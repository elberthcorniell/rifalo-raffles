'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, CreditCard, Loader2, Sparkles } from 'lucide-react'
import type { OrgPlan } from '@/lib/constants'

interface Quota {
  plan: OrgPlan
  used: number
  limit: number | null
  remaining: number | null
}

interface PlanCard {
  id: OrgPlan
  name: string
  price: number
  ticketLimit: number | null
  features: string[]
}

interface BillingData {
  plan: OrgPlan
  quota: Quota
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripeSubscriptionStatus: string | null
  customDomain: string | null
  plans: PlanCard[]
}

export default function AdminBillingPage() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/billing')
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo cargar la facturación')
        return
      }
      setData(json.data)
    } catch {
      setError('Error de red al cargar la facturación')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') {
      setInfo('Pago recibido. Tu plan se actualizará en unos segundos.')
      setTimeout(load, 2000)
    } else if (params.get('checkout') === 'cancel') {
      setInfo('Checkout cancelado. Puedes intentarlo de nuevo cuando quieras.')
    }
  }, [load])

  const startCheckout = async (plan: Exclude<OrgPlan, 'free'>) => {
    setActionLoading(plan)
    setError(null)
    try {
      const res = await fetch('/api/admin/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (!json.success || !json.data?.url) {
        setError(json.error || 'No se pudo iniciar el checkout')
        return
      }
      window.location.href = json.data.url
    } catch {
      setError('Error al iniciar el checkout')
    } finally {
      setActionLoading(null)
    }
  }

  const openPortal = async () => {
    setActionLoading('portal')
    setError(null)
    try {
      const res = await fetch('/api/admin/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (!json.success || !json.data?.url) {
        setError(json.error || 'No se pudo abrir el portal')
        return
      }
      window.location.href = json.data.url
    } catch {
      setError('Error al abrir el portal de Stripe')
    } finally {
      setActionLoading(null)
    }
  }

  const quota = data?.quota
  const limitLabel =
    quota?.limit == null ? 'Ilimitado' : `${quota.used} / ${quota.limit}`
  const pct =
    quota?.limit != null && quota.limit > 0
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 0
  const atLimit = quota?.limit != null && (quota.remaining ?? 0) <= 0
  const low = quota?.limit != null && (quota.remaining ?? 0) > 0 && (quota.remaining ?? 0) <= 25

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447]">Facturación</h1>
        <p className="text-muted-foreground">
          Empieza gratis. Mejora tu plan cuando necesites más boletos.
        </p>
      </div>

      {info && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-800 px-4 py-3 text-sm">
          {info}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {atLimit && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>
            Alcanzaste el límite mensual de boletos. Mejora tu plan para seguir
            vendiendo.
          </span>
          <Button
            size="sm"
            className="bg-[#1976D2] hover:bg-[#1565C0]"
            onClick={() => startCheckout('plus')}
            disabled={!!actionLoading}
          >
            Mejorar para seguir vendiendo
          </Button>
        </div>
      )}
      {!atLimit && low && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          Te quedan {quota?.remaining} boletos este mes. Considera mejorar tu plan.
        </div>
      )}

      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground">Uso este mes</p>
            <p className="text-3xl font-bold text-[#0B2447]">
              {loading ? '—' : limitLabel}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Plan actual:{' '}
              <span className="font-medium capitalize text-[#0B2447]">
                {data?.plan || 'free'}
              </span>
              {data?.stripeSubscriptionStatus
                ? ` · Stripe: ${data.stripeSubscriptionStatus}`
                : ''}
            </p>
          </div>
          {data?.stripeSubscriptionId && (
            <Button
              variant="outline"
              onClick={openPortal}
              disabled={!!actionLoading}
            >
              {actionLoading === 'portal' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Gestionar suscripción
            </Button>
          )}
        </div>
        {quota?.limit != null && (
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                atLimit ? 'bg-red-500' : low ? 'bg-amber-500' : 'bg-[#1976D2]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {(data?.plans || []).map((plan) => {
          const isCurrent = data?.plan === plan.id
          const isPaid = plan.id !== 'free'
          return (
            <Card
              key={plan.id}
              className={`p-6 flex flex-col space-y-4 ${
                isCurrent ? 'border-[#1976D2] ring-2 ring-[#1976D2]/20' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#1976D2]">{plan.name}</p>
                  {isCurrent && (
                    <span className="text-xs rounded-full bg-[#1976D2]/10 text-[#1976D2] px-2 py-0.5">
                      Actual
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-[#0B2447]">
                    {plan.price === 0 ? 'Gratis' : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground">/mes</span>
                  )}
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#1976D2] mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {isPaid ? (
                <Button
                  className={
                    isCurrent
                      ? 'bg-slate-200 text-slate-600 hover:bg-slate-200'
                      : 'bg-[#1976D2] hover:bg-[#1565C0]'
                  }
                  disabled={isCurrent || !!actionLoading}
                  onClick={() => startCheckout(plan.id as 'plus' | 'unlimited')}
                >
                  {actionLoading === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    'Plan actual'
                  ) : atLimit ? (
                    'Mejorar para seguir vendiendo'
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Mejorar a {plan.name}
                    </>
                  )}
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Incluido al registrarte
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        ¿Necesitas dominio propio o varios admins?{' '}
        <Link href="/admin/team" className="text-[#1976D2] hover:underline">
          Ver equipo
        </Link>{' '}
        ·{' '}
        <Link href="/admin/settings" className="text-[#1976D2] hover:underline">
          Configurar dominio
        </Link>
      </p>
    </div>
  )
}
