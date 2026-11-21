import { isHttpUrl } from '@/lib/emails/layout'
import { buildVerificationEmail, type VerificationOutcome } from '@/lib/emails/verification-template'
import type { OutboundEmail } from '@/lib/emails/resend'
import { resolveEmailFrom } from '@/lib/emails/welcome'
import { normalizeRecipient } from '@/lib/emails/recipients'

const MISSING_KEY_WARNING = 'RESEND_API_KEY is not configured. Skipping verification email.'

export type VerificationSkip =
  | 'not_a_response'
  | 'no_request'
  | 'already_sent'
  | 'missing_api_key'
  | 'no_recipient'
  | 'no_panel'
  | 'send_failed'

export type VerificationDecision = {
  send: boolean
  skip: VerificationSkip | null
  requestKey: string | null
}

type Log = {
  warn: (message: string) => void
  error: (message: string, error?: unknown) => void
}

export function sameInstant(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) return false
  const a = Date.parse(left)
  const b = Date.parse(right)
  return Number.isFinite(a) && a === b
}

/**
 * One email per verification request. The key is the request timestamp, so a
 * later request (new verification_requested_at) can be emailed again.
 */
export function verificationSendDecision(input: {
  status: string | null | undefined
  requestedAt: string | null | undefined
  sentFor: string | null | undefined
  apiKey?: string | null
}): VerificationDecision {
  const status = input.status || ''
  if (status !== 'verified' && status !== 'rejected') {
    return { send: false, skip: 'not_a_response', requestKey: null }
  }

  const requestedAt = input.requestedAt?.trim()
  if (!requestedAt || !Number.isFinite(Date.parse(requestedAt))) {
    return { send: false, skip: 'no_request', requestKey: null }
  }

  if (sameInstant(input.sentFor, requestedAt)) {
    return { send: false, skip: 'already_sent', requestKey: requestedAt }
  }

  if (!input.apiKey?.trim()) {
    return { send: false, skip: 'missing_api_key', requestKey: requestedAt }
  }

  return { send: true, skip: null, requestKey: requestedAt }
}

export function verificationIdempotencyKey(
  raffleId: string,
  requestedAt: string,
  email: string,
): string {
  const stamp = Date.parse(requestedAt)
  const when = Number.isFinite(stamp) ? String(stamp) : 'request'
  const safeId = raffleId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  const safeEmail = email.toLowerCase().replace(/[^a-z0-9@._+-]/g, '')
  return `raffle-verification/${safeId}/${when}/${safeEmail}`.slice(0, 256)
}

export type DeliverVerificationInput = {
  raffleId: string
  title: string
  panelUrl: string
  status: string | null | undefined
  requestedAt: string | null | undefined
  sentFor: string | null | undefined
  note?: string | null
  apiKey?: string | null
  from?: string | null
  replyTo?: string | null
  loadRecipients: () => Promise<string[]>
  send: (message: OutboundEmail) => Promise<{ ok: boolean }>
  markSent: (requestedAt: string) => Promise<void>
  log?: Log
}

export async function deliverVerificationNotice(
  input: DeliverVerificationInput,
): Promise<{ ok: true; sent?: boolean; skipped?: VerificationSkip }> {
  const log = input.log ?? console
  const decision = verificationSendDecision({
    status: input.status,
    requestedAt: input.requestedAt,
    sentFor: input.sentFor,
    apiKey: input.apiKey,
  })

  if (!decision.send || !decision.requestKey) {
    if (decision.skip === 'missing_api_key') log.warn(MISSING_KEY_WARNING)
    return { ok: true, skipped: decision.skip ?? 'not_a_response' }
  }

  const panelUrl = isHttpUrl(input.panelUrl)
  if (!panelUrl) return { ok: true, skipped: 'no_panel' }

  let recipients: string[] = []
  try {
    recipients = (await input.loadRecipients())
      .map((email) => normalizeRecipient(email))
      .filter((email): email is string => Boolean(email))
  } catch (err) {
    log.error('Verification email could not load recipients', err)
    return { ok: true, skipped: 'no_recipient' }
  }

  const unique = [...new Set(recipients)]
  if (!unique.length) return { ok: true, skipped: 'no_recipient' }

  const outcome: VerificationOutcome = input.status === 'rejected' ? 'rejected' : 'verified'
  const content = buildVerificationEmail({
    title: input.title,
    panelUrl,
    outcome,
    note: input.note,
  })
  const replyTo = input.replyTo?.trim() || undefined
  const from = resolveEmailFrom(input.from)

  for (const to of unique) {
    try {
      const result = await input.send({
        to,
        from,
        replyTo,
        subject: content.subject,
        html: content.html,
        text: content.text,
        idempotencyKey: verificationIdempotencyKey(input.raffleId, decision.requestKey, to),
      })
      if (!result.ok) {
        log.error('Verification email was not accepted')
        return { ok: true, skipped: 'send_failed' }
      }
    } catch (err) {
      log.error('Verification email failed', err)
      return { ok: true, skipped: 'send_failed' }
    }
  }

  try {
    await input.markSent(decision.requestKey)
  } catch (err) {
    log.error('Verification email was sent but not recorded', err)
  }

  return { ok: true, sent: true }
}
