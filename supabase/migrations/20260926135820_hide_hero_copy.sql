-- Hide the homepage hero intro (name, tagline, buttons, stats) and show only the featured raffle.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS show_hero_copy boolean NOT NULL DEFAULT true;
