-- Verified raffles: clients request review; only service role (admin APIs) can change these fields.

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_note text;

ALTER TABLE public.raffles
  DROP CONSTRAINT IF EXISTS raffles_verification_status_check;

ALTER TABLE public.raffles
  ADD CONSTRAINT raffles_verification_status_check
  CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));

CREATE INDEX IF NOT EXISTS raffles_verification_status_idx
  ON public.raffles (verification_status);

CREATE OR REPLACE FUNCTION public.protect_raffle_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Org-member JWT updates cannot change verification fields.
  -- Next.js admin APIs use the service role and are allowed through.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.verification_status := OLD.verification_status;
  NEW.verification_requested_at := OLD.verification_requested_at;
  NEW.verification_reviewed_at := OLD.verification_reviewed_at;
  NEW.verification_note := OLD.verification_note;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS raffles_protect_verification ON public.raffles;

CREATE TRIGGER raffles_protect_verification
  BEFORE UPDATE ON public.raffles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_raffle_verification();
