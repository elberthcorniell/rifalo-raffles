import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserOrgs } from '@/lib/tenant'
import { getTenantUrl } from '@/lib/constants'
import { orgAdminPath } from '@/lib/onboarding'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const orgs = await getUserOrgs(user.id)
    return NextResponse.json({
      success: true,
      data: orgs.map((o) => ({
        id: o.id,
        slug: o.slug,
        name: o.name,
        adminUrl: getTenantUrl(o.slug, orgAdminPath(o)),
        url: getTenantUrl(o.slug),
        onboardingCompleted: Boolean(o.onboarding_completed_at),
      })),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Error' }, { status: 500 })
  }
}
