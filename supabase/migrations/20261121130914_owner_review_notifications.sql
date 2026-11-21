-- Owner mail for a raffle verification response, and the clock for
-- pending-purchase reminders. Service role writes these. Org members cannot.

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS verification_response_email_for timestamptz;

COMMENT ON COLUMN public.raffles.verification_response_email_for IS
  'verification_requested_at of the response we already emailed. One mail per request.';

-- Decisions made before this column existed are treated as already notified.
-- Pending requests stay unmarked so the next response still sends.
-- The updated_at trigger is paused so this backfill does not look like an edit.
ALTER TABLE public.raffles DISABLE TRIGGER raffles_updated_at;

UPDATE public.raffles
SET verification_response_email_for = verification_requested_at
WHERE verification_status IN ('verified', 'rejected')
  AND verification_requested_at IS NOT NULL
  AND verification_response_email_for IS NULL;

ALTER TABLE public.raffles ENABLE TRIGGER raffles_updated_at;

-- Keep the sent marker aligned with the other verification fields: a member
-- JWT cannot set it. Service role (the admin API) still can.
CREATE OR REPLACE FUNCTION public.protect_raffle_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.verification_status := OLD.verification_status;
  NEW.verification_requested_at := OLD.verification_requested_at;
  NEW.verification_reviewed_at := OLD.verification_reviewed_at;
  NEW.verification_note := OLD.verification_note;
  NEW.verification_response_email_for := OLD.verification_response_email_for;
  RETURN NEW;
END;
$$;

