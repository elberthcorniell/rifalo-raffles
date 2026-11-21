'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LegalMarkdown } from '@/components/legal/LegalMarkdown'
import {
  defaultLegalMarkdown,
  LEGAL_DOCUMENT_LIST,
  LEGAL_MARKDOWN_MAX,
  normalizeStoredLegalMarkdown,
  type LegalDocKey,
  type LegalTemplateContext,
} from '@/lib/legal-docs'

const EMPTY_DOCS: Record<LegalDocKey, string> = {
  terms: '',
  privacy: '',
  rules: '',
  support: '',
}

export default function AdminLegalPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [docs, setDocs] = useState(EMPTY_DOCS)
  const [context, setContext] = useState<LegalTemplateContext>({
    organizerName: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/legal')
        const json = await res.json()
        if (cancelled) return
        if (!json.success) {
          setError(json.error || 'No se pudieron cargar los documentos')
          return
        }
        const data = json.data
        setContext({
          organizerName: data.organizerName || '',
          email: data.email || '',
          phone: data.phone || '',
        })
        setDocs({
          terms: data.documents?.terms || '',
          privacy: data.documents?.privacy || '',
          rules: data.documents?.rules || '',
          support: data.documents?.support || '',
        })
      } catch {
        if (!cancelled) setError('No se pudieron cargar los documentos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateDoc = (key: LegalDocKey, value: string) => {
    setDocs((current) => ({ ...current, [key]: value }))
    setSuccess(null)
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    try {
      for (const doc of LEGAL_DOCUMENT_LIST) {
        normalizeStoredLegalMarkdown(docs[doc.key])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Texto inválido')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/legal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: docs }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudieron guardar los documentos')
        return
      }
      const saved = json.data?.documents || {}
      setDocs({
        terms: saved.terms || '',
        privacy: saved.privacy || '',
        rules: saved.rules || '',
        support: saved.support || '',
      })
      const usingDefaults = LEGAL_DOCUMENT_LIST.every((doc) => !String(saved[doc.key] || '').trim())
      setSuccess(
        usingDefaults
          ? 'Documentos guardados. El sitio usa las plantillas predeterminadas.'
          : 'Documentos guardados. El sitio ya muestra esta versión.'
      )
    } catch {
      setError('No se pudieron guardar los documentos')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Legal</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Textos públicos del sitio. Si un documento queda vacío, se muestra una plantilla en
            español con el nombre de tu organización. El HTML no se interpreta.
          </p>
        </div>
        <Button className="self-start" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
      )}

      <Tabs defaultValue="terms">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-white p-1">
          {LEGAL_DOCUMENT_LIST.map((doc) => (
            <TabsTrigger key={doc.key} value={doc.key} className="px-3">
              {doc.short}
            </TabsTrigger>
          ))}
        </TabsList>

        {LEGAL_DOCUMENT_LIST.map((doc) => {
          const custom = docs[doc.key].trim()
          const preview = custom ? docs[doc.key] : defaultLegalMarkdown(doc.key, context)
          return (
            <TabsContent key={doc.key} value={doc.key} className="mt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {custom
                    ? 'Este texto reemplaza la plantilla.'
                    : 'Vacío: el sitio muestra la plantilla predeterminada.'}
                </p>
                <Link
                  href={doc.path}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#0B2447] hover:underline"
                >
                  Ver página
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-2 p-4">
                  <Label htmlFor={`legal-${doc.key}`}>{doc.title}</Label>
                  <Textarea
                    id={`legal-${doc.key}`}
                    value={docs[doc.key]}
                    onChange={(event) => updateDoc(doc.key, event.target.value)}
                    rows={16}
                    maxLength={LEGAL_MARKDOWN_MAX}
                    placeholder={'## Sección\n\nEscribe en Markdown, o déjalo vacío para usar la plantilla.'}
                    className="min-h-[320px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Títulos, listas, **negritas** y enlaces. {docs[doc.key].length.toLocaleString('es-DO')} /{' '}
                    {LEGAL_MARKDOWN_MAX.toLocaleString('es-DO')}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="mb-3 text-sm font-medium text-[#0B2447]">
                    Vista previa
                    {!custom && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        · plantilla predeterminada
                      </span>
                    )}
                  </p>
                  <div className="max-h-[480px] overflow-auto pr-1">
                    <LegalMarkdown markdown={preview} />
                  </div>
                </Card>
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
