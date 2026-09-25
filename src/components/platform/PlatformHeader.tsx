import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlatformLogo } from '@/components/platform/PlatformLogo'

export function PlatformHeader() {
  return (
    <header className="border-b border-white/10 bg-black sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link href="/" aria-label="Rifalo" className="shrink-0">
          <span className="sm:hidden">
            <PlatformLogo height={26} />
          </span>
          <span className="hidden sm:inline-block">
            <PlatformLogo height={34} />
          </span>
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-2">
          <Button variant="ghost" size="sm" className="px-2 text-white hover:bg-white/10 hover:text-white sm:px-3" asChild>
            <Link href="/explore">Explorar</Link>
          </Button>
          <Button variant="ghost" size="sm" className="px-2 text-white hover:bg-white/10 hover:text-white sm:px-3" asChild>
            <Link href="/login">
              <span className="sm:hidden">Entrar</span>
              <span className="hidden sm:inline">Iniciar sesión</span>
            </Link>
          </Button>
          <Button size="sm" className="bg-[#FFD000] px-2.5 text-black hover:bg-[#F0C400] sm:px-3" asChild>
            <Link href="/signup">
              <span className="sm:hidden">Crear</span>
              <span className="hidden sm:inline">Crear mi rifa</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
