import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { getTicketCounts, mapRaffle, replaceRaffleBundles } from '@/lib/raffles'
import { parseBundleInputs } from '@/lib/ticket-bundles'
import { parseReferralRewardTickets } from '@/lib/referrals'
import type { DbRaffle } from '@/types/raffle'
import { captureServerEvent } from '@/lib/posthog-server'

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

  const { user, admin, org } = auth
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
    bundles,
    referralEnabled = false,
    referralRewardTickets = 1,
  } = body

  if (!title || ticketPrice == null) {
    return NextResponse.json(
      { success: false, error: 'Título y precio son requeridos' },
      { status: 400 }
    )
  }

  const parsedMinTickets = Math.max(1, parseInt(String(minTickets), 10) || 1)
  const parsedBundles = bundles == null ? { bundles: [] } : parseBundleInputs(bundles)
  if ('error' in parsedBundles) {
    return NextResponse.json({ success: false, error: parsedBundles.error }, { status: 400 })
  }

  const parsedReferralTickets = parseReferralRewardTickets(referralRewardTickets)
  if (typeof parsedReferralTickets !== 'number') {
    return NextResponse.json(
      { success: false, error: parsedReferralTickets.error },
      { status: 400 }
    )
  }

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
      referral_enabled: Boolean(referralEnabled),
      referral_reward_tickets: parsedReferralTickets,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  try {
    await replaceRaffleBundles(admin, raffle.id, parsedBundles.bundles)
  } catch (err) {
    await admin.from('raffles').delete().eq('id', raffle.id)
    const message = err instanceof Error ? err.message : 'No se pudieron guardar los paquetes'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
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
  await captureServerEvent(user.id, 'raffle_created', {
    raffle_id: raffle.id,
    organization_id: org.id,
    ticket_price: Number(ticketPrice),
    min_tickets: parsedMinTickets,
    initial_ticket_count: counts[raffle.id]?.total ?? 0,
    is_featured: Boolean(featured),
  })

  return NextResponse.json({
    success: true,
    data: mapRaffle(raffle as DbRaffle, counts[raffle.id]),
  })
}
