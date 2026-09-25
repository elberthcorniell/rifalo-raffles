'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, Loader2, Pencil, Trash2, Star } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { Testimonial } from '@/types/testimonial'

const emptyForm = {
  name: '',
  quote: '',
  rating: 5,
  roleLabel: 'Ganador verificado',
  isActive: true,
  sortOrder: 0,
}

export default function TestimonialsAdminPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await fetch('/api/admin/testimonials')
    const json = await res.json()
    if (json.success) setItems(json.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      sortOrder: items.length > 0 ? Math.max(...items.map((i) => i.sortOrder ?? 0)) + 1 : 0,
    })
    setShowForm(true)
  }

  const openEdit = (t: Testimonial) => {
    setEditingId(t.id)
    setForm({
      name: t.name,
      quote: t.quote,
      rating: t.rating,
      roleLabel: t.roleLabel || 'Ganador verificado',
      isActive: t.isActive !== false,
      sortOrder: t.sortOrder ?? 0,
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingId
        ? `/api/admin/testimonials/${editingId}`
        : '/api/admin/testimonials'
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast({ title: editingId ? 'Testimonio actualizado' : 'Testimonio creado' })
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este testimonio?')) return
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Error', description: json.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Testimonio eliminado' })
    await load()
  }

  const toggleActive = async (t: Testimonial) => {
    const res = await fetch(`/api/admin/testimonials/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !t.isActive }),
    })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Error', description: json.error, variant: 'destructive' })
      return
    }
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Testimonios</h1>
          <p className="text-muted-foreground text-sm">
            Aparecen en el sitio público. Si no hay activos, la sección se oculta.
          </p>
        </div>
        <Button className="self-start" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo testimonio
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar testimonio' : 'Nuevo testimonio'}
            </DialogTitle>
            <DialogDescription>
              Historias de ganadores o clientes que se muestran en la home.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="María G."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote">Testimonio</Label>
              <Textarea
                id="quote"
                value={form.quote}
                onChange={(e) => setForm({ ...form, quote: e.target.value })}
                rows={4}
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rating">Estrellas (1–5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min={1}
                  max={5}
                  value={form.rating}
                  onChange={(e) =>
                    setForm({ ...form, rating: Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 5)) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Orden</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleLabel">Etiqueta</Label>
              <Input
                id="roleLabel"
                value={form.roleLabel}
                onChange={(e) => setForm({ ...form, roleLabel: e.target.value })}
                placeholder="Ganador verificado"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label>Visible en el sitio</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-muted-foreground">
          Aún no hay testimonios. Mientras esté vacío, la sección no se muestra en el sitio.
        </div>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {items.map((t) => (
            <article key={t.id} className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B2447] text-xs font-bold text-white">
                    {t.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.roleLabel}</p>
                  </div>
                </div>
                <Switch checked={t.isActive !== false} onCheckedChange={() => toggleActive(t)} />
              </div>
              <p className="text-sm text-muted-foreground">{t.quote}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-sm">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {t.rating}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(t.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden rounded-lg border bg-white overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Testimonio</TableHead>
                <TableHead>Estrellas</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2447] text-xs font-bold text-white">
                        {t.initials}
                      </span>
                      <div>
                        <p>{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.roleLabel}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-md">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{t.quote}</p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {t.rating}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch checked={t.isActive !== false} onCheckedChange={() => toggleActive(t)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}
    </div>
  )
}
