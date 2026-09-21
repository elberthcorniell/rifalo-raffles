import type { Metadata } from 'next'
import Link from 'next/link'
import { PLATFORM, getRootDomain, PLAN_PRICES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import {
  Ticket,
  Globe,
  LayoutDashboard,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Check,
  CreditCard,
} from 'lucide-react'

export const metadata: Metadata = {
  title: `${PLATFORM.name} — Rifas gratis, sin tarjeta`,
  description: PLATFORM.tagline,
}

const features = [
  {
    icon: Globe,
    title: 'Tu propio sitio',
    description:
      'Cada organización recibe un subdominio con tienda pública para vender boletos.',
  },
  {
    icon: LayoutDashboard,
    title: 'Panel de administración',
    description:
      'Crea rifas, revisa comprobantes, confirma pagos y gestiona cuentas bancarias.',
  },
  {
    icon: Ticket,
    title: 'Boletos aleatorios',
    description:
      'Asignación segura de números al azar con verificación por WhatsApp.',
  },
  {
    icon: ShieldCheck,
    title: 'Pagos por transferencia',
    description:
      'Tus clientes suben el voucher; tú apruebas o rechazas desde el admin.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Crea tu organización',
    description: 'Regístrate gratis y elige el nombre de tu sitio.',
  },
  {
    n: '2',
    title: 'Marca y cobros',
    description: 'Personaliza colores y agrega la cuenta donde recibirás los pagos.',
  },
  {
    n: '3',
    title: 'Publica y comparte',
    description: `Crea tu primera rifa y envía tu-org.${getRootDomain()} a tus clientes.`,
  },
]

const plans = [
  {
    id: 'free',
    name: 'Gratis',
    price: PLAN_PRICES.free,
    priceLabel: 'Gratis',
    description: 'Ideal para empezar sin compromiso.',
    highlight: true,
    features: [
      '250 boletos al mes',
      'Tu marca y colores',
      'Página de rifa estándar',
      'Analítica básica',
    ],
    cta: 'Empezar gratis',
    href: '/signup',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: PLAN_PRICES.plus,
    priceLabel: `$${PLAN_PRICES.plus}`,
    description: 'Para rifas que ya están vendiendo.',
    highlight: false,
    features: [
      'Hasta 50,000 boletos al mes',
      'Tu marca y colores',
      'Página de rifa estándar',
      'Analítica básica',
    ],
    cta: 'Empezar gratis',
    href: '/signup',
  },
  {
    id: 'unlimited',
    name: 'Ilimitado',
    price: PLAN_PRICES.unlimited,
    priceLabel: `$${PLAN_PRICES.unlimited}`,
    description: 'Todo lo que necesitas a escala.',
    highlight: false,
    features: [
      'Boletos ilimitados',
      'Dominio propio',
      'Analítica avanzada',
      'Varios organizadores / admins',
    ],
    cta: 'Empezar gratis',
    href: '/signup',
  },
]

export default function PlatformLandingPage() {
  return (
    <div className="min-h-screen bg-background font-poppins">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-[#0B2447] text-lg">
            <Sparkles className="h-5 w-5 text-[#1976D2]" />
            {PLATFORM.name}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button className="bg-[#1976D2] hover:bg-[#1565C0]" asChild>
              <Link href="/signup">Empezar gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0B2447] via-[#123A6B] to-[#1976D2] text-white">
          <div className="max-w-6xl mx-auto px-4 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
                <CreditCard className="h-4 w-4" />
                Gratis · Sin tarjeta requerida
              </p>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Haz tus rifas gratis. Sin tarjeta.
              </h1>
              <p className="text-lg text-white/80 max-w-xl">
                {PLATFORM.tagline} Empieza con 250 boletos al mes y escala cuando
                lo necesites.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-white text-[#0B2447] hover:bg-white/90"
                  asChild
                >
                  <Link href="/signup">
                    Empezar gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-white/60">
                Sin tarjeta · Cancela cuando quieras · Tu propio subdominio
              </p>
            </div>
            <div className="hidden md:block rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-6 space-y-4">
              <div className="text-sm text-white/70">Tu tienda pública</div>
              <div className="rounded-lg bg-white text-[#0B2447] p-4 font-mono text-sm">
                https://tu-org.{getRootDomain()}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-white/10 p-3">Rifas activas</div>
                <div className="rounded-lg bg-white/10 p-3">Panel admin</div>
                <div className="rounded-lg bg-white/10 p-3">250 boletos gratis</div>
                <div className="rounded-lg bg-white/10 p-3">Sin tarjeta</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 border-y">
          <div className="max-w-6xl mx-auto px-4 py-20">
            <div className="text-center mb-12 space-y-3">
              <h2 className="text-3xl font-bold text-[#0B2447]">Todo lo que necesitas</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Un sitio para tus clientes y un panel completo para tu equipo.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f) => {
                const Icon = f.icon
                return (
                  <div
                    key={f.title}
                    className="rounded-xl border bg-card p-6 space-y-3 shadow-sm"
                  >
                    <div className="h-10 w-10 rounded-lg bg-[#1976D2]/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-[#1976D2]" />
                    </div>
                    <h3 className="font-semibold text-[#0B2447]">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0B2447]">Cómo funciona</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.n} className="text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-[#0B2447] text-white flex items-center justify-center font-bold text-lg">
                  {s.n}
                </div>
                <h3 className="font-semibold text-lg text-[#0B2447]">{s.title}</h3>
                <p className="text-muted-foreground text-sm">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="planes" className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl font-bold text-[#0B2447]">Planes</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Empieza gratis. Cuando llegues a 250 boletos en el mes, mejora tu
              plan para seguir vendiendo.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border bg-card p-6 flex flex-col space-y-5 shadow-sm ${
                  plan.highlight
                    ? 'border-[#1976D2] ring-2 ring-[#1976D2]/20'
                    : ''
                }`}
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[#1976D2]">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#0B2447]">
                      {plan.priceLabel}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground text-sm">/mes</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-[#1976D2] mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={
                    plan.highlight
                      ? 'bg-[#1976D2] hover:bg-[#1565C0]'
                      : 'bg-[#0B2447] hover:bg-[#0B2447]/90'
                  }
                  asChild
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
          <h2 className="text-3xl font-bold text-[#0B2447]">
            ¿Listo para crear tu primera rifa?
          </h2>
          <p className="text-muted-foreground">
            Regístrate gratis, elige tu subdominio y publica en minutos. Sin tarjeta.
          </p>
          <Button size="lg" className="bg-[#1976D2] hover:bg-[#1565C0]" asChild>
            <Link href="/signup">
              Empezar gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>{PLATFORM.copyright}</p>
        <p className="mt-1">
          <a href={`mailto:${PLATFORM.email}`} className="hover:text-[#1976D2]">
            {PLATFORM.email}
          </a>
        </p>
      </footer>
    </div>
  )
}
