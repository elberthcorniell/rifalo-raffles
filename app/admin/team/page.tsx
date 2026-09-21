'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, UserPlus } from 'lucide-react'
import type { OrgPlan } from '@/lib/constants'

interface Member {
  userId: string
  role: string
  email: string | null
  createdAt?: string
}

export default function AdminTeamPage() {
  const [plan, setPlan] = useState<OrgPlan>('free')
  const [members, setMembers] = useState<Member[]>([])
  const [canAdd, setCanAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/team')
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo cargar el equipo')
        return
      }
      setPlan(json.data.plan)
      setMembers(json.data.members || [])
      setCanAdd(!!json.data.canAddMembers)
    } catch {
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'admin' }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo agregar')
        return
      }
      setSuccess(`Se agregó ${email}`)
      setEmail('')
      await load()
    } catch {
      setError('Error al agregar miembro')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (userId: string) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo eliminar')
        return
      }
      await load()
    } catch {
      setError('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447]">Equipo</h1>
        <p className="text-muted-foreground">
          Gestiona organizadores y administradores de tu organización.
        </p>
      </div>

      {!canAdd && (
        <Card className="p-5 border-amber-200 bg-amber-50 text-amber-900 text-sm space-y-3">
          <p>
            Tu plan <strong className="capitalize">{plan}</strong> permite un solo
            organizador. El plan Ilimitado desbloquea varios admins.
          </p>
          <Button asChild className="bg-[#1976D2] hover:bg-[#1565C0]">
            <Link href="/admin/billing">Ver planes</Link>
          </Button>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">
          {success}
        </div>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-[#0B2447]">Miembros</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <li
                key={m.userId}
                className="py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium">{m.email || m.userId}</p>
                  <p className="text-muted-foreground capitalize">{m.role}</p>
                </div>
                {canAdd && m.role !== 'owner' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => remove(m.userId)}
                  >
                    Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canAdd && (
        <Card className="p-6">
          <form onSubmit={invite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Invitar por correo</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ejemplo.com"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#1976D2] hover:bg-[#1565C0]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Agregar admin
                </>
              )}
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}
