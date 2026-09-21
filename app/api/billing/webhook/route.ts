import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getStripe,
  planFromPriceId,
  planFromSubscription,
} from '@/lib/stripe'
import type { OrgPlan } from '@/lib/constants'

export const runtime = 'nodejs'

async function applySubscriptionToOrg(
  orgId: string,
  subscription: Stripe.Subscription,
  fallbackPlan?: OrgPlan
) {
  const admin = createAdminClient()
  const status = subscription.status
  const active = status === 'active' || status === 'trialing'
  let plan: OrgPlan = active ? planFromSubscription(subscription) : 'free'

  if (active && plan === 'free') {
    const priceId = subscription.items.data[0]?.price?.id
    plan = planFromPriceId(priceId)
    if (plan === 'free' && (fallbackPlan === 'plus' || fallbackPlan === 'unlimited')) {
      plan = fallbackPlan
    }
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  await admin
    .from('organizations')
    .update({
      plan: active ? plan : 'free',
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: status,
    })
    .eq('id', orgId)
}

async function findOrgIdFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  if (subscription.metadata?.org_id) return subscription.metadata.org_id

  const admin = createAdminClient()
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  if (customerId) {
    const { data } = await admin
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (data?.id) return data.id
  }

  const { data } = await admin
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  return data?.id ?? null
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json(
      { success: false, error: 'STRIPE_WEBHOOK_SECRET no configurado' },
      { status: 503 }
    )
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ success: false, error: 'Firma ausente' }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Stripe webhook signature error:', error)
    return NextResponse.json({ success: false, error: 'Firma inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const orgId = session.metadata?.org_id
        const planMeta = session.metadata?.plan as OrgPlan | undefined
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id

        if (!orgId || !subscriptionId) break

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
        await applySubscriptionToOrg(
          orgId,
          subscription,
          planMeta === 'plus' || planMeta === 'unlimited' ? planMeta : undefined
        )
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = await findOrgIdFromSubscription(subscription)
        if (!orgId) break
        await applySubscriptionToOrg(orgId, subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = await findOrgIdFromSubscription(subscription)
        if (!orgId) break
        await createAdminClient()
          .from('organizations')
          .update({
            plan: 'free',
            stripe_subscription_id: subscription.id,
            stripe_subscription_status: 'canceled',
          })
          .eq('id', orgId)
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error('Stripe webhook handler error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al procesar el webhook' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
