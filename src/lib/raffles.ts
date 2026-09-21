import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'
import type { DbRaffle, Raffle } from '@/types/raffle'

export function getPublicImageUrl(path: string | null | undefined): string {
  if (!path) return '/placeholder.svg'
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
    return path
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return '/placeholder.svg'
  return `${base}/storage/v1/object/public/raffle-images/${path}`
}

export function computeTimeLeft(endDate: string | null | undefined): string {
  if (!endDate) return 'Sin fecha'
  const end = new Date(endDate)
  const now = new Date()
  const diffTime = end.getTime() - now.getTime()
  if (diffTime <= 0) return 'Finalizada'
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return `${diffDays}d ${diffHours}h`
}

export async function getTicketCounts(raffleIds: string[]): Promise<
  Record<string, { total: number; taken: number; available: number }>
> {
  const result: Record<string, { total: number; taken: number; available: number }> = {}
  for (const id of raffleIds) {
    result[id] = { total: 0, taken: 0, available: 0 }
  }
  if (raffleIds.length === 0) return result
  if (!hasSupabaseConfig()) return result

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tickets')
    .select('raffle_id, status')
    .in('raffle_id', raffleIds)

  if (error) {
    console.error('Error fetching ticket counts:', error)
    return result
  }

  for (const row of data || []) {
    const bucket = result[row.raffle_id]
    if (!bucket) continue
    bucket.total += 1
    if (row.status === 'available') {
      bucket.available += 1
    } else {
      bucket.taken += 1
    }
  }

  return result
}

const MAX_RAFFLE_TICKETS = 100000
const TICKET_MUTATION_CHUNK = 200

type AdminClient = ReturnType<typeof createAdminClient>
type TicketRow = { id: string; number: number; status: string }

async function applyInChunks<T>(
  items: T[],
  apply: (chunk: T[]) => Promise<{ error: { message: string } | null }>
) {
  for (let i = 0; i < items.length; i += TICKET_MUTATION_CHUNK) {
    const { error } = await apply(items.slice(i, i + TICKET_MUTATION_CHUNK))
    if (error) throw new Error(error.message)
  }
}

async function rebuildTicketRanges(admin: AdminClient, raffleId: string) {
  const { data: remaining, error } = await admin
    .from('tickets')
    .select('id, number')
    .eq('raffle_id', raffleId)
    .order('number', { ascending: true })

  if (error) throw new Error(error.message)

  const { error: deleteRangesError } = await admin
    .from('ticket_ranges')
    .delete()
    .eq('raffle_id', raffleId)

  if (deleteRangesError) throw new Error(deleteRangesError.message)

  const tickets = remaining || []
  if (tickets.length === 0) return

  const groups: { start: number; end: number; ids: string[] }[] = []
  for (const ticket of tickets) {
    const last = groups[groups.length - 1]
    if (last && ticket.number === last.end + 1) {
      last.end = ticket.number
      last.ids.push(ticket.id)
    } else {
      groups.push({ start: ticket.number, end: ticket.number, ids: [ticket.id] })
    }
  }

  for (const group of groups) {
    const { data: range, error: insertError } = await admin
      .from('ticket_ranges')
      .insert({
        raffle_id: raffleId,
        start_number: group.start,
        end_number: group.end,
      })
      .select('id')
      .single()

    if (insertError || !range) {
      throw new Error(insertError?.message || 'No se pudo reconstruir el rango')
    }

    await applyInChunks(group.ids, async (chunk) => {
      const { error } = await admin
        .from('tickets')
        .update({ range_id: range.id })
        .in('id', chunk)
      return { error }
    })
  }
}

async function mergeAdjacentRanges(admin: AdminClient, raffleId: string) {
  const { data: ranges, error } = await admin
    .from('ticket_ranges')
    .select('id, start_number, end_number')
    .eq('raffle_id', raffleId)
    .order('start_number', { ascending: true })

  if (error) throw new Error(error.message)
  if (!ranges || ranges.length < 2) return

  for (let i = 0; i < ranges.length - 1; i++) {
    const current = ranges[i]
    const next = ranges[i + 1]
    if (current.end_number + 1 !== next.start_number) continue

    const { error: moveError } = await admin
      .from('tickets')
      .update({ range_id: current.id })
      .eq('range_id', next.id)
    if (moveError) throw new Error(moveError.message)

    const { error: updateError } = await admin
      .from('ticket_ranges')
      .update({ end_number: next.end_number })
      .eq('id', current.id)
    if (updateError) throw new Error(updateError.message)

    const { error: deleteError } = await admin.from('ticket_ranges').delete().eq('id', next.id)
    if (deleteError) throw new Error(deleteError.message)

    current.end_number = next.end_number
    ranges.splice(i + 1, 1)
    i -= 1
  }
}

