'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Ticket,
  ShoppingCart,
  Building2,
  Settings,
  LogOut,
  Menu,
  MessageSquareQuote,
  CreditCard,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useOrgBrand } from '@/components/OrgBrandProvider'
import type { OrgPlan, TicketQuota } from '@/lib/billing'

const PLAN_LABEL: Record<OrgPlan, string> = {
  free: 'Gratis',
  plus: 'Plus',
  unlimited: 'Ilimitado',
}

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/raffles', label: 'Rifas', icon: Ticket },
  { href: '/admin/purchases', label: 'Compras', icon: ShoppingCart },
  { href: '/admin/bank-accounts', label: 'Cuentas', icon: Building2 },
  { href: '/admin/testimonials', label: 'Testimonios', icon: MessageSquareQuote },
  { href: '/admin/billing', label: 'Facturación', icon: CreditCard },
  { href: '/admin/team', label: 'Equipo', icon: Users },
  { href: '/admin/settings', label: 'Marca', icon: Settings },
]

export function AdminShell({
  children,
  initialQuota = null,
}: {
  children: React.ReactNode
  initialQuota?: TicketQuota | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const brand = useOrgBrand()
  const [open, setOpen] = useState(false)
  const [quota, setQuota] = useState<TicketQuota | null>(initialQuota)

  useEffect(() => {
    fetch('/api/admin/billing')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.quota) setQuota(json.data.quota)
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-[#0B2447] text-white flex flex-col transition-transform lg:translate-x-0 lg:static',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 border-b border-white/10">
          <p className="text-xs uppercase tracking-wider text-white/60">Admin</p>
          <h1 className="font-bold text-lg">{brand.name}</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1 flex flex-col">
          <div className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
          {quota && (
            <SidebarQuota quota={quota} onNavigate={() => setOpen(false)} />
          )}
        </nav>
        <div className="p-4 border-t border-white/10">
          <Button
            variant="ghost"
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-x-0 top-0 bottom-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center gap-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-[#0B2447]">{brand.name}</span>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}

function SidebarQuota({
  quota,
  onNavigate,
}: {
  quota: TicketQuota
  onNavigate: () => void
}) {
  const atLimit = quota.limit != null && (quota.remaining ?? 0) <= 0
  const low =
    quota.limit != null && (quota.remaining ?? 0) > 0 && (quota.remaining ?? 0) <= 25
  const pct =
    quota.limit != null && quota.limit > 0
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 0

  return (
    <Link
      href="/admin/billing"
      onClick={onNavigate}
      className="mt-auto block rounded-lg bg-white/10 px-3 py-3 hover:bg-white/15 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-white/60">Boletos del mes</span>
        <span className="text-white/80">{PLAN_LABEL[quota.plan]}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">
        {quota.limit == null ? `${quota.used} · Ilimitado` : `${quota.used} / ${quota.limit}`}
      </p>
      {quota.limit != null && (
        <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              atLimit ? 'bg-red-400' : low ? 'bg-amber-400' : 'bg-[#64B5F6]'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </Link>
  )
}
