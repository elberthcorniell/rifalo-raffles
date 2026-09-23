'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Users, Building2, Ticket } from 'lucide-react'
import type { OrgPlan } from '@/lib/constants'

const PLAN_LABEL: Record<OrgPlan, string> = {
  free: 'Gratis',
  plus: 'Plus',
  unlimited: 'Ilimitado',
}

interface Stats {
  users: number
  orgs: number
  raffles: number
  plans: Record<OrgPlan, number>
}

export default function SuperadminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/platform/superadmin/stats')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStats(json.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    {
      label: 'Usuarios',
      value: stats?.users ?? 0,
      icon: Users,
      href: '/superadmin/users',
      color: 'text-blue-600',
    },
    {
      label: 'Organizaciones',
      value: stats?.orgs ?? 0,
      icon: Building2,
      href: '/superadmin/orgs',
      color: 'text-purple-600',
    },
    {
      label: 'Rifas',
      value: stats?.raffles ?? 0,
      icon: Ticket,
      href: '/superadmin/raffles',
      color: 'text-amber-600',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447]">Superadmin</h1>
        <p className="text-muted-foreground">Vista global de usuarios, organizaciones y rifas</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.label} href={card.href}>
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? '—' : card.value}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${card.color} opacity-80`} />
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-[#0B2447] mb-4">Planes</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['free', 'plus', 'unlimited'] as OrgPlan[]).map((plan) => (
            <div key={plan} className="rounded-lg border bg-slate-50 px-4 py-3">
              <p className="text-sm text-muted-foreground">{PLAN_LABEL[plan]}</p>
              <p className="text-2xl font-bold text-[#0B2447]">
                {loading ? '—' : stats?.plans[plan] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
