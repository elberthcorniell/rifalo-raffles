-- Org site appearance: light (claro) or dark (oscuro)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_theme_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_theme_check
    CHECK (theme IN ('light', 'dark'));
