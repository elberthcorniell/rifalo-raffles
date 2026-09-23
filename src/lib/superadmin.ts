/** Only this account can open the platform superadmin panel. */
export const SUPERADMIN_EMAIL = 'elberthcorniell@gmail.com'

export function isSuperadminEmail(email: string | undefined | null): boolean {
  return (email || '').trim().toLowerCase() === SUPERADMIN_EMAIL
}

export function isSuperadminPath(pathname: string): boolean {
  return pathname === '/superadmin' || pathname.startsWith('/superadmin/')
}

export function safeSuperadminNext(value: string | null | undefined): string | null {
  if (!value) return null
  if (value === '/superadmin' || value.startsWith('/superadmin/')) return value
  return null
}
