-- Storefront typefaces. Poppins stays the default for both headings and paragraphs.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS heading_font text NOT NULL DEFAULT 'Poppins';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS body_font text NOT NULL DEFAULT 'Poppins';
