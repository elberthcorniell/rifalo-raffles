import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
  }

  const body = await request.json()
  const action = body.action as string
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { success: false, error: 'Acción inválida. Usa approve o reject.' },
      { status: 400 }
    )
  }

  if (action === 'reject' && note.length < 3) {
    return NextResponse.json(
      { success: false, error: 'Escribe un motivo de rechazo (mínimo 3 caracteres)' },
      { status: 400 }
    )
  }

  const { admin } = auth

  const { data: existing, error: loadError } = await admin
    .from('raffles')
    .select('id, verification_status')
    .eq('id', id)
    .maybeSingle()

  if (loadError) {
    return NextResponse.json({ success: false, error: loadError.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Rifa no encontrada' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const updates =
    action === 'approve'
      ? {
          verification_status: 'verified',
          verification_reviewed_at: now,
          verification_note: null,
        }
      : {
          verification_status: 'rejected',
          verification_reviewed_at: now,
          verification_note: note,
        }

  const { data, error } = await admin
    .from('raffles')
    .update(updates)
    .eq('id', id)
    .select(
      'id, verification_status, verification_requested_at, verification_reviewed_at, verification_note'
    )
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
      verificationReviewedAt: data.verification_reviewed_at,
      verificationNote: data.verification_note,
    },
  })
}
