import { headers } from 'next/headers'
import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'
import { ORG_ID_HEADER, ORG_SLUG_HEADER } from '@/lib/tenant-host'
import type { Organization } from '@/types/org'

export {
  ORG_ID_HEADER,
  ORG_SLUG_HEADER,
  PATHNAME_HEADER,
  getOrgBrand,
  parseHost,
  type HostKind,
  type ResolvedHost,
} from '@/lib/tenant-host'

export async function lookupOrgBySlug(slug: string): Promise<Organization | null> {
  if (!hasSupabaseConfig()) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null
  return data as Organization
}

export async function getOrgFromHeaders(): Promise<Organization | null> {
  const h = await headers()
  const orgId = h.get(ORG_ID_HEADER)
  const slug = h.get(ORG_SLUG_HEADER)

  if (!orgId && !slug) return null
  if (!hasSupabaseConfig()) return null

  const supabase = createAdminClient()
  if (orgId) {
    const { data } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
    if (data) return data as Organization
  }
  if (slug) {
    return lookupOrgBySlug(slug)
  }
  return null
}

export function requireOrgFromHeadersSync(orgId: string | null, slug: string | null): {
  orgId: string
  slug: string
} | null {
  if (!orgId || !slug) return null
  return { orgId, slug }
}

export async function userBelongsToOrg(
  userId: string,
  orgId: string
): Promise<{ belongs: boolean; role: string | null }> {
  if (!hasSupabaseConfig()) return { belongs: false, role: null }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return { belongs: false, role: null }
  return { belongs: true, role: data.role }
}

export async function getUserOrgs(userId: string): Promise<Organization[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createAdminClient()
  const { data: memberships } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)

  if (!memberships?.length) return []

  const ids = memberships.map((m) => m.org_id)
  const { data: orgs } = await supabase.from('organizations').select('*').in('id', ids)
  return (orgs || []) as Organization[]
}
