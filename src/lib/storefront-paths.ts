export const WINNERS_PATH = '/ganadores'

export const LEGAL_DOC_PATHS = {
  terms: '/terminos',
  privacy: '/privacidad',
  rules: '/reglamento',
  support: '/soporte',
} as const

const TENANT_CONTENT_PATHS = [WINNERS_PATH, ...Object.values(LEGAL_DOC_PATHS)]

/** Public pages that belong to a tenant site, not the platform apex. */
export function isTenantContentPath(pathname: string): boolean {
  return TENANT_CONTENT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}
