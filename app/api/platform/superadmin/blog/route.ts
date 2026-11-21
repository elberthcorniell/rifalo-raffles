import { NextResponse } from 'next/server'
import {
  BLOG_EMAIL_EXCLUDED_ORG_SLUGS,
  BLOG_AUDIENCE_IDS,
  type BlogAudienceId,
} from '@/lib/blog-audience'
import {
  BLOG_ORIGIN,
  blogCoverPublicPath,
  getBlogPost,
  loadBlogPosts,
} from '@/lib/blog'
import {
  buildBlogEmail,
  cleanEmailSubject,
  defaultBlogEmailSubject,
} from '@/lib/blog-email'
import { loadBlogAudience } from '@/lib/blog-recipients'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'
import {
  blogUnsubscribeSecret,
  signBlogUnsubscribeToken,
} from '@/lib/blog-unsubscribe'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const url = new URL(request.url)
  const posts = loadBlogPosts().map((post) => ({
    slug: post.slug,
    h1: post.h1,
    published: post.published,
    subjects: post.emailSubjects.length > 0 ? post.emailSubjects : [post.seoTitle],
    previewText: post.emailPreviewText,
  }))

  const requested = url.searchParams.get('slug')
  const post = getBlogPost(requested || '') || getBlogPost(posts[0]?.slug || '')
  if (!post) {
    return NextResponse.json({ success: true, data: { posts, selected: null, audiences: null } })
  }

  const subject = cleanEmailSubject(url.searchParams.get('subject') || '') || defaultBlogEmailSubject(post)
  const secret = blogUnsubscribeSecret()
  const token = secret ? signBlogUnsubscribeToken('preview@rifalo.do', secret) : 'preview'
  const email = buildBlogEmail({
    post,
    subject,
    coverUrl: `${url.origin}${blogCoverPublicPath(post)}`,
    unsubscribeUrl: `${BLOG_ORIGIN}/baja?token=${encodeURIComponent(token)}`,
  })

  let audiences: Record<BlogAudienceId, { willSend: number; alreadySent: number }> | null = null
  let audienceError: string | null = null
  try {
    const snapshot = await loadBlogAudience(auth.admin, post.slug)
    audiences = BLOG_AUDIENCE_IDS.reduce(
      (acc, id) => {
        acc[id] = {
          willSend: snapshot.audiences[id].willSend.length,
          alreadySent: snapshot.audiences[id].alreadySent,
        }
        return acc
      },
      {} as Record<BlogAudienceId, { willSend: number; alreadySent: number }>,
    )
  } catch (err) {
    audienceError = err instanceof Error ? err.message : 'No se pudo calcular la audiencia'
  }

  return NextResponse.json({
    success: true,
    data: {
      posts,
      excludedOrgSlugs: BLOG_EMAIL_EXCLUDED_ORG_SLUGS,
      selected: {
        slug: post.slug,
        h1: post.h1,
        published: post.published,
        subject,
        subjects: post.emailSubjects.length > 0 ? post.emailSubjects : [post.seoTitle],
        previewText: post.emailPreviewText,
        html: email.html,
      },
      audiences,
      audienceError,
    },
  })
}
