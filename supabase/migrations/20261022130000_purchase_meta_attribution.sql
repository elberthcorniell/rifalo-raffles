-- Click and browser context captured when a buyer submits a voucher on
-- rifalo.do. Used later to send the Purchase event to Meta after an admin
-- confirms the payment. Customer domains do not write these columns.

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS meta_fbp text,
  ADD COLUMN IF NOT EXISTS meta_fbc text,
  ADD COLUMN IF NOT EXISTS meta_client_ip text,
  ADD COLUMN IF NOT EXISTS meta_client_user_agent text,
  ADD COLUMN IF NOT EXISTS meta_event_source_url text;
