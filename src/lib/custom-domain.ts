import { getRootDomains } from '@/lib/constants'

export type DomainDnsRecord = {
  type: 'A' | 'CNAME' | 'TXT'
  host: string
  value: string
  purpose: 'routing' | 'verification' | 'redirect'
}

export type CustomDomainMode = 'ready' | 'skipped' | 'missing' | 'none'

export type CustomDomainStatus = {
  mode: CustomDomainMode
  domain: string | null
  verified: boolean | null
  misconfigured: boolean | null
  records: DomainDnsRecord[]
  error: string | null
}

/** Hostname only, without scheme, path, port, or a leading www. */
export function normalizeCustomDomain(value: unknown): string | null {
  if (value == null || value === '') return null
  let domain = String(value).trim().toLowerCase()
  domain = domain.replace(/^https?:\/\//, '')
  domain = domain.split('/')[0].split('?')[0]
  domain = domain.replace(/:\d+$/, '')
  domain = domain.replace(/\.$/, '')
  if (domain.startsWith('www.')) domain = domain.slice(4)
  return domain || null
}

export function customDomainError(domain: string): string | null {
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) {
    return 'Dominio inválido'
  }
  const roots = getRootDomains().map((root) => root.split(':')[0].toLowerCase())
  if (roots.some((root) => root && (domain === root || domain.endsWith(`.${root}`)))) {
    return 'Usa un dominio propio. Los subdominios de la plataforma ya incluyen HTTPS.'
  }
  return null
}
