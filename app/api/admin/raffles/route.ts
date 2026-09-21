import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { getTicketCounts, mapRaffle } from '@/lib/raffles'
import type { DbRaffle } from '@/types/raffle'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const { data, error } = await admin
    .from('raffles')
    .select('*')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const rows = (data || []) as DbRaffle[]
  const counts = await getTicketCounts(rows.map((r) => r.id))
  const raffles = rows.map((row) => mapRaffle(row, counts[row.id]))

  return NextResponse.json({ success: true, data: raffles })
}

export async function POST(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const body = await request.json()

  const {
    title,
    description = '',
    ticketPrice,
    minTickets = 1,
    endDate,
    featured = false,
    status = 'draft',
    imagePath,
    rangeStart,
    rangeEnd,
  } = body

  if (!title || ticketPrice == null) {
    return NextResponse.json(
      { success: false, error: 'Título y precio son requeridos' },
      { status: 400 }
    )
  }

  const parsedMinTickets = Math.max(1, parseInt(String(minTickets), 10) || 1)

  const { data: raffle, error } = await admin
    .from('raffles')
    .insert({
      org_id: org.id,
      title: String(title).trim(),
      description: String(description || ''),
      ticket_price: Number(ticketPrice),
      min_tickets: parsedMinTickets,
      end_date: endDate || null,
      featured: Boolean(featured),
      status,
      image_path: imagePath || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  if (rangeStart != null && rangeEnd != null) {
    const start = parseInt(rangeStart, 10)
    const end = parseInt(rangeEnd, 10)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      const { error: rangeError } = await admin.rpc('generate_ticket_range', {
        p_raffle_id: raffle.id,
        p_start: start,
        p_end: end,
      })
      if (rangeError) {
        await admin.from('raffles').delete().eq('id', raffle.id)
        return NextResponse.json(
          { success: false, error: rangeError.message },
          { status: 400 }
        )
      }
    }
  }

  const counts = await getTicketCounts([raffle.id])
  return NextResponse.json({
    success: true,
    data: mapRaffle(raffle as DbRaffle, counts[raffle.id]),
  })
}
