import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function membershipBody(body: Record<string, unknown>) {
  const userId = String(body.userId || '').trim()
  const orgId = String(body.orgId || '').trim()
  if (!UUID.test(userId) || !UUID.test(orgId)) return null
  const role = body.role === 'owner' ? 'owner' : 'admin'
  return { userId, orgId, role }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { admin } = auth
  const parsed = membershipBody(await request.json().catch(() => ({})))
  if (!parsed) {
    return NextResponse.json({ success: false, error: 'Usuario u organización inválidos' }, { status: 400 })
  }

  const [{ data: org }, { data: userData, error: userError }] = await Promise.all([
    admin.from('organizations').select('id, name, slug').eq('id', parsed.orgId).maybeSingle(),
    admin.auth.admin.getUserById(parsed.userId),
  ])

  if (!org) {
    return NextResponse.json({ success: false, error: 'Organización no encontrada' }, { status: 404 })
  }
  if (userError || !userData.user) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  const { error } = await admin.from('org_members').upsert(
    {
      org_id: parsed.orgId,
      user_id: parsed.userId,
      role: parsed.role,
    },
    { onConflict: 'org_id,user_id' }
  )

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      orgId: org.id,
      name: org.name,
      slug: org.slug,
      role: parsed.role,
    },
  })
}

export async function DELETE(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { admin } = auth
  const parsed = membershipBody(await request.json().catch(() => ({})))
  if (!parsed) {
    return NextResponse.json({ success: false, error: 'Usuario u organización inválidos' }, { status: 400 })
  }

  const { data: target } = await admin
    .from('org_members')
    .select('role')
    .eq('org_id', parsed.orgId)
    .eq('user_id', parsed.userId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ success: false, error: 'Este usuario no pertenece a esa organización' }, { status: 404 })
  }

  if (target.role === 'owner') {
    const { count } = await admin
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', parsed.orgId)
      .eq('role', 'owner')
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: 'Asigna otro owner antes de quitar al único owner' },
        { status: 400 }
      )
    }
  }

  const { error } = await admin
    .from('org_members')
    .delete()
    .eq('org_id', parsed.orgId)
    .eq('user_id', parsed.userId)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
