import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'
import { getTenantUrl } from '@/lib/constants'
import { effectiveOrgPlan } from '@/lib/billing'

type OrgMembership = {
  orgId: string
  name: string
  slug: string
  role: string
  plan: ReturnType<typeof effectiveOrgPlan>
  url: string
}

export async function GET() {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { admin } = auth

  try {
    const authUsers: {
      id: string
      email?: string
      created_at?: string
      last_sign_in_at?: string
      email_confirmed_at?: string
    }[] = []

    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
      authUsers.push(...data.users)
      if (data.users.length < 200) break
    }

    const [{ data: profiles }, { data: members, error: membersError }] = await Promise.all([
      admin.from('profiles').select('id, display_name'),
      admin
        .from('org_members')
        .select('user_id, role, organizations ( id, name, slug, plan, plan_override )'),
    ])

    if (membersError) {
      return NextResponse.json({ success: false, error: membersError.message }, { status: 500 })
    }

    const names = new Map((profiles || []).map((p) => [p.id, p.display_name as string | null]))
    const orgsByUser = new Map<string, OrgMembership[]>()

    for (const row of members || []) {
      const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
      if (!org) continue
      const list = orgsByUser.get(row.user_id) || []
      list.push({
        orgId: org.id,
        name: org.name,
        slug: org.slug,
        role: row.role,
        plan: effectiveOrgPlan(org),
        url: getTenantUrl(org.slug),
      })
      orgsByUser.set(row.user_id, list)
    }

    const users = authUsers
      .map((u) => ({
        id: u.id,
        email: u.email || null,
        displayName: names.get(u.id) || null,
        createdAt: u.created_at || null,
        lastSignInAt: u.last_sign_in_at || null,
        emailConfirmed: Boolean(u.email_confirmed_at),
        orgs: orgsByUser.get(u.id) || [],
      }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
