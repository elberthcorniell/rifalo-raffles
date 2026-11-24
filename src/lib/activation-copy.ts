/** Default Spanish copy for the organizer activation broadcast and day-1 mail. */
export const ACTIVATION_DAY1_SUBJECT = 'Organizador, así se vende tu primer boleto'

export const ACTIVATION_DAY1_BODY = `Hola, {{{contact.first_name|organizador}}}.

Tu rifa ya está creada. Lo único que falta para que venda es que la gente la vea. Haz esto hoy:

1. Pon tu link en la bio de Instagram.
2. Mándaselo a 10 personas que ya te conocen. Abajo te dejo el mensaje listo.
3. Súbelo a tu status esta noche, que es cuando más se compra.

Copia y pega este mensaje:

"¡Hola! Estoy haciendo una rifa de [premio]. Compra tu boleto aquí: {{{raffle_link}}}. Pagas por transferencia, subes tu comprobante y ahí mismo te sale tu número. Lo revisas cuando quieras con tu WhatsApp."

Cuando te llegue un comprobante, apruébalo rápido. Eso le da confianza al que compra.`

export const ACTIVATION_DAY3_SUBJECT =
  '{{{contact.first_name|organizador}}}, ¿ya le mandaste tu link a tus primeros 10?'

export const ACTIVATION_DAY3_BODY = `Hola, {{{contact.first_name|organizador}}}.

Tu rifa sigue esperando su primer boleto. Casi siempre lo compra alguien que ya te conoce, así que el paso más fácil es este: manda tu link hoy a 10 personas cercanas y súbelo a tu status esta noche.

Aquí tienes otra vez el mensaje listo:

"¡Hola! Estoy haciendo una rifa de [premio]. Compra tu boleto aquí: {{{raffle_link}}}. Pagas por transferencia, subes tu comprobante y ahí mismo te sale tu número. Lo revisas cuando quieras con tu WhatsApp."

¿Te falta algo para compartirla? Responde este email y te ayudamos a dejarla lista.`

export const ACTIVATION_PREVIEW = {
  firstName: 'Ana',
  raffleLink: 'https://ana.rifalo.do',
} as const

export const ACTIVATION_BUTTON_LABEL = 'Ver mi rifa'

/** Flags copy that compares money or states a raffle date or a ticket inventory count. */
export function activationCopyIssues(text: string): string[] {
  const issues: string[] = []
  if (/\$\s*\d|\d+\s*(dólares|pesos|usd)/i.test(text)) issues.push('price')
  if (/vale\s+más|más\s+barat/i.test(text)) issues.push('comparison')
  if (/\b\d+\s+boletos?\b/i.test(text)) issues.push('ticket_count')
  if (
    /\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(
      text,
    )
  ) {
    issues.push('date')
  }
  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(text)) issues.push('date')
  return issues
}
