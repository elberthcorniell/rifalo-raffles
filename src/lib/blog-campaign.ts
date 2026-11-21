import type { SupabaseClient, User } from '@supabase/supabase-js'
import { BLOG_ORIGIN, blogCoverPublicPath, getBlogPost, type BlogPost } from '@/lib/blog'
import {
  deliveryBlocksResend,
  isBlogAudienceId,
  type BlogAudienceId,
  type BlogRecipient,
} from '@/lib/blog-audience'
import {
  buildBlogEmail,
  cleanEmailSubject,
  listUnsubscribeHeaders,
} from '@/lib/blog-email'
import { loadBlogAudience } from '@/lib/blog-recipients'
import { sendBlogEmailBatch, type OutboundBlogEmail } from '@/lib/blog-send'
import {
  blogUnsubscribeSecret,
  signBlogUnsubscribeToken,
} from '@/lib/blog-unsubscribe'
import { resolveEmailFrom } from '@/lib/emails/welcome'

type Admin = SupabaseClient

type ClaimedDelivery = { id: string; email: string; userId: string | null }

export type BlogSendOutcome = {
  status: number
  body: {
    success: boolean
    error?: string
    sent?: number
    failed?: number
    count?: number
  }
}

function messageFor(
  post: BlogPost,
  recipient: { email: string },
  subject: string,
  from: string,
  replyTo: string | undefined,
  secret: string,
  imageOrigin: string,
): OutboundBlogEmail {
  const token = signBlogUnsubscribeToken(recipient.email, secret)
  const unsubscribePage = `${BLOG_ORIGIN}/baja?token=${encodeURIComponent(token)}`
  const unsubscribeApi = `${BLOG_ORIGIN}/api/blog/unsubscribe?token=${encodeURIComponent(token)}`
  const email = buildBlogEmail({
    post,
    subject,
    coverUrl: `${imageOrigin}${blogCoverPublicPath(post)}`,
    unsubscribeUrl: unsubscribePage,
  })
  return {
    to: recipient.email,
    from,
    replyTo,
    subject,
    html: email.html,
    text: email.text,
    headers: listUnsubscribeHeaders(unsubscribeApi),
  }
}

export async function runBlogSend(input: {
  admin: Admin
  user: User
  payload: unknown
  apiKey: string | null | undefined
  from: string | null | undefined
  replyTo: string | null | undefined
  imageOrigin: string
  now?: Date
}): Promise<BlogSendOutcome> {
  const parsed = parsePayload(input.payload)
  if (parsed.ok === false) return fail(400, parsed.error)

  const post = getBlogPost(parsed.slug)
  if (!post) return fail(404, 'Post no encontrado')

  const subject = cleanEmailSubject(parsed.subject)
  if (!subject) return fail(400, 'Escribe un asunto')

  const apiKey = input.apiKey?.trim()
  if (!apiKey) return fail(400, 'RESEND_API_KEY no está configurada')

  const secret = blogUnsubscribeSecret()
  if (!secret) return fail(500, 'No hay clave para firmar la baja')

  const from = resolveEmailFrom(input.from)
  const replyTo = input.replyTo?.trim() || undefined

  if (parsed.mode === 'test') {
    return sendTest({
      admin: input.admin,
      user: input.user,
      post,
      subject,
      to: parsed.testEmail,
      apiKey,
      from,
      replyTo,
      secret,
      imageOrigin: input.imageOrigin,
    })
  }

  if (!post.published) {
    return fail(400, 'Publica el post antes de enviarlo a todos.')
  }

  return sendBulk({
    admin: input.admin,
    user: input.user,
    post,
    subject,
    audience: parsed.audience,
    confirmCount: parsed.confirmCount,
    apiKey,
    from,
    replyTo,
    secret,
    imageOrigin: input.imageOrigin,
    now: input.now,
  })
}

async function sendTest(input: {
  admin: Admin
  user: User
  post: BlogPost
  subject: string
  to: string
  apiKey: string
  from: string
  replyTo?: string
  secret: string
  imageOrigin: string
}): Promise<BlogSendOutcome> {
  const message = messageFor(input.post, { email: input.to }, input.subject, input.from, input.replyTo, input.secret, input.imageOrigin)
  const [result] = await sendBlogEmailBatch(input.post.slug, [message], { apiKey: input.apiKey })
  const ok = Boolean(result?.ok)

  const { data: campaign, error } = await input.admin
    .from('blog_email_campaigns')
    .insert({
      post_slug: input.post.slug,
      subject: input.subject,
      audience: 'test',
      kind: 'test',
      recipient_count: 1,
      sent_count: ok ? 1 : 0,
      failed_count: ok ? 0 : 1,
      created_by: input.user.id,
      created_by_email: input.user.email || null,
    })
    .select('id')
    .single()

  if (!error && campaign?.id) {
    await input.admin.from('blog_email_deliveries').insert({
      campaign_id: campaign.id,
      post_slug: input.post.slug,
      email: input.to,
      kind: 'test',
      status: ok ? 'sent' : 'failed',
      error: ok ? null : result?.error || 'No se pudo enviar',
      sent_at: ok ? new Date().toISOString() : null,
    })
  }

  if (!ok) return fail(502, result?.error || 'No se pudo enviar la prueba')
  return { status: 200, body: { success: true, sent: 1, failed: 0 } }
}

