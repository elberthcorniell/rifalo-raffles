import type { SupabaseClient } from '@supabase/supabase-js'
import { getTenantUrl } from '@/lib/constants'
import { retryUnsentVerificationEmails } from '@/lib/emails/notify-verification'
import { loadOrgOwnerEmails } from '@/lib/emails/owner-recipients'
import {
  REMINDER_BATCH_LIMIT,
  runPendingReviewReminders,
  type ReminderCandidate,
  type ReminderClaim,
  type ReminderRunResult,
} from '@/lib/emails/review-reminder'
import { sendResendEmail } from '@/lib/emails/resend'

type CandidateRow = {
  org_id: string
  slug: string
  admin_email: string | null
  email: string | null
  queue_started_at: string
  last_step_hours: number | string | null
  pending_count: number | string | null
  oldest_submitted_at: string | null
}

export async function runReviewReminderCron(admin: SupabaseClient): Promise<
  ReminderRunResult & {
    verificationExamined: number
    verificationSent: number
  }
> {
  const apiKey = process.env.RESEND_API_KEY
  const reminders = await runPendingReviewReminders({
    apiKey,
    from: process.env.EMAIL_FROM,
    replyTo: process.env.EMAIL_REPLY_TO,
    loadCandidates: () => loadDueReminders(admin),
    loadRecipients: (candidate) =>
      loadOrgOwnerEmails(admin, candidate.orgId, [candidate.adminEmail, candidate.email]),
    panelUrl: (candidate) =>
      candidate.slug ? getTenantUrl(candidate.slug, '/admin/purchases') : null,
    claim: (claim) => claimReminder(admin, claim),
    release: (claim) => releaseReminder(admin, claim),
    send: (message) => sendResendEmail(message, { apiKey, logLabel: 'Pending review reminder' }),
  })
  const verification = await retryUnsentVerificationEmails(admin, apiKey)
  return {
    ...reminders,
    verificationExamined: verification.examined,
    verificationSent: verification.sent,
  }
}

async function loadDueReminders(admin: SupabaseClient): Promise<ReminderCandidate[]> {
  const { error: maintainError } = await admin.rpc('maintain_review_reminders')
  if (maintainError) throw maintainError

  const { data, error } = await admin.rpc('review_reminder_candidates', {
    p_limit: REMINDER_BATCH_LIMIT,
  })
  if (error) throw error

  return ((data ?? []) as CandidateRow[])
    .map((row) => ({
      orgId: row.org_id,
      slug: row.slug,
      queueStartedAt: row.queue_started_at,
      lastStepHours: Number(row.last_step_hours) || 0,
      pendingCount: Number(row.pending_count) || 0,
      oldestSubmittedAt: row.oldest_submitted_at,
      adminEmail: row.admin_email,
      email: row.email,
    }))
    .filter((row) => row.orgId && row.slug && row.pendingCount > 0 && row.queueStartedAt)
}

async function claimReminder(admin: SupabaseClient, claim: ReminderClaim): Promise<boolean> {
  const { data, error } = await admin.rpc('claim_review_reminder', {
    p_org_id: claim.orgId,
    p_queue_started_at: claim.queueStartedAt,
    p_previous_step: claim.previousStepHours,
    p_step: claim.stepHours,
    p_sent_at: claim.sentAt,
  })
  if (error) throw error
  return data === true
}

async function releaseReminder(admin: SupabaseClient, claim: ReminderClaim): Promise<void> {
  const { error } = await admin.rpc('release_review_reminder', {
    p_org_id: claim.orgId,
    p_queue_started_at: claim.queueStartedAt,
    p_previous_step: claim.previousStepHours,
    p_step: claim.stepHours,
  })
  if (error) throw error
}
