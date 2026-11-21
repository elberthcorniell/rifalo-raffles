const MAX_RECIPIENTS = 10

export function normalizeRecipient(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase()
  if (!email || !email.includes('@') || email.length > 320) return null
  if (email.includes(' ') || email.startsWith('@') || email.endsWith('@')) return null
  return email
}

/**
 * Owner accounts first. Organization contact emails are only a fallback when
 * no owner address could be read.
 */
export function selectReminderRecipients(
  ownerEmails: Array<string | null | undefined>,
  fallbacks: Array<string | null | undefined> = [],
): string[] {
  const seen = new Set<string>()
  const add = (value: string | null | undefined) => {
    const email = normalizeRecipient(value)
    if (!email || seen.has(email)) return
    seen.add(email)
  }

  for (const email of ownerEmails) add(email)
  if (seen.size === 0) {
    for (const email of fallbacks) add(email)
  }
  return [...seen].slice(0, MAX_RECIPIENTS)
}
