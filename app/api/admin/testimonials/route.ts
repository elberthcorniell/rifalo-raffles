import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { listOrgTestimonials, mapTestimonial } from '@/lib/testimonials'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const data = await listOrgTestimonials(auth.org.id)
  return NextResponse.json({ success: true, data })
}

export async function POST(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json()
  const name = String(body.name || '').trim()
  const quote = String(body.quote || '').trim()
  if (!name || !quote) {
    return NextResponse.json(
      { success: false, error: 'Nombre y testimonio son requeridos' },
      { status: 400 }
    )
  }

  const rating = Math.min(5, Math.max(1, Number(body.rating) || 5))
  const { admin, org } = auth

  const { data, error } = await admin
    .from('testimonials')
    .insert({
      org_id: org.id,
      name,
      quote,
      rating,
      role_label: String(body.roleLabel || 'Ganador verificado').trim() || 'Ganador verificado',
      is_active: body.isActive !== false,
      sort_order: Number(body.sortOrder) || 0,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: mapTestimonial(data) })
}
