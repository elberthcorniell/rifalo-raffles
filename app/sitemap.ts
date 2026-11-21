import type { MetadataRoute } from 'next'
import { BLOG_ORIGIN, loadBlogPosts, sitemapBlogPaths } from '@/lib/blog'

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapBlogPaths(loadBlogPosts()).map((path) => ({
    url: `${BLOG_ORIGIN}${path}`,
    changeFrequency: path === '/blog' ? 'weekly' : 'monthly',
    priority: path === '/blog' ? 0.8 : 0.7,
  }))
}
