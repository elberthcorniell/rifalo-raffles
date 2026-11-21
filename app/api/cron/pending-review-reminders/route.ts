import { NextResponse } from 'next/server'
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
    const result = await runReviewReminderCron(createAdminClient())
    return NextResponse.json(result)
  } catch (err) {
    console.error('Pending review reminders failed', err)
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 })
  }
}
