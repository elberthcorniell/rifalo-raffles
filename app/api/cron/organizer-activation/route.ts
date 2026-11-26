import { NextResponse } from 'next/server'
import { runOrganizerActivation } from '@/lib/activation-run'
import { cronAuthorized } from '@/lib/emails/cron-auth'
import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Day-1 and day-3 activation mail. Off until the superadmin turns it on.
 * The daily Hobby cron calls this from the pending-review route so the
 * project keeps a single schedule.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: true, skipped: 'missing_supabase', sent: 0 })
  }

  try {
    const result = await runOrganizerActivation(createAdminClient())
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed'
    console.error('Organizer activation failed', message.slice(0, 200))
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 })
  }
}
