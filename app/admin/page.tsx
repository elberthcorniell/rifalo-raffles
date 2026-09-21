'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Ticket,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import type { OrgPlan } from '@/lib/constants'

interface Stats {
  pendingPurchases: number
  activeRaffles: number
  reservedTickets: number
  soldTickets: number
}

interface Quota {
  plan: OrgPlan
  used: number
  limit: number | null
  remaining: number | null
}

interface DayPoint {
  day: string
  tickets: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [series, setSeries] = useState<DayPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then((r) => r.json()),
      fetch('/api/admin/billing').then((r) => r.json()),
    ])
      .then(([statsRes, billingRes]) => {
        if (statsRes.success) {
          setStats(statsRes.data)
          if (Array.isArray(statsRes.data?.ticketsPerDay)) {
            setSeries(statsRes.data.ticketsPerDay)
          }
        }
        if (billingRes.success) setQuota(billingRes.data.quota)
      })
      .finally(() => setLoading(false))
  }, [])

  const atLimit =
    quota?.limit != null && (quota.remaining ?? 0) <= 0
  const low =
    quota?.limit != null &&
    (quota.remaining ?? 0) > 0 &&
    (quota.remaining ?? 0) <= 25

  const cards = [
    {
      label: 'Compras pendientes',
      value: stats?.pendingPurchases ?? 0,
      icon: Clock,
      href: '/admin/purchases?status=pending',
      color: 'text-amber-600',
    },
    {
      label: 'Rifas activas',
      value: stats?.activeRaffles ?? 0,
      icon: Ticket,
      href: '/admin/raffles',
      color: 'text-blue-600',
    },
    {
      label: 'Boletos reservados',
      value: stats?.reservedTickets ?? 0,
      icon: ShoppingCart,
      href: '/admin/purchases?status=pending',
      color: 'text-purple-600',
    },
    {
      label: 'Boletos vendidos',
      value: stats?.soldTickets ?? 0,
      icon: CheckCircle,
      href: '/admin/purchases?status=confirmed',
      color: 'text-green-600',
    },
  ]

  const maxSeries = Math.max(1, ...series.map((p) => p.tickets))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447]">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de tu plataforma de rifas</p>
      </div>

      {(atLimit || low) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3 ${
            atLimit
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {atLimit
                ? 'Llegaste al límite de boletos del mes. Mejora tu plan para seguir vendiendo.'
                : `Te quedan ${quota?.remaining} boletos este mes (${quota?.used}/${quota?.limit}).`}
            </span>
          </div>
          <Button size="sm" className="bg-[#1976D2] hover:bg-[#1565C0]" asChild>
            <Link href="/admin/billing">
              {atLimit ? 'Mejorar para seguir vendiendo' : 'Ver planes'}
            </Link>
          </Button>
        </div>
      )}

      {quota && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">Boletos este mes</p>
              <p className="text-2xl font-bold text-[#0B2447]">
                {quota.limit == null
                  ? `${quota.used} (ilimitado)`
                  : `${quota.used} / ${quota.limit}`}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/billing">Facturación</Link>
            </Button>
          </div>
          {quota.limit != null && (
            <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  atLimit ? 'bg-red-500' : low ? 'bg-amber-500' : 'bg-[#1976D2]'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((quota.used / quota.limit) * 100))}%`,
                }}
              />
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.label} href={card.href}>
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-3xl font-bold mt-1">
                      {loading ? '—' : card.value}
                    </p>
                  </div>
                  <Icon className={`h-8 w-8 ${card.color} opacity-80`} />
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      {series.length > 0 && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-[#0B2447]">Boletos por día (mes)</h2>
            <p className="text-sm text-muted-foreground">
              Analítica avanzada · plan Ilimitado
            </p>
          </div>
          <div className="flex items-end gap-1 h-40">
            {series.map((p) => (
              <div
                key={p.day}
                className="flex-1 flex flex-col items-center gap-1 min-w-0"
                title={`${p.day}: ${p.tickets}`}
              >
                <div
                  className="w-full rounded-t bg-[#1976D2]/80"
                  style={{
                    height: `${Math.max(4, (p.tickets / maxSeries) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/admin/raffles">Nueva rifa</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/purchases?status=pending">Revisar compras</Link>
        </Button>
      </div>
    </div>
  )
}
