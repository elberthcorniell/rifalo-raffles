'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { cn } from '@/lib/utils'
import { Check, Loader2, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PurchaseRow {
  id: string
  status: string
  quantity: number
  totalAmount: number
  submittedAt: string
  customer: { name: string | null; whatsapp: string | null; email?: string | null } | null
  raffle: { title: string } | null
  ticketNumbers: string[]
}

interface PurchaseDetail {
  id: string
  status: string
  quantity: number
  totalAmount: number
  voucherUrl: string | null
  submittedAt: string
  notes: string | null
  customer: { name: string | null; whatsapp: string | null; email?: string | null } | null
  raffle: { id: string; title: string } | null
  bankAccount: {
    bank: string
    account_number: string
    holder_name?: string
  } | null
  ticketNumbers: string[]
}

const tabs = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'rejected', label: 'Rechazadas' },
]

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

function PurchasesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const status = searchParams.get('status') || ''
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(true)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null)
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    const q = status ? `?status=${status}` : ''
    const res = await fetch(`/api/admin/purchases${q}`)
    const json = await res.json()
    if (json.success) setPurchases(json.data)
    setLoading(false)
  }, [status])

  useEffect(() => {
    loadList()
  }, [loadList])

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setPurchase(null)
    try {
      const res = await fetch(`/api/admin/purchases/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setPurchase(json.data)
      setNotes(json.data.notes || '')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const act = async (action: 'confirm' | 'reject') => {
    if (!purchase) return
    setActing(true)
    try {
      const res = await fetch(`/api/admin/purchases/${purchase.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes || undefined }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast({
        title: action === 'confirm' ? 'Compra confirmada' : 'Compra rechazada',
      })
      setDetailOpen(false)
      await loadList()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447]">Compras</h1>
        <p className="text-muted-foreground">Confirma o rechaza comprobantes de pago</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.value || 'all'}
            variant={status === t.value ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              router.push(t.value ? `/admin/purchases?status=${t.value}` : '/admin/purchases')
            }
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Rifa</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead></TableHead>
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
            {!loading && purchases.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay compras
                </TableCell>
              </TableRow>
            )}
            {purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.customer?.name || 'Cliente'}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.customer?.whatsapp || p.customer?.email || '—'}
                  </div>
                </TableCell>
                <TableCell>{p.raffle?.title}</TableCell>
                <TableCell>
                  RD$ {p.totalAmount.toLocaleString('es-DO')}
                  <div className="text-xs text-muted-foreground">{p.quantity} boletos</div>
                </TableCell>
                <TableCell>
                  <Badge className={cn('border-0', statusBadge[p.status])}>{p.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(p.submittedAt).toLocaleString('es-DO')}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openDetail(p.id)}>
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {purchase ? `Orden #${purchase.id.slice(0, 8)}` : 'Detalle de compra'}
            </DialogTitle>
            <DialogDescription>
              {purchase?.raffle?.title || 'Revisa el comprobante y confirma o rechaza.'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !purchase ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={cn('border-0', statusBadge[purchase.status])}>
                  {purchase.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(purchase.submittedAt).toLocaleString('es-DO')}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1 rounded-md bg-slate-50 p-3">
                  <p className="font-semibold">Cliente</p>
                  <p>{purchase.customer?.name || 'Cliente'}</p>
                  {purchase.customer?.whatsapp && (
                    <p className="text-muted-foreground">{purchase.customer.whatsapp}</p>
                  )}
                  {purchase.customer?.email && (
                    <p className="text-muted-foreground">{purchase.customer.email}</p>
                  )}
                </div>
                <div className="space-y-1 rounded-md bg-slate-50 p-3">
                  <p className="font-semibold">Compra</p>
                  <p className="text-lg font-bold">
                    RD$ {purchase.totalAmount.toLocaleString('es-DO')}
                  </p>
                  <p>{purchase.quantity} boletos</p>
                </div>
              </div>

              <div className="space-y-1 rounded-md bg-slate-50 p-3 text-sm">
                <p className="font-semibold">Cuenta de destino</p>
                <p>{purchase.bankAccount?.bank}</p>
                <p className="font-mono">{purchase.bankAccount?.account_number}</p>
                {purchase.bankAccount?.holder_name && (
                  <p className="text-muted-foreground">{purchase.bankAccount.holder_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-sm">Números asignados</p>
                <div className="flex flex-wrap gap-2">
                  {purchase.ticketNumbers.map((n) => (
                    <span
                      key={n}
                      className="inline-flex px-3 py-1 rounded-full text-sm font-bold bg-secondary/15 text-secondary border border-secondary/30"
                    >
                      #{n}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-sm">Comprobante</p>
                {purchase.voucherUrl ? (
                  purchase.voucherUrl.toLowerCase().includes('.pdf') ? (
                    <a
                      href={purchase.voucherUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline text-sm"
                    >
                      Abrir PDF
                    </a>
                  ) : (
                    <a href={purchase.voucherUrl} target="_blank" rel="noreferrer">
                      <img
                        src={purchase.voucherUrl}
                        alt="Comprobante"
                        className="max-h-64 w-full rounded-md border object-contain"
                      />
                    </a>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">Sin comprobante</p>
                )}
              </div>

              {purchase.status === 'pending' && (
                <>
                  <div className="space-y-2">
                    <Label>Notas (opcional)</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="destructive"
                      onClick={() => act('reject')}
                      disabled={acting}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Rechazar
                    </Button>
                    <Button
                      onClick={() => act('confirm')}
                      disabled={acting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {acting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Confirmar
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminPurchasesPage() {
  return (
    <Suspense>
      <PurchasesContent />
    </Suspense>
  )
}