async function sendBulk(input: {
  admin: Admin
  user: User
  post: BlogPost
  subject: string
  audience: BlogAudienceId
  confirmCount: number
  apiKey: string
  from: string
  replyTo?: string
  secret: string
  imageOrigin: string
  now?: Date
}): Promise<BlogSendOutcome> {
  const snapshot = await loadBlogAudience(input.admin, input.post.slug, input.now)
  const targets = snapshot.audiences[input.audience].willSend
  if (targets.length !== input.confirmCount) {
    return fail(409, 'La cantidad cambió. Revisa el número y confirma otra vez.', targets.length)
  }
  if (targets.length === 0) return fail(400, 'No hay destinatarios.')

  const { data: campaign, error: campaignError } = await input.admin
    .from('blog_email_campaigns')
    .insert({
      post_slug: input.post.slug,
      subject: input.subject,
      audience: input.audience,
      kind: 'bulk',
      recipient_count: 0,
      sent_count: 0,
      failed_count: 0,
      created_by: input.user.id,
      created_by_email: input.user.email || null,
    })
    .select('id')
    .single()

  if (campaignError || !campaign?.id) {
    return fail(500, campaignError?.message || 'No se pudo crear el envío')
  }

  const campaignId = campaign.id as string
  try {
    const claimed = await claimDeliveries(input.admin, campaignId, input.post.slug, targets)
    if (claimed.length !== targets.length) {
      await input.admin.from('blog_email_campaigns').update({ recipient_count: claimed.length }).eq('id', campaignId)
      return fail(409, 'La cantidad cambió. Revisa el número y confirma otra vez.', claimed.length)
    }

    await input.admin
      .from('blog_email_campaigns')
      .update({ recipient_count: claimed.length })
      .eq('id', campaignId)

    const messages = claimed.map((row) =>
      messageFor(
        input.post,
        { email: row.email },
        input.subject,
        input.from,
        input.replyTo,
        input.secret,
        input.imageOrigin,
      ),
    )
    const results = await sendBlogEmailBatch(input.post.slug, messages, { apiKey: input.apiKey })

    const sentIds: string[] = []
    const failed: { id: string; error: string }[] = []
    results.forEach((result, index) => {
      const row = claimed[index]
      if (!row) return
      if (result.ok) sentIds.push(row.id)
      else failed.push({ id: row.id, error: result.error || 'No se pudo enviar' })
    })

    if (sentIds.length > 0) {
      await updateStatus(input.admin, sentIds, 'sent')
    }
    for (const row of failed) {
      await input.admin
        .from('blog_email_deliveries')
        .update({ status: 'failed', error: row.error, sent_at: null })
        .eq('id', row.id)
    }

    await input.admin
      .from('blog_email_campaigns')
      .update({ sent_count: sentIds.length, failed_count: failed.length })
      .eq('id', campaignId)

    return {
      status: 200,
      body: { success: failed.length === 0, sent: sentIds.length, failed: failed.length },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo enviar'
    await input.admin
      .from('blog_email_campaigns')
      .update({ failed_count: targets.length })
      .eq('id', campaignId)
    return fail(500, message)
  }
}

async function claimDeliveries(
  admin: Admin,
  campaignId: string,
  slug: string,
  targets: BlogRecipient[],
): Promise<ClaimedDelivery[]> {
  const emails = targets.map((target) => target.email)
  const existing = await loadExisting(admin, slug, emails)
  const byEmail = new Map(existing.map((row) => [row.email, row]))
  const fresh: BlogRecipient[] = []
  const retried: ClaimedDelivery[] = []
  const now = new Date().toISOString()

  for (const target of targets) {
    const row = byEmail.get(target.email)
    if (row && deliveryBlocksResend(row, new Date())) continue
    if (!row) {
      fresh.push(target)
      continue
    }
    const { error } = await admin
      .from('blog_email_deliveries')
      .update({
        campaign_id: campaignId,
        user_id: target.userId,
        status: 'pending',
        error: null,
        claimed_at: now,
        sent_at: null,
      })
      .eq('id', row.id)
    if (!error) retried.push({ id: row.id, email: target.email, userId: target.userId })
  }

  const inserted = await insertFresh(admin, campaignId, slug, fresh, now)
  const insertedByEmail = new Map(inserted.map((row) => [row.email, row]))
  const claimedFresh = fresh
    .map((target) => insertedByEmail.get(target.email))
    .filter((row): row is ClaimedDelivery => Boolean(row))

  return [...retried, ...claimedFresh]
}

async function loadExisting(
  admin: Admin,
  slug: string,
  emails: string[],
): Promise<{ id: string; email: string; status: string; claimedAt: string }[]> {
  const rows: { id: string; email: string; status: string; claimedAt: string }[] = []
  for (let index = 0; index < emails.length; index += 100) {
    const slice = emails.slice(index, index + 100)
    const { data, error } = await admin
      .from('blog_email_deliveries')
      .select('id, email, status, claimed_at')
      .eq('post_slug', slug)
      .eq('kind', 'bulk')
      .in('email', slice)
    if (error) throw new Error(error.message)
    for (const row of data || []) {
      rows.push({
        id: row.id as string,
        email: row.email as string,
        status: row.status as string,
        claimedAt: row.claimed_at as string,
      })
    }
  }
  return rows
}

async function insertFresh(
  admin: Admin,
  campaignId: string,
  slug: string,
  targets: BlogRecipient[],
  claimedAt: string,
): Promise<ClaimedDelivery[]> {
  if (targets.length === 0) return []
  const rows = targets.map((target) => ({
    campaign_id: campaignId,
    post_slug: slug,
    user_id: target.userId,
    email: target.email,
    kind: 'bulk',
    status: 'pending',
    claimed_at: claimedAt,
  }))

  const { data, error } = await admin.from('blog_email_deliveries').insert(rows).select('id, email, user_id')
  if (!error) {
    return ((data || []) as { id: string; email: string; user_id: string | null }[]).map((row) => ({
      id: row.id,
      email: row.email,
      userId: row.user_id,
    }))
  }
  if (error.code !== '23505') throw new Error(error.message)

  const inserted: ClaimedDelivery[] = []
  for (const row of rows) {
    const single = await admin.from('blog_email_deliveries').insert(row).select('id, email, user_id').maybeSingle()
    if (!single.error && single.data) {
      inserted.push({
        id: single.data.id as string,
        email: single.data.email as string,
        userId: (single.data.user_id as string | null) ?? null,
      })
    }
  }
  return inserted
}

async function updateStatus(admin: Admin, ids: string[], status: 'sent' | 'failed') {
  const sentAt = status === 'sent' ? new Date().toISOString() : null
  for (let index = 0; index < ids.length; index += 100) {
    const slice = ids.slice(index, index + 100)
    const { error } = await admin
      .from('blog_email_deliveries')
      .update({ status, error: null, sent_at: sentAt })
      .in('id', slice)
    if (error) throw new Error(error.message)
  }
}

function parsePayload(payload: unknown):
  | { ok: true; mode: 'test'; slug: string; subject: string; testEmail: string }
  | { ok: true; mode: 'bulk'; slug: string; subject: string; audience: BlogAudienceId; confirmCount: number }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Solicitud inválida' }
  const body = payload as Record<string, unknown>
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const subject = typeof body.subject === 'string' ? body.subject : ''
  if (!slug) return { ok: false, error: 'Elige un post' }

  if (body.mode === 'test') {
    const testEmail = typeof body.testEmail === 'string' ? body.testEmail.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      return { ok: false, error: 'Escribe un correo de prueba válido' }
    }
    return { ok: true, mode: 'test', slug, subject, testEmail }
  }

  if (body.mode !== 'bulk') return { ok: false, error: 'Modo inválido' }
  if (!isBlogAudienceId(body.audience)) return { ok: false, error: 'Elige una audiencia' }
  const confirmCount = typeof body.confirmCount === 'number' ? body.confirmCount : Number(body.confirmCount)
  if (!Number.isInteger(confirmCount) || confirmCount < 0) {
    return { ok: false, error: 'Confirma la cantidad de destinatarios' }
  }
  return { ok: true, mode: 'bulk', slug, subject, audience: body.audience, confirmCount }
}

function fail(status: number, error: string, count?: number): BlogSendOutcome {
  return { status, body: { success: false, error, ...(count != null ? { count } : {}) } }
}
