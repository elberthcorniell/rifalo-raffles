-- Organizer activation: editable day-1/day-3 copy, an off-by-default
-- switch, and one row per address and step so the daily cron does not
-- send the same mail twice. Service role only.

CREATE TABLE public.organizer_activation_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  day1_subject text NOT NULL,
  day1_body text NOT NULL,
  day3_subject text NOT NULL,
  day3_body text NOT NULL,
  broadcast_subject text NOT NULL,
  broadcast_body text NOT NULL,
  broadcast_segment text NOT NULL DEFAULT 'no_sales',
  resend_broadcast_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizer_activation_settings_segment_check
    CHECK (broadcast_segment IN ('no_sales', 'organizers'))
);

INSERT INTO public.organizer_activation_settings (
  id,
  enabled,
  day1_subject,
  day1_body,
  day3_subject,
  day3_body,
  broadcast_subject,
  broadcast_body,
  broadcast_segment
) VALUES (
  1,
  false,
  'Organizador, así se vende tu primer boleto',
  $body$Hola, {{{contact.first_name|organizador}}}.

Tu rifa ya está creada. Lo único que falta para que venda es que la gente la vea. Haz esto hoy:

1. Pon tu link en la bio de Instagram.
2. Mándaselo a 10 personas que ya te conocen. Abajo te dejo el mensaje listo.
3. Súbelo a tu status esta noche, que es cuando más se compra.

Copia y pega este mensaje:

"¡Hola! Estoy haciendo una rifa de [premio]. Compra tu boleto aquí: {{{raffle_link}}}. Pagas por transferencia, subes tu comprobante y ahí mismo te sale tu número. Lo revisas cuando quieras con tu WhatsApp."

Cuando te llegue un comprobante, apruébalo rápido. Eso le da confianza al que compra.$body$,
  '{{{contact.first_name|organizador}}}, ¿ya le mandaste tu link a tus primeros 10?',
  $body3$Hola, {{{contact.first_name|organizador}}}.

Tu rifa sigue esperando su primer boleto. Casi siempre lo compra alguien que ya te conoce, así que el paso más fácil es este: manda tu link hoy a 10 personas cercanas y súbelo a tu status esta noche.

Aquí tienes otra vez el mensaje listo:

"¡Hola! Estoy haciendo una rifa de [premio]. Compra tu boleto aquí: {{{raffle_link}}}. Pagas por transferencia, subes tu comprobante y ahí mismo te sale tu número. Lo revisas cuando quieras con tu WhatsApp."

¿Te falta algo para compartirla? Responde este email y te ayudamos a dejarla lista.$body3$,
  'Organizador, así se vende tu primer boleto',
  $body$Hola, {{{contact.first_name|organizador}}}.

Tu rifa ya está creada. Lo único que falta para que venda es que la gente la vea. Haz esto hoy:

1. Pon tu link en la bio de Instagram.
2. Mándaselo a 10 personas que ya te conocen. Abajo te dejo el mensaje listo.
3. Súbelo a tu status esta noche, que es cuando más se compra.

Copia y pega este mensaje:

"¡Hola! Estoy haciendo una rifa de [premio]. Compra tu boleto aquí: {{{raffle_link}}}. Pagas por transferencia, subes tu comprobante y ahí mismo te sale tu número. Lo revisas cuando quieras con tu WhatsApp."

Cuando te llegue un comprobante, apruébalo rápido. Eso le da confianza al que compra.$body$,
  'no_sales'
);

CREATE TABLE public.organizer_activation_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  error text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizer_activation_sends_kind_check
    CHECK (kind IN ('day1', 'day3')),
  CONSTRAINT organizer_activation_sends_status_check
    CHECK (status IN ('pending', 'sent', 'failed')),
  CONSTRAINT organizer_activation_sends_email_check
    CHECK (email = lower(email) AND position('@' in email) > 1)
);

CREATE UNIQUE INDEX organizer_activation_sends_email_kind_uidx
  ON public.organizer_activation_sends (email, kind);

ALTER TABLE public.organizer_activation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_activation_sends ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.organizer_activation_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organizer_activation_sends FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.organizer_activation_settings TO service_role;
GRANT ALL ON public.organizer_activation_sends TO service_role;

ALTER TABLE public.blog_email_campaigns
  DROP CONSTRAINT blog_email_campaigns_audience_check;

ALTER TABLE public.blog_email_campaigns
  ADD CONSTRAINT blog_email_campaigns_audience_check
  CHECK (audience IN ('all', 'published', 'paying', 'free', 'no_sales', 'test'));
