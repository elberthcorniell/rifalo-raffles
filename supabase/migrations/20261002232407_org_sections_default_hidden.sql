-- New organizations start with every public homepage section hidden.
-- Existing organizations keep their current values.

ALTER TABLE public.organizations
  ALTER COLUMN show_hero_copy SET DEFAULT false;

ALTER TABLE public.organizations
  ALTER COLUMN show_how_it_works SET DEFAULT false;

ALTER TABLE public.organizations
  ALTER COLUMN show_raffles SET DEFAULT false;

ALTER TABLE public.organizations
  ALTER COLUMN show_trust_benefits SET DEFAULT false;

ALTER TABLE public.organizations
  ALTER COLUMN show_testimonials SET DEFAULT false;
