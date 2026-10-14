import { headers } from 'next/headers'
import { AdminShell } from '@/components/admin/AdminShell'
import { PATHNAME_HEADER } from '@/lib/tenant-host'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { parseQuotaRow, type TicketQuota } from '@/lib/billing'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get(PATHNAME_HEADER) || ''
  if (pathname === '/admin/login' || pathname === '/admin/onboarding') {
    return children
  }

  let quota: TicketQuota | null = null
  let email: string | null = null
  const auth = await requireOrgAdmin()
  if (!('error' in auth)) {
    email = auth.user.email ?? null
    const { data } = await auth.admin.rpc('org_ticket_quota', { p_org_id: auth.org.id })
    quota = parseQuotaRow(data)
  }

  return (
    <AdminShell initialQuota={quota} email={email}>
      {children}
    </AdminShell>
  )
}
