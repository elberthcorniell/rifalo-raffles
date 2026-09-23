-- Ticket totals for one page of superadmin raffles.
-- One grouped count instead of loading every ticket row.

CREATE OR REPLACE FUNCTION public.superadmin_raffle_ticket_counts(p_raffle_ids uuid[])
RETURNS TABLE (
  raffle_id uuid,
  total integer,
  taken integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.raffle_id,
    count(*)::integer AS total,
    count(*) FILTER (WHERE t.status <> 'available')::integer AS taken
  FROM public.tickets t
  WHERE t.raffle_id = ANY (p_raffle_ids)
  GROUP BY t.raffle_id;
$$;

REVOKE ALL ON FUNCTION public.superadmin_raffle_ticket_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_raffle_ticket_counts(uuid[]) TO service_role;
