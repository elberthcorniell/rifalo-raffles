-- Referral links: a phone number gets a code. When a purchase made
-- through that link is confirmed, the referrer receives a fixed number
-- of tickets configured on the raffle.

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS referral_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_reward_tickets integer NOT NULL DEFAULT 1;

ALTER TABLE public.raffles
  DROP CONSTRAINT IF EXISTS raffles_referral_reward_tickets_check;

ALTER TABLE public.raffles
  ADD CONSTRAINT raffles_referral_reward_tickets_check
  CHECK (referral_reward_tickets >= 1 AND referral_reward_tickets <= 100);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  raffle_id uuid NOT NULL REFERENCES public.raffles (id) ON DELETE CASCADE,
  phone text NOT NULL,
  phone_key text NOT NULL,
  code text NOT NULL,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_phone_not_blank CHECK (btrim(phone) <> ''),
  CONSTRAINT referrals_phone_key_digits CHECK (phone_key ~ '^[0-9]{10,15}$'),
  CONSTRAINT referrals_code_format CHECK (code ~ '^[a-z0-9]{8}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS referrals_raffle_phone_key_unique
  ON public.referrals (raffle_id, phone_key);

CREATE UNIQUE INDEX IF NOT EXISTS referrals_code_unique
  ON public.referrals (code);

CREATE INDEX IF NOT EXISTS referrals_raffle_idx
  ON public.referrals (raffle_id);

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.referrals (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_source_purchase_id uuid REFERENCES public.purchases (id) ON DELETE SET NULL;

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_kind_check;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_kind_check
  CHECK (kind IN ('paid', 'referral_reward'));

ALTER TABLE public.purchases
  ALTER COLUMN bank_account_id DROP NOT NULL,
  ALTER COLUMN voucher_path DROP NOT NULL;

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_paid_requires_payment;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_paid_requires_payment
  CHECK (
    kind = 'referral_reward'
    OR (bank_account_id IS NOT NULL AND voucher_path IS NOT NULL AND btrim(voucher_path) <> '')
  );

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_reward_shape;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_reward_shape
  CHECK (
    kind = 'paid'
    OR (kind = 'referral_reward' AND total_amount = 0)
  );

CREATE UNIQUE INDEX IF NOT EXISTS purchases_one_reward_per_source
  ON public.purchases (reward_source_purchase_id)
  WHERE reward_source_purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchases_referral_idx
  ON public.purchases (referral_id)
  WHERE referral_id IS NOT NULL;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referrals_member_all ON public.referrals;

CREATE POLICY referrals_member_all ON public.referrals
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Award referral tickets when a paid purchase is confirmed.
-- Failures here must not undo the payment confirmation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.award_referral_reward(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_org_id uuid;
  v_raffle_id uuid;
  v_customer_id uuid;
  v_referral_id uuid;
  v_kind text;
  v_enabled boolean;
  v_reward integer;
  v_referrer_phone text;
  v_referrer_digits text;
  v_buyer_digits text;
  v_referrer_customer_id uuid;
  v_available integer;
  v_quota jsonb;
  v_limit integer;
  v_used integer;
  v_award integer;
  v_reward_purchase_id uuid;
BEGIN
  SELECT org_id, raffle_id, customer_id, referral_id, kind
  INTO v_org_id, v_raffle_id, v_customer_id, v_referral_id, v_kind
  FROM public.purchases
  WHERE id = p_purchase_id;

  IF v_referral_id IS NULL OR v_kind IS DISTINCT FROM 'paid' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.purchases
    WHERE reward_source_purchase_id = p_purchase_id
  ) THEN
    RETURN;
  END IF;

  SELECT referral_enabled, referral_reward_tickets
  INTO v_enabled, v_reward
  FROM public.raffles
  WHERE id = v_raffle_id;

  IF v_enabled IS NOT TRUE OR v_reward IS NULL OR v_reward < 1 THEN
    RETURN;
  END IF;

  SELECT phone, customer_id
  INTO v_referrer_phone, v_referrer_customer_id
  FROM public.referrals
  WHERE id = v_referral_id
    AND raffle_id = v_raffle_id
    AND org_id = v_org_id;

  IF v_referrer_phone IS NULL THEN
    RETURN;
  END IF;

  v_referrer_digits := regexp_replace(v_referrer_phone, '\D', '', 'g');

  SELECT regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g')
  INTO v_buyer_digits
  FROM public.customers
  WHERE id = v_customer_id;

  IF coalesce(v_buyer_digits, '') <> '' AND v_referrer_digits <> '' THEN
    IF v_buyer_digits = v_referrer_digits
       OR (
         length(v_buyer_digits) >= 10
         AND length(v_referrer_digits) >= 10
         AND right(v_buyer_digits, 10) = right(v_referrer_digits, 10)
       )
    THEN
      RETURN;
    END IF;
  END IF;

  BEGIN
    PERFORM 1 FROM public.organizations WHERE id = v_org_id FOR UPDATE;

    IF v_referrer_customer_id IS NULL THEN
      SELECT c.id
      INTO v_referrer_customer_id
      FROM public.customers c
      WHERE c.org_id = v_org_id
        AND c.whatsapp IS NOT NULL
        AND (
          regexp_replace(c.whatsapp, '\D', '', 'g') = v_referrer_digits
          OR (
            length(v_referrer_digits) >= 10
            AND length(regexp_replace(c.whatsapp, '\D', '', 'g')) >= 10
            AND right(regexp_replace(c.whatsapp, '\D', '', 'g'), 10) = right(v_referrer_digits, 10)
          )
        )
      ORDER BY CASE
        WHEN regexp_replace(c.whatsapp, '\D', '', 'g') = v_referrer_digits THEN 0
        ELSE 1
      END
      LIMIT 1;
    END IF;

    IF v_referrer_customer_id IS NULL THEN
      INSERT INTO public.customers (org_id, name, whatsapp)
      VALUES (v_org_id, 'Referidor', v_referrer_phone)
      ON CONFLICT (org_id, whatsapp)
        WHERE whatsapp IS NOT NULL AND btrim(whatsapp) <> ''
      DO UPDATE SET whatsapp = EXCLUDED.whatsapp
      RETURNING id INTO v_referrer_customer_id;
    END IF;

    UPDATE public.referrals
    SET customer_id = v_referrer_customer_id
    WHERE id = v_referral_id
      AND customer_id IS NULL;

    SELECT count(*)::integer
    INTO v_available
    FROM public.tickets
    WHERE raffle_id = v_raffle_id
      AND status = 'available';

    v_award := least(v_reward, coalesce(v_available, 0));

    v_quota := public.org_ticket_quota(v_org_id);
    IF v_quota->>'limit' IS NOT NULL THEN
      v_limit := (v_quota->>'limit')::integer;
      v_used := coalesce((v_quota->>'used')::integer, 0);
      v_award := least(v_award, greatest(coalesce(v_limit, 0) - v_used, 0));
    END IF;

    IF v_award < 1 THEN
      RETURN;
    END IF;

    INSERT INTO public.purchases (
      org_id,
      customer_id,
      raffle_id,
      bank_account_id,
      quantity,
      total_amount,
      status,
      voucher_path,
      reviewed_at,
      notes,
      kind,
      referral_id,
      reward_source_purchase_id
    ) VALUES (
      v_org_id,
      v_referrer_customer_id,
      v_raffle_id,
      NULL,
      v_award,
      0,
      'confirmed',
      NULL,
      now(),
      'Boletos por referido',
      'referral_reward',
      v_referral_id,
      p_purchase_id
    )
    RETURNING id INTO v_reward_purchase_id;

    PERFORM private.assign_random_tickets(v_raffle_id, v_award, v_reward_purchase_id);

    UPDATE public.tickets
    SET status = 'sold'
    WHERE purchase_id = v_reward_purchase_id
      AND status = 'reserved';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Referral reward skipped for purchase %: %', p_purchase_id, SQLERRM;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION private.confirm_purchase(
  p_purchase_id uuid,
  p_reviewed_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Purchase is not pending (status=%)', v_status;
  END IF;

  UPDATE public.purchases
  SET status = 'confirmed',
      reviewed_at = now(),
      reviewed_by = p_reviewed_by
  WHERE id = p_purchase_id;

  UPDATE public.tickets
  SET status = 'sold'
  WHERE purchase_id = p_purchase_id
    AND status = 'reserved';

  PERFORM private.award_referral_reward(p_purchase_id);
END;
$$;
