/**
 * Tenant lookups run in the middleware on every request. When Supabase rejects
 * the query (402 when the project is restricted, 401 on a bad key, 5xx), the
 * result has `data: null` plus an error. Treating that as "no organization"
 * shows "Esta página no existe" on every client subdomain and sends custom
 * domains to the marketing home, which hides the outage. Throw instead.
 */
export class TenantLookupError extends Error {
  status: number | null
  code: string | null

  constructor(message: string, status: number | null, code: string | null) {
    super(message)
    this.name = 'TenantLookupError'
    this.status = status
    this.code = code
  }
}

type LookupResult<T> = {
  data: T | null
  error: { message?: string; code?: string } | null
  status?: number
}

export function readTenantRow<T>(result: LookupResult<T>): T | null {
  if (result.error) {
    throw new TenantLookupError(
      result.error.message || 'Tenant lookup failed',
      typeof result.status === 'number' ? result.status : null,
      result.error.code ?? null
    )
  }
  return result.data ?? null
}

export const TENANT_UNAVAILABLE_BODY =
  'Rifalo no está disponible en este momento. Intenta de nuevo en unos minutos.'
