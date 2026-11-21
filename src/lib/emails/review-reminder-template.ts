import { renderSimpleEmail, type SimpleEmailContent } from '@/lib/emails/layout'

export function buildReviewReminderEmail(input: {
  pendingCount: number
  waitingHours: number
  panelUrl: string
}): SimpleEmailContent {
  const count = Math.max(1, Math.floor(input.pendingCount))
  const hours = Math.max(1, Math.floor(input.waitingHours))
  const purchases =
    count === 1
      ? 'Tienes 1 compra pendiente de revisar.'
      : `Tienes ${count} compras pendientes de revisar.`
  const wait =
    hours === 1
      ? 'La más antigua lleva al menos 1 hora esperando.'
      : `La más antigua lleva al menos ${hours} horas esperando.`

  return renderSimpleEmail({
    subject: 'Tienes compras por revisar',
    preheader: 'Hay compras esperando en tu panel.',
    heading: 'Tienes compras por revisar',
    paragraphs: [purchases, wait],
    actionHref: input.panelUrl,
    actionLabel: 'Revisar compras',
  })
}
