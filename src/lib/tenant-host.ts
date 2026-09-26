import { getRootDomain, getRootDomains, getTenantUrl } from '@/lib/constants'
import {
  DEFAULT_ORG_THEME,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  normalizeOrgTheme,
  normalizeThemeColors,
  type Organization,
  type OrgBrand,
} from '@/types/org'
import { normalizeHexColor, resolveFooterColors } from '@/lib/colors'
import { normalizeSiteFont } from '@/lib/fonts'

export const ORG_ID_HEADER = 'x-org-id'
export const ORG_SLUG_HEADER = 'x-org-slug'
export const PATHNAME_HEADER = 'x-pathname'

export type HostKind = 'apex' | 'tenant' | 'unknown'

export interface ResolvedHost {
  kind: HostKind
  slug: string | null
  host: string
}

function hostWithoutPort(value: string): string {
  return value.split(':')[0].trim().toLowerCase()
}

function rootHostsFrom(rootDomain?: string | string[]): string[] {
  const raw = rootDomain == null ? getRootDomains() : Array.isArray(rootDomain) ? rootDomain : [rootDomain]
  const hosts = raw.flatMap((domain) =>
    domain
      .split(',')
      .map((part) => hostWithoutPort(part))
      .filter(Boolean)
  )
  return hosts.length > 0 ? hosts : ['localhost']
}

export function parseHost(hostname: string, rootDomain?: string | string[]): ResolvedHost {
  const host = hostWithoutPort(hostname)

  if (host === '127.0.0.1' || host === 'localhost' || host === 'www.localhost') {
    return { kind: 'apex', slug: null, host }
  }

  if (host.endsWith('.localhost')) {
    const slug = host.replace(/\.localhost$/, '')
    if (slug && !slug.includes('.') && slug !== 'www') {
      return { kind: 'tenant', slug, host }
    }
  }

  let best: { kind: HostKind; slug: string | null; score: number } | null = null

  for (const rootHost of rootHostsFrom(rootDomain)) {
    const isApex =
      host === rootHost ||
      host === `www.${rootHost}` ||
      (rootHost === 'localhost' && host === 'localhost')

    if (isApex) {
      if (!best || rootHost.length > best.score) {
        best = { kind: 'apex', slug: null, score: rootHost.length }
      }
      continue
    }

    if (host.endsWith(`.${rootHost}`)) {
      const slug = host.slice(0, -(rootHost.length + 1))
      if (slug && !slug.includes('.')) {
        if (!best || rootHost.length > best.score) {
          best = { kind: 'tenant', slug, score: rootHost.length }
        }
      }
    }
  }

  if (best) return { kind: best.kind, slug: best.slug, host }
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
  const footer = resolveFooterColors(primary, org.footer_bg_color, org.footer_text_color)
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
    themeColors: normalizeThemeColors(org.theme_colors),
    showHeroCopy: org.show_hero_copy !== false,
    showHowItWorks: org.show_how_it_works !== false,
    showRaffles: org.show_raffles !== false,
    showTrustBenefits: org.show_trust_benefits !== false,
    showTestimonials: org.show_testimonials !== false,
    footerBgColor: footer.bg,
    footerTextColor: footer.text,
    headingFont: normalizeSiteFont(org.heading_font),
    bodyFont: normalizeSiteFont(org.body_font),
  }
}
