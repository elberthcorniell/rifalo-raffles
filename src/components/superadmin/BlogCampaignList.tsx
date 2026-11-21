'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { blogCampaignAudienceLabel } from '@/lib/blog-audience'
import { Button } from '@/components/ui/button'

type Campaign = {
  id: string
  post_slug: string
  subject: string
  audience: string
  kind: string
  recipient_count: number
  sent_count: number
  failed_count: number
  created_by_email: string | null
  created_at: string
}

export function BlogCampaignList() {
  const [rows, setRows] = useState<Campaign[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/platform/superadmin/blog/campaigns')
      .then((response) => response.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error || 'No se pudo cargar el historial')
          return
        }
        setRows(json.data)
      })
      .catch(() => setError('No se pudo cargar el historial'))
  }, [])

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Historial de envíos</h1>
          <p className="text-muted-foreground">Los últimos correos del blog.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin/blog">Volver a enviar</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay envíos.</p>}

      <ul className="space-y-3">
        {(rows || []).map((row) => (
          <li key={row.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#0B2447]">{row.subject}</p>
                <p className="text-sm text-muted-foreground">{row.post_slug}</p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground" dateTime={row.created_at}>
                {new Date(row.created_at).toLocaleString('es-DO', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </div>
            <p className="mt-2 text-sm text-[#334155]">
              {blogCampaignAudienceLabel(row.audience)} · {row.kind === 'test' ? 'Prueba' : 'Todos'} ·{' '}
              {row.sent_count} enviados · {row.failed_count} fallidos · {row.recipient_count} destinatarios
            </p>
            {row.created_by_email && (
              <p className="mt-1 text-xs text-muted-foreground">{row.created_by_email}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
