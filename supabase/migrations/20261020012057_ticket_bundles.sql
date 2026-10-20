-- Ticket packages for a raffle. A bundle is a quantity sold at a special price.
-- Quantities without a bundle keep the raffle's per-ticket price.

CREATE TABLE public.ticket_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles (id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity >= 1),
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_bundles_raffle_quantity_unique UNIQUE (raffle_id, quantity)
);

ALTER TABLE public.ticket_bundles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_bundles TO authenticated, service_role;

-- Members manage bundles for their org. Public reads go through Next.js + service role.
CREATE POLICY ticket_bundles_member_all ON public.ticket_bundles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.raffles r
      WHERE r.id = ticket_bundles.raffle_id AND public.is_org_member(r.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.raffles r
      WHERE r.id = ticket_bundles.raffle_id AND public.is_org_member(r.org_id)
    )
  );
