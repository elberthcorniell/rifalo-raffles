import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ACTIVATION_DAY1_BODY,
  ACTIVATION_DAY1_SUBJECT,
  ACTIVATION_DAY3_BODY,
  ACTIVATION_DAY3_SUBJECT,
} from '@/lib/activation-copy'
import {
  activationTargets,
  classifyOrganizer,
  decideClaim,
  previewOrganizerSync,
  type OrganizerContact,
  type OrganizerInput,
} from '@/lib/activation-contacts'
import { buildActivationEmail, cleanActivationBody, cleanActivationSubject } from '@/lib/activation-email'
import {
  broadcastRequestBody,
  createResendApi,
  parseBroadcastList,
  parseMetricTotals,
  resendId,
  segmentIdFromEnv,
  syncOrganizerContacts,
  type ActivationSegment,
  type BroadcastSummary,
} from '@/lib/activation-resend'
import { loadOrganizerInputs } from '@/lib/activation-recipients'
import { BLOG_ORIGIN } from '@/lib/blog'
import { listUnsubscribeHeaders } from '@/lib/blog-email'
import { blogUnsubscribeSecret, signBlogUnsubscribeToken } from '@/lib/blog-unsubscribe'
import { resolveEmailFrom } from '@/lib/emails/welcome'
import { sendResendEmail, type OutboundEmail } from '@/lib/emails/resend'
import { getRootDomain } from '@/lib/constants'
import type { ActivationSettingsView as ActivationSettings, ActivationView } from '@/lib/activation-view'

type Admin = SupabaseClient

const DEFAULT_SETTINGS: ActivationSettings = {
  enabled: false,
  day1Subject: ACTIVATION_DAY1_SUBJECT,
  day1Body: ACTIVATION_DAY1_BODY,
  day3Subject: ACTIVATION_DAY3_SUBJECT,
  day3Body: ACTIVATION_DAY3_BODY,
  broadcastSubject: ACTIVATION_DAY1_SUBJECT,
  broadcastBody: ACTIVATION_DAY1_BODY,
  broadcastSegment: 'no_sales',
  resendBroadcastId: null,
  storageReady: false,
}

export function defaultActivationSettings(): ActivationSettings {
  return { ...DEFAULT_SETTINGS }
}

export async function loadActivationSettings(admin: Admin): Promise<ActivationSettings> {
  const { data, error } = await admin
    .from('organizer_activation_settings')
    .select(
      'enabled, day1_subject, day1_body, day3_subject, day3_body, broadcast_subject, broadcast_body, broadcast_segment, resend_broadcast_id',
    )
    .eq('id', 1)
    .maybeSingle()

  if (error) return defaultActivationSettings()
  if (!data) return { ...defaultActivationSettings(), storageReady: true }

  return {
    enabled: data.enabled === true,
    day1Subject: textOr(data.day1_subject, ACTIVATION_DAY1_SUBJECT),
    day1Body: textOr(data.day1_body, ACTIVATION_DAY1_BODY),
    day3Subject: textOr(data.day3_subject, ACTIVATION_DAY3_SUBJECT),
    day3Body: textOr(data.day3_body, ACTIVATION_DAY3_BODY),
    broadcastSubject: textOr(data.broadcast_subject, ACTIVATION_DAY1_SUBJECT),
    broadcastBody: textOr(data.broadcast_body, ACTIVATION_DAY1_BODY),
    broadcastSegment: data.broadcast_segment === 'organizers' ? 'organizers' : 'no_sales',
    resendBroadcastId: typeof data.resend_broadcast_id === 'string' ? data.resend_broadcast_id : null,
    storageReady: true,
  }
}

