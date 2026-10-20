'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, Loader2, ShieldCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getTenantUrl } from '@/lib/constants'
import type { RaffleVerificationStatus } from '@/types/raffle'

const PAGE_SIZE = 25

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activa',
  ended: 'Finalizada',
  cancelled: 'Cancelada',
}

const verificationLabel: Record<RaffleVerificationStatus, string> = {
  none: 'Sin solicitar',
  pending: 'Pendiente',
  verified: 'Verificada',
  rejected: 'Rechazada',
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
  verificationStatus: RaffleVerificationStatus
  verificationRequestedAt: string | null
  verificationReviewedAt: string | null
  verificationNote: string | null
  org: { id: string; name: string; slug: string; url: string } | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function rafflePageUrl(raffle: SuperadminRaffle) {
  if (!raffle.org) return null
  return getTenantUrl(raffle.org.slug, `/raffles/${raffle.id}`)
}

function RaffleTitle({ raffle }: { raffle: SuperadminRaffle }) {
  const href = rafflePageUrl(raffle)
  if (!href) return <>{raffle.title}</>
  return (
    <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
      {raffle.title}
    </a>
  )
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
  const { toast } = useToast()
  const [raffles, setRaffles] = useState<SuperadminRaffle[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [verificationFilter, setVerificationFilter] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<SuperadminRaffle | null>(null)
  const [rejectNote, setRejectNote] = useState('')

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
    if (verificationFilter && verificationFilter !== 'all') {
      params.set('verification', verificationFilter)
    }
    const res = await fetch(`/api/platform/superadmin/raffles?${params}`)
    const json = await res.json()
    if (json.success) {
      setRaffles(json.data)
      setTotal(json.total ?? json.data.length)
    }
    setLoading(false)
  }, [page, debouncedQuery, verificationFilter])

  useEffect(() => {
    load()
  }, [load])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const approve = async (raffle: SuperadminRaffle) => {
    setActingId(raffle.id)
    try {
      const res = await fetch(`/api/platform/superadmin/raffles/${raffle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast({ title: 'Rifa verificada', description: raffle.title })
      await load()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo aprobar',
        variant: 'destructive',
      })
    } finally {
      setActingId(null)
    }
  }

  const openReject = (raffle: SuperadminRaffle) => {
    setRejectTarget(raffle)
    setRejectNote('')
    setRejectOpen(true)
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    setActingId(rejectTarget.id)
    try {
      const res = await fetch(`/api/platform/superadmin/raffles/${rejectTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', note: rejectNote }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast({ title: 'Solicitud rechazada', description: rejectTarget.title })
      setRejectOpen(false)
      setRejectTarget(null)
      await load()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo rechazar',
        variant: 'destructive',
      })
    } finally {
      setActingId(null)
    }
  }

  const actionsFor = (r: SuperadminRaffle) => {
    if (r.verificationStatus !== 'pending') return null
    const busy = actingId === r.id
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => approve(r)}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
          Aprobar
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => openReject(r)}>
          Rechazar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
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
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <Label className="text-sm text-muted-foreground shrink-0">Verificación</Label>
          <Select
            value={verificationFilter}
            onValueChange={(v) => {
              setVerificationFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="sm:max-w-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="verified">Verificadas</SelectItem>
              <SelectItem value="rejected">Rechazadas</SelectItem>
              <SelectItem value="none">Sin solicitar</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!loading && raffles.length === 0 && (
          <p className="rounded-lg border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            No hay rifas.
          </p>
        )}
        {!loading &&
          raffles.map((r) => (
            <article key={r.id} className="rounded-lg border bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-tight">
                  <RaffleTitle raffle={r} />
                </p>
                <Badge variant={r.status === 'active' ? 'default' : 'outline'}>
                  {statusLabel[r.status] || r.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {r.org ? `${r.org.name} · ${r.org.slug}` : 'Sin organización'}
              </p>
              <Badge
                variant={r.verificationStatus === 'verified' ? 'default' : 'outline'}
                className="gap-1"
              >
                {r.verificationStatus === 'verified' && <ShieldCheck className="h-3 w-3" />}
                {verificationLabel[r.verificationStatus] || r.verificationStatus}
              </Badge>
              <p className="text-sm">RD$ {r.ticketPrice.toLocaleString('es-DO')}</p>
              <TicketsCell sold={r.soldTickets} total={r.totalTickets} />
              <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
              {actionsFor(r)}
            </article>
          ))}
      </div>

      <div className="hidden rounded-lg border bg-white overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rifa</TableHead>
              <TableHead>Organización</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Verificación</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Boletos</TableHead>
              <TableHead>Creada</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && raffles.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay rifas.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              raffles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <RaffleTitle raffle={r} />
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
                  <TableCell>
                    <Badge
                      variant={r.verificationStatus === 'verified' ? 'default' : 'outline'}
                      className="gap-1"
                    >
                      {r.verificationStatus === 'verified' && <ShieldCheck className="h-3 w-3" />}
                      {verificationLabel[r.verificationStatus] || r.verificationStatus}
                    </Badge>
                    {r.verificationNote && (
                      <p className="mt-1 text-xs text-muted-foreground max-w-[12rem]">
                        {r.verificationNote}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>RD$ {r.ticketPrice.toLocaleString('es-DO')}</TableCell>
                  <TableCell>
                    <TicketsCell sold={r.soldTickets} total={r.totalTickets} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(r.createdAt)}</TableCell>
                  <TableCell>{actionsFor(r)}</TableCell>
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

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar verificación</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `Motivo para «${rejectTarget.title}». El organizador lo verá en su panel.`
                : 'Escribe el motivo del rechazo.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Ej. No pudimos confirmar que el premio exista o se pueda entregar."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={actingId === rejectTarget?.id || rejectNote.trim().length < 3}
              onClick={submitReject}
            >
              {actingId === rejectTarget?.id && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
