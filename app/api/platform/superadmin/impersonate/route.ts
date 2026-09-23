import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'
import { getTenantUrl } from '@/lib/constants'
import { orgAdminPath } from '@/lib/onboarding'
import { getSessionHandoffUrl } from '@/lib/auth-handoff'

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { admin } = auth
  const body = await request.json().catch(() => ({}))
  const orgId = String(body.orgId || '').trim()

  if (!orgId) {
    return NextResponse.json({ success: false, error: 'orgId requerido' }, { status: 400 })
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, slug, onboarding_completed_at')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError || !org) {
    return NextResponse.json({ success: false, error: 'Organización no encontrada' }, { status: 404 })
  }

  const { data: members, error: membersError } = await admin
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true })

  if (membersError) {
    return NextResponse.json({ success: false, error: membersError.message }, { status: 500 })
  }

  const target = (members || []).find((m) => m.role === 'owner') || members?.[0]
  if (!target) {
    return NextResponse.json(
      { success: false, error: 'Esta organización no tiene miembros' },
      { status: 400 }
    )
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(target.user_id)
  const email = userData.user?.email
  if (userError || !email) {
    return NextResponse.json(
      { success: false, error: 'El miembro no tiene un correo válido' },
      { status: 400 }
    )
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return NextResponse.json(
      { success: false, error: linkError?.message || 'No se pudo crear la sesión' },
      { status: 500 }
    )
  }

  let session = (
    await admin.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })
  ).data.session

  if (!session?.access_token || !session.refresh_token) {
    const fallback = await admin.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    })
    session = fallback.data.session
    if (fallback.error || !session?.access_token || !session.refresh_token) {
      return NextResponse.json(
        { success: false, error: fallback.error?.message || 'No se pudo verificar la sesión' },
        { status: 500 }
      )
    }
  }

  const adminUrl = getTenantUrl(org.slug, orgAdminPath(org))
  return NextResponse.json({
    success: true,
    data: {
      url: getSessionHandoffUrl(adminUrl, session),
      role: target.role,
    },
  })
}
