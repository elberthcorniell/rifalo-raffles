import { cleanLine, renderSimpleEmail, type SimpleEmailContent } from '@/lib/emails/layout'

export type VerificationOutcome = 'verified' | 'rejected'

const SUBJECT: Record<VerificationOutcome, string> = {
  verified: 'Tu rifa fue verificada',
  rejected: 'Tu rifa fue rechazada',
}

export function buildVerificationEmail(input: {
  title: string
  panelUrl: string
  outcome: VerificationOutcome
  note?: string | null
}): SimpleEmailContent {
  const title = cleanLine(input.title) || 'tu rifa'
  const outcome = input.outcome === 'rejected' ? 'rejected' : 'verified'
  const paragraphs = [
    outcome === 'verified'
      ? `Ya revisamos ${title}. Quedó verificada.`
      : `Ya revisamos ${title}. Quedó rechazada.`,
  ]
  if (outcome === 'rejected') {
    paragraphs.push('Puedes corregirla y volver a solicitar la verificación desde tu panel.')
  }

  return renderSimpleEmail({
    subject: SUBJECT[outcome],
    preheader:
      outcome === 'verified'
        ? 'Ya revisamos tu solicitud.'
        : 'Revisa el motivo en este correo.',
    heading: outcome === 'verified' ? 'Tu rifa fue verificada' : 'Tu rifa fue rechazada',
    paragraphs,
    noteLabel: outcome === 'rejected' ? 'Motivo' : 'Nota',
    note: input.note,
    actionHref: input.panelUrl,
    actionLabel: 'Ir a mi panel',
  })
}
