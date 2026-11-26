import { NextResponse } from 'next/server'
import {
  loadActivationView,
  runOrganizerSync,
  saveActivationSettings,
  saveBroadcastDraft,
  sendActivationBroadcast,
  sendActivationTest,
} from '@/lib/activation-run'
import type { ActivationSegment } from '@/lib/activation-resend'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  try {
    const data = await loadActivationView(auth.admin)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar'
    return NextResponse.json({ success: false, error: message.slice(0, 200) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) return auth.error

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ success: false, error: 'Solicitud inválida' }, { status: 400 })
  }
  const body = payload as Record<string, unknown>
  const mode = body.mode

  try {
    if (mode === 'sync') {
      const confirmCount = integer(body.confirmCount)
      if (confirmCount == null) {
        return NextResponse.json({ success: false, error: 'Confirma la cantidad' }, { status: 400 })
      }
      const result = await runOrganizerSync(auth.admin, {
        confirmCount,
        apiKey: process.env.RESEND_API_KEY,
      })
      return NextResponse.json(result.body, { status: result.status })
    }

    if (mode === 'draft' || mode === 'send') {
      const subject = stringValue(body.subject)
      const text = stringValue(body.body)
      const segment = segmentValue(body.segment)
      if (!segment) {
        return NextResponse.json({ success: false, error: 'Elige un segmento' }, { status: 400 })
      }
      if (mode === 'draft') {
        const result = await saveBroadcastDraft(auth.admin, {
          subject,
          body: text,
          segment,
          apiKey: process.env.RESEND_API_KEY,
          from: process.env.EMAIL_FROM,
          replyTo: process.env.EMAIL_REPLY_TO,
        })
        return NextResponse.json(result.body, { status: result.status })
      }
      const confirmCount = integer(body.confirmCount)
      if (confirmCount == null) {
        return NextResponse.json({ success: false, error: 'Confirma la cantidad' }, { status: 400 })
      }
      const result = await sendActivationBroadcast(auth.admin, {
        subject,
        body: text,
        segment,
        confirmCount,
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.EMAIL_FROM,
        replyTo: process.env.EMAIL_REPLY_TO,
      })
      return NextResponse.json(result.body, { status: result.status })
    }

    if (mode === 'test') {
      const result = await sendActivationTest({
        subject: stringValue(body.subject),
        body: stringValue(body.body),
        to: stringValue(body.testEmail),
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.EMAIL_FROM,
        replyTo: process.env.EMAIL_REPLY_TO,
      })
      return NextResponse.json(result.body, { status: result.status })
    }

    if (mode === 'settings') {
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Falta el interruptor' }, { status: 400 })
      }
      const saved = await saveActivationSettings(auth.admin, {
        enabled: body.enabled,
        day1Subject: stringValue(body.day1Subject),
        day1Body: stringValue(body.day1Body),
        day3Subject: stringValue(body.day3Subject),
        day3Body: stringValue(body.day3Body),
      })
      if (saved.ok === false) {
        return NextResponse.json({ success: false, error: saved.error }, { status: 400 })
      }
      return NextResponse.json({ success: true, enabled: saved.settings.enabled })
    }

    return NextResponse.json({ success: false, error: 'Modo inválido' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo completar'
    return NextResponse.json({ success: false, error: message.slice(0, 200) }, { status: 500 })
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function integer(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number) || number < 0) return null
  return number
}

function segmentValue(value: unknown): ActivationSegment | null {
  if (value === 'no_sales' || value === 'organizers') return value
  return null
}
