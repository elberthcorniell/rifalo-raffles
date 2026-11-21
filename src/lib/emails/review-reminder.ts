import { isHttpUrl } from '@/lib/emails/layout'
import { buildReviewReminderEmail } from '@/lib/emails/review-reminder-template'
import type { OutboundEmail } from '@/lib/emails/resend'
import { normalizeRecipient } from '@/lib/emails/recipients'
import { resolveEmailFrom } from '@/lib/emails/welcome'

const HOUR_MS = 60 * 60 * 1000
/** 2^16 hours. A queue that somehow stays open does not step forever. */
export const MAX_REMINDER_STEP_HOURS = 65536
export const REMINDER_BATCH_LIMIT = 50

const MISSING_KEY_WARNING =
  'RESEND_API_KEY is not configured. Skipping pending-review reminders.'

export type ReminderState = {
  queueStartedAt: string
  lastStepHours: number
}

export type ReminderPlan =
  | { action: 'idle' }
  | { action: 'clear' }
  | { action: 'wait'; queueStartedAt: string }
  | {
      action: 'send'
      queueStartedAt: string
      stepHours: number
      previousStepHours: number
    }

export type ReminderCandidate = {
  orgId: string
  slug: string
  queueStartedAt: string
  lastStepHours: number
  pendingCount: number
  oldestSubmittedAt: string | null
  adminEmail?: string | null
  email?: string | null
}

export type ReminderClaim = {
  orgId: string
  queueStartedAt: string
  previousStepHours: number
  stepHours: number
  sentAt: string
}

type Log = {
  warn: (message: string) => void
  error: (message: string, error?: unknown) => void
}

/**
 * Steps are 1, 2, 4, 8... hours after the queue started.
 * Returns the latest step that is already due and has not been sent.
 */
export function highestDueStepHours(elapsedMs: number, lastStepHours: number): number | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null
  const last = Number.isFinite(lastStepHours) && lastStepHours > 0 ? lastStepHours : 0
  let step = 1
  let due: number | null = null
  while (step <= MAX_REMINDER_STEP_HOURS) {
    if (elapsedMs < step * HOUR_MS) break
    if (step > last) due = step
    if (step >= MAX_REMINDER_STEP_HOURS) break
    step *= 2
  }
  return due
}

/**
 * The stored queue start stays while the queue is non-empty.
 * An empty queue clears it. The next pending purchase is a new streak at 1 hour.
 */
export function planReviewReminder(input: {
  state: ReminderState | null
  oldestSubmittedAt: string | null
  now: Date
}): ReminderPlan {
  if (!input.oldestSubmittedAt) {
    return input.state ? { action: 'clear' } : { action: 'idle' }
  }

  const anchor = input.state?.queueStartedAt || input.oldestSubmittedAt
  const started = Date.parse(anchor)
  const previous = input.state?.lastStepHours ?? 0
  if (!Number.isFinite(started)) {
    return { action: 'wait', queueStartedAt: input.oldestSubmittedAt }
  }

  const step = highestDueStepHours(input.now.getTime() - started, previous)
  if (step == null) {
    return { action: 'wait', queueStartedAt: anchor }
  }

  return {
    action: 'send',
    queueStartedAt: anchor,
    stepHours: step,
    previousStepHours: previous > 0 ? previous : 0,
  }
}

export function reminderIdempotencyKey(
  orgId: string,
  queueStartedAt: string,
  stepHours: number,
  email: string,
): string {
  const stamp = Date.parse(queueStartedAt)
  const when = Number.isFinite(stamp) ? String(stamp) : 'queue'
  const safeOrg = orgId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  const safeEmail = email.toLowerCase().replace(/[^a-z0-9@._+-]/g, '')
  return `pending-review/${safeOrg}/${when}/${stepHours}/${safeEmail}`.slice(0, 256)
}

export type ReminderRunResult = {
  ok: true
  skipped?: 'missing_api_key'
  examined: number
  sent: number
}

export async function runPendingReviewReminders(input: {
  now?: Date
  apiKey?: string | null
  from?: string | null
  replyTo?: string | null
  loadCandidates: () => Promise<ReminderCandidate[]>
  loadRecipients: (candidate: ReminderCandidate) => Promise<string[]>
  panelUrl: (candidate: ReminderCandidate) => string | null
  claim: (claim: ReminderClaim) => Promise<boolean>
  release: (claim: ReminderClaim) => Promise<void>
  send: (message: OutboundEmail) => Promise<{ ok: boolean }>
  log?: Log
}): Promise<ReminderRunResult> {
  const log = input.log ?? console
  if (!input.apiKey?.trim()) {
    log.warn(MISSING_KEY_WARNING)
    return { ok: true, skipped: 'missing_api_key', examined: 0, sent: 0 }
  }

  const now = input.now ?? new Date()
  const candidates = await input.loadCandidates()
  let sent = 0

  for (const candidate of candidates) {
    if (!candidate.orgId || candidate.pendingCount < 1) continue
    const plan = planReviewReminder({
      state: {
        queueStartedAt: candidate.queueStartedAt,
        lastStepHours: candidate.lastStepHours,
      },
      oldestSubmittedAt: candidate.oldestSubmittedAt,
      now,
    })
    if (plan.action !== 'send') continue

    const panelUrl = isHttpUrl(input.panelUrl(candidate))
    if (!panelUrl) continue

    let recipients: string[] = []
    try {
      recipients = (await input.loadRecipients(candidate))
        .map((email) => normalizeRecipient(email))
        .filter((email): email is string => Boolean(email))
    } catch (err) {
      log.error(`Pending review reminder could not load recipients for ${candidate.orgId}`, err)
      continue
    }
    recipients = [...new Set(recipients)]
    if (!recipients.length) {
      log.warn(`Pending review reminder has no recipient for ${candidate.orgId}`)
      continue
    }

    const claim: ReminderClaim = {
      orgId: candidate.orgId,
      queueStartedAt: plan.queueStartedAt,
      previousStepHours: plan.previousStepHours,
      stepHours: plan.stepHours,
      sentAt: now.toISOString(),
    }
    let claimed = false
    try {
      claimed = await input.claim(claim)
    } catch (err) {
      log.error(`Pending review reminder could not claim ${candidate.orgId}`, err)
      continue
    }
    if (!claimed) continue

    const content = buildReviewReminderEmail({
      pendingCount: candidate.pendingCount,
      waitingHours: plan.stepHours,
      panelUrl,
    })
    const replyTo = input.replyTo?.trim() || undefined
    let failed = false
    for (const to of recipients) {
      try {
        const result = await input.send({
          to,
          from: resolveEmailFrom(input.from),
          replyTo,
          subject: content.subject,
          html: content.html,
          text: content.text,
          idempotencyKey: reminderIdempotencyKey(
            candidate.orgId,
            plan.queueStartedAt,
            plan.stepHours,
            to,
          ),
        })
        if (!result.ok) failed = true
      } catch (err) {
        failed = true
        log.error(`Pending review reminder failed for ${candidate.orgId}`, err)
      }
      if (failed) break
    }

    if (failed) {
      try {
        await input.release(claim)
      } catch (err) {
        log.error(`Pending review reminder claim was not released for ${candidate.orgId}`, err)
      }
      continue
    }

    sent += 1
  }

  return { ok: true, examined: candidates.length, sent }
}