export async function loadActivationView(admin: Admin, env: NodeJS.ProcessEnv = process.env): Promise<ActivationView> {
  const [settings, inputs] = await Promise.all([loadActivationSettings(admin), loadOrganizerInputs(admin)])
  const preview = previewOrganizerSync(inputs, getRootDomain())
  const apiKey = env.RESEND_API_KEY?.trim() || ''
  let broadcasts: BroadcastSummary[] = []
  let broadcastsNote: string | null = null
  if (!apiKey) {
    broadcastsNote = 'RESEND_API_KEY no está configurada. El historial aparece cuando la clave está en el servidor.'
  } else {
    const listed = await createResendApi(apiKey).listBroadcasts()
    if (!listed.ok) {
      broadcastsNote = listed.message
    } else {
      const rows = parseBroadcastList(listed.body).slice(0, 8)
      broadcasts = await Promise.all(rows.map((row) => withMetrics(apiKey, row)))
    }
  }

  return {
    preview,
    settings,
    broadcasts,
    broadcastsNote,
    resendConfigured: Boolean(apiKey),
    segments: {
      noSales: Boolean(segmentIdFromEnv('no_sales', env)),
      organizers: Boolean(segmentIdFromEnv('organizers', env)),
    },
    replyToConfigured: Boolean(env.EMAIL_REPLY_TO?.trim()),
    storageReady: settings.storageReady,
  }
}

