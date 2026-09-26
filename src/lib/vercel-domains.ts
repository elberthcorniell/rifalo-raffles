import type { CustomDomainStatus, DomainDnsRecord } from '@/lib/custom-domain'

const API = 'https://api.vercel.com'

type VerificationChallenge = {
  type: string
  domain: string
  value: string
  reason: string
}

type ProjectDomain = {
  name: string
  apexName: string
  verified: boolean
  redirect?: string | null
  verification?: VerificationChallenge[]
}

type RankedValue = { rank: number; value: string }
type RankedIps = { rank: number; value: string[] }

type DomainConfig = {
  configuredBy: 'A' | 'CNAME' | 'dns-01' | 'http' | null
  misconfigured: boolean
  recommendedCNAME: RankedValue[]
  recommendedIPv4: RankedIps[]
}

export class VercelDomainError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'VercelDomainError'
    this.status = status
    this.code = code
  }
}

type VercelAuth = { token: string; projectId: string; teamId: string | null }

export function vercelDomainsMode(): 'ready' | 'skipped' | 'missing' {
  if (vercelAuth()) return 'ready'
  if (process.env.VERCEL) return 'missing'
  return 'skipped'
}

function vercelAuth(): VercelAuth | null {
  const token = process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return null
  const teamId = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || null
  return { token, projectId, teamId }
}

function teamQuery(teamId: string | null, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  if (teamId) params.set('teamId', teamId)
  if (extra) {
    for (const [key, value] of Object.entries(extra)) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function vercelFetch<T>(auth: VercelAuth, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string }
  }
  if (!res.ok) {
    throw new VercelDomainError(
      json.error?.message || `Vercel respondió ${res.status}`,
      res.status,
      json.error?.code
    )
  }
  return json as T
}

function projectPath(auth: VercelAuth, suffix: string): string {
  return `/v9/projects/${encodeURIComponent(auth.projectId)}${suffix}${teamQuery(auth.teamId)}`
}

export function vercelDomainErrorMessage(error: unknown): string {
  if (!(error instanceof VercelDomainError)) {
    return 'No se pudo registrar el dominio en Vercel.'
  }
  if (error.status === 401 || error.status === 403) {
    return 'No se pudo autorizar con Vercel. Revisa que el token pueda editar dominios del proyecto.'
  }
  if (error.status === 402) {
    return 'La cuenta de Vercel necesita un método de pago para dominios personalizados.'
  }
  if (error.status === 409) {
    return 'Este dominio ya está en otra cuenta de Vercel. Quítalo de ese proyecto o completa el registro TXT.'
  }
  if (/production deployment/i.test(error.message)) {
    return 'Vercel necesita un despliegue de producción exitoso antes de agregar dominios.'
  }
  return 'No se pudo registrar el dominio en Vercel.'
}

async function getProjectDomain(auth: VercelAuth, domain: string): Promise<ProjectDomain> {
  return vercelFetch<ProjectDomain>(
    auth,
    `/v9/projects/${encodeURIComponent(auth.projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(auth.teamId)}`
  )
}

async function addProjectDomain(
  auth: VercelAuth,
  domain: string,
  redirect?: string
): Promise<ProjectDomain> {
  const body: { name: string; redirect?: string; redirectStatusCode?: 308 } = { name: domain }
  if (redirect) {
    body.redirect = redirect
    body.redirectStatusCode = 308
  }
  try {
    return await vercelFetch<ProjectDomain>(
      auth,
      `/v10/projects/${encodeURIComponent(auth.projectId)}/domains${teamQuery(auth.teamId)}`,
      { method: 'POST', body: JSON.stringify(body) }
    )
  } catch (error) {
    if (error instanceof VercelDomainError && (error.status === 400 || error.status === 409)) {
      try {
        const existing = await getProjectDomain(auth, domain)
        if (redirect && existing.redirect !== redirect) {
          try {
            return await vercelFetch<ProjectDomain>(
              auth,
              `/v9/projects/${encodeURIComponent(auth.projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(auth.teamId)}`,
              {
                method: 'PATCH',
                body: JSON.stringify({ redirect, redirectStatusCode: 308 }),
              }
            )
          } catch (patchError) {
            console.error(
              'No se pudo actualizar la redirección',
              patchError instanceof Error ? patchError.message : patchError
            )
            return existing
          }
        }
        return existing
      } catch {
        throw error
      }
    }
    throw error
  }
}

export async function verifyProjectDomain(domain: string): Promise<ProjectDomain> {
  const auth = vercelAuth()
  if (!auth) throw new VercelDomainError('Vercel no está configurado', 500)
  return vercelFetch<ProjectDomain>(
    auth,
    `/v9/projects/${encodeURIComponent(auth.projectId)}/domains/${encodeURIComponent(domain)}/verify${teamQuery(auth.teamId)}`,
    { method: 'POST' }
  )
}

export async function releaseCustomDomain(domain: string): Promise<void> {
  const auth = vercelAuth()
  if (!auth) return
  for (const name of [domain, `www.${domain}`]) {
    try {
      await vercelFetch(
        auth,
        projectPath(auth, `/domains/${encodeURIComponent(name)}`),
        { method: 'DELETE' }
      )
    } catch (error) {
      if (error instanceof VercelDomainError && (error.status === 404 || error.status === 403)) {
        continue
      }
      console.error(`No se pudo quitar ${name} de Vercel`, error instanceof Error ? error.message : error)
    }
  }
}

