import type { Metadata } from 'next'
import Link from 'next/link'
import { BlogChrome } from '@/components/blog/BlogChrome'
import {
  BLOG_DEFAULT_COVER,
  BLOG_ORIGIN,
  blogCoverPublicPath,
  formatBlogDate,
  loadBlogPosts,
  visibleBlogPosts,
} from '@/lib/blog'

const blogDescription = 'Notas del equipo de Rifalo para vender más boletos.'

export function generateMetadata(): Metadata {
  const posts = visibleBlogPosts(loadBlogPosts())
  const image = `${BLOG_ORIGIN}${posts[0] ? blogCoverPublicPath(posts[0]) : BLOG_DEFAULT_COVER}`
  const alt = posts[0]?.coverAlt || 'Rifalo'
  return {
    title: 'Blog',
    description: blogDescription,
    alternates: { canonical: `${BLOG_ORIGIN}/blog` },
    openGraph: {
      title: 'Blog de Rifalo',
      description: blogDescription,
      url: `${BLOG_ORIGIN}/blog`,
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Blog de Rifalo',
      description: blogDescription,
      images: [image],
    },
  }
}

export default function BlogIndexPage() {
  const posts = visibleBlogPosts(loadBlogPosts())

  return (
    <BlogChrome>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7340]">Blog</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">
          Notas para vender más boletos
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-[#4b5563]">
          El equipo de Rifalo publica una nota cada dos días, a partir de lo que vemos en las rifas.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10 text-[#4b5563]">Todavía no hay artículos publicados.</p>
        ) : (
          <ul className="mt-8 space-y-8">
            {posts.map((post) => {
              const image = blogCoverPublicPath(post)
              return (
                <li key={post.slug}>
                  <Link href={`/blog/${post.slug}`} className="group block">
                    <span className="relative block aspect-[1200/630] overflow-hidden rounded-2xl bg-[#0B2447]">
                      {/* Generated OG routes are not static files, so next/image cannot optimize them. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image}
                        alt={post.coverAlt}
                        width={1200}
                        height={630}
                        className="h-full w-full object-cover"
                      />
                      {!post.published && (
                        <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0B2447]">
                          Borrador
                        </span>
                      )}
                    </span>
                    <time className="mt-4 block text-sm text-[#6b7280]" dateTime={post.date}>
                      {formatBlogDate(post.date)}
                    </time>
                    <h2 className="mt-1 text-xl font-semibold leading-snug tracking-tight group-hover:underline sm:text-2xl">
                      {post.h1}
                    </h2>
                    <p className="mt-2 text-base leading-relaxed text-[#4b5563]">{post.metaDescription}</p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </BlogChrome>
  )
}
