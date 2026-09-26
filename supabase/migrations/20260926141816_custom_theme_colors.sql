-- Custom storefront theme: user-picked surface colors, in addition to light and dark.

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_theme_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_theme_check
  CHECK (theme IN ('light', 'dark', 'custom'));

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS theme_colors jsonb;
