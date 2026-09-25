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
  Check,
} from 'lucide-react'
import { PlatformHeader } from '@/components/platform/PlatformHeader'
import { CatalogGrid } from '@/components/platform/CatalogGrid'
import { fetchCatalogRaffles } from '@/lib/raffle-catalog'

const GOLD = '#FFD000'

const showcaseRaffles = [
  {
    title: 'Honda CB650R',
    detail: 'Motocicleta',
    price: 'RD$100',
    sold: 42,
    image: '/platform/motorcycle.jpg',
    rotate: -16,
    z: 1,
  },
  {
    title: 'iPhone Duo',
    detail: 'Doblable',
    price: 'RD$150',
    sold: 78,
    image: '/platform/iphone.jpg',
    rotate: 0,
    z: 3,
  },
  {
    title: 'Toyota Corolla',
    detail: 'Sedán híbrido',
    price: 'RD$250',
    sold: 61,
    image: '/platform/car.jpg',
    rotate: 16,
    z: 2,
  },
]

export const metadata: Metadata = {
  title: `${PLATFORM.name} — Publica tu rifa y vende boletos hoy`,
  description:
    'Crea tu rifa, comparte tu página y cobra por transferencia. Empieza gratis, sin tarjeta.',
}

const features = [
  {
    icon: Globe,
    title: 'Tu propia página para vender',
    description:
      'Tus clientes compran en una página con tu nombre y tus colores. Tú compartes el enlace. No montas un sitio.',
  },
  {
    icon: ShieldCheck,
    title: 'Cobra por transferencia sin perseguir comprobantes',
    description:
      'El cliente transfiere a tu cuenta y sube el recibo. Tú apruebas o rechazas desde un solo lugar. El dinero entra a tu banco.',
  },
  {
    icon: Ticket,
    title: 'Olvídate de asignar números a mano',
    description:
      'Al enviar el comprobante, cada comprador recibe sus números al azar. Nada de Excel ni de “ese número ya está tomado”.',
  },
  {
    icon: LayoutDashboard,
    title: 'Controla toda la rifa desde un solo lugar',
    description:
      'Creas la rifa, ves las ventas y confirmas los pagos ahí. Tus clientes consultan sus boletos con el WhatsApp que dejaron.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Crea tu rifa',
    description: 'Pon el premio, el precio del boleto y publica. Sin código.',
  },
  {
    n: '2',
    title: 'Agrega cómo te pagan',
    description: 'Tu marca y la cuenta bancaria donde quieres recibir el dinero.',
  },
  {
    n: '3',
    title: 'Comparte el link',
    description: `Mándales link por WhatsApp, Instagram o donde ya vendes.`,
  },
  {
    n: '4',
    title: 'Vende boletos',
    description:
      'Ellos transfieren, suben el comprobante y reciben su número. Tú apruebas el pago.',
  },
]

const contrasts = [
  {
    before: 'WhatsApp + Excel',
    after: 'Una página tuya donde la gente compra el boleto.',
  },
  {
    before: 'Números anotados a mano',
    after: 'Cada comprador recibe su número solo, al azar.',
  },
  {
    before: 'Capturas perdidas en el chat',
    after: 'El comprobante llega a tu panel. Tú apruebas o rechazas.',
  },
  {
    before: 'Pedirle un sitio a un programador',
    after: 'Publicas la rifa sin escribir una línea de código.',
  },
]

const faqs = [
  {
    q: '¿Necesito tarjeta?',
    a: 'No para crear tu rifa. El plan Gratis no pide tarjeta. Solo la agregas si más adelante activas Plus o Ilimitado.',
  },
  {
    q: '¿Necesito saber programar?',
    a: 'No. Escribes el premio, el precio y publicas. Rifalo arma la página, los boletos y el panel.',
  },
  {
    q: '¿Cuánto tarda en crear una rifa?',
    a: 'Cuenta, página, banco y rifa. Si ya tienes el premio y la cuenta, la dejas publicada en menos de 5 minutos.',
  },
  {
    q: '¿Cómo reciben los clientes sus números?',
    a: 'Cuando envían el comprobante, el sistema les asigna números al azar. También pueden consultarlos con el WhatsApp que dejaron.',
  },
  {
    q: '¿Cómo verifico los pagos?',
    a: 'El comprobante aparece en tu panel. Lo apruebas o lo rechazas. No tienes que buscar la captura en el chat.',
  },
  {
    q: '¿Dónde recibo el dinero?',
    a: 'En la cuenta bancaria que tú agregas. El cliente te transfiere a ti. Rifalo no recibe ese dinero ni se queda con la rifa.',
  },
  {
    q: '¿Puedo usar mi propio dominio?',
    a: 'Sí, en el plan Ilimitado. En Gratis y Plus tu rifa vive en tu subdominio.',
  },
  {
    q: '¿Puedo tener varios administradores?',
    a: 'En el plan Ilimitado. Gratis y Plus incluyen un organizador.',
  },
  {
    q: '¿Qué pasa cuando vendo más de 250 boletos?',
    a: 'Esos 250 son para que pruebes de verdad, cada mes. Si llegas al tope, pasas a Plus y sigues vendiendo, hasta 50,000 boletos. Si rifas seguido, Ilimitado no tiene tope.',
  },
  {
    q: '¿Puedo cancelar?',
    a: 'Sí. El plan Gratis no ata a nada. Si activas un plan de pago, lo cancelas desde facturación cuando quieras.',
  },
]

