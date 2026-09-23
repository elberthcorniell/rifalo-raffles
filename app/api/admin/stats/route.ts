import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { effectiveOrgPlan } from '@/lib/billing'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const plan = effectiveOrgPlan(org)

  const raffleIdsResult = await admin.from('raffles').select('id').eq('org_id', org.id)
  const raffleIds = (raffleIdsResult.data || []).map((r) => r.id)

  const [
    { count: pendingPurchases },
    { count: activeRaffles },
    reservedResult,
    soldResult,
  ] = await Promise.all([
    admin
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'pending'),
    admin
      .from('raffles')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'active'),
    raffleIds.length
      ? admin
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .in('raffle_id', raffleIds)
          .eq('status', 'reserved')
      : Promise.resolve({ count: 0 }),
    raffleIds.length
      ? admin
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .in('raffle_id', raffleIds)
          .eq('status', 'sold')
      : Promise.resolve({ count: 0 }),
  ])

  let ticketsPerDay: { day: string; tickets: number }[] | undefined

  if (plan === 'unlimited') {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { data: purchases } = await admin
      .from('purchases')
      .select('quantity, submitted_at')
      .eq('org_id', org.id)
      .in('status', ['pending', 'confirmed'])
      .gte('submitted_at', monthStart.toISOString())

    const byDay = new Map<string, number>()
    const daysInMonth = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0
    ).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      byDay.set(key, 0)
    }
    for (const p of purchases || []) {
      const day = String(p.submitted_at).slice(0, 10)
      if (byDay.has(day)) {
        byDay.set(day, (byDay.get(day) || 0) + Number(p.quantity || 0))
      }
    }
    ticketsPerDay = Array.from(byDay.entries()).map(([day, tickets]) => ({
      day,
      tickets,
    }))
  }

  return NextResponse.json({
    success: true,
    data: {
      pendingPurchases: pendingPurchases ?? 0,
      activeRaffles: activeRaffles ?? 0,
      reservedTickets: reservedResult.count ?? 0,
      soldTickets: soldResult.count ?? 0,
      plan,
      ...(ticketsPerDay ? { ticketsPerDay } : {}),
    },
  })
}
