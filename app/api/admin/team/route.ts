import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveOrgPlan } from '@/lib/billing'

type AdminClient = ReturnType<typeof createAdminClient>

async function findUserIdByEmail(
  admin: AdminClient,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  // Prefer getUserByEmail when available; fall back to paging listUsers.
  const anyAdmin = admin as {
    auth: {
      admin: {
        getUserByEmail?: (email: string) => Promise<{ data: { user: { id: string } | null }; error: Error | null }>
        listUsers: (args: { page: number; perPage: number }) => Promise<{
          data: { users: { id: string; email?: string }[] }
          error: Error | null
        }>
        inviteUserByEmail: (
          email: string
        ) => Promise<{ data: { user: { id: string } | null }; error: Error | null }>
      }
    }
  }

  if (typeof anyAdmin.auth.admin.getUserByEmail === 'function') {
    const { data, error } = await anyAdmin.auth.admin.getUserByEmail(normalized)
    if (!error && data.user?.id) return data.user.id
  }

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await anyAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized)
    if (match) return match.id
    if (data.users.length < 200) break
  }

  const invited = await anyAdmin.auth.admin.inviteUserByEmail(normalized)
  if (invited.error || !invited.data.user?.id) return null
  return invited.data.user.id
}

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const plan = effectiveOrgPlan(org)

  const { data: members, error } = await admin
    .from('org_members')
    .select('org_id, user_id, role, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const enriched = []
  for (const m of members || []) {
    const { data: userData } = await admin.auth.admin.getUserById(m.user_id)
    enriched.push({
      userId: m.user_id,
      role: m.role,
      createdAt: m.created_at,
      email: userData.user?.email || null,
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      plan,
      canAddMembers: plan === 'unlimited',
      maxMembers: plan === 'unlimited' ? null : 1,
      members: enriched,
    },
  })
}

export async function POST(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const plan = effectiveOrgPlan(org)

  if (plan !== 'unlimited') {
    return NextResponse.json(
      {
        success: false,
        error:
          'Varios organizadores están disponibles en el plan Ilimitado. Mejora tu plan en Facturación.',
      },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const role = body.role === 'owner' ? 'owner' : 'admin'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: 'Correo inválido' }, { status: 400 })
  }

  const userId = await findUserIdByEmail(admin, email)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'No se pudo encontrar o invitar al usuario' },
      { status: 400 }
    )
  }

  const { error } = await admin.from('org_members').upsert(
    {
      org_id: org.id,
      user_id: userId,
      role,
    },
    { onConflict: 'org_id,user_id' }
  )

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { userId, email, role } })
}

export async function DELETE(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org, user } = auth
  const body = await request.json().catch(() => ({}))
  const userId = String(body.userId || '')

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 })
  }

  if (userId === user.id) {
    return NextResponse.json(
      { success: false, error: 'No puedes eliminarte a ti mismo' },
      { status: 400 }
    )
  }

  const { data: target } = await admin
    .from('org_members')
    .select('role')
    .eq('org_id', org.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ success: false, error: 'Miembro no encontrado' }, { status: 404 })
  }

  if (target.role === 'owner') {
    const { count } = await admin
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('role', 'owner')
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: 'No puedes eliminar al único owner' },
        { status: 400 }
      )
    }
  }

  const { error } = await admin
    .from('org_members')
    .delete()
    .eq('org_id', org.id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
