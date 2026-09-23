import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { effectiveOrgPlan, parseOrgPlanOverride, parseQuotaRow, purchasedOrgPlan } from '@/lib/billing'
import { PLAN_LIMITS, PLAN_PRICES, type OrgPlan } from '@/lib/constants'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth

  const { data: quotaRaw, error: quotaError } = await admin.rpc('org_ticket_quota', {
    p_org_id: org.id,
  })

  if (quotaError) {
    return NextResponse.json(
      { success: false, error: quotaError.message },
      { status: 500 }
    )
  }

  const quota = parseQuotaRow(quotaRaw)
  const plan = effectiveOrgPlan(org)
  const purchasedPlan = purchasedOrgPlan(org)
  const planOverride = parseOrgPlanOverride(org.plan_override)

  return NextResponse.json({
    success: true,
    data: {
      plan,
      purchasedPlan,
      planOverride,
      quota,
      limits: PLAN_LIMITS,
      prices: PLAN_PRICES,
      stripeCustomerId: org.stripe_customer_id ?? null,
      stripeSubscriptionId: org.stripe_subscription_id ?? null,
      stripeSubscriptionStatus: org.stripe_subscription_status ?? null,
      customDomain: org.custom_domain ?? null,
      plans: [
        {
          id: 'free' as OrgPlan,
          name: 'Gratis',
          price: PLAN_PRICES.free,
          ticketLimit: PLAN_LIMITS.free,
          features: [
            '250 boletos al mes',
            'Tu marca y colores',
            'Página de rifa estándar',
            'Analítica básica',
          ],
        },
        {
          id: 'plus' as OrgPlan,
          name: 'Plus',
          price: PLAN_PRICES.plus,
          ticketLimit: PLAN_LIMITS.plus,
          features: [
            'Hasta 50,000 boletos al mes',
            'Tu marca y colores',
            'Página de rifa estándar',
            'Analítica básica',
          ],
        },
        {
          id: 'unlimited' as OrgPlan,
          name: 'Ilimitado',
          price: PLAN_PRICES.unlimited,
          ticketLimit: PLAN_LIMITS.unlimited,
          features: [
            'Boletos ilimitados',
            'Dominio propio',
            'Analítica avanzada',
            'Varios organizadores / admins',
          ],
        },
      ],
    },
  })
}
