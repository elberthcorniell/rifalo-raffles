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

/**
 * Brand-agnostic on purpose: it is served on client subdomains and custom
 * domains, so it must not carry any Rifalo or tenant name, logo, color or link.
 * Self-contained (inline CSS, no assets) so it works with no database.
 */
export const TENANT_UNAVAILABLE_TITLE = 'Sitio temporalmente no disponible'
export const TENANT_UNAVAILABLE_MESSAGE =
  'Estamos teniendo un problema técnico. Intenta de nuevo en unos minutos.'

export const TENANT_UNAVAILABLE_BODY = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${TENANT_UNAVAILABLE_TITLE}</title>
<style>
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;background:#fafafa;color:#27272a;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:420px;text-align:center}
h1{font-size:1.25rem;font-weight:600;margin:0 0 .75rem;letter-spacing:-.01em}
p{font-size:.95rem;line-height:1.55;margin:0;color:#52525b}
</style>
</head>
<body>
<main>
<h1>${TENANT_UNAVAILABLE_TITLE}</h1>
<p>${TENANT_UNAVAILABLE_MESSAGE}</p>
</main>
</body>
</html>
`
