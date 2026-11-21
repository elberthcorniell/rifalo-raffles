import fs from 'node:fs'
import path from 'node:path'
import { renderLegalMarkdown } from '@/lib/legal-markdown'

export const BLOG_ORIGIN = 'https://rifalo.do'
export const BLOG_DEFAULT_COVER = '/blog/default-og.png'
const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export type BlogFaq = { q: string; a: string }

export type BlogPost = {
  slug: string
  seoTitle: string
  h1: string
  metaDescription: string
  date: string
  updated: string | null
  published: boolean
  coverImage: string | null
  coverAlt: string
  faq: BlogFaq[]
  ctaTitle: string
  ctaText: string
  ctaButton: string
  ctaHref: string
  methodNote: string
  emailSubjects: string[]
  emailPreviewText: string
  emailButtonLabel: string | null
  emailBody: string
  body: string
  intro: string
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function blogDraftsVisible(env: string | undefined = process.env.VERCEL_ENV): boolean {
  return env !== 'production'
}

export function isBlogPostVisible(post: { published: boolean }, env?: string): boolean {
  return post.published || blogDraftsVisible(env)
}

export function visibleBlogPosts(posts: BlogPost[], env?: string): BlogPost[] {
  return posts.filter((post) => isBlogPostVisible(post, env))
}

/** Newest published posts for the marketing home. Drafts stay off this list. */
export function latestPublishedBlogPosts(posts: BlogPost[], limit = 3): BlogPost[] {
  return [...posts]
    .filter((post) => post.published)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
    .slice(0, Math.max(0, limit))
}

export type MarketingSitemapEntry = {
  path: string
  lastModified?: string
  changeFrequency: 'weekly' | 'monthly'
  priority: number
}

/**
 * Public marketing URLs. Tenant legal pages (/terminos, /privacidad,
 * /reglamento, /soporte) 404 on rifalo.do, so they are not listed.
 * Unpublished posts stay out in every environment.
 */
export function marketingSitemapEntries(
  posts: { slug: string; published: boolean; date?: string; updated?: string | null }[],
): MarketingSitemapEntry[] {
  return [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/signup', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
    ...posts
      .filter((post) => post.published)
      .map((post) => ({
        path: `/blog/${post.slug}`,
        lastModified: post.updated || post.date,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
  ]
}

export function sitemapBlogPaths(
  posts: { slug: string; published: boolean; date?: string; updated?: string | null }[],
): string[] {
  return marketingSitemapEntries(posts).map((entry) => entry.path)
}

export function formatBlogDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  const name = MONTHS[(month || 1) - 1] || ''
  if (!year || !name || !day) return iso
  return `${day} de ${name} de ${year}`
}

export function blogIntro(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const chunk: string[] = []
  for (const line of lines) {
    if (/^#{1,3}\s+\S/.test(line)) break
    chunk.push(line)
  }
  return chunk.join('\n').trim()
}

export function renderBlogBody(markdown: string): string {
  const html = renderLegalMarkdown(markdown)
  return html.replace(/<h2>Checklist<\/h2><ul>/g, '<h2>Checklist</h2><ul class="blog-checklist">')
}

export function blogCoverFile(post: Pick<BlogPost, 'coverImage'>): string | null {
  const cover = post.coverImage
  if (!cover || !cover.startsWith('/blog/') || cover.includes('..')) return null
  const file = path.join(process.cwd(), 'public', cover.slice(1))
  return fs.existsSync(file) ? cover : null
}

export function blogCoverPublicPath(post: Pick<BlogPost, 'slug' | 'coverImage'>): string {
  return blogCoverFile(post) ?? BLOG_DEFAULT_COVER
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function blogStructuredData(post: BlogPost, imageUrl: string): Record<string, unknown>[] {
  const pageUrl = `${BLOG_ORIGIN}/blog/${post.slug}`
  const graph: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.h1,
      description: post.metaDescription,
      datePublished: `${post.date}T00:00:00-04:00`,
      dateModified: `${post.updated || post.date}T00:00:00-04:00`,
      mainEntityOfPage: pageUrl,
      image: imageUrl,
      author: { '@type': 'Organization', name: 'Rifalo', url: BLOG_ORIGIN },
      publisher: {
        '@type': 'Organization',
        name: 'Rifalo',
        url: BLOG_ORIGIN,
        logo: {
          '@type': 'ImageObject',
          url: `${BLOG_ORIGIN}/rifalo_logo_clear_dark.png`,
        },
      },
    },
  ]

  if (post.faq.length > 0) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
  }

  graph.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${BLOG_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BLOG_ORIGIN}/blog` },
      { '@type': 'ListItem', position: 3, name: post.h1, item: pageUrl },
    ],
  })

  return graph
}

export function loadBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((name) => name.endsWith('.md') || name.endsWith('.mdx'))
  const posts = files.map((name) => parseBlogSource(fs.readFileSync(path.join(BLOG_DIR, name), 'utf8'), name))
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
  return posts
}

export function getBlogPost(slug: string): BlogPost | null {
  return loadBlogPosts().find((post) => post.slug === slug) ?? null
}

export function parseBlogSource(raw: string, filename = 'post.md'): BlogPost {
  const { data, body } = splitFrontmatter(raw)
  const slug = asString(data.slug)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${filename}: el slug no es válido`)
  }

  const seoTitle = asString(data.seoTitle)
  const h1 = asString(data.h1)
  const metaDescription = asString(data.metaDescription)
  const date = asString(data.date)
  if (!seoTitle || !h1 || !metaDescription) {
    throw new Error(`${filename}: faltan seoTitle, h1 o metaDescription`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${filename}: la fecha tiene que ser YYYY-MM-DD`)
  }
  const updatedRaw = asString(data.updated)
  if (updatedRaw && !/^\d{4}-\d{2}-\d{2}$/.test(updatedRaw)) {
    throw new Error(`${filename}: updated tiene que ser YYYY-MM-DD`)
  }

  const faq = asFaq(data.faq)
  const emailSubjects = asStringList(data.emailSubjects)
  const ctaHref = safePath(asString(data.ctaHref)) || '/signup'
  const markdown = body.trim()

  return {
    slug,
    seoTitle,
    h1,
    metaDescription,
    date,
    updated: updatedRaw || null,
    published: data.published === true || data.published === 'true',
    coverImage: asString(data.coverImage) || null,
    coverAlt: asString(data.coverAlt) || h1,
    faq,
    ctaTitle: asString(data.ctaTitle),
    ctaText: asString(data.ctaText),
    ctaButton: asString(data.ctaButton) || 'Crear mi cuenta gratis',
    ctaHref,
    methodNote: asString(data.methodNote),
    emailSubjects,
    emailPreviewText: asString(data.emailPreviewText) || metaDescription,
    emailButtonLabel: asString(data.emailButtonLabel) || null,
    emailBody: asString(data.emailBody),
    body: markdown,
    intro: blogIntro(markdown),
  }
}

function safePath(value: string): string {
  if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value
  return ''
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  return ''
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter(Boolean)
}

function asFaq(value: unknown): BlogFaq[] {
  if (!Array.isArray(value)) return []
  const faq: BlogFaq[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const q = asString(row.q)
    const a = asString(row.a)
    if (q && a) faq.push({ q, a })
  }
  return faq
}

function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) {
    throw new Error('El post no tiene frontmatter')
  }
  const end = text.indexOf('\n---\n', 4)
  if (end === -1) throw new Error('El frontmatter no cierra')
  return {
    data: parseSimpleYaml(text.slice(4, end)),
    body: text.slice(end + 5),
  }
}

/**
 * The small YAML this blog writes: scalars, string lists, `faq` objects, and `|` blocks.
 */
function parseSimpleYaml(source: string): Record<string, unknown> {
  const lines = source.split('\n')
  const data: Record<string, unknown> = {}
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim() || line.trimStart().startsWith('#')) {
      index += 1
      continue
    }

    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line)
    if (!match) {
      index += 1
      continue
    }

    const key = match[1]
    const rest = match[2]

    if (rest === '|' || rest === '>') {
      const block: string[] = []
      index += 1
      while (index < lines.length) {
        const current = lines[index]
        if (current.trim() === '') {
          block.push('')
          index += 1
          continue
        }
        if (!current.startsWith('  ')) break
        block.push(current.slice(2))
        index += 1
      }
      while (block.length > 0 && block[block.length - 1] === '') block.pop()
      data[key] = block.join('\n')
      continue
    }

    if (rest === '') {
      const items: unknown[] = []
      index += 1
      while (index < lines.length && lines[index].startsWith('  - ')) {
        const item = lines[index].slice(4)
        if (key === 'faq') {
          const row: Record<string, string> = {}
          const inline = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(item)
          if (inline) row[inline[1]] = unquote(inline[2])
          index += 1
          while (index < lines.length && /^    [A-Za-z0-9_]+:\s*/.test(lines[index])) {
            const nested = /^    ([A-Za-z0-9_]+):\s*(.*)$/.exec(lines[index])
            if (!nested) break
            row[nested[1]] = unquote(nested[2])
            index += 1
          }
          items.push(row)
        } else {
          items.push(unquote(item))
          index += 1
        }
      }
      data[key] = items
      continue
    }

    data[key] = parseScalar(rest)
    index += 1
  }

  return data
}

function parseScalar(raw: string): string | boolean {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return unquote(trimmed)
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}
