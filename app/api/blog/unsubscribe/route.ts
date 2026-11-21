import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { blogUnsubscribeSecret, verifyBlogUnsubscribeToken } from '@/lib/blog-unsubscribe'

export const runtime = 'nodejs'

async function unsubscribe(email: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('blog_email_unsubscribes').insert({ email })
  if (error && error.code !== '23505') {
    throw new Error(error.message)
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const dest = new URL('/baja', url.origin)
  const token = url.searchParams.get('token')
  if (token) dest.searchParams.set('token', token)
  return NextResponse.redirect(dest, 303)
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  let token = url.searchParams.get('token') || ''
  let web = false
  const contentType = request.headers.get('content-type') || ''

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData()
    token = token || String(form.get('token') || '')
    web = form.get('web') === '1'
  }

  const secret = blogUnsubscribeSecret()
  const email = secret ? verifyBlogUnsubscribeToken(token, secret) : null
  if (!email) {
    if (web) return NextResponse.redirect(new URL('/baja', url.origin), 303)
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    await unsubscribe(email)
  } catch {
    if (web) {
      return NextResponse.redirect(new URL('/baja?error=1', url.origin), 303)
    }
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  if (web) return NextResponse.redirect(new URL('/baja?listo=1', url.origin), 303)
  return NextResponse.json({ ok: true })
}
