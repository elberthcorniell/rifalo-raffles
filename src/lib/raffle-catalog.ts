import { getTenantUrl } from '@/lib/constants'
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

export async function fetchCatalogRaffles(limit = 48): Promise<CatalogRaffle[]> {
  if (!hasSupabaseConfig()) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('raffles')
    .select('id, title, image_path, ticket_price, status, org_id')
    .in('status', ['active', 'ended', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.error('Error fetching raffle catalog:', error.message)
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
        href: getTenantUrl(org.slug, `/raffles/${row.id}`),
      },
    ]
  })
}
