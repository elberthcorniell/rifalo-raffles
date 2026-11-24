import type { SupabaseClient } from '@supabase/supabase-js'
import { countSoldTicketsByOrg } from '@/lib/blog-recipients'
import { normalizeBlogEmail } from '@/lib/blog-audience'
import type { OrganizerInput } from '@/lib/activation-contacts'

type Admin = SupabaseClient

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

async function eachPage<T>(load: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await load(from, from + 999)
    if (error) throw new Error(error.message)
    const page = data || []
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}

export async function loadOrganizerInputs(admin: Admin): Promise<OrganizerInput[]> {
  const authUsers: {
    id: string
    email?: string | null
    email_confirmed_at?: string | null
    created_at?: string | null
    user_metadata?: Record<string, unknown> | null
  }[] = []
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    authUsers.push(...data.users)
    if (data.users.length < 200) break
  }

  const [members, orgs, raffles, unsubscribes] = await Promise.all([
    eachPage<{ user_id: string; org_id: string }>((from, to) =>
      admin.from('org_members').select('user_id, org_id').eq('role', 'owner').range(from, to),
    ),
    eachPage<{
      id: string
      slug: string
      name: string | null
      custom_domain: string | null
      created_at: string | null
    }>((from, to) =>
      admin
        .from('organizations')
        .select('id, slug, name, custom_domain, created_at')
        .range(from, to),
    ),
    eachPage<{ id: string; org_id: string }>((from, to) =>
      admin.from('raffles').select('id, org_id').eq('status', 'active').range(from, to),
    ),
    eachPage<{ email: string }>((from, to) =>
      admin.from('blog_email_unsubscribes').select('email').range(from, to),
    ),
  ])

  const soldByOrg = await countSoldTicketsByOrg(admin, raffles)
  const activeOrgs = new Set(raffles.map((row) => row.org_id))
  const orgsById = new Map(orgs.map((org) => [org.id, org]))
  const orgsByUser = new Map<string, OrganizerInput['orgs']>()

  for (const member of members) {
    const org = orgsById.get(member.org_id)
    if (!org?.slug) continue
    const list = orgsByUser.get(member.user_id) || []
    list.push({
      slug: org.slug,
      name: org.name || '',
      customDomain: org.custom_domain,
      createdAt: org.created_at || '',
      hasActiveRaffle: activeOrgs.has(org.id),
      ticketsSold: soldByOrg.get(org.id) || 0,
    })
    orgsByUser.set(member.user_id, list)
  }

  const unsubscribed = new Set(
    unsubscribes
      .map((row) => normalizeBlogEmail(row.email))
      .filter((email): email is string => Boolean(email)),
  )
  const merged = new Map<string, OrganizerInput>()

  for (const user of authUsers) {
    const email = normalizeBlogEmail(user.email)
    const orgsForUser = orgsByUser.get(user.id) || []
    if (!email || orgsForUser.length === 0) continue
    const row: OrganizerInput = {
      userId: user.id,
      email,
      emailConfirmed: Boolean(user.email_confirmed_at),
      fullName: metadataName(user.user_metadata),
      signupAt: user.created_at || null,
      unsubscribed: unsubscribed.has(email),
      orgs: orgsForUser,
    }
    const existing = merged.get(email)
    if (!existing) {
      merged.set(email, row)
      continue
    }
    existing.orgs = existing.orgs.concat(orgsForUser)
    if (!existing.fullName && row.fullName) existing.fullName = row.fullName
    if ((row.signupAt || '') < (existing.signupAt || '9999')) {
      existing.signupAt = row.signupAt
      existing.userId = row.userId
    }
  }

  return [...merged.values()]
}

function metadataName(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.full_name || metadata?.name
  return typeof value === 'string' ? value : null
}
