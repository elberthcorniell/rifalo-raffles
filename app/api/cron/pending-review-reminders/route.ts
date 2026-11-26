import { NextResponse } from 'next/server'
import { runOrganizerActivation } from '@/lib/activation-run'
import { cronAuthorized } from '@/lib/emails/cron-auth'
import { runReviewReminderCron } from '@/lib/emails/review-reminder-run'
import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Reminds raffle owners while purchases are waiting for review.
 * Vercel Cron calls GET with Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!hasSupabaseConfig()) {
    console.error('Pending review reminders skipped: Supabase is not configured')
    return NextResponse.json({ ok: true, skipped: 'missing_supabase', sent: 0 })
  }

  try {
    const admin = createAdminClient()
    const result = await runReviewReminderCron(admin)
    let activation: { ok: boolean; skipped?: string; sent: number } = {
      ok: true,
      skipped: 'disabled',
      sent: 0,
    }
    try {
      activation = await runOrganizerActivation(admin)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'failed'
      console.error('Organizer activation failed', message.slice(0, 200))
      activation = { ok: false, skipped: 'failed', sent: 0 }
    }
    return NextResponse.json({ ...result, activation })
  } catch (err) {
    console.error('Pending review reminders failed', err)
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 })
  }
}
