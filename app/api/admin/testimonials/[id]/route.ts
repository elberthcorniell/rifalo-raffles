import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { mapTestimonial } from '@/lib/testimonials'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await request.json()
  const { admin, org } = auth

  const updates: Record<string, unknown> = {}
  if (body.name != null) {
    const name = String(body.name).trim()
    if (!name) {
      return NextResponse.json({ success: false, error: 'Nombre requerido' }, { status: 400 })
    }
    updates.name = name
  }
  if (body.quote != null) {
    const quote = String(body.quote).trim()
    if (!quote) {
      return NextResponse.json({ success: false, error: 'Testimonio requerido' }, { status: 400 })
    }
    updates.quote = quote
  }
  if (body.rating != null) updates.rating = Math.min(5, Math.max(1, Number(body.rating) || 5))
  if (body.roleLabel != null) {
    updates.role_label = String(body.roleLabel).trim() || 'Ganador verificado'
  }
  if (body.isActive != null) updates.is_active = Boolean(body.isActive)
  if (body.sortOrder != null) updates.sort_order = Number(body.sortOrder) || 0

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('testimonials')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: mapTestimonial(data) })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { admin, org } = auth
  const { error } = await admin
    .from('testimonials')
    .delete()
    .eq('id', id)
    .eq('org_id', org.id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
