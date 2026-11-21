import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { BLOG_ORIGIN, loadBlogPosts, marketingSitemapEntries } from '@/lib/blog'
import { isMarketingHost } from '@/lib/robots-policy'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get('host') || ''
  if (!isMarketingHost(host)) return []

  return marketingSitemapEntries(loadBlogPosts()).map((entry) => ({
    url: `${BLOG_ORIGIN}${entry.path}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
  }))
}
