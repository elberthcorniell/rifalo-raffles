import { getTenantUrl } from '@/lib/constants'
import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'
import type { WelcomeLinks } from '@/lib/emails/welcome'

/**
 * Raffle and panel URLs for the signed-in user. Looks up membership server-side
 * so the request body cannot supply a link.
 */
export async function loadWelcomeLinks(userId: string): Promise<WelcomeLinks | null> {
  if (!hasSupabaseConfig()) return null

  const admin = createAdminClient()
  const { data: memberships, error: memberError } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)

  if (memberError || !memberships?.length) return null

  const ids = memberships.map((membership) => membership.org_id).filter(Boolean)
  if (!ids.length) return null

  const { data: orgs, error: orgError } = await admin
    .from('organizations')
    .select('id, slug, created_at')
    .in('id', ids)

  if (orgError || !orgs?.length) return null

  const org = [...orgs].sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || '')),
  )[0]
  if (!org?.id || !org.slug) return null

  const { data: raffles, error: raffleError } = await admin
    .from('raffles')
    .select('id, title')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const raffle = raffles?.[0]
  if (raffleError || !raffle?.id || !raffle.title) return null

  return {
    raffleTitle: raffle.title,
    raffleUrl: getTenantUrl(org.slug, `/raffles/${raffle.id}`),
    panelUrl: getTenantUrl(org.slug, '/admin'),
  }
}
