import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isSuperadminEmail } from '@/lib/superadmin'
import type { User, SupabaseClient } from '@supabase/supabase-js'

type AuthSuccess = {
  user: User
  admin: ReturnType<typeof createAdminClient>
  supabase: SupabaseClient
}

type AuthFailure = { error: NextResponse }

export async function requirePlatformAdmin(): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      error: NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 }),
    }
  }

  if (!isSuperadminEmail(user.email)) {
    return {
      error: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 }),
    }
  }

  return { user, supabase, admin: createAdminClient() }
}
