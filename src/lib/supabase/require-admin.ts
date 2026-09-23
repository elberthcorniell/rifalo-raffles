import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getOrgFromHeaders, userBelongsToOrg } from '@/lib/tenant'
import type { Organization } from '@/types/org'
import type { User, SupabaseClient } from '@supabase/supabase-js'

type AuthSuccess = {
  user: User
  org: Organization
  admin: ReturnType<typeof createAdminClient>
  supabase: SupabaseClient
}

type AuthFailure = { error: NextResponse }

export async function requireOrgAdmin(): Promise<AuthSuccess | AuthFailure> {
  const org = await getOrgFromHeaders()
  if (!org) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      ),
    }
  }

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

  const { belongs } = await userBelongsToOrg(user.id, org.id)
  if (!belongs) {
    return {
      error: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 }),
    }
  }

  return { user, org, supabase, admin: createAdminClient() }
}