/**
 * Grow or shrink a raffle's ticket pool to match `desiredTotal`.
 * Adds numbers after the current max; removes highest available tickets.
 */
export async function syncRaffleTicketTotal(
  admin: AdminClient,
  raffleId: string,
  desiredTotal: number
) {
  const desired = Math.floor(Number(desiredTotal))
  if (!Number.isFinite(desired) || desired < 1) {
    throw new Error('El total de boletos debe ser al menos 1')
  }
  if (desired > MAX_RAFFLE_TICKETS) {
    throw new Error(`El total no puede superar ${MAX_RAFFLE_TICKETS.toLocaleString('es-DO')} boletos`)
  }

  const { data: tickets, error } = await admin
    .from('tickets')
    .select('id, number, status')
    .eq('raffle_id', raffleId)
    .order('number', { ascending: true })

  if (error) throw new Error(error.message)

  const rows = (tickets || []) as TicketRow[]
  const taken = rows.filter((ticket) => ticket.status !== 'available').length
  if (desired < taken) {
    throw new Error(
      `No se puede reducir a ${desired.toLocaleString('es-DO')}. Hay ${taken.toLocaleString('es-DO')} boletos tomados.`
    )
  }
  if (desired === rows.length) return

  if (desired > rows.length) {
    const add = desired - rows.length
    const maxNumber = rows.length ? rows[rows.length - 1].number : 0
    const { error: rangeError } = await admin.rpc('generate_ticket_range', {
      p_raffle_id: raffleId,
      p_start: maxNumber + 1,
      p_end: maxNumber + add,
    })
    if (rangeError) throw new Error(rangeError.message)
    await mergeAdjacentRanges(admin, raffleId)
    return
  }

  const removable = rows
    .filter((ticket) => ticket.status === 'available')
    .sort((a, b) => b.number - a.number)
    .slice(0, rows.length - desired)
    .map((ticket) => ticket.id)

  await applyInChunks(removable, async (chunk) => {
    const { error } = await admin.from('tickets').delete().in('id', chunk)
    return { error }
  })
  await rebuildTicketRanges(admin, raffleId)
}

export function mapRaffle(
  row: DbRaffle,
  counts?: { total: number; taken: number; available: number }
): Raffle {
  return {
    id: row.id,
    title: row.title || 'Rifa sin título',
    description: row.description || 'Participa en esta increíble rifa y gana premios increíbles.',
    ticketPrice: Number(row.ticket_price) || 0,
    minTickets: Math.max(1, Number(row.min_tickets) || 1),
    totalTickets: counts?.total ?? 0,
    soldTickets: counts?.taken ?? 0,
    timeLeft: computeTimeLeft(row.end_date),
    image: getPublicImageUrl(row.image_path),
    featured: row.featured === true,
    status: row.status,
    endDate: row.end_date,
  }
}

/**
 * Fetches active raffles for an organization (server-side).
 */
export async function fetchRaffles(options?: {
  page?: number
  limit?: number
  orgId: string
}): Promise<{
  raffles: Raffle[]
  total: number
}> {
  const page = options?.page || 1
  const limit = options?.limit || 50
  const from = (page - 1) * limit
  const to = from + limit - 1
  const orgId = options?.orgId

  try {
    if (!orgId || !hasSupabaseConfig()) {
      return { raffles: [], total: 0 }
    }
    const supabase = createAdminClient()
    const { data, error, count } = await supabase
      .from('raffles')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    const rows = (data || []) as DbRaffle[]
    const counts = await getTicketCounts(rows.map((r) => r.id))
    const raffles = rows.map((row) => mapRaffle(row, counts[row.id]))

    return {
      raffles,
      total: count ?? raffles.length,
    }
  } catch (error) {
    console.error('Error fetching raffles:', error)
    return { raffles: [], total: 0 }
  }
}

export async function fetchFirstRaffle(orgId: string): Promise<Raffle | null> {
  const { raffles } = await fetchRaffles({ page: 1, limit: 1, orgId })
  return raffles[0] || null
}

export async function fetchRaffleById(id: string, orgId: string): Promise<Raffle | null> {
  if (!hasSupabaseConfig() || !orgId) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('raffles')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const counts = await getTicketCounts([id])
  return mapRaffle(data as DbRaffle, counts[id])
}
