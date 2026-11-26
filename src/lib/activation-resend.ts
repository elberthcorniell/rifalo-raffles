import { ACTIVATION_PROPERTY_KEYS, type OrganizerContact, toResendContactBody } from '@/lib/activation-contacts'

const SEGMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ResendCallResult = {
  ok: boolean
  status: number
  message: string
  body: unknown
}

export type ActivationSegment = 'no_sales' | 'organizers'

export type BroadcastSummary = {
  id: string
  subject: string
  status: string
  createdAt: string
  sent: number | null
  delivered: number | null
  opened: number | null
  clicked: number | null
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

export function segmentIdFromEnv(segment: ActivationSegment, env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = segment === 'no_sales' ? env.RESEND_SEGMENT_NO_SALES_ID : env.RESEND_SEGMENT_ORGANIZERS_ID
  const id = raw?.trim() || ''
  return SEGMENT_ID.test(id) ? id : null
}

export function createResendApi(apiKey: string, fetchImpl: FetchImpl = fetch) {
  async function request(method: string, path: string, payload?: unknown): Promise<ResendCallResult> {
    let response: Response
    try {
      response = await fetchImpl(`https://api.resend.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'rifalo-raffles',
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      })
    } catch {
      return { ok: false, status: 0, message: 'No se pudo contactar a Resend', body: null }
    }

    const text = await response.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = null
      }
    }
    if (!response.ok) {
      return { ok: false, status: response.status, message: publicMessage(body, apiKey), body }
    }
    return { ok: true, status: response.status, message: '', body }
  }

  return {
    request,
    async ensureProperties(): Promise<ResendCallResult> {
      const listed = await request('GET', '/contact-properties?limit=100')
      const existing = new Set(propertyKeys(listed.body))
      for (const property of ACTIVATION_PROPERTY_KEYS) {
        if (existing.has(property.key)) continue
        const created = await request('POST', '/contact-properties', {
          key: property.key,
          type: property.type,
        })
        if (!created.ok && !alreadyExists(created)) return created
      }
      return { ok: true, status: 200, message: '', body: null }
    },
    async upsertContact(contact: OrganizerContact): Promise<ResendCallResult & { created: boolean }> {
      const payload = toResendContactBody(contact)
      const created = await request('POST', '/contacts', payload)
      if (created.ok) return { ...created, created: true }
      if (!alreadyExists(created)) return { ...created, created: false }
      const updated = await request('PATCH', `/contacts/${encodeURIComponent(contact.email)}`, payload)
      return { ...updated, created: false }
    },
    async addToSegment(email: string, segmentId: string): Promise<ResendCallResult> {
      const result = await request(
        'POST',
        `/contacts/${encodeURIComponent(email)}/segments/${segmentId}`,
      )
      if (result.ok || alreadyExists(result)) {
        return { ok: true, status: result.status, message: '', body: result.body }
      }
      return result
    },
    async removeFromSegment(email: string, segmentId: string): Promise<ResendCallResult> {
      const result = await request(
        'DELETE',
        `/contacts/${encodeURIComponent(email)}/segments/${segmentId}`,
      )
      if (result.ok || result.status === 404) {
        return { ok: true, status: result.status, message: '', body: result.body }
      }
      return result
    },
    createBroadcast(payload: Record<string, unknown>) {
      return request('POST', '/broadcasts', payload)
    },
    updateBroadcast(id: string, payload: Record<string, unknown>) {
      return request('PATCH', `/broadcasts/${id}`, payload)
    },
    sendBroadcast(id: string) {
      return request('POST', `/broadcasts/${id}/send`, {})
    },
    listBroadcasts() {
      return request('GET', '/broadcasts?limit=20')
    },
    broadcastMetrics(id: string) {
      const metrics = 'sent,delivered,opened,clicked,unique_opened,unique_clicked'
      return request('GET', `/emails/metrics?broadcast_id=${encodeURIComponent(id)}&metrics=${metrics}`)
    },
  }
}

export type ResendApi = ReturnType<typeof createResendApi>

export async function syncOrganizerContacts(input: {
  contacts: OrganizerContact[]
  api: Pick<ResendApi, 'ensureProperties' | 'upsertContact' | 'addToSegment' | 'removeFromSegment'>
  organizersSegmentId: string | null
  noSalesSegmentId: string | null
  limit?: number
  sleep?: (ms: number) => Promise<void>
}): Promise<{ synced: number; failed: number; remaining: number; rateLimited: boolean }> {
  const limit = input.limit ?? 40
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const batch = input.contacts.slice(0, limit)
  let synced = 0
  let failed = 0
  let rateLimited = false

  const properties = await input.api.ensureProperties()
  if (!properties.ok && properties.status === 429) {
    return { synced: 0, failed: 0, remaining: input.contacts.length, rateLimited: true }
  }

  for (const contact of batch) {
    const saved = await input.api.upsertContact(contact)
    if (saved.status === 429) {
      rateLimited = true
      break
    }
    if (!saved.ok) {
      failed += 1
      continue
    }

    const segmented = await assignSegments(input.api, contact, input.organizersSegmentId, input.noSalesSegmentId)
    if (segmented === 'rate_limited') {
      rateLimited = true
      failed += 1
      break
    }
    if (segmented === 'failed') {
      failed += 1
      continue
    }
    synced += 1
    if (sleep) await sleep(120)
  }

  const processed = synced + failed
  return {
    synced,
    failed,
    remaining: Math.max(0, input.contacts.length - processed),
    rateLimited,
  }
}

async function assignSegments(
  api: Pick<ResendApi, 'addToSegment' | 'removeFromSegment'>,
  contact: OrganizerContact,
  organizersSegmentId: string | null,
  noSalesSegmentId: string | null,
): Promise<'ok' | 'failed' | 'rate_limited'> {
  if (organizersSegmentId) {
    const added = await api.addToSegment(contact.email, organizersSegmentId)
    if (added.status === 429) return 'rate_limited'
    if (!added.ok) return 'failed'
  }
  if (!noSalesSegmentId) return 'ok'
  const membership = contact.noSales
    ? await api.addToSegment(contact.email, noSalesSegmentId)
    : await api.removeFromSegment(contact.email, noSalesSegmentId)
  if (membership.status === 429) return 'rate_limited'
  if (!membership.ok) return 'failed'
  return 'ok'
}

export function broadcastRequestBody(input: {
  segmentId: string
  from: string
  replyTo?: string
  subject: string
  html: string
  text: string
}): Record<string, unknown> {
  return {
    segment_id: input.segmentId,
    from: input.from,
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    subject: input.subject,
    html: input.html,
    text: input.text,
    name: `Activación: ${input.subject}`.slice(0, 80),
    send: false,
  }
}

export function parseBroadcastList(body: unknown): Omit<BroadcastSummary, 'sent' | 'delivered' | 'opened' | 'clicked'>[] {
  if (!body || typeof body !== 'object') return []
  const rows = (body as { data?: unknown }).data
  if (!Array.isArray(rows)) return []
  const list: Omit<BroadcastSummary, 'sent' | 'delivered' | 'opened' | 'clicked'>[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id) continue
    list.push({
      id,
      subject: typeof record.subject === 'string' ? record.subject : '',
      status: typeof record.status === 'string' ? record.status : '',
      createdAt: typeof record.created_at === 'string' ? record.created_at : '',
    })
  }
  return list
}

export function parseMetricTotals(body: unknown): {
  sent: number
  delivered: number
  opened: number
  clicked: number
} | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const totals =
    record.totals && typeof record.totals === 'object' ? (record.totals as Record<string, unknown>) : record
  const sent = num(totals.sent)
  const delivered = num(totals.delivered)
  const opened = num(totals.unique_opened) ?? num(totals.opened)
  const clicked = num(totals.unique_clicked) ?? num(totals.clicked)
  if (sent == null && delivered == null && opened == null && clicked == null) return null
  return {
    sent: sent ?? 0,
    delivered: delivered ?? 0,
    opened: opened ?? 0,
    clicked: clicked ?? 0,
  }
}

export function resendId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const id = (body as { id?: unknown }).id
  return typeof id === 'string' && id ? id : null
}

function propertyKeys(body: unknown): string[] {
  if (!body || typeof body !== 'object') return []
  const rows = (body as { data?: unknown }).data
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => (row && typeof row === 'object' ? (row as { key?: unknown }).key : null))
    .filter((key): key is string => typeof key === 'string')
}

function alreadyExists(result: ResendCallResult): boolean {
  if (result.status === 409) return true
  return /already exists/i.test(result.message)
}

function publicMessage(body: unknown, apiKey: string): string {
  const message =
    body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
      ? (body as { message: string }).message
      : 'Resend rechazó la solicitud'
  const secret = apiKey.trim()
  const redacted = secret ? message.split(secret).join('') : message
  return redacted.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Resend rechazó la solicitud'
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
