import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { fetchCatalogRaffles } from '@/lib/raffle-catalog'
import { PlatformHeader } from '@/components/platform/PlatformHeader'
import { CatalogGrid } from '@/components/platform/CatalogGrid'
import { Button } from '@/components/ui/button'
import { SHOW_EXPLORE } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Rifas verificadas',
  description:
    'Rifas cuyo premio confirmamos y cuyo organizador es de confianza. Compra en Rifalo o en el sitio del organizador.',
}

export default async function ExplorePage() {
  if (!SHOW_EXPLORE) redirect('/')

  const raffles = await fetchCatalogRaffles(60)

  return (
    <div className="min-h-screen bg-background font-poppins">
      <PlatformHeader />
      <main className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="mb-10 max-w-2xl space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-[#111111]">Rifas verificadas</h1>
          <p className="text-muted-foreground">
            Premios que revisamos y organizadores en los que confiamos. Puedes comprar aquí o en el
            sitio de cada organización; el pago va a sus cuentas bancarias.
          </p>
        </div>
        {raffles.length > 0 ? (
          <CatalogGrid raffles={raffles} />
        ) : (
          <div className="rounded-2xl border bg-card px-6 py-16 text-center space-y-4">
            <p className="text-lg font-semibold text-[#111111]">Todavía no hay rifas verificadas</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Cuando un organizador solicite verificación y la aprobemos, su rifa aparecerá aquí.
            </p>
            <Button className="bg-[#FFD000] text-black hover:bg-[#F0C400]" asChild>
              <Link href="/signup">Crear mi rifa</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
