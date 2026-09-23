-- Batch stats for the superadmin org list (current Santo Domingo month).
-- One grouped pass per page instead of N org_ticket_quota() calls.

CREATE INDEX IF NOT EXISTS purchases_org_period_idx
  ON public.purchases (org_id, submitted_at)
  WHERE status IN ('pending', 'confirmed');

CREATE OR REPLACE FUNCTION public.superadmin_org_period_stats(p_org_ids uuid[])
RETURNS TABLE (
  org_id uuid,
  raffle_count integer,
  member_count integer,
  tickets_used integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_bounds AS (
    SELECT
      date_trunc('month', timezone('America/Santo_Domingo', now()))
        AT TIME ZONE 'America/Santo_Domingo' AS month_start,
      (date_trunc('month', timezone('America/Santo_Domingo', now())) + interval '1 month')
        AT TIME ZONE 'America/Santo_Domingo' AS month_end
  )
  SELECT
    o.id,
    coalesce(r.cnt, 0)::integer,
    coalesce(m.cnt, 0)::integer,
    coalesce(p.used, 0)::integer
  FROM unnest(p_org_ids) AS o(id)
  LEFT JOIN (
    SELECT raffles.org_id, count(*)::integer AS cnt
    FROM public.raffles
    WHERE raffles.org_id = ANY (p_org_ids)
    GROUP BY raffles.org_id
  ) r ON r.org_id = o.id
  LEFT JOIN (
    SELECT org_members.org_id, count(*)::integer AS cnt
    FROM public.org_members
    WHERE org_members.org_id = ANY (p_org_ids)
    GROUP BY org_members.org_id
  ) m ON m.org_id = o.id
  LEFT JOIN (
    SELECT purchases.org_id, coalesce(sum(purchases.quantity), 0)::integer AS used
    FROM public.purchases, month_bounds
    WHERE purchases.org_id = ANY (p_org_ids)
      AND purchases.status IN ('pending', 'confirmed')
      AND purchases.submitted_at >= month_bounds.month_start
      AND purchases.submitted_at < month_bounds.month_end
    GROUP BY purchases.org_id
  ) p ON p.org_id = o.id;
$$;

REVOKE ALL ON FUNCTION public.superadmin_org_period_stats(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_org_period_stats(uuid[]) TO service_role;
