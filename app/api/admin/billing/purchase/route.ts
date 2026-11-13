import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { getTenantUrl } from '@/lib/constants'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { checkoutPlanPurchaseEvent } from '@/lib/meta-plan-purchase'

const SESSION_ID_RE = /^cs_[A-Za-z0-9_]{10,200}$/

function empty() {
  return NextResponse.json({ success: true, data: null })
}

export async function GET(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  if (!isStripeConfigured()) return empty()

  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!SESSION_ID_RE.test(sessionId)) return empty()

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.metadata?.org_id !== auth.org.id) return empty()

    const purchase = checkoutPlanPurchaseEvent(
      session,
      getTenantUrl(auth.org.slug, '/admin/billing?checkout=success'),
      auth.org.id
    )
    if (!purchase || purchase.customData.currency !== 'USD') return empty()

    return NextResponse.json({
      success: true,
      data: {
        eventId: purchase.eventId,
        value: purchase.customData.value,
        currency: 'USD' as const,
        contentName: purchase.customData.content_name,
        contentIds: purchase.customData.content_ids,
        orderId: purchase.customData.order_id,
      },
    })
  } catch (error) {
    console.error(
      'Plan purchase verification failed:',
      error instanceof Error ? error.message : 'unknown'
    )
    return empty()
  }
}
