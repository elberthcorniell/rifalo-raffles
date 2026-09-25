'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import type { Raffle } from '@/types/raffle'
import { Loader2, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activa',
  ended: 'Finalizada',
  cancelled: 'Cancelada',
}

interface Range {
  id: string
  start_number: number
  end_number: number
}

const emptyCreate = {
  title: '',
  description: '',
  ticketPrice: '100',
  minTickets: '1',
  endDate: '',
  featured: false,
  status: 'draft',
  rangeStart: '1',
  rangeEnd: '100',
}

function formatRd(amount: number) {
  return `RD$ ${amount.toLocaleString('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function ticketCountFromRange(start: string, end: string) {
  const from = parseInt(start, 10)
  const to = parseInt(end, 10)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0
  return to - from + 1
}

function IncomePreview({
  price,
  total,
  taken,
}: {
  price: number
  total: number
  taken?: number
}) {
  const expected = (Number.isFinite(price) ? price : 0) * Math.max(total, 0)
  const collected = taken != null ? (Number.isFinite(price) ? price : 0) * Math.max(taken, 0) : null

  return (
    <div className="rounded-md border bg-slate-50 px-3 py-2.5 space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Ingreso esperado</span>
        <span className="font-semibold text-[#0B2447]">{formatRd(expected)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {total.toLocaleString('es-DO')} boletos × {formatRd(Number.isFinite(price) ? price : 0)}
      </p>
      {collected != null && (
        <p className="text-xs text-muted-foreground">
          Recaudado: {formatRd(collected)} · Pendiente: {formatRd(expected - collected)}
        </p>
      )}
    </div>
  )
}

export default function AdminRafflesPage() {
  const { toast } = useToast()
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [imageFile, setImageFile] = useState<File | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTicketPrice, setEditTicketPrice] = useState('')
  const [editMinTickets, setEditMinTickets] = useState('1')
  const [editEndDate, setEditEndDate] = useState('')
  const [editFeatured, setEditFeatured] = useState(false)
  const [editStatus, setEditStatus] = useState('draft')
  const [editImage, setEditImage] = useState<string | null>(null)
  const [ranges, setRanges] = useState<Range[]>([])
  const [counts, setCounts] = useState({ total: 0, taken: 0, available: 0 })
  const [editTotal, setEditTotal] = useState('0')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [addingRange, setAddingRange] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/raffles')
    const json = await res.json()
    if (json.success) setRaffles(json.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setCreateForm(emptyCreate)
    setImageFile(null)
    setCreateOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      let imagePath: string | undefined
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        fd.append('bucket', 'raffle-images')
        const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        const uploadJson = await uploadRes.json()
        if (!uploadJson.success) throw new Error(uploadJson.error)
        imagePath = uploadJson.data.path
      }

      const res = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description,
          ticketPrice: parseFloat(createForm.ticketPrice),
          minTickets: parseInt(createForm.minTickets, 10) || 1,
          endDate: createForm.endDate || null,
          featured: createForm.featured,
          status: createForm.status,
          imagePath,
          rangeStart: parseInt(createForm.rangeStart, 10),
          rangeEnd: parseInt(createForm.rangeEnd, 10),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      toast({ title: 'Rifa creada', description: 'Los boletos fueron generados.' })
      setCreateOpen(false)
      await load()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo crear la rifa',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const openEdit = async (id: string) => {
    setEditingId(id)
    setEditOpen(true)
    setEditLoading(true)
    setNewStart('')
    setNewEnd('')
    try {
      const res = await fetch(`/api/admin/raffles/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const r = json.data.raffle as Raffle
      setEditTitle(r.title)
      setEditDescription(r.description)
      setEditTicketPrice(String(r.ticketPrice))
      setEditMinTickets(String(r.minTickets || 1))
      setEditFeatured(!!r.featured)
      setEditStatus(r.status || 'draft')
      setEditImage(r.image || null)
      setRanges(json.data.ranges || [])
      const nextCounts = json.data.counts || { total: 0, taken: 0, available: 0 }
      setCounts(nextCounts)
      setEditTotal(String(nextCounts.total))

      if (r.endDate) {
        const d = new Date(r.endDate)
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
        setEditEndDate(local)
      } else {
        setEditEndDate('')
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setEditOpen(false)
    } finally {
      setEditLoading(false)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    const nextTotal = parseInt(editTotal, 10)
    if (!Number.isFinite(nextTotal) || nextTotal < 1) {
      toast({
        title: 'Total inválido',
        description: 'El total de boletos debe ser al menos 1.',
        variant: 'destructive',
      })
      return
    }
    if (nextTotal < counts.taken) {
      toast({
        title: 'Total inválido',
        description: `Hay ${counts.taken.toLocaleString('es-DO')} boletos tomados.`,
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/raffles/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          ticketPrice: parseFloat(editTicketPrice),
          minTickets: parseInt(editMinTickets, 10) || 1,
          totalTickets: parseInt(editTotal, 10),
          endDate: editEndDate || null,
          featured: editFeatured,
          status: editStatus,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast({ title: 'Guardado' })
      setEditOpen(false)
      await load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddRange = async () => {
    if (!editingId) return
    setAddingRange(true)
    try {
      const res = await fetch(`/api/admin/raffles/${editingId}/ranges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: parseInt(newStart, 10),
          end: parseInt(newEnd, 10),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast({ title: 'Rango agregado' })
      setNewStart('')
      setNewEnd('')

      const detail = await fetch(`/api/admin/raffles/${editingId}`)
      const detailJson = await detail.json()
      if (detailJson.success) {
        setRanges(detailJson.data.ranges || [])
        const nextCounts = detailJson.data.counts || { total: 0, taken: 0, available: 0 }
        setCounts(nextCounts)
        setEditTotal(String(nextCounts.total))
      }
      await load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setAddingRange(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Rifas</h1>
          <p className="text-muted-foreground">Administra rifas y rangos de números</p>
        </div>
        <Button className="self-start" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva rifa
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!loading && raffles.length === 0 && (
          <p className="rounded-lg border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            No hay rifas. Crea la primera.
          </p>
        )}
        {raffles.map((r) => (
          <article key={r.id} className="rounded-lg border bg-white p-4 flex gap-3">
            <img
              src={r.image || '/placeholder.svg'}
              alt=""
              className="h-14 w-14 shrink-0 rounded-md object-cover bg-slate-100 border"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-tight">{r.title}</p>
                <Badge variant={r.status === 'active' ? 'default' : 'outline'}>
                  {statusLabel[r.status || ''] || r.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                RD$ {r.ticketPrice.toLocaleString('es-DO')} · {r.soldTickets} / {r.totalTickets} · {r.timeLeft}
              </p>
              {r.featured && <Badge variant="secondary">Destacada</Badge>}
              <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(r.id)}>
                Editar
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden rounded-lg border bg-white overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Imagen</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Boletos</TableHead>
              <TableHead>Tiempo</TableHead>
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
            {!loading && raffles.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay rifas. Crea la primera.
                </TableCell>
              </TableRow>
            )}
            {raffles.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <img
                    src={r.image || '/placeholder.svg'}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover bg-slate-100 border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      if (target.src !== '/placeholder.svg') {
                        target.src = '/placeholder.svg'
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {r.title}
                  {r.featured && (
                    <Badge className="ml-2" variant="secondary">
                      Destacada
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === 'active' ? 'default' : 'outline'}>
                    {statusLabel[r.status || ''] || r.status}
                  </Badge>
                </TableCell>
                <TableCell>RD$ {r.ticketPrice.toLocaleString('es-DO')}</TableCell>
                <TableCell>
                  {r.soldTickets} / {r.totalTickets}
                </TableCell>
                <TableCell>{r.timeLeft}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(r.id)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva rifa</DialogTitle>
            <DialogDescription>
              Crea una rifa y genera el rango inicial de boletos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio (RD$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.ticketPrice}
                  onChange={(e) => setCreateForm({ ...createForm, ticketPrice: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Mínimo de boletos</Label>
                <Input
                  type="number"
                  min="1"
                  value={createForm.minTickets}
                  onChange={(e) => setCreateForm({ ...createForm, minTickets: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fecha de cierre</Label>
              <Input
                type="datetime-local"
                value={createForm.endDate}
                onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={createForm.status}
                  onValueChange={(v) => setCreateForm({ ...createForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="active">Activa</SelectItem>
                    <SelectItem value="ended">Finalizada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-8">
                <Switch
                  checked={createForm.featured}
                  onCheckedChange={(v) => setCreateForm({ ...createForm, featured: v })}
                />
                <Label>Destacada</Label>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número inicial</Label>
                <Input
                  type="number"
                  min="0"
                  value={createForm.rangeStart}
                  onChange={(e) => setCreateForm({ ...createForm, rangeStart: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Número final</Label>
                <Input
                  type="number"
                  min="0"
                  value={createForm.rangeEnd}
                  onChange={(e) => setCreateForm({ ...createForm, rangeEnd: e.target.value })}
                  required
                />
              </div>
            </div>
            <IncomePreview
              price={parseFloat(createForm.ticketPrice)}
              total={ticketCountFromRange(createForm.rangeStart, createForm.rangeEnd)}
            />
            <div className="space-y-2">
              <Label>Imagen</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Crear rifa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar rifa</DialogTitle>
            <DialogDescription>
              Disponibles: {Math.max(0, (parseInt(editTotal, 10) || 0) - counts.taken)} · Tomados:{' '}
              {counts.taken} · Total: {parseInt(editTotal, 10) || 0}
            </DialogDescription>
          </DialogHeader>

          {editLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Precio (RD$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editTicketPrice}
                    onChange={(e) => setEditTicketPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mínimo de boletos</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editMinTickets}
                    onChange={(e) => setEditMinTickets(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Total de boletos</Label>
                <Input
                  type="number"
                  min={Math.max(1, counts.taken)}
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {counts.taken > 0
                    ? `No puede ser menor que los ${counts.taken.toLocaleString('es-DO')} boletos tomados.`
                    : 'Al guardar se generan o eliminan boletos disponibles para llegar a este total.'}
                </p>
              </div>
              <IncomePreview
                price={parseFloat(editTicketPrice)}
                total={parseInt(editTotal, 10) || 0}
                taken={counts.taken}
              />
              <div className="space-y-2">
                <Label>Fecha de cierre</Label>
                <Input
                  type="datetime-local"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="active">Activa</SelectItem>
                      <SelectItem value="ended">Finalizada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-8">
                  <Switch checked={editFeatured} onCheckedChange={setEditFeatured} />
                  <Label>Destacada</Label>
                </div>
              </div>
              {editImage && (
                <img src={editImage} alt="" className="h-28 rounded-md object-cover" />
              )}

              <div className="border-t pt-4 space-y-3">
                <h3 className="font-semibold text-sm">Rangos de números</h3>
                {ranges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin rangos</p>
                ) : (
                  <ul className="space-y-1">
                    {ranges.map((r) => (
                      <li key={r.id} className="text-sm bg-slate-50 rounded px-3 py-2">
                        {r.start_number} – {r.end_number} (
                        {r.end_number - r.start_number + 1} boletos)
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input
                      type="number"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input
                      type="number"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddRange}
                    disabled={addingRange || !newStart || !newEnd}
                  >
                    {addingRange ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agregar'}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
