'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { OrgPlan } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Loader2, LogIn } from 'lucide-react'

const PLAN_LABEL: Record<OrgPlan, string> = {
  free: 'Gratis',
  plus: 'Plus',
  unlimited: 'Ilimitado',
}

const PLAN_CLASS: Record<OrgPlan, string> = {
  free: 'bg-slate-100 text-slate-700',
  plus: 'bg-blue-100 text-blue-800',
  unlimited: 'bg-emerald-100 text-emerald-800',
}

const PAGE_SIZE = 25

interface SuperadminOrg {
  id: string
  slug: string
  name: string
  plan: OrgPlan
  purchasedPlan: OrgPlan
  planOverride: OrgPlan | null
  stripeStatus: string | null
  customDomain: string | null
  email: string | null
  onboardingCompleted: boolean
  createdAt: string
  raffleCount: number
  memberCount: number
  usage: { used: number; limit: number | null; remaining: number | null }
  url: string
  adminUrl: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function UsageCell({ used, limit }: { used: number; limit: number | null }) {
  const atLimit = limit != null && used >= limit
  const low = limit != null && !atLimit && used / limit >= 0.8
  const pct = limit != null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  return (
    <div className="min-w-[8.5rem]">
      <p className="text-sm font-medium text-[#0B2447]">
        {limit == null
          ? `${used.toLocaleString('es-DO')} · Ilimitado`
          : `${used.toLocaleString('es-DO')} / ${limit.toLocaleString('es-DO')}`}
      </p>
      {limit != null && (
        <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              atLimit ? 'bg-red-500' : low ? 'bg-amber-500' : 'bg-[#1976D2]'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function SuperadminOrgsPage() {
  const [orgs, setOrgs] = useState<SuperadminOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
    const res = await fetch(`/api/platform/superadmin/orgs?${params}`)
    const json = await res.json()
    if (json.success) {
      setOrgs(json.data)
      setTotal(json.total ?? json.data.length)
    }
    setLoading(false)
  }, [page, debouncedQuery])

  useEffect(() => {
    load()
  }, [load])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const setPlanOverride = async (orgId: string, planOverride: OrgPlan | '') => {
    setActionError(null)
    setSavingId(orgId)
    try {
      const res = await fetch('/api/platform/superadmin/orgs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, planOverride: planOverride || null }),
      })
      const json = await res.json()
      if (!json.success) {
        setActionError(json.error || 'No se pudo sobreescribir el plan')
        return
      }
      setOrgs((current) =>
        current.map((org) => {
          if (org.id !== orgId) return org
          const limit = json.data.usageLimit as number | null
          const used = org.usage.used
          return {
            ...org,
            plan: json.data.plan,
            purchasedPlan: json.data.purchasedPlan,
            planOverride: json.data.planOverride,
            usage: {
              used,
              limit,
              remaining: limit == null ? null : Math.max(limit - used, 0),
            },
          }
        })
      )
    } catch {
      setActionError('No se pudo sobreescribir el plan')
    } finally {
      setSavingId(null)
    }
  }

  const openAdmin = async (orgId: string) => {
    setActionError(null)
    setOpeningId(orgId)
    try {
      const res = await fetch('/api/platform/superadmin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      const json = await res.json()
      if (!json.success || !json.data?.url) {
        setActionError(json.error || 'No se pudo abrir el admin')
        return
      }
      window.open(json.data.url, '_blank', 'noopener,noreferrer')
    } catch {
      setActionError('No se pudo abrir el admin')
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Organizaciones</h1>
          <p className="text-muted-foreground">
            {loading
              ? 'Cargando...'
              : `${total} ${total === 1 ? 'organización' : 'organizaciones'} · uso del mes`}
          </p>
        </div>
        <Input
          placeholder="Buscar por nombre, slug o correo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs bg-white"
        />
      </div>

      {actionError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{actionError}</p>
      )}

      <div className="rounded-lg border bg-white min-w-0 max-h-[calc(100vh-14rem)] overflow-auto">
        <table className="w-full min-w-[1240px] caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_hsl(var(--border))]">
            <TableRow>
              <TableHead>Organización</TableHead>
              <TableHead>Plan / overwrite</TableHead>
              <TableHead>Uso del mes</TableHead>
              <TableHead>Stripe</TableHead>
              <TableHead>Rifas</TableHead>
              <TableHead>Miembros</TableHead>
              <TableHead>Creada</TableHead>
              <TableHead className="sticky right-0 bg-white" />
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
            {!loading && orgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay organizaciones.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="whitespace-nowrap">
                    <a
                      href={org.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                    >
                      {org.name}
                    </a>
                    <div className="text-xs text-muted-foreground">
                      {org.slug}
                      {org.customDomain ? ` · ${org.customDomain}` : ''}
                    </div>
                    {org.email && <div className="text-xs text-muted-foreground">{org.email}</div>}
                    {!org.onboardingCompleted && (
                      <Badge variant="outline" className="mt-1">
                        Onboarding pendiente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col gap-1 min-w-[10.5rem]">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={org.planOverride ?? ''}
                        disabled={savingId === org.id}
                        onChange={(e) =>
                          setPlanOverride(org.id, e.target.value as OrgPlan | '')
                        }
                      >
                        <option value="">Comprado · {PLAN_LABEL[org.purchasedPlan]}</option>
                        <option value="free">Overwrite · Gratis</option>
                        <option value="plus">Overwrite · Plus</option>
                        <option value="unlimited">Overwrite · Ilimitado</option>
                      </select>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_CLASS[org.plan]}`}
                        >
                          {PLAN_LABEL[org.plan]}
                        </span>
                        {org.planOverride ? (
                          <span className="text-[11px] text-amber-700">
                            overwrite · comprado {PLAN_LABEL[org.purchasedPlan]}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">comprado</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <UsageCell used={org.usage.used} limit={org.usage.limit} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {org.stripeStatus || '—'}
                  </TableCell>
                  <TableCell>{org.raffleCount}</TableCell>
                  <TableCell>{org.memberCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(org.createdAt)}</TableCell>
                  <TableCell className="sticky right-0 bg-white text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAdmin(org.id)}
                      disabled={openingId === org.id}
                    >
                      {openingId === org.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <LogIn className="h-4 w-4 mr-1" />
                          Abrir admin
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </table>
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
