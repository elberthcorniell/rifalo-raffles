import { buildWelcomeEmail } from '@/lib/emails/welcome-template'

export const DEFAULT_EMAIL_FROM = 'Rifalo <hola@rifalo.do>'
export const WELCOME_EMAIL_SENT_AT_KEY = 'welcome_email_sent_at'
/** A welcome mail is only for an account created in this window. */
export const WELCOME_EMAIL_MAX_AGE_MS = 24 * 60 * 60 * 1000
const CLOCK_SKEW_MS = 5 * 60 * 1000

const MISSING_KEY_WARNING = 'RESEND_API_KEY is not configured. Skipping welcome email.'

export type WelcomeAuthUser = {
  id: string
  email?: string | null
  created_at?: string | null
  user_metadata?: { [key: string]: unknown } | null
}

export type WelcomeLinks = {
  raffleTitle: string
  raffleUrl: string
  panelUrl: string
  posterUrl?: string | null
}

export type OutboundWelcomeEmail = {
  to: string
  from: string
  replyTo?: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}

export type WelcomeEmailResult = {
  status: number
  body: {
    ok: boolean
    sent?: boolean
    skipped?: string
    error?: string
  }
}

type WelcomeLog = {
  warn: (message: string) => void
  error: (message: string, error?: unknown) => void
}

export type HandleWelcomeInput = {
  /** Session user from Supabase. Never an address taken from the request body. */
  user: WelcomeAuthUser | null
  apiKey?: string | null
  from?: string | null
  replyTo?: string | null
  now?: Date
  loadLinks: (userId: string) => Promise<WelcomeLinks | null>
  markSent: (sentAt: string) => Promise<void>
  send: (message: OutboundWelcomeEmail) => Promise<{ ok: boolean }>
  log?: WelcomeLog
}

export function resolveEmailFrom(value: string | null | undefined): string {
  const from = value?.trim()
  return from || DEFAULT_EMAIL_FROM
}

export function welcomeEmailAlreadySent(
  metadata: { [key: string]: unknown } | null | undefined,
): boolean {
  const value = metadata?.[WELCOME_EMAIL_SENT_AT_KEY]
  return typeof value === 'string' && value.trim().length > 0
}

export function isRecentSignup(
  createdAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!createdAt) return false
  const created = Date.parse(createdAt)
  if (!Number.isFinite(created)) return false
  const age = now.getTime() - created
  return age >= -CLOCK_SKEW_MS && age <= WELCOME_EMAIL_MAX_AGE_MS
}

export function welcomeIdempotencyKey(userId: string): string {
  const safe = userId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  return `welcome/${safe}`
}

/**
 * Decides whether to send. The caller has already resolved the session user.
 * Failures stay on this result so signup can ignore them.
 */
export async function handleWelcomeEmail(input: HandleWelcomeInput): Promise<WelcomeEmailResult> {
  const log = input.log ?? console
  const user = input.user
  if (!user?.id) {
    return { status: 401, body: { ok: false, error: 'unauthorized' } }
  }

  if (welcomeEmailAlreadySent(user.user_metadata)) {
    return { status: 200, body: { ok: true, skipped: 'already_sent' } }
  }

  if (!input.apiKey?.trim()) {
    log.warn(MISSING_KEY_WARNING)
    return { status: 200, body: { ok: true, skipped: 'missing_api_key' } }
  }

  if (!isRecentSignup(user.created_at, input.now)) {
    return { status: 200, body: { ok: true, skipped: 'not_new_signup' } }
  }

  const to = normalizeEmail(user.email)
  if (!to) {
    return { status: 200, body: { ok: true, skipped: 'no_email' } }
  }

  let links: WelcomeLinks | null = null
  try {
    links = await input.loadLinks(user.id)
  } catch (err) {
    log.error('Welcome email could not load the raffle', err)
    return { status: 200, body: { ok: true, skipped: 'no_raffle' } }
  }

  const raffleTitle = links?.raffleTitle?.trim()
  const raffleUrl = links?.raffleUrl?.trim()
  const panelUrl = links?.panelUrl?.trim()
  if (!raffleTitle || !raffleUrl || !panelUrl) {
    return { status: 200, body: { ok: true, skipped: 'no_raffle' } }
  }

  const content = buildWelcomeEmail({
    raffleTitle,
    raffleUrl,
    panelUrl,
    posterUrl: links?.posterUrl,
  })
  const replyTo = input.replyTo?.trim() || undefined

  let accepted = false
  try {
    const result = await input.send({
      to,
      from: resolveEmailFrom(input.from),
      replyTo,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: welcomeIdempotencyKey(user.id),
    })
    accepted = result.ok
  } catch (err) {
    log.error('Welcome email failed', err)
    return { status: 200, body: { ok: true, skipped: 'send_failed' } }
  }

  if (!accepted) {
    log.error('Welcome email was not accepted')
    return { status: 200, body: { ok: true, skipped: 'send_failed' } }
  }

  try {
    await input.markSent(new Date(input.now ?? Date.now()).toISOString())
  } catch (err) {
    log.error('Welcome email was sent but not recorded', err)
  }

  return { status: 200, body: { ok: true, sent: true } }
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase()
  if (!email || !email.includes('@') || email.length > 320) return null
  return email
}
