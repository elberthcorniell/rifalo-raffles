import { createHash } from 'node:crypto'
import { Resend } from 'resend'

/** Resend accepts up to 100 messages per batch call. */
export const BLOG_EMAIL_BATCH_SIZE = 100
/** Stay under the default Resend rate limit of 2 requests per second. */
export const BLOG_EMAIL_BATCH_GAP_MS = 600

export type OutboundBlogEmail = {
  to: string
  from: string
  subject: string
  html: string
  text: string
  replyTo?: string
  headers: Record<string, string>
}

export type BlogSendResult = { ok: boolean; error?: string }

export function blogBatchIdempotencyKey(slug: string, emails: string[]): string {
  const hash = createHash('sha256')
    .update([...emails].map((email) => email.toLowerCase()).sort().join('\n'))
    .digest('hex')
    .slice(0, 32)
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80)
  return `blog-${safeSlug}-${hash}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type BatchError = { index: number; message: string }

/**
 * Sends in chunks of 100. The idempotency key is a hash of the chunk, so a
 * retry of the same addresses does not deliver a second copy within Resend's window.
 */
export async function sendBlogEmailBatch(
  slug: string,
  messages: OutboundBlogEmail[],
  options: {
    apiKey: string
    sleep?: (ms: number) => Promise<void>
  },
): Promise<BlogSendResult[]> {
  const resend = new Resend(options.apiKey)
  const sleep = options.sleep ?? delay
  const results: BlogSendResult[] = []

  for (let offset = 0; offset < messages.length; offset += BLOG_EMAIL_BATCH_SIZE) {
    if (offset > 0) await sleep(BLOG_EMAIL_BATCH_GAP_MS)
    const chunk = messages.slice(offset, offset + BLOG_EMAIL_BATCH_SIZE)
    const key = blogBatchIdempotencyKey(slug, chunk.map((message) => message.to))
    results.push(...(await sendChunk(resend, chunk, key, sleep)))
  }

  return results
}

async function sendChunk(
  resend: Resend,
  chunk: OutboundBlogEmail[],
  idempotencyKey: string,
  sleep: (ms: number) => Promise<void>,
): Promise<BlogSendResult[]> {
  let lastError = 'No se pudo enviar'

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await resend.batch.send(
        chunk.map((message) => ({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        })),
        { idempotencyKey, batchValidation: 'permissive' },
      )

      if (response.error) {
        lastError = response.error.message || lastError
        if (attempt === 0 && response.error.name === 'rate_limit_exceeded') {
          await sleep(2000)
          continue
        }
        return chunk.map(() => ({ ok: false, error: lastError }))
      }

      const errors = new Map<number, string>()
      const data = response.data as { errors?: BatchError[] }
      for (const item of data.errors ?? []) errors.set(item.index, item.message)
      return chunk.map((_, index) => {
        const message = errors.get(index)
        return message ? { ok: false, error: message } : { ok: true }
      })
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError
      if (attempt === 0) {
        await sleep(2000)
        continue
      }
    }
  }

  return chunk.map(() => ({ ok: false, error: lastError }))
}
