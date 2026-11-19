export const HERO_EYEBROW = '¿Organizas rifas?'

export const HERO_CTA_LABEL = 'Crea tu rifa gratis'

export const HERO_CTA_HREF = '/signup'

/** No figures. Used when counts are missing or too small to be useful. */
export const HERO_PROOF_FALLBACK =
  'Organizadores en República Dominicana ya venden sus boletos con Rifalo'

/**
 * Below these, a count reads like an empty product, so that part is omitted.
 * Fewer than 20 live raffles is too small to put next to the headline; ticket
 * sales can stand on their own sooner. If both are below, the fallback line is used.
 */
export const HERO_PROOF_MIN_LIVE_RAFFLES = 20
export const HERO_PROOF_MIN_TICKETS_SOLD = 100

export type HeroProofCounts = {
  liveRaffles: number
  ticketsSold: number
}

/**
 * Obvious test raffles are left out of the public counts.
 * Matches the filters in hero-stats: title contains "prueba", or the whole
 * title is "test" (case-insensitive).
 */
export function isObviousTestRaffleTitle(title: string): boolean {
  const value = title.trim().toLowerCase()
  return value.includes('prueba') || value === 'test'
}

function wholeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('es-DO').format(value)
}

export function describeLiveRaffles(count: number): string {
  const label = count === 1 ? 'rifa activa' : 'rifas activas'
  return `${formatCount(count)} ${label}`
}

export function describeTicketsSold(count: number): string {
  const label = count === 1 ? 'boleto vendido' : 'boletos vendidos'
  return `${formatCount(count)} ${label}`
}

/** One social-proof line. Never invents a number; small or missing counts fall back. */
export function formatHeroProof(counts: HeroProofCounts | null | undefined): string {
  if (!counts) return HERO_PROOF_FALLBACK
  const liveRaffles = wholeCount(counts.liveRaffles)
  const ticketsSold = wholeCount(counts.ticketsSold)
  const showRaffles = liveRaffles >= HERO_PROOF_MIN_LIVE_RAFFLES
  const showTickets = ticketsSold >= HERO_PROOF_MIN_TICKETS_SOLD
  if (showRaffles && showTickets) {
    return `${describeLiveRaffles(liveRaffles)} · ${describeTicketsSold(ticketsSold)}`
  }
  if (showTickets) return describeTicketsSold(ticketsSold)
  if (showRaffles) return describeLiveRaffles(liveRaffles)
  return HERO_PROOF_FALLBACK
}
