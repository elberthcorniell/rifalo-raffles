import { hasSupabaseConfig } from '@/lib/supabase/admin'

export type PublishedWinner = {
  id: string
  name: string
  raffleTitle: string
  ticketLabel: string | null
  announcedAt: string | null
}

/**
 * Published draw results for one organizer.
 * Raffles, tickets, and purchases do not store a winner, so this stays empty
 * until that data exists. Purchasers are not listed here.
 */
export async function listPublishedWinners(orgId: string): Promise<PublishedWinner[]> {
  if (!orgId || !hasSupabaseConfig()) return []
  return []
}

export function formatWinnerDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Santo_Domingo',
  })
}
