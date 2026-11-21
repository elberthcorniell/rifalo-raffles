import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { SuperadminShell } from '@/components/superadmin/SuperadminShell'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requirePlatformAdmin()
  if ('error' in auth) {
    if (auth.error.status === 401) {
      redirect('/login?next=/superadmin')
    }
    notFound()
  }

  return <SuperadminShell email={auth.user.email}>{children}</SuperadminShell>
}
