import Stripe from 'stripe'
import type { OrgPlan } from '@/lib/constants'

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: '2026-08-26.dahlia',
      typescript: true,
    })
  }
  return stripeClient
}

export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_PLUS &&
    process.env.STRIPE_PRICE_UNLIMITED
  )
}

export function priceIdForPlan(plan: Exclude<OrgPlan, 'free'>): string {
  const priceId =
    plan === 'plus'
      ? process.env.STRIPE_PRICE_PLUS
      : process.env.STRIPE_PRICE_UNLIMITED
  if (!priceId) {
    throw new Error(`Missing Stripe price id for plan: ${plan}`)
  }
  return priceId
}

export function planFromPriceId(priceId: string | null | undefined): OrgPlan {
  if (!priceId) return 'free'
  if (priceId === process.env.STRIPE_PRICE_PLUS) return 'plus'
  if (priceId === process.env.STRIPE_PRICE_UNLIMITED) return 'unlimited'
  return 'free'
}

export function planFromSubscription(
  subscription: Stripe.Subscription | null | undefined
): OrgPlan {
  if (!subscription) return 'free'
  const status = subscription.status
  if (!['active', 'trialing'].includes(status)) return 'free'
  const priceId = subscription.items.data[0]?.price?.id
  return planFromPriceId(priceId)
}
