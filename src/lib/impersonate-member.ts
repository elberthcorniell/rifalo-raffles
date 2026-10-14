import type { SupabaseClient } from '@supabase/supabase-js'
import { getSessionHandoffUrl } from '@/lib/auth-handoff'
import { getTenantUrl } from '@/lib/constants'
import { orgAdminPath } from '@/lib/onboarding'

type Failure = { error: string; status: number }

export type OrgMemberAccount = {
  userId: string
  role: string
  email: string | null
  displayName: string | null
  createdAt: string
}

/** Server-only. Mint a tenant admin session for one member of an organization. */
export async function openOrgAsMember(
  admin: SupabaseClient,
  orgId: string,
  userId?: string
): Promise<{ url: string; role: string; email: string } | Failure> {
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, slug, onboarding_completed_at')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError || !org) {
    return { error: 'Organización no encontrada', status: 404 }
  }

  const { data: members, error: membersError } = await admin
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true })

  if (membersError) {
    return { error: membersError.message, status: 500 }
  }

  const list = members || []
  const target = userId
    ? list.find((member) => member.user_id === userId)
    : list.find((member) => member.role === 'owner') || list[0]

  if (userId && !target) {
    return { error: 'Ese usuario no pertenece a esta organización', status: 404 }
  }
  if (!target) {
    return { error: 'Esta organización no tiene miembros', status: 400 }
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(target.user_id)
  const email = userData.user?.email
  if (userError || !email) {
    return { error: 'El miembro no tiene un correo válido', status: 400 }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return { error: linkError?.message || 'No se pudo crear la sesión', status: 500 }
  }

  let verified = await admin.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })
  let session = verified.data.session

  if (!session?.access_token || !session.refresh_token) {
    verified = await admin.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    })
    session = verified.data.session
    if (verified.error || !session?.access_token || !session.refresh_token) {
      return {
        error: verified.error?.message || 'No se pudo verificar la sesión',
        status: 500,
      }
    }
  }

  const adminUrl = getTenantUrl(org.slug, orgAdminPath(org))
  return {
    url: getSessionHandoffUrl(adminUrl, session),
    role: target.role,
    email,
  }
}

export async function listOrgMemberAccounts(
  admin: SupabaseClient,
  orgId: string
): Promise<{ members: OrgMemberAccount[] } | Failure> {
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError || !org) {
    return { error: 'Organización no encontrada', status: 404 }
  }

  const { data: members, error: membersError } = await admin
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true })

  if (membersError) {
    return { error: membersError.message, status: 500 }
  }

  const rows = members || []
  const ids = rows.map((member) => member.user_id)
  const names = new Map<string, string | null>()

  if (ids.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, display_name').in('id', ids)
    for (const profile of profiles || []) {
      names.set(profile.id, profile.display_name)
    }
  }

  const accounts: OrgMemberAccount[] = []
  for (const member of rows) {
    const { data: userData } = await admin.auth.admin.getUserById(member.user_id)
    accounts.push({
      userId: member.user_id,
      role: member.role,
      email: userData.user?.email || null,
      displayName: names.get(member.user_id) || null,
      createdAt: member.created_at,
    })
  }

  accounts.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (b.role === 'owner' && a.role !== 'owner') return 1
    return a.createdAt.localeCompare(b.createdAt)
  })

  return { members: accounts }
}
