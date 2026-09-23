import { redirect, notFound } from 'next/navigation'
import { SuperadminShell } from '@/components/superadmin/SuperadminShell'
import { requirePlatformAdmin } from '@/lib/supabase/require-platform-admin'

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
