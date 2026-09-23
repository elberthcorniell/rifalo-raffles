-- Superadmin can overwrite the effective plan without changing the purchased Stripe plan.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_override text;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_plan_override_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_override_check
    CHECK (plan_override IS NULL OR plan_override IN ('free', 'plus', 'unlimited'));

CREATE OR REPLACE FUNCTION public.org_effective_plan(p_plan text, p_override text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_override IN ('free', 'plus', 'unlimited') THEN p_override
    WHEN p_plan IN ('free', 'plus', 'unlimited') THEN p_plan
    ELSE 'free'
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
  SELECT public.org_effective_plan(plan, plan_override) INTO v_plan
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

REVOKE ALL ON FUNCTION public.org_effective_plan(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_effective_plan(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_ticket_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_ticket_quota(uuid) TO authenticated;
