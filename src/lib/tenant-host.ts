import { getRootDomain, getTenantUrl } from '@/lib/constants'
import {
  DEFAULT_ORG_THEME,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  normalizeOrgTheme,
  type Organization,
  type OrgBrand,
} from '@/types/org'
import { normalizeHexColor } from '@/lib/colors'

export const ORG_ID_HEADER = 'x-org-id'
export const ORG_SLUG_HEADER = 'x-org-slug'
export const PATHNAME_HEADER = 'x-pathname'

export type HostKind = 'apex' | 'tenant' | 'unknown'

export interface ResolvedHost {
  kind: HostKind
  slug: string | null
  host: string
}

export function parseHost(hostname: string, rootDomain: string = getRootDomain()): ResolvedHost {
  const host = hostname.split(':')[0].toLowerCase()
  const rootHost = rootDomain.split(':')[0].toLowerCase()

  if (
    host === rootHost ||
    host === `www.${rootHost}` ||
    host === '127.0.0.1' ||
    (rootHost === 'localhost' && host === 'localhost')
  ) {
    return { kind: 'apex', slug: null, host }
  }

  if (host.endsWith('.localhost')) {
    const slug = host.replace(/\.localhost$/, '')
    if (slug && !slug.includes('.')) {
      return { kind: 'tenant', slug, host }
    }
  }

  if (host.endsWith(`.${rootHost}`)) {
    const slug = host.slice(0, -(rootHost.length + 1))
    if (slug && !slug.includes('.')) {
      return { kind: 'tenant', slug, host }
    }
  }

  return { kind: 'unknown', slug: null, host }
}

function orgLogoUrl(path: string | null): string {
  if (!path) return '/logo.jpg'
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
    return path
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return '/logo.jpg'
  return `${base}/storage/v1/object/public/raffle-images/${path}`
}

function twitterHandleFromUrl(url: string | null | undefined): string {
  if (!url) return ''
  const m = url.match(/(?:twitter\.com|x\.com)\/(@?[\w]+)/i)
  if (!m) return ''
  return m[1].startsWith('@') ? m[1] : `@${m[1]}`
}

export function getOrgBrand(org: Organization): OrgBrand {
  const url = getTenantUrl(org.slug)
  const primary = normalizeHexColor(org.primary_color || '', DEFAULT_PRIMARY_COLOR)
  const secondary = normalizeHexColor(org.secondary_color || '', DEFAULT_SECONDARY_COLOR)
  return {
    name: org.name,
    slug: org.slug,
    url,
    domain: `${org.slug}.${getRootDomain()}`,
    tagline: org.tagline || '',
    email: org.email || org.admin_email || '',
    phone: org.phone || '',
    logo: orgLogoUrl(org.logo_path),
    adminEmail: org.admin_email || org.email || '',
    copyright: `© ${new Date().getFullYear()} ${org.name}`,
    twitter_handle: twitterHandleFromUrl(org.twitter_url),
    social: {
      facebook: org.facebook_url || '#',
      instagram: org.instagram_url || '#',
      twitter: org.twitter_url || '#',
    },
    location: org.location || 'República Dominicana',
    primaryColor: primary,
    secondaryColor: secondary,
    theme: normalizeOrgTheme(org.theme ?? DEFAULT_ORG_THEME),
  }
}
