export const REFERRAL_CODE_RE = /^[a-z0-9]{8}$/
export const REFERRAL_STORAGE_PREFIX = 'cura-referral:'

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function referralStorageKey(raffleId: string): string {
  return `${REFERRAL_STORAGE_PREFIX}${raffleId}`
}

export function generateReferralCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export function readStoredReferralCode(raffleId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const code = sessionStorage.getItem(referralStorageKey(raffleId))
    return code && REFERRAL_CODE_RE.test(code) ? code : null
  } catch {
    return null
  }
}

export function storeReferralCode(raffleId: string, code: string): void {
  if (!REFERRAL_CODE_RE.test(code)) return
  try {
    sessionStorage.setItem(referralStorageKey(raffleId), code)
  } catch {
    // Private mode can reject storage. The purchase still sends the code
    // when the page that stored it is the one submitting.
  }
}
