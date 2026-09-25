import type { Metadata } from 'next'
import { getPlatformUrl } from '@/lib/constants'
import { PlatformLogo } from '@/components/platform/PlatformLogo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Esta página no existe',
  description: 'Esta página de rifas no existe, pero puede ser tuya.',
}

export default function MissingOrgPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center">
          <PlatformLogo height={32} />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg text-center">
          <p className="text-[#FFD000] font-semibold tracking-wide uppercase text-sm">Ups</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight">
            Esta página de rifas no existe
          </h1>
          <p className="mt-4 text-lg text-white/70">
            Pero puede ser tuya. Crea tu página, publica tu rifa y compártela.
          </p>
          <Button
            className="mt-8 bg-[#FFD000] text-black hover:bg-[#F0C400]"
            asChild
          >
            <a href={getPlatformUrl('/')}>Saber más</a>
          </Button>
        </div>
      </main>
    </div>
  )
}
