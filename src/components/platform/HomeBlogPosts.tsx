import Link from 'next/link'
import {
  blogCoverPublicPath,
  formatBlogDate,
  latestPublishedBlogPosts,
  loadBlogPosts,
} from '@/lib/blog'

export function HomeBlogPosts() {
  const posts = latestPublishedBlogPosts(loadBlogPosts())
  if (posts.length === 0) return null

  return (
    <section aria-labelledby="home-blog-heading" className="border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h2
              id="home-blog-heading"
              className="text-2xl font-semibold tracking-tight text-[#111111] sm:text-3xl"
            >
              Notas para vender más boletos
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4b5563] sm:text-base">
              Lo que el equipo ve en las rifas, para copiarlo en la tuya.
            </p>
          </div>
          <Link
            href="/blog"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[#111111] underline decoration-[#FFD000] decoration-2 underline-offset-4"
          >
            Ver todo el blog
          </Link>
        </div>

        <ul
          className={`mt-8 grid gap-8 ${posts.length > 1 ? 'sm:grid-cols-2' : ''} ${posts.length > 2 ? 'lg:grid-cols-3' : ''}`}
        >
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group block">
                <span className="block overflow-hidden rounded-2xl bg-[#f4f1e8]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={blogCoverPublicPath(post)}
                    alt={post.coverAlt}
                    width={1200}
                    height={630}
                    className="aspect-[1200/630] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </span>
                <time className="mt-4 block text-sm text-[#6b7280]" dateTime={post.date}>
                  {formatBlogDate(post.date)}
                </time>
                <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-[#111111] group-hover:underline sm:text-xl">
                  {post.h1}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">{post.metaDescription}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
