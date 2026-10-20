import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'
import { getPublicImageUrl } from '@/lib/raffles'
import type { RaffleStatus } from '@/types/raffle'

export type CatalogRaffle = {
  id: string
  title: string
  image: string
  ticketPrice: number
  soldTickets: number
  totalTickets: number
  status: RaffleStatus
  orgName: string
  orgSlug: string
  href: string
  verified: boolean
}

type CatalogRow = {
  id: string
  title: string
  image_path: string | null
  ticket_price: number
  status: RaffleStatus
  org_id: string
}

type OrgRow = {
  id: string
  name: string
  slug: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CatalogRaffleDetail = {
  id: string
  title: string
  description: string
  image: string
  ticketPrice: number
  orgName: string
}

/** One verified raffle, for the explore page and its share tags. */
export async function fetchCatalogRaffle(id: string): Promise<CatalogRaffleDetail | null> {
  if (!UUID_RE.test(id) || !hasSupabaseConfig()) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('raffles')
    .select('id, title, description, image_path, ticket_price, org_id')
    .eq('id', id)
    .eq('status', 'active')
    .eq('verification_status', 'verified')
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('Error fetching catalog raffle:', error.message)
    return null
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('id', data.org_id)
    .maybeSingle()

  if (orgError || !org?.slug) {
    if (orgError) console.error('Error fetching catalog raffle organization:', orgError.message)
    return null
  }

  return {
    id: data.id,
    title: data.title || 'Rifa',
    description: data.description || '',
    image: getPublicImageUrl(data.image_path),
    ticketPrice: Number(data.ticket_price) || 0,
    orgName: org.name,
  }
}

/** Active raffles approved for the platform verified catalog. */
export async function fetchCatalogRaffles(limit = 48): Promise<CatalogRaffle[]> {
  if (!hasSupabaseConfig()) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('raffles')
    .select('id, title, image_path, ticket_price, status, org_id')
    .eq('status', 'active')
    .eq('verification_status', 'verified')
    .order('verification_reviewed_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.error('Error fetching raffle catalog:', error?.message)
    return []
  }

  const rows = data as CatalogRow[]
  const orgIds = [...new Set(rows.map((row) => row.org_id).filter(Boolean))]
  const orgs = new Map<string, OrgRow>()

  if (orgIds.length > 0) {
    const { data: orgRows, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .in('id', orgIds)

    if (orgError) {
      console.error('Error fetching catalog organizations:', orgError.message)
    } else {
      for (const org of (orgRows || []) as OrgRow[]) {
        orgs.set(org.id, org)
      }
    }
  }

  const ids = rows.map((row) => row.id)
  const counts = new Map<string, { total: number; taken: number }>()

  if (ids.length > 0) {
    const { data: countRows, error: countError } = await supabase.rpc(
      'superadmin_raffle_ticket_counts',
      { p_raffle_ids: ids }
    )
    if (countError) {
      console.error('Error fetching catalog ticket counts:', countError)
    } else {
      for (const row of countRows || []) {
        counts.set(row.raffle_id, { total: row.total, taken: row.taken })
      }
    }
  }

  return rows.flatMap((row) => {
    const org = orgs.get(row.org_id)
    if (!org?.slug) return []
    const count = counts.get(row.id)
    return [
      {
        id: row.id,
        title: row.title || 'Rifa',
        image: getPublicImageUrl(row.image_path),
        ticketPrice: Number(row.ticket_price) || 0,
        soldTickets: count?.taken ?? 0,
        totalTickets: count?.total ?? 0,
        status: row.status,
        orgName: org.name,
        orgSlug: org.slug,
        href: `/explore/${row.id}`,
        verified: true,
      },
    ]
  })
}
