-- Optional homepage section and independent footer colors.
-- Null footer colors keep the previous look: primary background and readable text.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS show_how_it_works boolean NOT NULL DEFAULT true;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS footer_bg_color text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS footer_text_color text;
