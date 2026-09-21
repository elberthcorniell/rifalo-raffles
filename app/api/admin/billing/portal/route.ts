import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { getTenantUrl } from '@/lib/constants'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

export async function POST() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Stripe no está configurado' },
      { status: 503 }
    )
  }

  const { org } = auth
  if (!org.stripe_customer_id) {
    return NextResponse.json(
      {
        success: false,
        error: 'No hay una suscripción de Stripe para esta organización',
      },
      { status: 400 }
    )
  }

  try {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: getTenantUrl(org.slug, '/admin/billing'),
    })

    return NextResponse.json({ success: true, data: { url: session.url } })
  } catch (error) {
    console.error('Stripe portal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al abrir el portal',
      },
      { status: 500 }
    )
  }
}
