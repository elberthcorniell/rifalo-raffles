-- Hide homepage sections independently of whether content exists.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS show_trust_benefits boolean NOT NULL DEFAULT true;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS show_testimonials boolean NOT NULL DEFAULT true;