async function getDomainConfig(auth: VercelAuth, domain: string): Promise<DomainConfig | null> {
  try {
    return await vercelFetch<DomainConfig>(
      auth,
      `/v6/domains/${encodeURIComponent(domain)}/config${teamQuery(auth.teamId, {
        projectIdOrName: auth.projectId,
      })}`
    )
  } catch (error) {
    console.error('No se pudo leer la configuración DNS', error instanceof Error ? error.message : error)
    return null
  }
}

function preferredCname(config: DomainConfig | null): string | null {
  const ranked = [...(config?.recommendedCNAME || [])].sort((a, b) => a.rank - b.rank)
  return ranked[0]?.value || null
}

function preferredIpv4(config: DomainConfig | null): string | null {
  const ranked = [...(config?.recommendedIPv4 || [])].sort((a, b) => a.rank - b.rank)
  return ranked[0]?.value?.[0] || null
}

function routingRecords(domain: string, projectDomain: ProjectDomain, config: DomainConfig | null): DomainDnsRecord[] {
  const cname = preferredCname(config)
  const ipv4 = preferredIpv4(config)
  const records: DomainDnsRecord[] = []
  const isApex = projectDomain.apexName === domain

  if (isApex) {
    if (ipv4) records.push({ type: 'A', host: '@', value: ipv4, purpose: 'routing' })
    if (cname) records.push({ type: 'CNAME', host: 'www', value: cname, purpose: 'redirect' })
    return records
  }

  if (cname) {
    const apex = projectDomain.apexName
    const host = apex && domain.endsWith(`.${apex}`) ? domain.slice(0, -(apex.length + 1)) : domain
    records.push({ type: 'CNAME', host, value: cname, purpose: 'routing' })
  }
  return records
}

function verificationRecords(projectDomain: ProjectDomain): DomainDnsRecord[] {
  if (projectDomain.verified) return []
  return (projectDomain.verification || [])
    .filter((challenge) => challenge.type && challenge.value)
    .map((challenge) => ({
      type: 'TXT' as const,
      host: challenge.domain || '@',
      value: challenge.value,
      purpose: 'verification' as const,
    }))
}

async function statusFor(domain: string, projectDomain: ProjectDomain): Promise<CustomDomainStatus> {
  const auth = vercelAuth()
  const config = auth ? await getDomainConfig(auth, domain) : null
  return {
    mode: 'ready',
    domain,
    verified: projectDomain.verified,
    misconfigured: config ? config.misconfigured : null,
    records: [...verificationRecords(projectDomain), ...routingRecords(domain, projectDomain, config)],
    error: null,
  }
}

/** Assign the hostname to the project. Apex domains also get a www → apex redirect. */
export async function provisionCustomDomain(domain: string): Promise<CustomDomainStatus> {
  const auth = vercelAuth()
  if (!auth) throw new VercelDomainError('Vercel no está configurado', 500)
  const added = await addProjectDomain(auth, domain)
  if (added.apexName === domain) {
    try {
      await addProjectDomain(auth, `www.${domain}`, domain)
    } catch (error) {
      console.error('No se pudo agregar www', error instanceof Error ? error.message : error)
    }
  }
  return statusFor(domain, added)
}

export async function verifyCustomDomain(domain: string): Promise<CustomDomainStatus> {
  try {
    const verified = await verifyProjectDomain(domain)
    const status = await statusFor(domain, verified)
    if (!status.verified) {
      status.error = 'Vercel todavía no puede verificar el dominio. Revisa el registro TXT.'
    }
    return status
  } catch (error) {
    let status: CustomDomainStatus
    try {
      status = await getCustomDomainStatus(domain)
    } catch (statusError) {
      console.error('getCustomDomainStatus', statusError instanceof Error ? statusError.message : statusError)
      status = {
        mode: 'ready',
        domain,
        verified: null,
        misconfigured: null,
        records: [],
        error: null,
      }
    }
    status.error = 'No se pudo verificar el dominio. Revisa el registro TXT y vuelve a intentarlo.'
    console.error('verifyProjectDomain', error instanceof Error ? error.message : error)
    return status
  }
}

export async function describeCustomDomain(domain: string | null): Promise<CustomDomainStatus> {
  if (!domain) {
    return {
      mode: 'none',
      domain: null,
      verified: null,
      misconfigured: null,
      records: [],
      error: null,
    }
  }
  const mode = vercelDomainsMode()
  if (mode !== 'ready') {
    return {
      mode,
      domain,
      verified: null,
      misconfigured: null,
      records: [],
      error: null,
    }
  }
  try {
    return await getCustomDomainStatus(domain)
  } catch (error) {
    console.error('getCustomDomainStatus', error instanceof Error ? error.message : error)
    return {
      mode,
      domain,
      verified: null,
      misconfigured: null,
      records: [],
      error: 'No se pudo consultar el dominio en Vercel.',
    }
  }
}

export async function getCustomDomainStatus(domain: string): Promise<CustomDomainStatus> {
  const auth = vercelAuth()
  if (!auth) {
    return {
      mode: vercelDomainsMode(),
      domain,
      verified: null,
      misconfigured: null,
      records: [],
      error: null,
    }
  }
  try {
    const projectDomain = await getProjectDomain(auth, domain)
    return statusFor(domain, projectDomain)
  } catch (error) {
    if (error instanceof VercelDomainError && error.status === 404) {
      return {
        mode: 'ready',
        domain,
        verified: false,
        misconfigured: true,
        records: [],
        error: 'Este dominio aún no está en el proyecto de Vercel. Guárdalo de nuevo para registrarlo.',
      }
    }
    throw error
  }
}