const plans = [
  {
    id: 'free',
    name: 'Gratis',
    price: PLAN_PRICES.free,
    priceLabel: 'Gratis',
    audience: 'Para probar tu primera rifa',
    description: 'Lanza la rifa completa por $0 y mira si vende.',
    highlight: true,
    features: [
      'Tus primeros 250 boletos del mes, gratis',
      'Tu página para vender, con tu marca',
      'Cobros por transferencia a tu cuenta',
      'Ves rifas, compras pendientes y boletos vendidos',
    ],
    cta: 'Crear mi rifa gratis',
    href: '/signup',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: PLAN_PRICES.plus,
    priceLabel: `$${PLAN_PRICES.plus}`,
    audience: 'Para rifas que ya están creciendo',
    description: 'Cuando pasaste los 250 y la rifa sigue moviéndose.',
    highlight: false,
    features: [
      'Hasta 50,000 boletos al mes',
      'La misma página, marca y cobros',
      'Sigues vendiendo sin armar otra cosa',
      'Ves rifas, compras pendientes y boletos vendidos',
    ],
    cta: 'Crear mi rifa gratis',
    href: '/signup',
  },
  {
    id: 'unlimited',
    name: 'Ilimitado',
    price: PLAN_PRICES.unlimited,
    priceLabel: `$${PLAN_PRICES.unlimited}`,
    audience: 'Para quien rifa seguido',
    description: 'Organizaciones que lanzan rifas una y otra vez.',
    highlight: false,
    features: [
      'Boletos sin tope mensual',
      'Tu propio dominio',
      'Ventas por día, no solo el total',
      'Varios administradores',
    ],
    cta: 'Crear mi rifa gratis',
    href: '/signup',
  },
]

