import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { normalizeCustomDomain } from '@/lib/custom-domain'
import { describeCustomDomain, verifyCustomDomain, vercelDomainsMode } from '@/lib/vercel-domains'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const domain = normalizeCustomDomain(auth.org.custom_domain)
  const status = await describeCustomDomain(domain)
  return NextResponse.json({ success: true, data: status })
}

export async function POST() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const domain = normalizeCustomDomain(auth.org.custom_domain)
  if (!domain) {
    return NextResponse.json(
      { success: false, error: 'No hay un dominio personalizado.' },
      { status: 400 }
    )
  }
  if (vercelDomainsMode() !== 'ready') {
    return NextResponse.json(
      { success: false, error: 'Vercel no está configurado en este entorno.' },
      { status: 503 }
    )
  }

  const status = await verifyCustomDomain(domain)
  return NextResponse.json({ success: true, data: status })
}
