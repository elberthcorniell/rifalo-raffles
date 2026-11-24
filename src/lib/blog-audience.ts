/** Organizations that must never receive the blog email. */
export const BLOG_EMAIL_EXCLUDED_ORG_SLUGS = [
  'test',
  'test42323',
  'prueba-interna-test',
  'cura',
] as const

export const BLOG_AUDIENCE_IDS = ['all', 'published', 'paying', 'free', 'no_sales'] as const

export type BlogAudienceId = (typeof BLOG_AUDIENCE_IDS)[number]

export const BLOG_AUDIENCE_LABELS: Record<BlogAudienceId, string> = {
  all: 'Todos los organizadores',
  published: 'Con una rifa publicada',
  paying: 'Planes de pago',
  free: 'Solo plan gratis',
  no_sales: 'Con rifa activa y 0 boletos vendidos',
}

/** A pending row newer than this is treated as an in-flight send. */
export const BLOG_EMAIL_STALE_MS = 15 * 60 * 1000

const EXCLUDED = new Set<string>(BLOG_EMAIL_EXCLUDED_ORG_SLUGS)

export type AudienceOrg = {
  slug: string
  plan: string
  stripeStatus: string | null
  hasActiveRaffle: boolean
  /** Sold tickets on this org's active raffles. */
  ticketsSold: number
}

export type AudienceUser = {
  id: string
  email: string
  emailConfirmed: boolean
  orgs: AudienceOrg[]
}

export type BlogRecipient = {
  userId: string
  email: string
}

export type BlogAudienceCounts = Record<
  BlogAudienceId,
  { willSend: BlogRecipient[]; alreadySent: number }
>

export function isBlogAudienceId(value: unknown): value is BlogAudienceId {
  return typeof value === 'string' && (BLOG_AUDIENCE_IDS as readonly string[]).includes(value)
}

export function blogCampaignAudienceLabel(audience: string): string {
  if (audience === 'test') return 'Prueba'
  if (isBlogAudienceId(audience)) return BLOG_AUDIENCE_LABELS[audience]
  return audience
}

export function normalizeBlogEmail(value: string | null | undefined): string | null {
  const email = (value || '').trim().toLowerCase()
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

export function isPayingOrg(org: Pick<AudienceOrg, 'plan' | 'stripeStatus'>): boolean {
  const paid = org.plan === 'plus' || org.plan === 'unlimited'
  const live = org.stripeStatus === 'active' || org.stripeStatus === 'trialing'
  return paid && live
}

export function deliveryBlocksResend(
  row: { status: string; claimedAt: string },
  now: Date,
  staleMs = BLOG_EMAIL_STALE_MS,
): boolean {
  if (row.status === 'sent') return true
  if (row.status !== 'pending') return false
  const claimed = Date.parse(row.claimedAt)
  if (!Number.isFinite(claimed)) return true
  return now.getTime() - claimed < staleMs
}

function realOrgs(user: AudienceUser): AudienceOrg[] {
  return user.orgs.filter((org) => org.slug && !EXCLUDED.has(org.slug))
}

function emptyCounts(): BlogAudienceCounts {
  return {
    all: { willSend: [], alreadySent: 0 },
    published: { willSend: [], alreadySent: 0 },
    paying: { willSend: [], alreadySent: 0 },
    free: { willSend: [], alreadySent: 0 },
    no_sales: { willSend: [], alreadySent: 0 },
  }
}

/**
 * Owners with a verified email, outside the test orgs and the unsubscribe list.
 * `blockedEmails` are addresses that already have a sent or in-flight delivery
 * for this post, so a second bulk send skips them.
 */
export function classifyBlogAudiences(
  users: AudienceUser[],
  opts: { unsubscribed: Set<string>; blockedEmails: Set<string> },
): BlogAudienceCounts {
  const result = emptyCounts()
  const seen = new Set<string>()

  for (const user of users) {
    const email = normalizeBlogEmail(user.email)
    if (!email || !user.emailConfirmed || seen.has(email)) continue
    if (opts.unsubscribed.has(email)) continue
    const orgs = realOrgs(user)
    if (orgs.length === 0) continue
    seen.add(email)

    const paying = orgs.some(isPayingOrg)
    const active = orgs.filter((org) => org.hasActiveRaffle)
    const published = active.length > 0
    const buckets: BlogAudienceId[] = ['all']
    if (published) buckets.push('published')
    if (paying) buckets.push('paying')
    else buckets.push('free')
    if (published && active.every((org) => org.ticketsSold === 0)) buckets.push('no_sales')

    const recipient = { userId: user.id, email }
    const blocked = opts.blockedEmails.has(email)
    for (const bucket of buckets) {
      if (blocked) result[bucket].alreadySent += 1
      else result[bucket].willSend.push(recipient)
    }
  }

  return result
}
