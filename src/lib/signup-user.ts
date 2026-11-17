/**
 * True only when this signUp response created an auth user.
 * Supabase returns identities: [] for an email that already exists when
 * confirmations are on, so a repeat signup or a login must not count.
 */
export function isNewlyCreatedAuthUser(
  user: { id?: string | null; identities?: unknown[] | null } | null | undefined,
): boolean {
  if (!user?.id) return false;
  return Array.isArray(user.identities) && user.identities.length > 0;
}
