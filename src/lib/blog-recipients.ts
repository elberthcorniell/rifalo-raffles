import type { SupabaseClient } from '@supabase/supabase-js'
import {
  classifyBlogAudiences,
  deliveryBlocksResend,
  normalizeBlogEmail,
  type AudienceUser,
  type BlogAudienceCounts,
} from '@/lib/blog-audience'

type Admin = SupabaseClient

export type BlogAudienceSnapshot = {
  audiences: BlogAudienceCounts
}

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

export async function loadBlogAudience(admin: Admin, slug: string, now = new Date()): Promise<BlogAudienceSnapshot> {
  const authUsers: { id: string; email?: string | null; email_confirmed_at?: string | null }[] = []
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    authUsers.push(...data.users)
    if (data.users.length < 200) break
  }

  const [members, orgs, raffles, unsubscribes, deliveries] = await Promise.all([
    eachPage<{ user_id: string; org_id: string }>((from, to) =>
      admin.from('org_members').select('user_id, org_id').eq('role', 'owner').range(from, to),
    ),
    eachPage<{ id: string; slug: string; plan: string | null; stripe_subscription_status: string | null }>(
      (from, to) =>
        admin.from('organizations').select('id, slug, plan, stripe_subscription_status').range(from, to),
    ),
    eachPage<{ org_id: string }>((from, to) =>
      admin.from('raffles').select('org_id').eq('status', 'active').range(from, to),
    ),
    eachPage<{ email: string }>((from, to) =>
      admin.from('blog_email_unsubscribes').select('email').range(from, to),
    ),
    eachPage<{ email: string; status: string; claimed_at: string }>((from, to) =>
      admin
        .from('blog_email_deliveries')
        .select('email, status, claimed_at')
        .eq('post_slug', slug)
        .eq('kind', 'bulk')
        .range(from, to),
    ),
  ])

  const activeOrgs = new Set(raffles.map((row) => row.org_id))
  const orgsById = new Map(orgs.map((org) => [org.id, org]))
  const orgsByUser = new Map<string, AudienceUser['orgs']>()

  for (const member of members) {
    const org = orgsById.get(member.org_id)
    if (!org) continue
    const list = orgsByUser.get(member.user_id) || []
    list.push({
      slug: org.slug,
      plan: org.plan || 'free',
      stripeStatus: org.stripe_subscription_status,
      hasActiveRaffle: activeOrgs.has(org.id),
    })
    orgsByUser.set(member.user_id, list)
  }

  const merged = new Map<string, AudienceUser>()
  for (const user of authUsers) {
    const email = normalizeBlogEmail(user.email)
    const orgsForUser = orgsByUser.get(user.id) || []
    if (!email || !user.email_confirmed_at || orgsForUser.length === 0) continue
    const existing = merged.get(email)
    if (!existing) {
      merged.set(email, { id: user.id, email, emailConfirmed: true, orgs: orgsForUser })
    } else {
      existing.orgs = existing.orgs.concat(orgsForUser)
    }
  }

  const blockedEmails = new Set(
    deliveries
      .filter((row) =>
        deliveryBlocksResend({ status: row.status, claimedAt: row.claimed_at }, now),
      )
      .map((row) => normalizeBlogEmail(row.email))
      .filter((email): email is string => Boolean(email)),
  )

  return {
    audiences: classifyBlogAudiences([...merged.values()], {
      unsubscribed: new Set(
        unsubscribes
          .map((row) => normalizeBlogEmail(row.email))
          .filter((email): email is string => Boolean(email)),
      ),
      blockedEmails,
    }),
  }
}
