import { BLOG_EMAIL_EXCLUDED_ORG_SLUGS, normalizeBlogEmail } from '@/lib/blog-audience'

export const ACTIVATION_DAY_MS = 24 * 60 * 60 * 1000
/** Day 1 is due from 24h after signup until the day-3 window opens. */
export const ACTIVATION_DAY1_MIN_MS = ACTIVATION_DAY_MS
export const ACTIVATION_DAY1_MAX_MS = 3 * ACTIVATION_DAY_MS
/** Day 3 is due from 72h, and only while the organizer still has no sold tickets. */
export const ACTIVATION_DAY3_MIN_MS = 3 * ACTIVATION_DAY_MS
export const ACTIVATION_DAY3_MAX_MS = 5 * ACTIVATION_DAY_MS
export const ACTIVATION_CLAIM_STALE_MS = 15 * 60 * 1000

const EXCLUDED = new Set<string>(BLOG_EMAIL_EXCLUDED_ORG_SLUGS)

export const ACTIVATION_PROPERTY_KEYS = [
  { key: 'org_slug', type: 'string' },
  { key: 'raffle_link', type: 'string' },
  { key: 'has_published_raffle', type: 'string' },
  { key: 'tickets_sold', type: 'number' },
  { key: 'has_first_sale', type: 'string' },
  { key: 'signup_date', type: 'string' },
] as const

export type OrganizerOrgInput = {
  slug: string
  name: string
  customDomain: string | null
  createdAt: string
  hasActiveRaffle: boolean
  /** Confirmed tickets only (status sold). */
  ticketsSold: number
  /** Reserved tickets whose purchase already has a payment receipt. */
  pendingReceipts: number
}

export type OrganizerInput = {
  userId: string
  email: string | null
  emailConfirmed: boolean
  fullName: string | null
  signupAt: string | null
  unsubscribed: boolean
  orgs: OrganizerOrgInput[]
}

export type OrganizerContact = {
  userId: string
  email: string
  firstName: string
  orgSlug: string
  raffleLink: string
  hasPublishedRaffle: boolean
  ticketsSold: number
  hasFirstSale: boolean
  signupDate: string
  signupAt: string
  noSales: boolean
}

export type OrganizerSkipReason = 'invalid_email' | 'unconfirmed' | 'unsubscribed' | 'excluded'

export type OrganizerDecision =
  | { action: 'sync'; contact: OrganizerContact }
  | { action: 'skip'; reason: OrganizerSkipReason }

export type SyncPreview = {
  willSync: number
  noSales: number
  withSales: number
  withActiveRaffle: number
  invalidEmail: number
  unconfirmed: number
  unsubscribed: number
  excluded: number
}

export type ActivationSendRecord = {
  kind: 'day1' | 'day3'
  status: string
  claimedAt: string
}

export function organizerRaffleLink(
  org: { slug: string; customDomain: string | null },
  rootDomain = 'rifalo.do',
): string {
  const custom = publicHost(org.customDomain)
  if (custom && custom.includes('.')) return `https://${custom}`
  const configured = publicHost(rootDomain.split(',')[0] || '') || 'rifalo.do'
  const apex =
    configured.startsWith('localhost') || configured.startsWith('127.0.0.1') ? 'rifalo.do' : configured
  return `https://${org.slug}.${apex}`
}

export function organizerFirstName(input: {
  fullName: string | null
  orgName: string | null
  email: string
}): string {
  return cleanName(input.fullName) || cleanName(input.orgName) || nameFromEmail(input.email)
}

export function classifyOrganizer(input: OrganizerInput, rootDomain = 'rifalo.do'): OrganizerDecision {
  const email = normalizeBlogEmail(input.email)
  if (!email) return { action: 'skip', reason: 'invalid_email' }
  if (!input.emailConfirmed) return { action: 'skip', reason: 'unconfirmed' }
  if (input.unsubscribed) return { action: 'skip', reason: 'unsubscribed' }

  const real = dedupedRealOrgs(input.orgs)
  if (real.length === 0) return { action: 'skip', reason: 'excluded' }

  const active = real.filter((org) => org.hasActiveRaffle)
  const pool = (active.length > 0 ? active : real)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const chosen = pool[0]
  const ticketsSold = active.reduce((sum, org) => sum + Math.max(0, org.ticketsSold || 0), 0)
  const pendingReceipts = active.reduce((sum, org) => sum + Math.max(0, org.pendingReceipts || 0), 0)
  const hasPublishedRaffle = active.length > 0
  const hasFirstSale = ticketsSold > 0 || pendingReceipts > 0
  const signupAt = input.signupAt || ''

  return {
    action: 'sync',
    contact: {
      userId: input.userId,
      email,
      firstName: organizerFirstName({ fullName: input.fullName, orgName: chosen.name, email }),
      orgSlug: chosen.slug,
      raffleLink: organizerRaffleLink(chosen, rootDomain),
      hasPublishedRaffle,
      ticketsSold,
      hasFirstSale,
      signupDate: signupDate(signupAt),
      signupAt,
      noSales: hasPublishedRaffle && !hasFirstSale,
    },
  }
}

/**
 * A pending comprobante reserves tickets and stores the receipt on the purchase.
 * Referral rewards are created already sold and have no voucher, so a reserved
 * ticket without a receipt is not a first sale.
 */
