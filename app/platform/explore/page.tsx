import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchCatalogRaffles } from '@/lib/raffle-catalog'
import { PlatformHeader } from '@/components/platform/PlatformHeader'
import { CatalogGrid } from '@/components/platform/CatalogGrid'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Explorar rifas',
  description: 'Rifas que las organizaciones publican en Rifalo.',
}

export default async function ExplorePage() {
  const raffles = await fetchCatalogRaffles(60)

  return (
    <div className="min-h-screen bg-background font-poppins">
      <PlatformHeader />
      <main className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="mb-10 max-w-2xl space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-[#111111]">Rifas de nuestros clientes</h1>
          <p className="text-muted-foreground">
            Un catálogo de las rifas que las organizaciones publican en su propio sitio.
          </p>
        </div>
        {raffles.length > 0 ? (
          <CatalogGrid raffles={raffles} />
        ) : (
          <div className="rounded-2xl border bg-card px-6 py-16 text-center space-y-4">
            <p className="text-lg font-semibold text-[#111111]">Todavía no hay rifas</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Cuando un cliente publique una rifa, va a aparecer aquí con su premio, el precio del
              boleto y cuánto se vendió.
            </p>
            <Button className="bg-[#FFD000] text-black hover:bg-[#F0C400]" asChild>
              <Link href="/signup">Crear la primera</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
