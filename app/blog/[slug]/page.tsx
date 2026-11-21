import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlogChrome } from '@/components/blog/BlogChrome'
import {
  BLOG_ORIGIN,
  blogCoverPublicPath,
  blogStructuredData,
  formatBlogDate,
  getBlogPost,
  isBlogPostVisible,
  jsonLdScript,
  loadBlogPosts,
  renderBlogBody,
  visibleBlogPosts,
} from '@/lib/blog'

type Params = { slug: string }

export function generateStaticParams() {
  return visibleBlogPosts(loadBlogPosts()).map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post || !isBlogPostVisible(post)) {
    return { title: 'Artículo no encontrado', robots: { index: false, follow: false } }
  }

  const canonical = `${BLOG_ORIGIN}/blog/${post.slug}`
  const image = `${BLOG_ORIGIN}${blogCoverPublicPath(post)}`

  return {
    title: { absolute: post.seoTitle },
    description: post.metaDescription,
    alternates: { canonical },
    robots: post.published
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: post.seoTitle,
      description: post.metaDescription,
      type: 'article',
      url: canonical,
      publishedTime: `${post.date}T00:00:00-04:00`,
      modifiedTime: `${post.updated || post.date}T00:00:00-04:00`,
      images: [{ url: image, width: 1200, height: 630, alt: post.coverAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle,
      description: post.metaDescription,
      images: [image],
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post || !isBlogPostVisible(post)) notFound()

  const image = blogCoverPublicPath(post)
  const structured = blogStructuredData(post, `${BLOG_ORIGIN}${image}`)

  return (
    <BlogChrome>
      {structured.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(entry) }}
        />
      ))}
      <article className="mx-auto max-w-[40rem] px-4 py-8 sm:py-12">
        <p className="text-sm">
          <Link href="/blog" className="text-[#4b5563] hover:text-black">
            Blog
          </Link>
        </p>
        <h1 className="mt-3 text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-4xl">
          {post.h1}
        </h1>
        <time className="mt-3 block text-sm text-[#6b7280]" dateTime={post.date}>
          {formatBlogDate(post.date)}
        </time>
        {!post.published && (
          <p className="mt-3 inline-flex rounded-full bg-[#f4f1e8] px-2.5 py-1 text-xs font-semibold text-[#0B2447]">
            Borrador. En producción esta página no se publica.
          </p>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl bg-[#0B2447]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={post.coverAlt}
            width={1200}
            height={630}
            className="aspect-[1200/630] w-full object-cover"
          />
        </div>

        <div
          className="blog-prose mt-8"
          dangerouslySetInnerHTML={{ __html: renderBlogBody(post.body) }}
        />

        {(post.ctaTitle || post.ctaText) && (
          <aside className="mt-10 rounded-2xl bg-[#0B2447] px-5 py-6 text-white sm:px-6">
            {post.ctaTitle && (
              <h2 className="text-xl font-semibold leading-snug tracking-tight">{post.ctaTitle}</h2>
            )}
            {post.ctaText && (
              <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">{post.ctaText}</p>
            )}
            <Link
              href={post.ctaHref}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#FFD000] px-5 text-base font-semibold text-[#111111] hover:bg-[#F0C400] sm:w-auto"
            >
              {post.ctaButton}
            </Link>
          </aside>
        )}

        {post.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold tracking-tight">Preguntas frecuentes</h2>
            <dl className="mt-4 divide-y border-y">
              {post.faq.map((item) => (
                <div key={item.q} className="py-4">
                  <dt className="font-semibold leading-snug">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-[#4b5563] sm:text-base">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {post.methodNote && (
          <p className="mt-10 text-xs leading-relaxed text-[#6b7280]">{post.methodNote}</p>
        )}
      </article>
    </BlogChrome>
  )
}
