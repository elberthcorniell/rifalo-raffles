-- Seed default org (cura) and its bank accounts
-- Org id matches migration backfill constant for local resets that re-run seed after migrations

INSERT INTO public.organizations (id, slug, name, tagline, email, admin_email, location, primary_color, secondary_color, onboarding_completed_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'cura',
  'Cura tu Suerte',
  'La plataforma de rifas más emocionante de República Dominicana. ¡Cura tu suerte con nosotros!',
  'info@curatusuerte.do',
  'info@curatusuerte.do',
  'República Dominicana',
  '#0B2447',
  '#1976D2',
  now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.bank_accounts (org_id, name, bank, account_number, account_type, currency, holder_name, cedula, is_active, sort_order)
SELECT o.id, v.name, v.bank, v.account_number, v.account_type, v.currency, v.holder_name, v.cedula, v.is_active, v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('BHD', 'Banco BHD', '40099180013', 'Cuenta de ahorros', 'DOP', 'Adilssa Santos', NULL::text, true, 1),
    ('Popular', 'Banco Popular', '836405746', 'Cuenta corriente', 'DOP', 'Adilssa Santos', NULL, true, 2),
    ('Banreservas', 'Banreservas', '9607543272', 'Cuenta corriente', 'DOP', 'Adilssa Santos', NULL, true, 3),
    ('Qik', 'Qik', '1000612991', 'Cuenta de ahorros', 'DOP', 'Adilssa Santos', NULL, true, 4),
    ('PayPal', 'PayPal', 'https://www.paypal.me/adilssasantos', 'PayPal', 'DOP', 'Adilssa Santos', NULL, true, 5),
    ('Cibao', 'Asociación Cibao', '100100256895', 'Cuenta de ahorros', 'DOP', 'Adilssa Santos', NULL, true, 6)
) AS v(name, bank, account_number, account_type, currency, holder_name, cedula, is_active, sort_order)
WHERE o.slug = 'cura'
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.org_id = o.id AND ba.account_number = v.account_number
  );
