'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 25

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activa',
  ended: 'Finalizada',
  cancelled: 'Cancelada',
}

interface SuperadminRaffle {
  id: string
  title: string
  status: string
  featured: boolean
  ticketPrice: number
  totalTickets: number
  soldTickets: number
  createdAt: string
  org: { id: string; name: string; slug: string; url: string } | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function TicketsCell({ sold, total }: { sold: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0

  return (
    <div className="min-w-[9.5rem]">
      <p className="text-sm font-medium text-[#0B2447]">
        {sold.toLocaleString('es-DO')} / {total.toLocaleString('es-DO')}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-[#1976D2]" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
      </div>
    </div>
  )
}

export default function SuperadminRafflesPage() {
  const [raffles, setRaffles] = useState<SuperadminRaffle[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (debouncedQuery) params.set('q', debouncedQuery)
    const res = await fetch(`/api/platform/superadmin/raffles?${params}`)
    const json = await res.json()
    if (json.success) {
      setRaffles(json.data)
      setTotal(json.total ?? json.data.length)
    }
    setLoading(false)
  }, [page, debouncedQuery])

  useEffect(() => {
    load()
  }, [load])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Rifas</h1>
          <p className="text-muted-foreground">
            {loading ? 'Cargando...' : `${total} rifa${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <Input
          placeholder="Buscar por título u organización"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs bg-white"
        />
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rifa</TableHead>
              <TableHead>Organización</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Boletos</TableHead>
              <TableHead>Creada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && raffles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay rifas.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              raffles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.title}
                    {r.featured && (
                      <Badge className="ml-2" variant="secondary">
                        Destacada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.org ? (
                      <a
                        href={r.org.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        <div>{r.org.name}</div>
                        <div className="text-xs text-muted-foreground">{r.org.slug}</div>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Sin organización</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'active' ? 'default' : 'outline'}>
                      {statusLabel[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>RD$ {r.ticketPrice.toLocaleString('es-DO')}</TableCell>
                  <TableCell>
                    <TicketsCell sold={r.soldTickets} total={r.totalTickets} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(r.createdAt)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Página {page} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount || loading}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