export async function saveActivationSettings(
  admin: Admin,
  patch: Partial<ActivationSettings>,
): Promise<{ ok: true; settings: ActivationSettings } | { ok: false; error: string }> {
  const current = await loadActivationSettings(admin)
  if (!current.storageReady) {
    return { ok: false, error: 'Falta aplicar la migración de activación en Supabase.' }
  }
  const next: ActivationSettings = {
    ...current,
    ...patch,
    enabled: patch.enabled === undefined ? current.enabled : patch.enabled === true,
    storageReady: true,
  }
  const subject = cleanActivationSubject(next.day1Subject)
  const day3Subject = cleanActivationSubject(next.day3Subject)
  const broadcastSubject = cleanActivationSubject(next.broadcastSubject)
  if (!subject || !day3Subject || !broadcastSubject) return { ok: false, error: 'Escribe un asunto' }
  const day1Body = cleanActivationBody(next.day1Body)
  const day3Body = cleanActivationBody(next.day3Body)
  const broadcastBody = cleanActivationBody(next.broadcastBody)
  if (!day1Body || !day3Body || !broadcastBody) return { ok: false, error: 'Escribe el mensaje' }

  const { error } = await admin.from('organizer_activation_settings').upsert({
    id: 1,
    enabled: next.enabled,
    day1_subject: subject,
    day1_body: day1Body,
    day3_subject: day3Subject,
    day3_body: day3Body,
    broadcast_subject: broadcastSubject,
    broadcast_body: broadcastBody,
    broadcast_segment: next.broadcastSegment === 'organizers' ? 'organizers' : 'no_sales',
    resend_broadcast_id: next.resendBroadcastId,
    updated_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    settings: {
      ...next,
      day1Subject: subject,
      day1Body,
      day3Subject,
      day3Body,
      broadcastSubject,
      broadcastBody,
    },
  }
}

export async function runOrganizerSync(
  admin: Admin,
  input: { confirmCount: number; apiKey: string | null | undefined; env?: NodeJS.ProcessEnv },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const apiKey = input.apiKey?.trim()
  if (!apiKey) return fail(400, 'RESEND_API_KEY no está configurada')
  const inputs = await loadOrganizerInputs(admin)
  const root = getRootDomain()
  const contacts = syncableContacts(inputs, root)
  const preview = previewOrganizerSync(inputs, root)
  if (input.confirmCount !== preview.willSync) {
    return fail(409, 'La cantidad cambió. Revisa el número y confirma otra vez.', { count: preview.willSync })
  }
  const env = input.env || process.env
  const result = await syncOrganizerContacts({
    contacts,
    api: createResendApi(apiKey),
    organizersSegmentId: segmentIdFromEnv('organizers', env),
    noSalesSegmentId: segmentIdFromEnv('no_sales', env),
  })
  return {
    status: 200,
    body: {
      success: true,
      ...result,
      segments: {
        noSales: Boolean(segmentIdFromEnv('no_sales', env)),
        organizers: Boolean(segmentIdFromEnv('organizers', env)),
      },
    },
  }
}

export async function saveBroadcastDraft(
  admin: Admin,
  input: {
    subject: string
    body: string
    segment: ActivationSegment
    apiKey: string | null | undefined
    from: string | null | undefined
    replyTo: string | null | undefined
    env?: NodeJS.ProcessEnv
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const saved = await saveActivationSettings(admin, {
    broadcastSubject: input.subject,
    broadcastBody: input.body,
    broadcastSegment: input.segment,
  })
  if (saved.ok === false) return fail(400, saved.error)

  const apiKey = input.apiKey?.trim()
  const env = input.env || process.env
  const segmentId = segmentIdFromEnv(input.segment, env)
  if (!apiKey || !segmentId) {
    return {
      status: 200,
      body: {
        success: true,
        stored: true,
        resend: false,
        error: !apiKey
          ? 'Borrador guardado aquí. Falta RESEND_API_KEY para crearlo en Resend.'
          : 'Borrador guardado aquí. Falta el id del segmento en Resend.',
      },
    }
  }

  const email = buildActivationEmail({
    subject: input.subject,
    body: input.body,
    mode: 'broadcast',
    unsubscribeUrl: '{{{RESEND_UNSUBSCRIBE_URL}}}',
  })
  const payload = broadcastRequestBody({
    segmentId,
    from: resolveEmailFrom(input.from),
    replyTo: input.replyTo?.trim() || undefined,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  const api = createResendApi(apiKey)
  let broadcastId = saved.settings.resendBroadcastId
  if (broadcastId) {
    const updated = await api.updateBroadcast(broadcastId, payload)
    if (!updated.ok) broadcastId = null
  }
  if (!broadcastId) {
    const created = await api.createBroadcast(payload)
    if (!created.ok) return fail(502, created.message)
    broadcastId = resendId(created.body)
    if (!broadcastId) return fail(502, 'Resend no devolvió el id del broadcast')
    await saveActivationSettings(admin, { resendBroadcastId: broadcastId })
  }
  return { status: 200, body: { success: true, stored: true, resend: true, id: broadcastId } }
}

export async function sendActivationTest(input: {
  subject: string
  body: string
  to: string
  apiKey: string | null | undefined
  from: string | null | undefined
  replyTo: string | null | undefined
  send?: (message: OutboundEmail) => Promise<{ ok: boolean }>
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const to = input.to.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail(400, 'Escribe un correo de prueba válido')
  if (!input.apiKey?.trim()) return fail(400, 'RESEND_API_KEY no está configurada')
  const email = buildActivationEmail({
    subject: input.subject,
    body: input.body,
    mode: 'personal',
    firstName: 'Ana',
    raffleLink: 'https://ana.rifalo.do',
    unsubscribeUrl: `${BLOG_ORIGIN}/baja`,
  })
  const send = input.send || sendResendEmail
  const result = await send({
    to,
    from: resolveEmailFrom(input.from),
    replyTo: input.replyTo?.trim() || undefined,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: `activation/test/${Date.now()}`,
  })
  if (!result.ok) return fail(502, 'No se pudo enviar la prueba')
  return { status: 200, body: { success: true, sent: 1 } }
}

export async function sendActivationBroadcast(
  admin: Admin,
  input: {
    subject: string
    body: string
    segment: ActivationSegment
    confirmCount: number
    apiKey: string | null | undefined
    from: string | null | undefined
    replyTo: string | null | undefined
    env?: NodeJS.ProcessEnv
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const inputs = await loadOrganizerInputs(admin)
  const preview = previewOrganizerSync(inputs, getRootDomain())
  const expected = input.segment === 'organizers' ? preview.willSync : preview.noSales
  if (input.confirmCount !== expected) {
    return fail(409, 'La cantidad cambió. Revisa el número y confirma otra vez.', { count: expected })
  }
  if (expected === 0) return fail(400, 'No hay destinatarios.')
  const draft = await saveBroadcastDraft(admin, input)
  if (draft.status !== 200 || draft.body.resend !== true) {
    return fail(draft.status === 200 ? 400 : draft.status, String(draft.body.error || 'No se pudo preparar el broadcast'))
  }
  const id = String(draft.body.id || '')
  const apiKey = input.apiKey?.trim()
  if (!apiKey || !id) return fail(400, 'No se pudo preparar el broadcast')
  const sent = await createResendApi(apiKey).sendBroadcast(id)
  if (!sent.ok) return fail(502, sent.message)
  return { status: 200, body: { success: true, id } }
}

export async function runOrganizerActivation(
  admin: Admin,
  options?: {
    now?: Date
    apiKey?: string | null
    from?: string | null
    replyTo?: string | null
    rootDomain?: string
    send?: (message: OutboundEmail) => Promise<{ ok: boolean }>
    limit?: number
  },
): Promise<{ ok: boolean; skipped?: string; sent: number; failed: number; day1: number; day3: number }> {
  const settings = await loadActivationSettings(admin)
  if (!settings.storageReady) return { ok: true, skipped: 'missing_storage', sent: 0, failed: 0, day1: 0, day3: 0 }
  if (!settings.enabled) return { ok: true, skipped: 'disabled', sent: 0, failed: 0, day1: 0, day3: 0 }

  const apiKey = (options?.apiKey ?? process.env.RESEND_API_KEY)?.trim()
  if (!apiKey) return { ok: true, skipped: 'missing_api_key', sent: 0, failed: 0, day1: 0, day3: 0 }

  const now = options?.now ?? new Date()
  const root = options?.rootDomain || getRootDomain()
  const [inputs, records] = await Promise.all([loadOrganizerInputs(admin), loadSendRecords(admin)])
  const due: { input: OrganizerInput; kind: 'day1' | 'day3'; signupAt: string }[] = []
  for (const input of inputs) {
    const targets = activationTargets(input, records.get(normalizeKey(input.email)) || [], now, root)
    const decision = classifyOrganizer(input, root)
    if (decision.action !== 'sync') continue
    if (targets.day1) due.push({ input, kind: 'day1', signupAt: decision.contact.signupAt })
    if (targets.day3) due.push({ input, kind: 'day3', signupAt: decision.contact.signupAt })
  }
  due.sort((a, b) => a.signupAt.localeCompare(b.signupAt))

  const send = options?.send || ((message: OutboundEmail) => sendResendEmail(message, { apiKey, logLabel: 'Activation' }))
  const from = resolveEmailFrom(options?.from ?? process.env.EMAIL_FROM)
  const replyTo = (options?.replyTo ?? process.env.EMAIL_REPLY_TO)?.trim() || undefined
  const secret = blogUnsubscribeSecret()
  let sent = 0
  let failed = 0
  let day1 = 0
  let day3 = 0
  const limit = options?.limit ?? 25

  for (const item of due.slice(0, limit)) {
    const decision = classifyOrganizer(item.input, root)
    if (decision.action !== 'sync') continue
    const contact = decision.contact
    const existing = (records.get(contact.email) || []).find((row) => row.kind === item.kind) || null
    const claim = decideClaim(existing, now)
    if (claim === 'skip') continue
    const claimed = await claimSend(admin, contact, item.kind, claim, now)
    if (!claimed) continue

    const token = secret ? signBlogUnsubscribeToken(contact.email, secret) : ''
    const unsubscribePage = token ? `${BLOG_ORIGIN}/baja?token=${encodeURIComponent(token)}` : ''
    const unsubscribeApi = token ? `${BLOG_ORIGIN}/api/blog/unsubscribe?token=${encodeURIComponent(token)}` : ''
    const template = item.kind === 'day1'
      ? { subject: settings.day1Subject, body: settings.day1Body }
      : { subject: settings.day3Subject, body: settings.day3Body }
    const email = buildActivationEmail({
      subject: template.subject,
      body: template.body,
      mode: 'personal',
      firstName: contact.firstName,
      raffleLink: contact.raffleLink,
      unsubscribeUrl: unsubscribePage || undefined,
    })
    const result = await send({
      to: contact.email,
      from,
      replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `activation/${item.kind}/${contact.userId}`,
      headers: unsubscribeApi ? listUnsubscribeHeaders(unsubscribeApi) : undefined,
    })
    if (result.ok) {
      await markSend(admin, contact.email, item.kind, 'sent', null)
      sent += 1
      if (item.kind === 'day1') day1 += 1
      else day3 += 1
    } else {
      await markSend(admin, contact.email, item.kind, 'failed', 'No se pudo enviar')
      failed += 1
    }
  }

  return { ok: failed === 0, sent, failed, day1, day3 }
}

async function withMetrics(
  apiKey: string,
  row: { id: string; subject: string; status: string; createdAt: string },
): Promise<BroadcastSummary> {
  if (row.status === 'draft') {
    return { ...row, sent: null, delivered: null, opened: null, clicked: null }
  }
  const metrics = await createResendApi(apiKey).broadcastMetrics(row.id)
  const totals = metrics.ok ? parseMetricTotals(metrics.body) : null
  return {
    ...row,
    sent: totals?.sent ?? null,
    delivered: totals?.delivered ?? null,
    opened: totals?.opened ?? null,
    clicked: totals?.clicked ?? null,
  }
}

function syncableContacts(inputs: OrganizerInput[], root: string): OrganizerContact[] {
  const contacts: OrganizerContact[] = []
  for (const input of inputs) {
    const decision = classifyOrganizer(input, root)
    if (decision.action === 'sync') contacts.push(decision.contact)
  }
  return contacts
}

async function loadSendRecords(admin: Admin): Promise<Map<string, { kind: 'day1' | 'day3'; status: string; claimedAt: string }[]>> {
  const map = new Map<string, { kind: 'day1' | 'day3'; status: string; claimedAt: string }[]>()
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await admin
      .from('organizer_activation_sends')
      .select('email, kind, status, claimed_at')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const page = data || []
    for (const row of page) {
      const email = normalizeKey(row.email as string)
      const kind = row.kind === 'day3' ? 'day3' : 'day1'
      const list = map.get(email) || []
      list.push({ kind, status: String(row.status), claimedAt: String(row.claimed_at) })
      map.set(email, list)
    }
    if (page.length < 1000) break
  }
  return map
}

async function claimSend(
  admin: Admin,
  contact: OrganizerContact,
  kind: 'day1' | 'day3',
  claim: 'insert' | 'retry',
  now: Date,
): Promise<boolean> {
  const claimedAt = now.toISOString()
  if (claim === 'insert') {
    const { error } = await admin.from('organizer_activation_sends').insert({
      user_id: contact.userId,
      email: contact.email,
      kind,
      status: 'pending',
      claimed_at: claimedAt,
    })
    if (!error) return true
    return false
  }
  const { data, error } = await admin
    .from('organizer_activation_sends')
    .update({ status: 'pending', error: null, claimed_at: claimedAt, sent_at: null })
    .eq('email', contact.email)
    .eq('kind', kind)
    .neq('status', 'sent')
    .select('id')
  return !error && Boolean(data?.length)
}

async function markSend(
  admin: Admin,
  email: string,
  kind: 'day1' | 'day3',
  status: 'sent' | 'failed',
  error: string | null,
) {
  await admin
    .from('organizer_activation_sends')
    .update({
      status,
      error,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('email', email)
    .eq('kind', kind)
}

function normalizeKey(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase()
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return { status, body: { success: false, error, ...extra } }
}
