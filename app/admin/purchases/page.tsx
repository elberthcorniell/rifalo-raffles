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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Check, Loader2, Undo2, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { BankAccount } from '@/types/raffle'

interface PurchaseRow {
  id: string
  status: string
  kind?: 'paid' | 'referral_reward'
  quantity: number
  totalAmount: number
  submittedAt: string
  customer: { name: string | null; whatsapp: string | null; email?: string | null } | null
  raffle: { title: string } | null
  bankAccount: {
    id?: string
    bank: string
    account_number: string
    holder_name?: string
  } | null
  ticketNumbers: string[]
  referrerPhone?: string | null
}

interface PurchaseDetail {
  id: string
  status: string
  kind?: 'paid' | 'referral_reward'
  quantity: number
  totalAmount: number
  voucherUrl: string | null
  submittedAt: string
  notes: string | null
  customer: { name: string | null; whatsapp: string | null; email?: string | null } | null
  raffle: { id: string; title: string; referralRewardTickets?: number } | null
  bankAccount: {
    bank: string
    account_number: string
    holder_name?: string
  } | null
  ticketNumbers: string[]
  referrerPhone?: string | null
  canRestoreTickets?: boolean
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

function accountOptionLabel(account: Pick<BankAccount, 'bank' | 'name' | 'accountNumber'>) {
  const bank = account.bank || account.name || 'Cuenta'
  return account.accountNumber ? `${bank} · ${account.accountNumber}` : bank
}

function purchaseAccountLabel(
  account: { bank?: string | null; account_number?: string | null } | null,
) {
  if (!account?.bank && !account?.account_number) return null
  return [account.bank, account.account_number].filter(Boolean).join(' · ')
}

function PurchasesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const status = searchParams.get('status') || ''
  const account = searchParams.get('account') || ''
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null)
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState(false)

  const setFilters = (next: { status?: string; account?: string }) => {
    const params = new URLSearchParams()
    const nextStatus = next.status !== undefined ? next.status : status
    const nextAccount = next.account !== undefined ? next.account : account
    if (nextStatus) params.set('status', nextStatus)
    if (nextAccount) params.set('account', nextAccount)
    const q = params.toString()
    router.push(q ? `/admin/purchases?${q}` : '/admin/purchases')
  }

  const loadList = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (account) params.set('account', account)
    const q = params.toString()
    const res = await fetch(`/api/admin/purchases${q ? `?${q}` : ''}`)
    const json = await res.json()
    if (json.success) {
      setPurchases(json.data)
    } else {
      setPurchases([])
      toast({
        title: 'Error',
        description: json.error || 'No se pudieron cargar las compras',
        variant: 'destructive',
      })
    }
    setLoading(false)
  }, [status, account, toast])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/bank-accounts')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) setAccounts(json.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setPurchase(null)
    setConfirmRevert(false)
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

  const act = async (action: 'confirm' | 'reject' | 'revert') => {
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
        title:
          action === 'confirm'
            ? 'Compra confirmada'
            : action === 'reject'
              ? 'Compra rechazada'
              : 'Compra devuelta a pendiente',
      })
      setConfirmRevert(false)
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
        <p className="text-muted-foreground">
          Confirma o rechaza comprobantes. Si te equivocas, abre la compra y devuélvela a
          pendiente.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.value || 'all'}
              variant={status === t.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilters({ status: t.value })}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <Select
          value={account || 'all'}
          onValueChange={(value) => setFilters({ account: value === 'all' ? '' : value })}
        >
          <SelectTrigger className="h-9 w-full sm:w-[280px]" aria-label="Cuenta">
            <SelectValue placeholder="Todas las cuentas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {account && !accounts.some((item) => item.id === account) && (
              <SelectItem value={account}>Cuenta seleccionada</SelectItem>
            )}
            {accounts.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {accountOptionLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 md:hidden">
        {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!loading && purchases.length === 0 && (
          <p className="rounded-lg border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            No hay compras
          </p>
        )}
        {purchases.map((p) => (
          <article key={p.id} className="rounded-lg border bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{p.customer?.name || 'Cliente'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.customer?.whatsapp || p.customer?.email || '—'}
                </p>
                <p className="text-sm mt-1">{p.raffle?.title}</p>
                {purchaseAccountLabel(p.bankAccount) && (
                  <p className="text-xs text-muted-foreground">{purchaseAccountLabel(p.bankAccount)}</p>
                )}
              </div>
              <Badge className={cn('border-0 shrink-0', statusBadge[p.status])}>{p.status}</Badge>
            </div>
            <div className="flex items-end justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">RD$ {p.totalAmount.toLocaleString('es-DO')}</p>
                <p className="text-xs text-muted-foreground">{p.quantity} boletos</p>
                {p.kind === 'referral_reward' && (
                  <p className="text-xs font-medium text-emerald-700">Boletos por referido</p>
                )}
                {p.referrerPhone && (
                  <p className="text-xs text-muted-foreground">Referido por {p.referrerPhone}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(p.submittedAt).toLocaleString('es-DO')}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openDetail(p.id)}>
                Ver
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden rounded-lg border bg-white overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Rifa</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && purchases.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                <TableCell className="text-sm">
                  {purchaseAccountLabel(p.bankAccount) || '—'}
                </TableCell>
                <TableCell>
                  RD$ {p.totalAmount.toLocaleString('es-DO')}
                  <div className="text-xs text-muted-foreground">{p.quantity} boletos</div>
                  {p.kind === 'referral_reward' && (
                    <div className="text-xs font-medium text-emerald-700">Boletos por referido</div>
                  )}
                  {p.referrerPhone && (
                    <div className="text-xs text-muted-foreground">Referido por {p.referrerPhone}</div>
                  )}
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

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setConfirmRevert(false)
        }}
      >
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
                {purchase.kind === 'referral_reward' && (
                  <Badge variant="outline">Boletos por referido</Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {new Date(purchase.submittedAt).toLocaleString('es-DO')}
                </span>
              </div>

              {purchase.referrerPhone && purchase.status === 'pending' && (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Esta compra llegó por un referido ({purchase.referrerPhone}). Al confirmar, esa
                  persona recibe {purchase.raffle?.referralRewardTickets || 1} boletos.
                </p>
              )}
              {purchase.kind === 'referral_reward' && (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Estos boletos se otorgaron gratis porque alguien compró con el enlace de este
                  cliente.
                </p>
              )}

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
                  <p className="text-sm text-muted-foreground">
                    {purchase.kind === 'referral_reward'
                      ? 'Boletos de referido, sin comprobante'
                      : 'Sin comprobante'}
                  </p>
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

              {purchase.status !== 'pending' && purchase.kind === 'referral_reward' && (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                  Estos boletos se anulan si reviertes la compra que los generó.
                </p>
              )}

              {purchase.status !== 'pending' && purchase.kind !== 'referral_reward' && (
                <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-950">
                    {purchase.status === 'confirmed'
                      ? 'Si la confirmaste por error, devuélvela a pendiente. Los boletos vuelven a quedar reservados. Si esta compra entregó boletos por referido, esos boletos se liberan.'
                      : purchase.canRestoreTickets
                        ? 'Si la rechazaste por error, devuélvela a pendiente. Se reservan otra vez los mismos boletos, siempre que sigan libres.'
                        : 'Si la rechazaste por error, devuélvela a pendiente. Los números originales ya no están guardados, así que se reservan boletos libres nuevos.'}
                  </p>
                  {confirmRevert ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={acting}
                        onClick={() => setConfirmRevert(false)}
                      >
                        Cancelar
                      </Button>
                      <Button size="sm" disabled={acting} onClick={() => act('revert')}>
                        {acting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Undo2 className="h-4 w-4 mr-2" />
                        )}
                        Sí, revertir
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={acting}
                      onClick={() => setConfirmRevert(true)}
                    >
                      <Undo2 className="h-4 w-4 mr-2" />
                      Revertir a pendiente
                    </Button>
                  )}
                </div>
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
