export const PLATFORM = {
  name: 'Rifalo',
  tagline: 'Haz tus rifas gratis. Sin tarjeta. Tu propio sitio y panel de administración.',
  email: 'hola@rifalo.do',
  copyright: `© ${new Date().getFullYear()} Rifalo`,
} as const

export type OrgPlan = 'free' | 'plus' | 'unlimited'

export const PLAN_LIMITS: Record<OrgPlan, number | null> = {
  free: 250,
  plus: 50_000,
  unlimited: null,
}

export const PLAN_PRICES = {
  free: 0,
  plus: 20,
  unlimited: 50,
} as const

export const RESERVED_SLUGS = [
  'www',
  'app',
  'admin',
  'api',
  'signup',
  'login',
  'mail',
  'support',
  'help',
  'status',
  'billing',
  'dashboard',
  'platform',
  'superadmin',
  'static',
  'assets',
  'cdn',
  'docs',
] as const

function splitRootDomains(raw: string): string[] {
  const domains = raw
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean)
  return domains.length > 0 ? domains : ['localhost:3000']
}

/** Every apex domain this deployment serves. The first entry is canonical. */
export function getRootDomains(): string[] {
  return splitRootDomains(process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000')
}

/** Canonical domain used for generated links and displayed URLs. */
export function getRootDomain(): string {
  return getRootDomains()[0]
}

export function isLocalRootDomain(root: string = getRootDomain()): boolean {
  return root.startsWith('localhost') || root.startsWith('127.0.0.1')
}

export function getProtocol(): string {
  return isLocalRootDomain() ? 'http' : 'https'
}

export function getPlatformUrl(path: string = '/'): string {
  const root = getRootDomain()
  const base = `${getProtocol()}://${root}`
  if (!path || path === '/') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function getTenantUrl(slug: string, path: string = '/'): string {
  const root = getRootDomain()
  const base = `${getProtocol()}://${slug}.${root}`
  if (!path || path === '/') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 32) return false
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return false
  return /^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$/.test(slug)
}
