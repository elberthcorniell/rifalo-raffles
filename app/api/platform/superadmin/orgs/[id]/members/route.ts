import { NextResponse } from 'next/server'
import { listOrgMemberAccounts } from '@/lib/impersonate-member'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const result = await listOrgMemberAccounts(auth.admin, id)
  if ('error' in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, data: result.members })
}
