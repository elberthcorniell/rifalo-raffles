'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ACTIVATION_DAY1_BODY,
  ACTIVATION_DAY1_SUBJECT,
  ACTIVATION_DAY3_BODY,
  ACTIVATION_DAY3_SUBJECT,
  ACTIVATION_PREVIEW,
} from '@/lib/activation-copy'
import { buildActivationEmail } from '@/lib/activation-email'
import { BROADCAST_STATUS_LABELS, type ActivationView } from '@/lib/activation-view'

type Segment = 'no_sales' | 'organizers'

const EMPTY: ActivationView = {
  preview: {
    willSync: 0,
    noSales: 0,
    withSales: 0,
    withActiveRaffle: 0,
    invalidEmail: 0,
    unconfirmed: 0,
    unsubscribed: 0,
    excluded: 0,
  },
  settings: {
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
  },
  broadcasts: [],
  broadcastsNote: null,
  resendConfigured: false,
  segments: { noSales: false, organizers: false },
  replyToConfigured: false,
  storageReady: false,
}

export function OrganizerActivationPanel({ initial }: { initial?: ActivationView }) {
  const [data, setData] = useState<ActivationView>(initial || EMPTY)
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [subject, setSubject] = useState(initial?.settings.broadcastSubject || ACTIVATION_DAY1_SUBJECT)
  const [body, setBody] = useState(initial?.settings.broadcastBody || ACTIVATION_DAY1_BODY)
  const [segment, setSegment] = useState<Segment>(initial?.settings.broadcastSegment || 'no_sales')
  const [testEmail, setTestEmail] = useState('')
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncTyped, setSyncTyped] = useState('')
  const [sendOpen, setSendOpen] = useState(false)
  const [sendTyped, setSendTyped] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(initial?.settings.enabled === true)
  const [day1Subject, setDay1Subject] = useState(initial?.settings.day1Subject || ACTIVATION_DAY1_SUBJECT)
  const [day1Body, setDay1Body] = useState(initial?.settings.day1Body || ACTIVATION_DAY1_BODY)
  const [day3Subject, setDay3Subject] = useState(initial?.settings.day3Subject || ACTIVATION_DAY3_SUBJECT)
  const [day3Body, setDay3Body] = useState(initial?.settings.day3Body || ACTIVATION_DAY3_BODY)

  useEffect(() => {
    if (initial) return
    let cancelled = false
    fetch('/api/platform/superadmin/blog/activation')
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return
        if (!json.success) {
          setError(json.error || 'No se pudo cargar')
          return
        }
        const next = json.data as ActivationView
        setData(next)
        setSubject(next.settings.broadcastSubject)
        setBody(next.settings.broadcastBody)
        setSegment(next.settings.broadcastSegment)
        setEnabled(next.settings.enabled)
        setDay1Subject(next.settings.day1Subject)
        setDay1Body(next.settings.day1Body)
        setDay3Subject(next.settings.day3Subject)
        setDay3Body(next.settings.day3Body)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initial])

  const preview = data.preview
  const count = segment === 'organizers' ? preview.willSync : preview.noSales
  const email = buildActivationEmail({
    subject,
    body,
    mode: 'personal',
    campaign: 'activacion_broadcast',
    firstName: ACTIVATION_PREVIEW.firstName,
    raffleLink: ACTIVATION_PREVIEW.raffleLink,
    unsubscribeUrl: 'https://www.rifalo.do/baja',
  })

  async function post(mode: string, payload: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/platform/superadmin/blog/activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, ...payload }),
      })
      const json = await response.json()
      if (!response.ok || json.success === false) {
        setError(json.error || 'No se pudo completar')
        return json
      }
      return json
    } catch {
      setError('No se pudo completar')
      return null
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447]">Activación de organizadores</h1>
        <p className="text-muted-foreground">
          Sincroniza contactos, prepara un broadcast y deja listos los correos del día 1 y del día 3.
          La automatización nace apagada.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border bg-white p-4 md:p-5">
        <div>
          <h2 className="text-lg font-semibold text-[#0B2447]">Sincronizar organizadores</h2>
          <p className="text-sm text-muted-foreground">
            Vista previa de quién entraría a Resend. El botón hace un upsert por correo y no crea duplicados.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Count label="Se sincronizarían" value={loading ? null : preview.willSync} />
          <Count label="Con rifa activa" value={loading ? null : preview.withActiveRaffle} />
          <Count label="Rifa activa y 0 boletos" value={loading ? null : preview.noSales} />
          <Count label="Con ventas" value={loading ? null : preview.withSales} />
        </dl>
        <p className="text-xs leading-relaxed text-[#6b7280]">
          Fuera: {loading ? '…' : preview.unconfirmed} sin correo confirmado, {loading ? '…' : preview.unsubscribed} dados
          de baja, {loading ? '…' : preview.excluded} solo en organizaciones de prueba,{' '}
          {loading ? '…' : preview.invalidEmail} sin correo válido.
        </p>
        <p className="text-xs leading-relaxed text-[#6b7280]">
          Segmento de todos: {data.segments.organizers ? 'configurado' : 'falta RESEND_SEGMENT_ORGANIZERS_ID'}.
          Segmento sin ventas: {data.segments.noSales ? 'configurado' : 'falta RESEND_SEGMENT_NO_SALES_ID'}.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null || loading || preview.willSync === 0}
          onClick={() => {
            setSyncOpen(true)
            setSyncTyped('')
          }}
        >
          Sincronizar organizadores
        </Button>
        {syncOpen && (
          <div className="space-y-3 rounded-xl border border-[#0B2447]/15 bg-[#f8fafc] p-4">
            <p className="text-sm leading-relaxed text-[#0B2447]">
              Vas a sincronizar <span className="font-semibold">{preview.willSync}</span>{' '}
              {preview.willSync === 1 ? 'organizador' : 'organizadores'}. Escribe {preview.willSync} para confirmar.
            </p>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={syncTyped}
              aria-label="Confirmar sincronización"
              onChange={(event) => setSyncTyped(event.target.value)}
            />
            <Button
              type="button"
              className="bg-[#0B2447] hover:bg-[#0B2447]/90"
              disabled={busy !== null || syncTyped.trim() !== String(preview.willSync)}
              onClick={async () => {
                const json = await post('sync', { confirmCount: preview.willSync }, 'sync')
                if (!json || json.success === false) return
                const parts = [`Sincronizados ${json.synced}.`]
                if (json.failed) parts.push(`${json.failed} fallaron.`)
                if (json.remaining) parts.push(`Quedan ${json.remaining}; pulsa otra vez para seguir.`)
                if (json.rateLimited) parts.push('Resend pidió esperar antes de continuar.')
                setNotice(parts.join(' '))
                setSyncOpen(false)
                setSyncTyped('')
              }}
            >
              {busy === 'sync' ? 'Sincronizando…' : 'Confirmar sincronización'}
            </Button>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#0B2447]">Broadcast</h2>
            <p className="text-sm text-muted-foreground">
              Borrador en Resend. La prueba sale a una sola dirección, con el nombre Ana y un link de ejemplo.
            </p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[#0B2447]">Segmento</legend>
            <SegmentOption
              checked={segment === 'no_sales'}
              label="Con rifa activa y 0 boletos vendidos"
              count={loading ? null : preview.noSales}
              onChange={() => {
                setSegment('no_sales')
                setSendOpen(false)
                setSendTyped('')
              }}
            />
            <SegmentOption
              checked={segment === 'organizers'}
              label="Todos los organizadores"
              count={loading ? null : preview.willSync}
              onChange={() => {
                setSegment('organizers')
                setSendOpen(false)
                setSendTyped('')
              }}
            />
          </fieldset>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#0B2447]">Asunto</span>
            <Input value={subject} maxLength={180} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#0B2447]">Mensaje</span>
            <Textarea
              value={body}
              rows={14}
              maxLength={8000}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <p className="text-xs leading-relaxed text-[#6b7280]">
            Variables: {'{{{contact.first_name|organizador}}}'} y {'{{{raffle_link}}}'}. El botón Ver mi rifa se agrega
            solo. [premio] lo cambia el organizador al copiar el mensaje.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null || !subject.trim() || !body.trim()}
              onClick={async () => {
                const json = await post('draft', { subject, body, segment }, 'draft')
                if (!json || json.success === false) return
                setNotice(json.resend ? 'Borrador guardado en Resend.' : json.error || 'Borrador guardado aquí.')
              }}
            >
              {busy === 'draft' ? 'Guardando…' : 'Guardar borrador'}
            </Button>
          </div>
          <div className="space-y-2 border-t pt-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[#0B2447]">Enviar prueba</span>
              <Input
                type="email"
                value={testEmail}
                placeholder="tu@correo.com"
                onChange={(event) => setTestEmail(event.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null || !testEmail.trim() || !subject.trim()}
              onClick={async () => {
                const json = await post('test', { subject, body, testEmail }, 'test')
                if (!json || json.success === false) return
                setNotice(`Prueba enviada a ${testEmail}.`)
              }}
            >
              {busy === 'test' ? 'Enviando…' : 'Enviar prueba'}
            </Button>
          </div>
          <div className="space-y-3 border-t pt-4">
            <Button
              type="button"
              className="bg-[#0B2447] hover:bg-[#0B2447]/90"
              disabled={busy !== null || count === 0 || !subject.trim() || !body.trim()}
              onClick={() => {
                setSendOpen(true)
                setSendTyped('')
              }}
            >
              Enviar broadcast
            </Button>
            {sendOpen && (
              <div className="space-y-3 rounded-xl border border-[#0B2447]/15 bg-[#f8fafc] p-4">
                <p className="text-sm leading-relaxed text-[#0B2447]">
                  Vas a enviar <span className="font-semibold">{subject}</span> a{' '}
                  <span className="font-semibold">{count}</span>{' '}
                  {count === 1 ? 'organizador' : 'organizadores'}. Escribe {count} para confirmar.
                </p>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={sendTyped}
                  aria-label="Confirmar broadcast"
                  onChange={(event) => setSendTyped(event.target.value)}
                />
                <Button
                  type="button"
                  disabled={busy !== null || sendTyped.trim() !== String(count)}
                  onClick={async () => {
                    const json = await post('send', { subject, body, segment, confirmCount: count }, 'send')
                    if (!json || json.success === false) return
                    setNotice('Broadcast enviado.')
                    setSendOpen(false)
                    setSendTyped('')
                  }}
                >
                  {busy === 'send' ? 'Enviando…' : 'Confirmar envío'}
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-sm font-medium text-[#0B2447]">Vista previa del correo</p>
          <PreviewFrame label="Móvil" width={375} html={email.html} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#0B2447]">Broadcasts en Resend</h2>
        {data.broadcastsNote && <p className="text-sm text-muted-foreground">{data.broadcastsNote}</p>}
        {data.broadcasts.length === 0 && !data.broadcastsNote && (
          <p className="text-sm text-muted-foreground">Todavía no hay broadcasts.</p>
        )}
        <ul className="space-y-3">
          {data.broadcasts.map((row) => (
            <li key={row.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-[#0B2447]">{row.subject || 'Sin asunto'}</p>
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-[#64748b]">
                  {BROADCAST_STATUS_LABELS[row.status] || row.status || 'Sin estado'}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#334155]">
                Enviados {metric(row.sent)} · Entregados {metric(row.delivered)} · Abiertos {metric(row.opened)} ·
                Clics {metric(row.clicked)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0B2447]">Día 1 y día 3</h2>
            <p className="text-sm text-muted-foreground">
              Apagado por defecto. El cron diario de las 14:00 UTC no envía nada mientras el interruptor esté apagado.
              El día 1 sale al día siguiente del registro, si ya hay rifa activa. El día 3 solo si sigue en 0 boletos.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={!data.storageReady || busy !== null}
            aria-label="Automatización día 1 y día 3"
            onCheckedChange={setEnabled}
          />
        </div>
        {!data.storageReady && (
          <p className="text-sm text-[#0B2447]">Falta aplicar la migración para guardar estos textos y el interruptor.</p>
        )}
        <p className="text-xs leading-relaxed text-[#6b7280]">
          {data.replyToConfigured
            ? 'Las respuestas van a EMAIL_REPLY_TO.'
            : 'EMAIL_REPLY_TO no está definido. Las respuestas llegan al remitente (hola@rifalo.do, salvo que EMAIL_FROM diga otra cosa).'}
        </p>
        <TemplateFields legend="Día 1" subject={day1Subject} body={day1Body} onSubject={setDay1Subject} onBody={setDay1Body} />
        <TemplateFields legend="Día 3" subject={day3Subject} body={day3Body} onSubject={setDay3Subject} onBody={setDay3Body} />
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null || !data.storageReady}
          onClick={async () => {
            const json = await post(
              'settings',
              { enabled, day1Subject, day1Body, day3Subject, day3Body },
              'settings',
            )
            if (!json || json.success === false) return
            setNotice(enabled ? 'Automatización guardada y encendida.' : 'Automatización guardada. Sigue apagada.')
          }}
        >
          {busy === 'settings' ? 'Guardando…' : 'Guardar automatización'}
        </Button>
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {notice && <p className="text-sm text-emerald-800">{notice}</p>}
    </div>
  )
}

function Count({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border bg-[#f8fafc] px-3 py-2">
      <dt className="text-xs text-[#64748b]">{label}</dt>
      <dd className="text-xl font-semibold text-[#0B2447]">{value == null ? '…' : value}</dd>
    </div>
  )
}

function SegmentOption({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean
  label: string
  count: number | null
  onChange: () => void
}) {
  return (
    <label className="flex items-start justify-between gap-3 text-sm">
      <span className="flex items-start gap-2">
        <input type="radio" name="activation-segment" className="mt-1" checked={checked} onChange={onChange} />
        <span>{label}</span>
      </span>
      <span className="shrink-0 font-semibold text-[#0B2447]">{count == null ? '…' : count}</span>
    </label>
  )
}

function TemplateFields({
  legend,
  subject,
  body,
  onSubject,
  onBody,
}: {
  legend: string
  subject: string
  body: string
  onSubject: (value: string) => void
  onBody: (value: string) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[#0B2447]">{legend}</legend>
      <Input aria-label={`Asunto ${legend}`} value={subject} maxLength={180} onChange={(event) => onSubject(event.target.value)} />
      <Textarea aria-label={`Mensaje ${legend}`} value={body} rows={8} maxLength={8000} onChange={(event) => onBody(event.target.value)} />
    </fieldset>
  )
}

function PreviewFrame({ label, width, html }: { label: string; width: number; html: string }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
        {label} · {width}px
      </figcaption>
      <div className="overflow-hidden rounded-xl border bg-[#eef2f6] p-3">
        <iframe
          title={`Vista previa ${label}`}
          sandbox=""
          srcDoc={html}
          style={{ width: '100%', maxWidth: width, height: 720 }}
          className="bg-white"
        />
      </div>
    </figure>
  )
}

function metric(value: number | null): string {
  return value == null ? '—' : String(value)
}
