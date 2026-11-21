import type { SupabaseClient } from '@supabase/supabase-js'
import { getTenantUrl } from '@/lib/constants'
import { loadOrgOwnerEmails } from '@/lib/emails/owner-recipients'
import { sendResendEmail } from '@/lib/emails/resend'
import {
  deliverVerificationNotice,
  verificationSendDecision,
} from '@/lib/emails/verification-response'

export type VerificationRaffle = {
  id: string
  title?: string | null
  orgId: string
  status: string | null
  requestedAt: string | null
  note: string | null
  sentFor: string | null
}

type OrgContact = {
  slug: string | null
  admin_email: string | null
  email: string | null
}

/**
 * Emails the raffle owner after a verification response is stored.
 * Failures stay here so the admin action still succeeds.
 */
export async function notifyRaffleVerificationResponse(
  admin: SupabaseClient,
  raffle: VerificationRaffle,
): Promise<{ sent: boolean }> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    const decision = verificationSendDecision({
      status: raffle.status,
      requestedAt: raffle.requestedAt,
      sentFor: raffle.sentFor,
      apiKey,
    })
    if (!decision.send) {
      if (decision.skip === 'missing_api_key') {
        console.warn('RESEND_API_KEY is not configured. Skipping verification email.')
      }
      return { sent: false }
    }

    const org = await loadOrg(admin, raffle.orgId)
    const result = await deliverVerificationNotice({
      raffleId: raffle.id,
      title: raffle.title || '',
      panelUrl: org?.slug ? getTenantUrl(org.slug, '/admin/raffles') : '',
      status: raffle.status,
      requestedAt: raffle.requestedAt,
      sentFor: raffle.sentFor,
      note: raffle.note,
      apiKey,
      from: process.env.EMAIL_FROM,
      replyTo: process.env.EMAIL_REPLY_TO,
      loadRecipients: () =>
        loadOrgOwnerEmails(admin, raffle.orgId, [org?.admin_email, org?.email]),
      send: (message) => sendResendEmail(message, { apiKey, logLabel: 'Verification email' }),
      markSent: async (requestedAt) => {
        const { error } = await admin.rpc('mark_verification_email_sent', {
          p_raffle_id: raffle.id,
          p_requested_at: requestedAt,
        })
        if (error) throw error
      },
    })
    return { sent: result.sent === true }
  } catch (err) {
    console.error('Verification response email failed', err)
    return { sent: false }
  }
}

const VERIFICATION_RETRY_LIMIT = 20

/** Picks up a response whose email failed. Older decisions are already marked. */
export async function retryUnsentVerificationEmails(
  admin: SupabaseClient,
  apiKey: string | null | undefined = process.env.RESEND_API_KEY,
): Promise<{ examined: number; sent: number }> {
  if (!apiKey?.trim()) return { examined: 0, sent: 0 }

  const { data, error } = await admin.rpc('unsent_verification_responses', {
    p_limit: VERIFICATION_RETRY_LIMIT,
  })
  if (error) throw error

  const rows = (data ?? []) as Array<{
    id: string
    title: string | null
    org_id: string
    verification_status: string | null
    verification_requested_at: string | null
    verification_note: string | null
    verification_response_email_for: string | null
  }>
  let sent = 0
  for (const row of rows) {
    const result = await notifyRaffleVerificationResponse(admin, {
      id: row.id,
      title: row.title,
      orgId: row.org_id,
      status: row.verification_status,
      requestedAt: row.verification_requested_at,
      note: row.verification_note,
      sentFor: row.verification_response_email_for,
    })
    if (result.sent) sent += 1
  }
  return { examined: rows.length, sent }
}

async function loadOrg(admin: SupabaseClient, orgId: string): Promise<OrgContact | null> {
  const { data, error } = await admin
    .from('organizations')
    .select('slug, admin_email, email')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw error
  return (data as OrgContact | null) ?? null
}
