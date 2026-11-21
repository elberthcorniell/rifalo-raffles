import { NextResponse } from 'next/server'
import { BLOG_ORIGIN } from '@/lib/blog'
import { runBlogSend } from '@/lib/blog-campaign'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const payload = await request.json().catch(() => null)
  const result = await runBlogSend({
    admin: auth.admin,
    user: auth.user,
    payload,
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
    replyTo: process.env.EMAIL_REPLY_TO,
    imageOrigin: BLOG_ORIGIN,
  })

  return NextResponse.json(result.body, { status: result.status })
}
