import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'
import { getTenantUrl } from '@/lib/constants'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

function escapeIlike(value: string) {
  return value.replace(/[%_,()]/g, '').trim()
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const { admin } = auth
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )
  const q = escapeIlike(url.searchParams.get('q') || '')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = admin
    .from('raffles')
    .select(
      'id, title, status, featured, ticket_price, created_at, org_id, organizations ( id, name, slug )',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (q) {
    const { data: matchingOrgs, error: orgError } = await admin
      .from('organizations')
      .select('id')
      .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
      .limit(200)

    if (orgError) {
      return NextResponse.json({ success: false, error: orgError.message }, { status: 500 })
    }

    const orgIds = (matchingOrgs || []).map((org) => org.id)
    const filters = [`title.ilike.%${q}%`]
    if (orgIds.length > 0) filters.push(`org_id.in.(${orgIds.join(',')})`)
    query = query.or(filters.join(','))
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const ids = (data || []).map((row) => row.id)
  const countsByRaffle = new Map<string, { total: number; taken: number }>()

  if (ids.length > 0) {
    const { data: counts, error: countsError } = await admin.rpc('superadmin_raffle_ticket_counts', {
      p_raffle_ids: ids,
    })
    if (countsError) {
      return NextResponse.json({ success: false, error: countsError.message }, { status: 500 })
    }
    for (const row of counts || []) {
      countsByRaffle.set(row.raffle_id, {
        total: Number(row.total) || 0,
        taken: Number(row.taken) || 0,
      })
    }
  }

  const raffles = (data || []).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
    const counts = countsByRaffle.get(row.id)
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      featured: Boolean(row.featured),
      ticketPrice: Number(row.ticket_price) || 0,
      totalTickets: counts?.total ?? 0,
      soldTickets: counts?.taken ?? 0,
      createdAt: row.created_at,
      org: org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            url: getTenantUrl(org.slug),
          }
        : null,
    }
  })

  return NextResponse.json({
    success: true,
    data: raffles,
    page,
    pageSize,
    total: count ?? raffles.length,
  })
}
