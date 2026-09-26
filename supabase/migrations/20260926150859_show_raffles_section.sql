-- Hide the active raffles block on the homepage without deleting raffles.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS show_raffles boolean NOT NULL DEFAULT true;
