import { sendResendEmail } from '@/lib/emails/resend'
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

  return sendResendEmail(message, { apiKey: key, logLabel: 'Welcome email' })
}
