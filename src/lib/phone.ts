/** Keep a leading + and digits. Matches checkout WhatsApp storage. */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, '')
}

export function phoneDigits(phone: string | null | undefined): string {
  return (phone || '').replace(/\D/g, '')
}

/** Same number, including a missing country code on one side. */
export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = phoneDigits(a)
  const right = phoneDigits(b)
  if (!left || !right) return false
  if (left === right) return true
  return left.length >= 10 && right.length >= 10 && left.slice(-10) === right.slice(-10)
}
