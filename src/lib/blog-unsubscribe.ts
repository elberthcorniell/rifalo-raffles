import { createHmac, timingSafeEqual } from 'node:crypto'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Signs the address with the service-role key already present in production.
 * No new environment variable is required. Links stop working if that key rotates.
 */
export function blogUnsubscribeSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const dedicated = env.BLOG_UNSUBSCRIBE_SECRET?.trim()
  if (dedicated) return dedicated
  const fallback = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return fallback || null
}

export function signBlogUnsubscribeToken(email: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email.trim().toLowerCase() }), 'utf8').toString(
    'base64url',
  )
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyBlogUnsubscribeToken(token: string, secret: string): string | null {
  if (!secret || !token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  if (!payload || !signature) return null

  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { e?: unknown }
    if (typeof data.e !== 'string') return null
    const email = data.e.trim().toLowerCase()
    if (!EMAIL.test(email) || email.length > 320) return null
    return email
  } catch {
    return null
  }
}
