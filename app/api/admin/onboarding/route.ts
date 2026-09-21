import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { getOrgBrand } from '@/lib/tenant'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth

  const [{ count: bankCount }, { data: raffles }] = await Promise.all([
    admin
      .from('bank_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id),
    admin
      .from('raffles')
      .select('id, title')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const raffle = raffles?.[0] ?? null

  return NextResponse.json({
    success: true,
    data: {
      completed: Boolean(org.onboarding_completed_at),
      org,
      brand: getOrgBrand(org),
      hasBankAccount: (bankCount ?? 0) > 0,
      hasRaffle: Boolean(raffle),
      raffle,
    },
  })
}

export async function POST() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth

  if (org.onboarding_completed_at) {
    return NextResponse.json({
      success: true,
      data: { completed: true, already: true },
    })
  }

  const { count: raffleCount } = await admin
    .from('raffles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)

  if (!raffleCount) {
    return NextResponse.json(
      { success: false, error: 'Crea tu primera rifa para terminar la configuración' },
      { status: 400 }
    )
  }

  const { error } = await admin
    .from('organizations')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', org.id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { completed: true } })
}
