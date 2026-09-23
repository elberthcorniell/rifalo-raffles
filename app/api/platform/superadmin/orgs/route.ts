import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'
import { getTenantUrl } from '@/lib/constants'
import {
  effectiveOrgPlan,
  parseOrgPlanOverride,
  planTicketLimit,
  purchasedOrgPlan,
} from '@/lib/billing'
import { orgAdminPath } from '@/lib/onboarding'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

function escapeIlike(value: string) {
  return value.replace(/[%_,()]/g, '').trim()
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { admin } = auth
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )
  const q = escapeIlike(url.searchParams.get('q') || '')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = admin
    .from('organizations')
    .select(
      'id, slug, name, plan, plan_override, stripe_subscription_status, custom_domain, admin_email, email, onboarding_completed_at, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,slug.ilike.%${q}%,admin_email.ilike.%${q}%,email.ilike.%${q}%`
    )
  }

  const { data: orgs, error, count } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const ids = (orgs || []).map((org) => org.id)
  const statsByOrg = new Map<
    string,
    { raffleCount: number; memberCount: number; ticketsUsed: number }
  >()

  if (ids.length > 0) {
    const { data: stats, error: statsError } = await admin.rpc('superadmin_org_period_stats', {
      p_org_ids: ids,
    })
    if (statsError) {
      return NextResponse.json({ success: false, error: statsError.message }, { status: 500 })
    }
    for (const row of stats || []) {
      statsByOrg.set(row.org_id, {
        raffleCount: Number(row.raffle_count) || 0,
        memberCount: Number(row.member_count) || 0,
        ticketsUsed: Number(row.tickets_used) || 0,
      })
    }
  }

  const data = (orgs || []).map((org) => {
    const purchasedPlan = purchasedOrgPlan(org)
    const planOverride = parseOrgPlanOverride(org.plan_override)
    const plan = effectiveOrgPlan(org)
    const limit = planTicketLimit(plan)
    const stats = statsByOrg.get(org.id)
    const used = stats?.ticketsUsed || 0
    return {
      id: org.id,
      slug: org.slug,
      name: org.name,
      plan,
      purchasedPlan,
      planOverride,
      stripeStatus: org.stripe_subscription_status || null,
      customDomain: org.custom_domain || null,
      email: org.admin_email || org.email || null,
      onboardingCompleted: Boolean(org.onboarding_completed_at),
      createdAt: org.created_at,
      raffleCount: stats?.raffleCount || 0,
      memberCount: stats?.memberCount || 0,
      usage: {
        used,
        limit,
        remaining: limit == null ? null : Math.max(limit - used, 0),
      },
      url: getTenantUrl(org.slug),
      adminUrl: getTenantUrl(org.slug, orgAdminPath(org)),
    }
  })

  return NextResponse.json({
    success: true,
    data,
    page,
    pageSize,
    total: count ?? data.length,
  })
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { admin } = auth
  const body = await request.json().catch(() => ({}))
  const orgId = String(body.orgId || '').trim()
  if (!orgId) {
    return NextResponse.json({ success: false, error: 'orgId requerido' }, { status: 400 })
  }

  const rawOverride = body.planOverride
  let planOverride = parseOrgPlanOverride(rawOverride)
  if (rawOverride != null && rawOverride !== '' && planOverride == null) {
    return NextResponse.json({ success: false, error: 'Plan inválido' }, { status: 400 })
  }
  if (rawOverride == null || rawOverride === '') planOverride = null

  const { data: org, error: fetchError } = await admin
    .from('organizations')
    .select('id, plan')
    .eq('id', orgId)
    .maybeSingle()

  if (fetchError || !org) {
    return NextResponse.json({ success: false, error: 'Organización no encontrada' }, { status: 404 })
  }

  const nextOverride = planOverride === purchasedOrgPlan(org) ? null : planOverride
  const { data: updated, error } = await admin
    .from('organizations')
    .update({ plan_override: nextOverride })
    .eq('id', orgId)
    .select('id, plan, plan_override')
    .maybeSingle()

  if (error || !updated) {
    return NextResponse.json(
      { success: false, error: error?.message || 'No se pudo actualizar' },
      { status: 500 }
    )
  }

  const plan = effectiveOrgPlan(updated)
  const limit = planTicketLimit(plan)
  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      plan,
      purchasedPlan: purchasedOrgPlan(updated),
      planOverride: parseOrgPlanOverride(updated.plan_override),
      usageLimit: limit,
    },
  })
}
