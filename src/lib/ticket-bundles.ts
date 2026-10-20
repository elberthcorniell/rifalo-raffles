export type BundleBadge = '' | 'best' | 'vip'

export interface BundlePrice {
  quantity: number
  price: number
  label: string
  badge: BundleBadge
}

export interface BundleDraft {
  quantity: string
  price: string
  label: string
  badge: BundleBadge
}

const MAX_BUNDLES = 20
const MAX_QUANTITY = 100000
const MAX_PRICE = 9_999_999_999.99

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function regularTotal(quantity: number, ticketPrice: number) {
  return roundMoney(quantity * ticketPrice)
}

/** One purchase cannot exceed 10% of the raffle's total tickets. */
export function maxTicketsPerPurchase(totalTickets: number) {
  const total = Math.max(0, Math.floor(Number(totalTickets) || 0))
  return Math.max(1, Math.floor(total * 0.1))
}

export function moneyEquals(a: number, b: number) {
  return Math.abs(roundMoney(a) - roundMoney(b)) < 0.001
}

/** Bundle price when that quantity has a package; otherwise quantity × ticket price. */
export function priceForQuantity(
  quantity: number,
  ticketPrice: number,
  bundles: Pick<BundlePrice, "quantity" | "price">[]
) {
  const match = bundles.find((bundle) => bundle.quantity === quantity)
  if (match) return roundMoney(Number(match.price))
  return regularTotal(quantity, ticketPrice)
}

export function parseBundleInputs(
  input: unknown
): { bundles: BundlePrice[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Los paquetes no son válidos' }
  if (input.length > MAX_BUNDLES) {
    return { error: `Puedes crear hasta ${MAX_BUNDLES} paquetes` }
  }

  const bundles: BundlePrice[] = []
  const seen = new Set<number>()

  for (const item of input) {
    if (!item || typeof item !== 'object') return { error: 'Hay un paquete inválido' }
    const record = item as Record<string, unknown>
    const quantity = parseInt(String(record.quantity), 10)
    const price = Number(record.price)

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { error: 'La cantidad de cada paquete debe ser al menos 1' }
    }
    if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
      return { error: 'El precio especial de cada paquete no es válido' }
    }
    if (seen.has(quantity)) {
      return { error: `Ya hay un paquete de ${quantity} boletos` }
    }

    const label = String(record.label ?? '').trim().slice(0, 40)
    const rawBadge = String(record.badge ?? '')
    const badge: BundleBadge = rawBadge === 'best' || rawBadge === 'vip' ? rawBadge : ''

    seen.add(quantity)
    bundles.push({ quantity, price: roundMoney(price), label, badge })
  }

  bundles.sort((a, b) => a.quantity - b.quantity)
  return { bundles }
}

/** Skips blank rows. A row with only one field filled is an error. */
export function parseBundleDrafts(
  drafts: BundleDraft[]
): { bundles: BundlePrice[] } | { error: string } {
  const filled = drafts.filter(
    (draft) =>
      draft.quantity.trim() !== '' ||
      draft.price.trim() !== '' ||
      (draft.label || '').trim() !== ''
  )
  for (const draft of filled) {
    if (draft.quantity.trim() === '' || draft.price.trim() === '') {
      return { error: 'Completa la cantidad y el precio especial de cada paquete' }
    }
  }
  return parseBundleInputs(filled)
}
