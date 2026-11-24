import { Resend } from 'resend'

export type OutboundEmail = {
  to: string
  from: string
  replyTo?: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
  headers?: Record<string, string>
}

/**
 * Shared Resend send. A missing key returns { ok: false } and does not call Resend.
 * Callers decide whether that skip is success for the user-facing action.
 */
export async function sendResendEmail(
  message: OutboundEmail,
  options?: {
    apiKey?: string | null
    logLabel?: string
  },
): Promise<{ ok: boolean }> {
  const label = options?.logLabel ?? 'Email'
  const key = options?.apiKey?.trim()
  if (!key) {
    console.warn('RESEND_API_KEY is not configured. Skipping email.')
    return { ok: false }
  }

  try {
    const resend = new Resend(key)
    const { error } = await resend.emails.send(
      {
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        ...(message.headers ? { headers: message.headers } : {}),
      },
      { idempotencyKey: message.idempotencyKey },
    )
    if (error) {
      console.error(`${label} was rejected`, error.name)
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error(`${label} failed`, err)
    return { ok: false }
  }
}
