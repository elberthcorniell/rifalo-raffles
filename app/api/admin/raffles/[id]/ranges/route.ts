import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { captureServerEvent } from '@/lib/posthog-server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { user, admin, org } = auth

  const { data: raffle } = await admin
    .from('raffles')
    .select('id')
    .eq('id', id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (!raffle) {
    return NextResponse.json({ success: false, error: 'Rifa no encontrada' }, { status: 404 })
  }

  const body = await request.json()
  const start = parseInt(body.start, 10)
  const end = parseInt(body.end, 10)

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return NextResponse.json(
      { success: false, error: 'Rango inválido' },
      { status: 400 }
    )
  }

  const { data, error } = await admin.rpc('generate_ticket_range', {
    p_raffle_id: id,
    p_start: start,
    p_end: end,
  })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }

  await captureServerEvent(user.id, 'raffle_ticket_range_added', {
    raffle_id: id,
    organization_id: org.id,
    range_start: start,
    range_end: end,
    ticket_count: end - start + 1,
  })

  return NextResponse.json({ success: true, data: { rangeId: data } })
}
