'use client'

import { useEffect, useMemo, useState } from 'react'
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

interface UserOrg {
  orgId: string
  name: string
  slug: string
  role: string
  plan: string
  url: string
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
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/platform/superadmin/users')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUsers(json.data)
      })
      .finally(() => setLoading(false))
  }, [])

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

      <div className="rounded-lg border bg-white overflow-hidden">
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
                  {u.orgs.length === 0 ? (
                    <span className="text-muted-foreground">Sin organización</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.orgs.map((org) => (
                        <Badge key={org.orgId} variant="secondary">
                          {org.name} · {org.role}
                        </Badge>
                      ))}
                    </div>
                  )}
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
    </div>
  )
}
