'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BLOG_AUDIENCE_IDS,
  BLOG_AUDIENCE_LABELS,
  BLOG_EMAIL_EXCLUDED_ORG_SLUGS,
  type BlogAudienceId,
} from '@/lib/blog-audience'

type PostOption = {
  slug: string
  h1: string
  published: boolean
  subjects: string[]
  previewText: string
}

type AudienceCounts = Record<BlogAudienceId, { willSend: number; alreadySent: number }>

type Payload = {
  posts: PostOption[]
  excludedOrgSlugs?: string[]
  selected: {
    slug: string
    h1: string
    published: boolean
    subject: string
    subjects: string[]
    previewText: string
    html: string
  } | null
  audiences: AudienceCounts | null
  audienceError: string | null
}

export function BlogSendForm() {
  const [slug, setSlug] = useState('')
  const [subject, setSubject] = useState('')
  const [audience, setAudience] = useState<BlogAudienceId>('all')
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [sending, setSending] = useState<'test' | 'bulk' | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (slug) params.set('slug', slug)
      if (subject) params.set('subject', subject)
      setLoading(true)
      fetch(`/api/platform/superadmin/blog?${params.toString()}`)
        .then((response) => response.json())
        .then((json) => {
          if (!json.success) {
            setError(json.error || 'No se pudo cargar')
            return
          }
          const payload = json.data as Payload
          setData(payload)
          if (!slug && payload.selected) {
            setSlug(payload.selected.slug)
            setSubject(payload.selected.subject)
          }
        })
        .catch(() => setError('No se pudo cargar'))
        .finally(() => setLoading(false))
    }, slug ? 250 : 0)

    return () => window.clearTimeout(handle)
  }, [slug, subject])

  const selected = data?.selected
  const count = data?.audiences?.[audience]?.willSend ?? 0
  const alreadySent = data?.audiences?.[audience]?.alreadySent ?? 0
  const excluded = data?.excludedOrgSlugs || BLOG_EMAIL_EXCLUDED_ORG_SLUGS

  function choosePost(next: string) {
    const post = data?.posts.find((item) => item.slug === next)
    setSlug(next)
    setSubject(post?.subjects[0] || '')
    setConfirmOpen(false)
    setTyped('')
    setNotice('')
  }

  async function send(mode: 'test' | 'bulk') {
    setSending(mode)
    setNotice('')
    setError('')
    try {
      const response = await fetch('/api/platform/superadmin/blog/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          subject,
          audience,
          mode,
          testEmail,
          confirmCount: count,
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        setError(json.error || 'No se pudo enviar')
        if (response.status === 409) {
          setTyped('')
          setConfirmOpen(true)
        }
        return
      }
      setNotice(
        mode === 'test'
          ? `Prueba enviada a ${testEmail}.`
          : `Enviado a ${json.sent} organizadores${json.failed ? `. ${json.failed} fallaron.` : '.'}`,
      )
      setConfirmOpen(false)
      setTyped('')
    } catch {
      setError('No se pudo enviar')
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Enviar post por email</h1>
          <p className="text-muted-foreground">
            Escribe a los organizadores con correo verificado. La prueba va a una sola dirección.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/blog/envios">Historial</Link>
        </Button>
      </div>

      {data && data.posts.length === 0 && <p>No hay posts en el repositorio.</p>}

      {data && data.posts.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-5">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[#0B2447]">Post</span>
              <select
                className="flex h-10 w-full rounded-md border bg-white px-3 text-sm"
                value={slug}
                onChange={(event) => choosePost(event.target.value)}
              >
                {data.posts.map((post) => (
                  <option key={post.slug} value={post.slug}>
                    {post.published ? '' : '[Borrador] '}
                    {post.h1}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[#0B2447]">Asunto</legend>
              {(selected?.subjects || []).map((option) => (
                <label key={option} className="flex items-start gap-2 text-sm leading-snug">
                  <input
                    type="radio"
                    name="subject-option"
                    className="mt-1"
                    checked={subject === option}
                    onChange={() => setSubject(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
              <Input
                value={subject}
                maxLength={180}
                onChange={(event) => setSubject(event.target.value)}
                aria-label="Editar asunto"
              />
            </fieldset>

            {selected && (
              <p className="text-sm text-[#4b5563]">
                <span className="font-medium text-[#0B2447]">Vista previa: </span>
                {selected.previewText}
              </p>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[#0B2447]">Audiencia</legend>
              {BLOG_AUDIENCE_IDS.map((id) => {
                const row = data.audiences?.[id]
                return (
                  <label key={id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="audience"
                        className="mt-1"
                        checked={audience === id}
                        onChange={() => {
                          setAudience(id)
                          setConfirmOpen(false)
                          setTyped('')
                        }}
                      />
                      <span>{BLOG_AUDIENCE_LABELS[id]}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-[#0B2447]">
                      {row ? row.willSend : loading ? '…' : '—'}
                    </span>
                  </label>
                )
              })}
              {alreadySent > 0 && (
                <p className="text-xs text-[#6b7280]">
                  {alreadySent} ya {alreadySent === 1 ? 'recibió' : 'recibieron'} este post y no entran otra vez.
                </p>
              )}
              <p className="text-xs leading-relaxed text-[#6b7280]">
                Se excluyen las organizaciones {excluded.join(', ')}, quien no verificó el correo y quien se dio de baja.
              </p>
              {data.audienceError && (
                <p className="text-xs leading-relaxed text-red-700">
                  No se pudo contar la audiencia: {data.audienceError}
                </p>
              )}
            </fieldset>

            {selected && !selected.published && (
              <p className="rounded-lg bg-[#f4f1e8] px-3 py-2 text-sm text-[#0B2447]">
                Este post sigue en borrador. Puedes mandar una prueba. El envío a todos se habilita cuando{' '}
                <span className="font-medium">published</span> sea true.
              </p>
            )}

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
                disabled={sending !== null || !testEmail.trim() || !subject.trim()}
                onClick={() => send('test')}
              >
                {sending === 'test' ? 'Enviando…' : 'Enviar prueba'}
              </Button>
            </div>

            <div className="space-y-3 border-t pt-4">
              <Button
                type="button"
                className="bg-[#0B2447] hover:bg-[#0B2447]/90"
                disabled={sending !== null || !selected?.published || count === 0 || !subject.trim()}
                onClick={() => {
                  setConfirmOpen(true)
                  setTyped('')
                }}
              >
                Enviar a todos
              </Button>
              {confirmOpen && (
                <div className="space-y-3 rounded-xl border border-[#0B2447]/15 bg-[#f8fafc] p-4">
                  <p className="text-sm leading-relaxed text-[#0B2447]">
                    Vas a enviar <span className="font-semibold">{subject}</span> a{' '}
                    <span className="font-semibold">{count}</span>{' '}
                    {count === 1 ? 'organizador' : 'organizadores'} (
                    {BLOG_AUDIENCE_LABELS[audience]}). Escribe {count} para confirmar.
                  </p>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    value={typed}
                    aria-label="Confirmar cantidad"
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={sending !== null || typed.trim() !== String(count)}
                    onClick={() => send('bulk')}
                  >
                    {sending === 'bulk' ? 'Enviando…' : 'Confirmar envío'}
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}
            {notice && <p className="text-sm text-emerald-800">{notice}</p>}
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-[#0B2447]">Vista previa del correo</p>
            <div className="grid gap-4 xl:grid-cols-2">
              <PreviewFrame label="Móvil" width={375} html={selected?.html || ''} />
              <PreviewFrame label="Escritorio" width={600} html={selected?.html || ''} />
            </div>
          </div>
        </div>
      )}
    </div>
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
