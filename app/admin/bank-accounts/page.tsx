'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { BankAccount } from '@/types/raffle'

const emptyForm = {
  name: '',
  bank: '',
  accountNumber: '',
  accountType: '',
  currency: 'DOP',
  holderName: '',
  cedula: '',
  isActive: true,
  sortOrder: 0,
}

export default function BankAccountsPage() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<(BankAccount & { isActive?: boolean; sortOrder?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await fetch('/api/admin/bank-accounts')
    const json = await res.json()
    if (json.success) setAccounts(json.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (a: BankAccount & { isActive?: boolean; sortOrder?: number }) => {
    setEditingId(a.id)
    setForm({
      name: a.name || '',
      bank: a.bank || '',
      accountNumber: a.accountNumber || '',
      accountType: a.accountType || '',
      currency: a.currency || 'DOP',
      holderName: a.holderName || '',
      cedula: a.cedula || '',
      isActive: a.isActive !== false,
      sortOrder: a.sortOrder ?? 0,
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingId
        ? `/api/admin/bank-accounts/${editingId}`
        : '/api/admin/bank-accounts'
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast({ title: editingId ? 'Cuenta actualizada' : 'Cuenta creada' })
      setShowForm(false)
      await load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta?')) return
    const res = await fetch(`/api/admin/bank-accounts/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Error', description: json.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Cuenta eliminada' })
    await load()
  }

  const toggleActive = async (a: BankAccount & { isActive?: boolean }) => {
    const res = await fetch(`/api/admin/bank-accounts/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !a.isActive }),
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Cuentas bancarias</h1>
          <p className="text-muted-foreground">Cuentas mostradas en el checkout</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva cuenta
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar cuenta' : 'Nueva cuenta'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Actualiza los datos de la cuenta bancaria.'
                : 'Agrega una cuenta que los clientes verán al pagar.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input
                  value={form.bank}
                  onChange={(e) => setForm({ ...form, bank: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Número de cuenta</Label>
              <Input
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input
                  value={form.accountType}
                  onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Titular</Label>
                <Input
                  value={form.holderName}
                  onChange={(e) => setForm({ ...form, holderName: e.target.value })}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div className="flex items-center gap-3 pt-8">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label>Activa</Label>
              </div>
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

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banco</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Titular</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.bank}</div>
                  <div className="text-xs text-muted-foreground">{a.accountType}</div>
                </TableCell>
                <TableCell className="font-mono text-sm">{a.accountNumber}</TableCell>
                <TableCell>{a.holderName}</TableCell>
                <TableCell>
                  <Switch checked={a.isActive !== false} onCheckedChange={() => toggleActive(a)} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