export default async function PlatformLandingPage() {
  const catalog = await fetchCatalogRaffles(6)

  return (
    <div className="min-h-screen bg-background font-poppins">
      <PlatformHeader />

      <main>
        <section className="relative overflow-hidden bg-black text-white">
          <div
            className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full blur-3xl"
            style={{ background: 'rgba(255, 208, 0, 0.18)' }}
          />
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-28 grid md:grid-cols-2 gap-10 md:gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Publica tu rifa hoy. Empieza a vender boletos.
              </h1>
              <p className="text-lg text-white/80 max-w-xl">
                Crea la rifa, comparte tu página y cobra por transferencia.
                Los números se asignan solos. Tú apruebas los pagos. Sin
                programador y sin tarjeta.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-[#FFD000] text-black hover:bg-[#F0C400]"
                  asChild
                >
                  <Link href="/signup">
                    Crear mi rifa gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-white/60">
                Empieza gratis · Sin tarjeta · Sin permanencia · Tus primeros 250
                boletos de cada mes son gratis
              </p>
            </div>
            <div className="relative mx-auto h-[200px] w-full min-[400px]:h-[230px] sm:h-[340px]">
              <div className="absolute left-1/2 top-1 flex origin-top -translate-x-1/2 scale-[0.58] items-end justify-center min-[400px]:scale-[0.68] sm:scale-100">
              {showcaseRaffles.map((raffle, index) => (
                <article
                  key={raffle.title}
                  className={`w-52 shrink-0 origin-bottom overflow-hidden rounded-2xl border border-black/10 bg-white text-black shadow-[0_18px_40px_rgba(0,0,0,0.45)] ${
                    index > 0 ? '-ml-20 sm:-ml-24' : ''
                  }`}
                  style={{
                    zIndex: raffle.z,
                    transform: `rotate(${raffle.rotate}deg)`,
                  }}
                >
                  <div className="relative h-32 bg-neutral-200">
                    <img
                      src={raffle.image}
                      alt={raffle.title}
                      className="h-full w-full object-cover"
                    />
                    <span
                      className="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black"
                      style={{ background: GOLD }}
                    >
                      Rifa
                    </span>
                  </div>
                  <div className={`space-y-1.5 p-3 ${index === 2 ? 'text-right' : ''}`}>
                    <div>
                      <h3 className="text-sm font-bold leading-tight">{raffle.title}</h3>
                      <p className="text-xs text-neutral-500">{raffle.detail}</p>
                    </div>
                    <div className={`flex items-baseline justify-between gap-2 ${index === 2 ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm font-bold">{raffle.price}</span>
                      <span className="text-[10px] text-neutral-500">por boleto</span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${raffle.sold}%`, background: GOLD }}
                        />
                      </div>
                      <p className="text-right text-[10px] text-neutral-500">{raffle.sold}% vendido</p>
                    </div>
                  </div>
                </article>
              ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b">
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl space-y-2">
                <h2 className="text-3xl font-bold text-[#111111]">
                  Rifas que ya están en Rifalo
                </h2>
                <p className="text-muted-foreground">
                  Organizaciones reales, con su propia página para vender boletos.
                </p>
              </div>
              {catalog.length > 0 && (
                <Button variant="outline" className="border-black/15" asChild>
                  <Link href="/explore">
                    Ver todas
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
            {catalog.length > 0 ? (
              <CatalogGrid raffles={catalog} />
            ) : (
              <div className="rounded-2xl border bg-card px-6 py-12 text-center space-y-3">
                <p className="font-semibold text-[#111111]">Todavía no hay rifas públicas</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Sé de los primeros en publicar la tuya.
                </p>
                <Button className="bg-[#FFD000] text-black hover:bg-[#F0C400]" asChild>
                  <Link href="/signup">Crear mi rifa gratis</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-20">
          <div className="max-w-2xl mb-10 space-y-3">
            <h2 className="text-3xl font-bold text-[#111111]">
              Deja de rifar por WhatsApp, Excel y capturas.
            </h2>
            <p className="text-muted-foreground">
              Si hoy anotas números en una hoja y persigues comprobantes en el
              chat, esto reemplaza ese desorden. Tú te quedas con la rifa y con
              el dinero.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {contrasts.map((item) => (
              <div key={item.before} className="rounded-xl border bg-card p-5 space-y-2">
                <p className="text-sm text-muted-foreground line-through decoration-black/30">
                  {item.before}
                </p>
                <p className="font-semibold text-[#111111]">{item.after}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 border-y">
          <div className="max-w-6xl mx-auto px-4 py-20">
            <div className="text-center mb-12 space-y-3">
              <h2 className="text-3xl font-bold text-[#111111]">
                Todo lo que hace falta para vender
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                La página, el cobro, los números y el control. Sin armar nada de eso tú.
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
                    <div className="h-10 w-10 rounded-lg bg-[#FFD000]/20 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-black" />
                    </div>
                    <h3 className="font-semibold text-[#111111]">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#111111]">Así de simple</h2>
            <p className="text-muted-foreground mt-3">
              Escribes la rifa. La publicas. Compartes el enlace. Vendes.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s) => (
              <div key={s.n} className="text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-[#FFD000] text-black flex items-center justify-center font-bold text-lg">
                  {s.n}
                </div>
                <h3 className="font-semibold text-lg text-[#111111]">{s.title}</h3>
                <p className="text-muted-foreground text-sm">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="planes" className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl font-bold text-[#111111]">
              Lanza la primera rifa gratis 
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Sin tarjeta. Sin permanencia. Prueba la rifa completa antes de
              pagar. Si vende, el software sigue siendo una fracción del volumen.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border bg-card p-6 flex flex-col space-y-5 shadow-sm ${
                  plan.highlight
                    ? 'border-[#FFD000] ring-2 ring-[#FFD000]/20'
                    : ''
                }`}
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {plan.audience}
                  </p>
                  <p className="text-sm font-semibold text-black">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#111111]">
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
                      <Check className="h-4 w-4 text-black mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={
                    plan.highlight
                      ? 'bg-[#FFD000] text-black hover:bg-[#F0C400]'
                      : 'bg-[#111111] text-white hover:bg-black'
                  }
                  asChild
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 border-y">
          <div className="max-w-3xl mx-auto px-4 py-20">
            <h2 className="text-3xl font-bold text-[#111111] mb-8">
              Antes de crear tu rifa
            </h2>
            <dl className="divide-y">
              {faqs.map((item) => (
                <div key={item.q} className="py-5 space-y-2">
                  <dt className="font-semibold text-[#111111]">{item.q}</dt>
                  <dd className="text-sm text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
          <h2 className="text-3xl font-bold text-[#111111]">
            Tu rifa puede estar en línea hoy.
          </h2>
          <p className="text-muted-foreground">
            Crea la rifa, comparte el link y empieza a vender. Sin tarjeta.
            Sin programador.
          </p>
          <Button size="lg" className="bg-[#FFD000] text-black hover:bg-[#F0C400]" asChild>
            <Link href="/signup">
              Publicar mi primera rifa
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>{PLATFORM.copyright}</p>
        <p className="mt-1">
          <a href={`mailto:${PLATFORM.email}`} className="hover:text-black">
            {PLATFORM.email}
          </a>
        </p>
      </footer>
    </div>
  )
}
