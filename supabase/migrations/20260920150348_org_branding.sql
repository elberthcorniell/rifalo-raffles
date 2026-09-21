-- Org branding: colors, location, social links

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#0B2447',
  ADD COLUMN IF NOT EXISTS secondary_color text NOT NULL DEFAULT '#1976D2',
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS twitter_url text;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_primary_color_hex
    CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT organizations_secondary_color_hex
    CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$');

UPDATE public.organizations
SET location = 'República Dominicana'
WHERE slug = 'cura' AND location IS NULL;
