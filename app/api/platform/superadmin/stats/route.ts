import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveOrgPlan } from '@/lib/billing'
import type { OrgPlan } from '@/lib/constants'

async function countAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  let total = 0
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    total += data.users.length
    if (data.users.length < 200) break
  }
  return total
}

export async function GET() {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { admin } = auth

  try {
    const [orgsRes, rafflesRes, users] = await Promise.all([
      admin.from('organizations').select('plan, plan_override'),
      admin.from('raffles').select('id', { count: 'exact', head: true }),
      countAuthUsers(admin),
    ])

    if (orgsRes.error) {
      return NextResponse.json({ success: false, error: orgsRes.error.message }, { status: 500 })
    }
    if (rafflesRes.error) {
      return NextResponse.json({ success: false, error: rafflesRes.error.message }, { status: 500 })
    }

    const plans: Record<OrgPlan, number> = { free: 0, plus: 0, unlimited: 0 }
    for (const row of orgsRes.data || []) {
      plans[effectiveOrgPlan(row)] += 1
    }

    return NextResponse.json({
      success: true,
      data: {
        users,
        orgs: orgsRes.data?.length ?? 0,
        raffles: rafflesRes.count ?? 0,
        plans,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
