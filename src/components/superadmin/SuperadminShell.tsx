'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Ticket,
  Building2,
  LogOut,
  Menu,
  Users,
  Shield,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { PLATFORM } from '@/lib/constants'

const nav = [
  { href: '/superadmin', label: 'Resumen', icon: LayoutDashboard },
  { href: '/superadmin/users', label: 'Usuarios', icon: Users },
  { href: '/superadmin/orgs', label: 'Organizaciones', icon: Building2 },
  { href: '/superadmin/raffles', label: 'Rifas', icon: Ticket },
]

export function SuperadminShell({
  children,
  email,
}: {
  children: React.ReactNode
  email?: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/superadmin' ? pathname === '/superadmin' : pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-[#0B2447] text-white flex flex-col transition-transform lg:translate-x-0 lg:static',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 border-b border-white/10">
          <p className="text-xs uppercase tracking-wider text-white/60 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Superadmin
          </p>
          <h1 className="font-bold text-lg">{PLATFORM.name}</h1>
          {email && <p className="text-xs text-white/50 mt-1 truncate">{email}</p>}
        </div>
        <nav className="flex-1 p-4 space-y-1">
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
          <span className="font-semibold text-[#0B2447]">Superadmin</span>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