CREATE TABLE public.org_review_reminders (
  org_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  queue_started_at timestamptz NOT NULL,
  last_step_hours integer NOT NULL DEFAULT 0
    CHECK (last_step_hours >= 0 AND last_step_hours <= 65536),
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.org_review_reminders IS
  'Backoff clock for pending purchase reviews. Deleted when the queue is empty so the next pending purchase starts again at 1 hour.';

ALTER TABLE public.org_review_reminders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.org_review_reminders FROM PUBLIC, anon, authenticated;

CREATE INDEX org_review_reminders_queue_started_idx
  ON public.org_review_reminders (queue_started_at);

CREATE INDEX purchases_org_pending_submitted_idx
  ON public.purchases (org_id, submitted_at)
  WHERE status = 'pending';

CREATE TRIGGER org_review_reminders_updated_at
  BEFORE UPDATE ON public.org_review_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Purchases are writable by org members, so this cannot rely on the caller's
-- grants. It only mirrors the pending queue into the reminder clock.
CREATE OR REPLACE FUNCTION private.refresh_org_review_reminder(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_oldest timestamptz;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT min(submitted_at)
  INTO v_oldest
  FROM public.purchases
  WHERE org_id = p_org_id
    AND status = 'pending';

  IF v_oldest IS NULL THEN
    DELETE FROM public.org_review_reminders
    WHERE org_id = p_org_id;
    RETURN;
  END IF;

  -- Keep queue_started_at and last_step_hours while anything is still pending.
  -- A new row is inserted only after the queue has been empty.
  INSERT INTO public.org_review_reminders (org_id, queue_started_at)
  VALUES (p_org_id, v_oldest)
  ON CONFLICT (org_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_org_review_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.org_id IS DISTINCT FROM NEW.org_id THEN
    PERFORM private.refresh_org_review_reminder(OLD.org_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM private.refresh_org_review_reminder(OLD.org_id);
  ELSE
    PERFORM private.refresh_org_review_reminder(NEW.org_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS purchases_sync_review_reminder ON public.purchases;

CREATE TRIGGER purchases_sync_review_reminder
  AFTER INSERT OR DELETE OR UPDATE OF status, org_id, submitted_at
  ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_org_review_reminder();

-- The helper stays callable by the trigger owner. private is not an API schema.
REVOKE ALL ON FUNCTION private.sync_org_review_reminder() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sync_org_review_reminder() TO authenticated, service_role;

-- Orgs that already have purchases waiting get a clock from the oldest one.
INSERT INTO public.org_review_reminders (org_id, queue_started_at)
SELECT org_id, min(submitted_at)
FROM public.purchases
WHERE status = 'pending'
GROUP BY org_id
ON CONFLICT (org_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.maintain_review_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.org_review_reminders AS reminder
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.purchases AS purchase
    WHERE purchase.org_id = reminder.org_id
      AND purchase.status = 'pending'
  );

  INSERT INTO public.org_review_reminders (org_id, queue_started_at)
  SELECT purchase.org_id, min(purchase.submitted_at)
  FROM public.purchases AS purchase
  WHERE purchase.status = 'pending'
  GROUP BY purchase.org_id
  ON CONFLICT (org_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_reminder_candidates(p_limit integer)
RETURNS TABLE (
  org_id uuid,
  slug text,
  admin_email text,
  email text,
  queue_started_at timestamptz,
  last_step_hours integer,
  pending_count bigint,
  oldest_submitted_at timestamptz
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    reminder.org_id,
    org.slug,
    org.admin_email,
    org.email,
    reminder.queue_started_at,
    reminder.last_step_hours,
    pending.pending_count,
    pending.oldest_submitted_at
  FROM public.org_review_reminders AS reminder
  JOIN public.organizations AS org ON org.id = reminder.org_id
  JOIN LATERAL (
    SELECT
      count(*)::bigint AS pending_count,
      min(purchase.submitted_at) AS oldest_submitted_at
    FROM public.purchases AS purchase
    WHERE purchase.org_id = reminder.org_id
      AND purchase.status = 'pending'
  ) AS pending ON true
  WHERE pending.pending_count > 0
    AND org.slug IS NOT NULL
    AND reminder.last_step_hours < 65536
    AND reminder.queue_started_at <= now() - make_interval(
      hours => CASE
        WHEN reminder.last_step_hours < 1 THEN 1
        ELSE reminder.last_step_hours * 2
      END
    )
  ORDER BY reminder.queue_started_at
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.claim_review_reminder(
  p_org_id uuid,
  p_queue_started_at timestamptz,
  p_previous_step integer,
  p_step integer,
  p_sent_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_step IS NULL OR p_previous_step IS NULL OR p_step <= p_previous_step OR p_step < 1 OR p_step > 65536 THEN
    RETURN false;
  END IF;

  UPDATE public.org_review_reminders
  SET
    last_step_hours = p_step,
    last_sent_at = p_sent_at,
    updated_at = p_sent_at
  WHERE org_id = p_org_id
    AND queue_started_at = p_queue_started_at
    AND last_step_hours = p_previous_step;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_review_reminder(
  p_org_id uuid,
  p_queue_started_at timestamptz,
  p_previous_step integer,
  p_step integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.org_review_reminders
  SET
    last_step_hours = p_previous_step,
    last_sent_at = NULL,
    updated_at = now()
  WHERE org_id = p_org_id
    AND queue_started_at = p_queue_started_at
    AND last_step_hours = p_step;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_verification_email_sent(
  p_raffle_id uuid,
  p_requested_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.raffles
  SET verification_response_email_for = verification_requested_at
  WHERE id = p_raffle_id
    AND verification_requested_at = p_requested_at
    AND verification_status IN ('verified', 'rejected')
    AND verification_response_email_for IS DISTINCT FROM verification_requested_at;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.unsent_verification_responses(p_limit integer)
RETURNS TABLE (
  id uuid,
  title text,
  org_id uuid,
  verification_status text,
  verification_requested_at timestamptz,
  verification_note text,
  verification_response_email_for timestamptz
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    raffle.id,
    raffle.title,
    raffle.org_id,
    raffle.verification_status,
    raffle.verification_requested_at,
    raffle.verification_note,
    raffle.verification_response_email_for
  FROM public.raffles AS raffle
  WHERE raffle.verification_status IN ('verified', 'rejected')
    AND raffle.verification_requested_at IS NOT NULL
    AND raffle.verification_reviewed_at >= now() - interval '2 days'
    AND raffle.verification_response_email_for IS DISTINCT FROM raffle.verification_requested_at
  ORDER BY raffle.verification_reviewed_at
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.maintain_review_reminders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unsent_verification_responses(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_reminder_candidates(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_review_reminder(uuid, timestamptz, integer, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_review_reminder(uuid, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_verification_email_sent(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.maintain_review_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.unsent_verification_responses(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_reminder_candidates(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_review_reminder(uuid, timestamptz, integer, integer, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_review_reminder(uuid, timestamptz, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_verification_email_sent(uuid, timestamptz) TO service_role;
