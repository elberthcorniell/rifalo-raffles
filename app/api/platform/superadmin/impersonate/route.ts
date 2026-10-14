import { NextResponse } from 'next/server'
import { openOrgAsMember } from '@/lib/impersonate-member'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => ({}))
  const orgId = String(body.orgId || '').trim()
  const userId = String(body.userId || '').trim()

  if (!orgId) {
    return NextResponse.json({ success: false, error: 'orgId requerido' }, { status: 400 })
  }

  const result = await openOrgAsMember(auth.admin, orgId, userId || undefined)
  if ('error' in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    data: {
      url: result.url,
      role: result.role,
      email: result.email,
    },
  })
}
