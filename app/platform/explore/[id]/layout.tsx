import { redirect } from 'next/navigation'
import { PlatformHeader } from '@/components/platform/PlatformHeader'
import { SHOW_EXPLORE } from '@/lib/constants'

export default function ExploreRaffleLayout({ children }: { children: React.ReactNode }) {
  if (!SHOW_EXPLORE) redirect('/')

  return (
    <div className="min-h-screen bg-background font-poppins pb-24 md:pb-0">
      <PlatformHeader />
      {children}
    </div>
  )
}
