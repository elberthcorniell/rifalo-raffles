import { NextResponse } from 'next/server'
import { loadWelcomeLinks } from '@/lib/emails/welcome-links'
import { sendWithResend } from '@/lib/emails/welcome-send'
import { handleWelcomeEmail, WELCOME_EMAIL_SENT_AT_KEY } from '@/lib/emails/welcome'
import { createClient } from '@/lib/supabase/server'

/**
 * Welcome mail for the raffle owner who just signed up.
 * The recipient is the Supabase session user. The body is not read.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    const apiKey = process.env.RESEND_API_KEY
    const result = await handleWelcomeEmail({
      user: error ? null : user,
      apiKey,
      from: process.env.EMAIL_FROM,
      replyTo: process.env.EMAIL_REPLY_TO,
      loadLinks: loadWelcomeLinks,
      markSent: async (sentAt) => {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { [WELCOME_EMAIL_SENT_AT_KEY]: sentAt },
        })
        if (updateError) throw updateError
      },
      send: (message) => sendWithResend(message, apiKey),
    })

    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    console.error('Welcome email failed', err)
    return NextResponse.json({ ok: true, skipped: 'error' })
  }
}
