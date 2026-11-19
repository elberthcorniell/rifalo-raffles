import { Resend } from 'resend'
import type { OutboundWelcomeEmail } from '@/lib/emails/welcome'

const MISSING_KEY_WARNING = 'RESEND_API_KEY is not configured. Skipping welcome email.'

export async function sendWithResend(
  message: OutboundWelcomeEmail,
  apiKey: string | null | undefined = process.env.RESEND_API_KEY,
): Promise<{ ok: boolean }> {
  const key = apiKey?.trim()
  if (!key) {
    console.warn(MISSING_KEY_WARNING)
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
      },
      { idempotencyKey: message.idempotencyKey },
    )
    if (error) {
      console.error('Welcome email was rejected', error.name)
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error('Welcome email failed', err)
    return { ok: false }
  }
}
