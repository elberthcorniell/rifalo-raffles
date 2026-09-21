-- Org-managed testimonials for the public storefront

CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  quote text NOT NULL,
  rating integer NOT NULL DEFAULT 5
    CHECK (rating >= 1 AND rating <= 5),
  role_label text NOT NULL DEFAULT 'Ganador verificado',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX testimonials_org_idx ON public.testimonials (org_id);
CREATE INDEX testimonials_org_active_sort_idx
  ON public.testimonials (org_id, is_active, sort_order);

CREATE TRIGGER testimonials_updated_at BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY testimonials_member_select ON public.testimonials
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY testimonials_member_insert ON public.testimonials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));

CREATE POLICY testimonials_member_update ON public.testimonials
  FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE POLICY testimonials_member_delete ON public.testimonials
  FOR DELETE TO authenticated
  USING (public.is_org_member(org_id));

-- Seed Cura with the previous hardcoded testimonials
INSERT INTO public.testimonials (org_id, name, quote, rating, role_label, sort_order)
SELECT
  o.id,
  v.name,
  v.quote,
  v.rating,
  'Ganador verificado',
  v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    (
      'María G.',
      '¡No podía creerlo cuando me llamaron! Gané un iPhone con solo 2 boletos. El proceso fue súper fácil y transparente.',
      5,
      1
    ),
    (
      'Carlos R.',
      'Llevo participando varios meses y la experiencia siempre ha sido excelente. Los sorteos en vivo te dan total confianza.',
      5,
      2
    ),
    (
      'Ana P.',
      'Me encanta que puedo verificar mis boletos en cualquier momento. El soporte por WhatsApp es rapidísimo. ¡Muy recomendado!',
      5,
      3
    )
) AS v(name, quote, rating, sort_order)
WHERE o.slug = 'cura';
