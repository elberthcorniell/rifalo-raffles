-- Org billing: plans, Stripe ids, custom domain, monthly ticket quota

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
  ADD COLUMN IF NOT EXISTS custom_domain text;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_plan_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
    CHECK (plan IN ('free', 'plus', 'unlimited'));

CREATE UNIQUE INDEX IF NOT EXISTS organizations_custom_domain_unique
  ON public.organizations (lower(custom_domain))
  WHERE custom_domain IS NOT NULL AND btrim(custom_domain) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_customer_unique
  ON public.organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_subscription_unique
  ON public.organizations (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Monthly ticket quota helpers (America/Santo_Domingo calendar month)
-- Counts purchases.quantity where status IN ('pending','confirmed').
-- Rejected purchases free quota.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.org_plan_ticket_limit(p_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'free' THEN 250
    WHEN 'plus' THEN 50000
    WHEN 'unlimited' THEN NULL
    ELSE 250
  END;
$$;

CREATE OR REPLACE FUNCTION public.org_ticket_quota(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit integer;
  v_used integer;
  v_month_start timestamptz;
  v_month_end timestamptz;
BEGIN
  SELECT plan INTO v_plan
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  v_limit := public.org_plan_ticket_limit(v_plan);

  v_month_start :=
    date_trunc('month', timezone('America/Santo_Domingo', now()))
    AT TIME ZONE 'America/Santo_Domingo';
  v_month_end :=
    (date_trunc('month', timezone('America/Santo_Domingo', now())) + interval '1 month')
    AT TIME ZONE 'America/Santo_Domingo';

  SELECT coalesce(sum(p.quantity), 0)::integer
  INTO v_used
  FROM public.purchases p
  WHERE p.org_id = p_org_id
    AND p.status IN ('pending', 'confirmed')
    AND p.submitted_at >= v_month_start
    AND p.submitted_at < v_month_end;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'used', v_used,
    'limit', to_jsonb(v_limit),
    'remaining', CASE
      WHEN v_limit IS NULL THEN NULL
      ELSE greatest(v_limit - v_used, 0)
    END
  );
END;
$$;

-- Lock org row, re-check quota, raise if quantity would exceed limit.
CREATE OR REPLACE FUNCTION public.assert_org_ticket_quota(
  p_org_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota jsonb;
  v_limit integer;
  v_used integer;
  v_remaining integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  -- Serialize concurrent purchases for this org
  PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  v_quota := public.org_ticket_quota(p_org_id);
  v_limit := (v_quota ->> 'limit')::integer;
  v_used := (v_quota ->> 'used')::integer;

  IF v_limit IS NOT NULL AND (v_used + p_quantity) > v_limit THEN
    v_remaining := greatest(v_limit - v_used, 0);
    RAISE EXCEPTION 'TICKET_QUOTA_EXCEEDED:used=%,limit=%,remaining=%,requested=%',
      v_used, v_limit, v_remaining, p_quantity
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_quota;
END;
$$;

REVOKE ALL ON FUNCTION public.org_plan_ticket_limit(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.org_ticket_quota(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_org_ticket_quota(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.org_plan_ticket_limit(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_ticket_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_org_ticket_quota(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_ticket_quota(uuid) TO authenticated;
