import type { SupabaseClient } from '@supabase/supabase-js'
import { selectReminderRecipients } from '@/lib/emails/recipients'

export async function loadOrgOwnerEmails(
  admin: SupabaseClient,
  orgId: string,
  fallbacks: Array<string | null | undefined> = [],
): Promise<string[]> {
  const { data, error } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'owner')

  if (error) throw error

  const owners: string[] = []
  for (const member of data ?? []) {
    const userId = member.user_id as string | null
    if (!userId) continue
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
      if (userError) continue
      if (userData.user?.email) owners.push(userData.user.email)
    } catch {
      // One unreadable account should not block the others.
    }
  }

  return selectReminderRecipients(owners, fallbacks)
}
