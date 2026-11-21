import type { MetadataRoute } from 'next'
import { BLOG_ORIGIN } from '@/lib/blog'
import { parseHost } from '@/lib/tenant-host'

const BOTS = ['Googlebot', 'Bingbot', 'Twitterbot', 'facebookexternalhit', '*']

/** Apex marketing host. Tenant subdomains and unknown hosts are not the marketing site. */
export function isMarketingHost(hostname: string, rootDomain?: string | string[]): boolean {
  return parseHost(hostname, rootDomain).kind === 'apex'
}

export function buildRobots(marketing: boolean): MetadataRoute.Robots {
  return {
    rules: BOTS.map((userAgent) => ({
      userAgent,
      allow: '/',
      ...(marketing ? { disallow: '/superadmin' } : {}),
    })),
    ...(marketing ? { sitemap: `${BLOG_ORIGIN}/sitemap.xml` } : {}),
  }
}
