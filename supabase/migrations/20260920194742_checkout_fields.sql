-- Per-org checkout fields (name + phone on by default)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS checkout_fields jsonb NOT NULL DEFAULT '{"name":true,"email":false,"phone":true}'::jsonb;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_checkout_fields_object;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_checkout_fields_object
  CHECK (jsonb_typeof(checkout_fields) = 'object');

ALTER TABLE public.customers
  ALTER COLUMN name DROP NOT NULL;

ALTER TABLE public.customers
  ALTER COLUMN whatsapp DROP NOT NULL;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_org_whatsapp_unique;

CREATE UNIQUE INDEX IF NOT EXISTS customers_org_whatsapp_unique
  ON public.customers (org_id, whatsapp)
  WHERE whatsapp IS NOT NULL AND btrim(whatsapp) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS customers_org_email_unique
  ON public.customers (org_id, email)
  WHERE email IS NOT NULL AND btrim(email) <> '';
