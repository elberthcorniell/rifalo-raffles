/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Missing secret fails closed. */
export function cronAuthorized(
  authorization: string | null,
  secret: string | null | undefined,
): boolean {
  const expected = secret?.trim()
  if (!expected) return false
  return authorization === `Bearer ${expected}`
}
