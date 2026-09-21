import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { getTicketCounts, mapRaffle, syncRaffleTicketTotal } from '@/lib/raffles'
import type { DbRaffle } from '@/types/raffle'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
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
  const { data: raffle, error } = await admin
    .from('raffles')
    .select('*')
    .eq('id', id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  if (!raffle) {
    return NextResponse.json({ success: false, error: 'Rifa no encontrada' }, { status: 404 })
  }

  const { data: ranges } = await admin
    .from('ticket_ranges')
    .select('*')
    .eq('raffle_id', id)
    .order('start_number', { ascending: true })

  const counts = await getTicketCounts([id])

  return NextResponse.json({
    success: true,
    data: {
      raffle: mapRaffle(raffle as DbRaffle, counts[id]),
      ranges: ranges || [],
      counts: counts[id],
    },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.title != null) updates.title = String(body.title).trim()
  if (body.description != null) updates.description = String(body.description)
  if (body.ticketPrice != null) updates.ticket_price = Number(body.ticketPrice)
  if (body.minTickets != null) updates.min_tickets = Math.max(1, parseInt(String(body.minTickets), 10) || 1)
  if (body.endDate !== undefined) updates.end_date = body.endDate || null
  if (body.featured != null) updates.featured = Boolean(body.featured)
  if (body.status != null) updates.status = body.status
  if (body.imagePath !== undefined) updates.image_path = body.imagePath || null

  const { admin, org } = auth

  const { data: existing } = await admin
    .from('raffles')
    .select('id')
    .eq('id', id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Rifa no encontrada' }, { status: 404 })
  }

  if (body.totalTickets != null) {
    try {
      await syncRaffleTicketTotal(admin, id, Number(body.totalTickets))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo actualizar el total de boletos'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }

  let data: DbRaffle
  if (Object.keys(updates).length > 0) {
    const { data: updated, error } = await admin
      .from('raffles')
      .update(updates)
      .eq('id', id)
      .eq('org_id', org.id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    data = updated as DbRaffle
  } else {
    const { data: current, error } = await admin
      .from('raffles')
      .select('*')
      .eq('id', id)
      .eq('org_id', org.id)
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    data = current as DbRaffle
  }

  const counts = await getTicketCounts([id])
  return NextResponse.json({
    success: true,
    data: mapRaffle(data, counts[id]),
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { admin, org } = auth

  const { error } = await admin.from('raffles').delete().eq('id', id).eq('org_id', org.id)
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