export function ticketSaleActivity(ticket: {
  status: string
  voucherPath?: string | null
}): 'sold' | 'pending_receipt' | 'none' {
  if (ticket.status === 'sold') return 'sold'
  if (ticket.status === 'reserved' && Boolean(ticket.voucherPath?.trim())) return 'pending_receipt'
  return 'none'
}

export function previewOrganizerSync(inputs: OrganizerInput[], rootDomain = 'rifalo.do'): SyncPreview {
  const preview: SyncPreview = {
    willSync: 0,
    noSales: 0,
    withSales: 0,
    withActiveRaffle: 0,
    invalidEmail: 0,
    unconfirmed: 0,
    unsubscribed: 0,
    excluded: 0,
  }
  for (const input of inputs) {
    const decision = classifyOrganizer(input, rootDomain)
    if (decision.action === 'skip') {
      preview[skipCountKey(decision.reason)] += 1
      continue
    }
    preview.willSync += 1
    if (decision.contact.noSales) preview.noSales += 1
    if (decision.contact.hasFirstSale) preview.withSales += 1
    if (decision.contact.hasPublishedRaffle) preview.withActiveRaffle += 1
  }
  return preview
}

export function toResendContactBody(contact: OrganizerContact): {
  email: string
  first_name: string
  properties: {
    org_slug: string
    raffle_link: string
    has_published_raffle: 'true' | 'false'
    tickets_sold: number
    has_first_sale: 'true' | 'false'
    signup_date: string
  }
} {
  return {
    email: contact.email,
    first_name: contact.firstName,
    properties: {
      org_slug: contact.orgSlug,
      raffle_link: contact.raffleLink,
      has_published_raffle: contact.hasPublishedRaffle ? 'true' : 'false',
      tickets_sold: contact.ticketsSold,
      has_first_sale: contact.hasFirstSale ? 'true' : 'false',
      signup_date: contact.signupDate,
    },
  }
}

export function activationTargets(
  input: OrganizerInput,
  records: ActivationSendRecord[],
  now: Date,
  rootDomain = 'rifalo.do',
): { day1: boolean; day3: boolean } {
  const decision = classifyOrganizer(input, rootDomain)
  if (decision.action === 'skip' || !decision.contact.hasPublishedRaffle || !decision.contact.raffleLink) {
    return { day1: false, day3: false }
  }
  const age = signupAgeMs(decision.contact.signupAt, now)
  if (age == null) return { day1: false, day3: false }
  const day1 =
    age >= ACTIVATION_DAY1_MIN_MS &&
    age < ACTIVATION_DAY1_MAX_MS &&
    !sendBlocks(records, 'day1', now)
  const day3 =
    age >= ACTIVATION_DAY3_MIN_MS &&
    age < ACTIVATION_DAY3_MAX_MS &&
    !decision.contact.hasFirstSale &&
    !sendBlocks(records, 'day3', now)
  return { day1, day3 }
}

export function decideClaim(
  existing: { status: string; claimedAt: string } | null,
  now: Date,
): 'insert' | 'retry' | 'skip' {
  if (!existing) return 'insert'
  if (existing.status === 'sent') return 'skip'
  if (existing.status === 'failed') return 'retry'
  if (existing.status !== 'pending') return 'skip'
  const claimed = Date.parse(existing.claimedAt)
  if (!Number.isFinite(claimed)) return 'skip'
  return now.getTime() - claimed >= ACTIVATION_CLAIM_STALE_MS ? 'retry' : 'skip'
}

function sendBlocks(records: ActivationSendRecord[], kind: 'day1' | 'day3', now: Date): boolean {
  const row = records.find((record) => record.kind === kind)
  if (!row) return false
  return decideClaim({ status: row.status, claimedAt: row.claimedAt }, now) === 'skip'
}

function skipCountKey(reason: OrganizerSkipReason): 'invalidEmail' | 'unconfirmed' | 'unsubscribed' | 'excluded' {
  if (reason === 'invalid_email') return 'invalidEmail'
  if (reason === 'unconfirmed') return 'unconfirmed'
  if (reason === 'unsubscribed') return 'unsubscribed'
  return 'excluded'
}

function dedupedRealOrgs(orgs: OrganizerOrgInput[]): OrganizerOrgInput[] {
  const seen = new Set<string>()
  const real: OrganizerOrgInput[] = []
  for (const org of orgs) {
    if (!org.slug || EXCLUDED.has(org.slug) || seen.has(org.slug)) continue
    seen.add(org.slug)
    real.push(org)
  }
  return real
}

function publicHost(value: string | null | undefined): string | null {
  const host = (value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
  if (!host || /\s/.test(host)) return null
  return host
}

function cleanName(value: string | null | undefined): string | null {
  const token = (value || '').trim().split(/\s+/)[0] || ''
  if (token.length < 2 || token.length > 40) return null
  if (/[@\d]/.test(token)) return null
  return token
}

function nameFromEmail(email: string): string {
  const word = (email.split('@')[0] || '').split(/[._+-]/)[0] || ''
  const letters = word.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')
  if (letters.length < 2) return 'organizador'
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase()
}

function signupDate(value: string): string {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return ''
  return new Date(time).toISOString().slice(0, 10)
}

function signupAgeMs(value: string, now: Date): number | null {
  const created = Date.parse(value)
  if (!Number.isFinite(created)) return null
  return now.getTime() - created
}
