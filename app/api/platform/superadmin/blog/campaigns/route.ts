import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.admin
    .from('blog_email_campaigns')
    .select(
      'id, post_slug, subject, audience, kind, recipient_count, sent_count, failed_count, created_by_email, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: data || [] })
}
