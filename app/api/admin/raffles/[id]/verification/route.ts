import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
  }

  const { admin, org } = auth

  const { data: raffle, error: loadError } = await admin
    .from('raffles')
    .select('id, status, verification_status')
    .eq('id', id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (loadError) {
    return NextResponse.json({ success: false, error: loadError.message }, { status: 500 })
  }
  if (!raffle) {
    return NextResponse.json({ success: false, error: 'Rifa no encontrada' }, { status: 404 })
  }
  if (raffle.status !== 'active') {
    return NextResponse.json(
      { success: false, error: 'Solo puedes solicitar verificación para rifas activas' },
      { status: 400 }
    )
  }

  const current = raffle.verification_status || 'none'
  if (current !== 'none' && current !== 'rejected') {
    return NextResponse.json(
      {
        success: false,
        error:
          current === 'pending'
            ? 'Esta rifa ya está en revisión'
            : 'Esta rifa ya está verificada',
      },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('raffles')
    .update({
      verification_status: 'pending',
      verification_requested_at: now,
      verification_reviewed_at: null,
      verification_note: null,
    })
    .eq('id', id)
    .eq('org_id', org.id)
    .select('id, verification_status, verification_requested_at')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      verificationStatus: data.verification_status,
      verificationRequestedAt: data.verification_requested_at,
    },
  })
}
