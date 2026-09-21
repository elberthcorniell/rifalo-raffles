import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { getTenantUrl, type OrgPlan } from '@/lib/constants'
import { normalizeOrgPlan } from '@/lib/billing'
import {
  getStripe,
  isStripeConfigured,
  priceIdForPlan,
} from '@/lib/stripe'

export async function POST(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Stripe no está configurado. Agrega STRIPE_SECRET_KEY y los price IDs en el entorno.',
      },
      { status: 503 }
    )
  }

  const { admin, org, user } = auth
  const body = await request.json().catch(() => ({}))
  const plan = String(body.plan || '') as Exclude<OrgPlan, 'free'>

  if (plan !== 'plus' && plan !== 'unlimited') {
    return NextResponse.json(
      { success: false, error: 'Plan inválido. Elige plus o unlimited.' },
      { status: 400 }
    )
  }

  const currentPlan = normalizeOrgPlan(org.plan)
  if (currentPlan === plan && org.stripe_subscription_status === 'active') {
    return NextResponse.json(
      { success: false, error: 'Ya tienes este plan activo.' },
      { status: 400 }
    )
  }

  try {
    const stripe = getStripe()
    let customerId = org.stripe_customer_id || null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || org.admin_email || org.email || undefined,
        name: org.name,
        metadata: {
          org_id: org.id,
          org_slug: org.slug,
        },
      })
      customerId = customer.id
      await admin
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      success_url: getTenantUrl(org.slug, '/admin/billing?checkout=success'),
      cancel_url: getTenantUrl(org.slug, '/admin/billing?checkout=cancel'),
      allow_promotion_codes: true,
      metadata: {
        org_id: org.id,
        org_slug: org.slug,
        plan,
      },
      subscription_data: {
        metadata: {
          org_id: org.id,
          org_slug: org.slug,
          plan,
        },
      },
    })

    if (!session.url) {
      return NextResponse.json(
        { success: false, error: 'No se pudo crear la sesión de Stripe' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { url: session.url } })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Error al iniciar el checkout',
      },
      { status: 500 }
    )
  }
}
