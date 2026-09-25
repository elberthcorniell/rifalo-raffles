'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface UserOrg {
  orgId: string
  name: string
  slug: string
  role: string
  plan: string
  url: string
}

interface OrgOption {
  id: string
  name: string
  slug: string
}

interface SuperadminUser {
  id: string
  email: string | null
  displayName: string | null
  createdAt: string | null
  lastSignInAt: string | null
  emailConfirmed: boolean
  orgs: UserOrg[]
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function SuperadminUsersPage() {
  const [users, setUsers] = useState<SuperadminUser[]>([])
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [assignUser, setAssignUser] = useState<SuperadminUser | null>(null)
  const [orgId, setOrgId] = useState('')
  const [role, setRole] = useState<'admin' | 'owner'>('admin')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadUsers() {
    const response = await fetch('/api/platform/superadmin/users')
    const json = await response.json()
    if (json.success) setUsers(json.data)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/platform/superadmin/users').then((r) => r.json()),
      fetch('/api/platform/superadmin/orgs?pageSize=100').then((r) => r.json()),
    ])
      .then(([usersJson, orgsJson]) => {
        if (usersJson.success) setUsers(usersJson.data)
        if (orgsJson.success) {
          setOrgs(
            (orgsJson.data as { id: string; name: string; slug: string }[]).map((org) => ({
              id: org.id,
              name: org.name,
              slug: org.slug,
            }))
          )
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function openAssign(user: SuperadminUser) {
    const available = orgs.find((org) => !user.orgs.some((membership) => membership.orgId === org.id))
    setAssignUser(user)
    setOrgId(available?.id || '')
    setRole('admin')
    setError('')
  }

  async function assignMembership() {
    if (!assignUser || !orgId) return
    setSaving(true)
    setError('')
    const response = await fetch('/api/platform/superadmin/users/membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: assignUser.id, orgId, role }),
    })
    const json = await response.json()
    setSaving(false)
    if (!json.success) {
      setError(json.error || 'No se pudo asignar')
      return
    }
    setAssignUser(null)
    await loadUsers()
  }

  async function removeMembership(user: SuperadminUser, org: UserOrg) {
    setError('')
    const response = await fetch('/api/platform/superadmin/users/membership', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, orgId: org.orgId }),
    })
    const json = await response.json()
    if (!json.success) {
      setError(json.error || 'No se pudo quitar de la organización')
      return
    }
    await loadUsers()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const haystack = [
        u.email,
        u.displayName,
        ...u.orgs.map((o) => `${o.name} ${o.slug}`),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [users, query])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Usuarios</h1>
          <p className="text-muted-foreground">
            {loading ? 'Cargando...' : `${filtered.length} usuario${filtered.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Input
          placeholder="Buscar por correo u organización"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs bg-white"
        />
      </div>

      {error && !assignUser && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-3 md:hidden">
        {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!loading && filtered.length === 0 && (
          <p className="rounded-lg border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            No hay usuarios.
          </p>
        )}
        {filtered.map((u) => (
          <article key={u.id} className="rounded-lg border bg-white p-4 space-y-3">
            <div>
              <p className="font-medium break-all">{u.email || u.id}</p>
              {u.displayName && <p className="text-xs text-muted-foreground">{u.displayName}</p>}
              {!u.emailConfirmed && (
                <Badge variant="outline" className="mt-1">
                  Sin confirmar
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {u.orgs.length === 0 && (
                <span className="text-sm text-muted-foreground">Sin organización</span>
              )}
              {u.orgs.map((org) => (
                <Badge key={org.orgId} variant="secondary" className="gap-1 pr-1">
                  {org.name} · {org.role}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-black/10"
                    aria-label={`Quitar de ${org.name}`}
                    onClick={() => removeMembership(u, org)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Creado {formatDate(u.createdAt)} · Último acceso {formatDate(u.lastSignInAt)}
            </p>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => openAssign(u)}>
              Asignar
            </Button>
          </article>
        ))}
      </div>

      <div className="hidden rounded-lg border bg-white overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Organizaciones</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Último acceso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No hay usuarios.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.email || u.id}</div>
                  {u.displayName && (
                    <div className="text-xs text-muted-foreground">{u.displayName}</div>
                  )}
                  {!u.emailConfirmed && (
                    <Badge variant="outline" className="mt-1">
                      Sin confirmar
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {u.orgs.length === 0 && (
                      <span className="text-muted-foreground">Sin organización</span>
                    )}
                    {u.orgs.map((org) => (
                      <Badge key={org.orgId} variant="secondary" className="gap-1 pr-1">
                        {org.name} · {org.role}
                        <button
                          type="button"
                          className="rounded-sm p-0.5 hover:bg-black/10"
                          aria-label={`Quitar de ${org.name}`}
                          onClick={() => removeMembership(u, org)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => openAssign(u)}
                    >
                      Asignar
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDate(u.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(u.lastSignInAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(assignUser)} onOpenChange={(open) => !open && setAssignUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar organización</DialogTitle>
            <DialogDescription>
              {assignUser?.email || assignUser?.displayName || 'Usuario'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige una organización" />
              </SelectTrigger>
              <SelectContent>
                {orgs
                  .filter((org) => !assignUser?.orgs.some((membership) => membership.orgId === org.id))
                  .map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(value) => setRole(value === 'owner' ? 'owner' : 'admin')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignUser(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={assignMembership} disabled={!orgId || saving}>
              {saving ? 'Asignando...' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
