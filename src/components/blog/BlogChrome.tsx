import Link from 'next/link'
import { PLATFORM } from '@/lib/constants'
import { PlatformHeader } from '@/components/platform/PlatformHeader'

export function BlogChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <PlatformHeader />
      {children}
      <footer className="border-t py-8 text-center text-sm text-[#6b7280]">
        <p>{PLATFORM.copyright}</p>
        <p className="mt-2 flex items-center justify-center gap-3">
          <Link href="/blog" className="hover:text-black">
            Blog
          </Link>
          <a href={`mailto:${PLATFORM.email}`} className="hover:text-black">
            {PLATFORM.email}
          </a>
        </p>
      </footer>
    </div>
  )
}
