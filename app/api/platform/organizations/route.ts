import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getTenantUrl,
  isValidSlug,
  RESERVED_SLUGS,
  slugifyOrgName,
} from '@/lib/constants'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Debes iniciar sesión para crear una organización' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const name = String(body.name || '').trim()
    let slug = String(body.slug || '').trim().toLowerCase()

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'El nombre de la organización es requerido' },
        { status: 400 }
      )
    }

    if (!slug) {
      slug = slugifyOrgName(name)
    }

    if (!isValidSlug(slug)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Slug inválido. Usa 3–32 caracteres: letras minúsculas, números y guiones.',
        },
        { status: 400 }
      )
    }

    if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
      return NextResponse.json(
        { success: false, error: 'Este subdominio está reservado' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Este subdominio ya está en uso' },
        { status: 409 }
      )
    }

    const adminEmail = user.email || null

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        slug,
        name,
        tagline: '',
        email: adminEmail,
        admin_email: adminEmail,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (orgError) {
      console.error('Create org error:', orgError)
      return NextResponse.json(
        { success: false, error: orgError.message || 'Error al crear la organización' },
        { status: 500 }
      )
    }

    const { error: memberError } = await admin.from('org_members').insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner',
    })

    if (memberError) {
      await admin.from('organizations').delete().eq('id', org.id)
      console.error('Create membership error:', memberError)
      return NextResponse.json(
        { success: false, error: 'Error al asignar permisos' },
        { status: 500 }
      )
    }

    const adminUrl = getTenantUrl(slug, '/admin/onboarding')

    return NextResponse.json({
      success: true,
      data: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        adminUrl,
        url: getTenantUrl(slug),
      },
    })
  } catch (error) {
    console.error('Platform create org error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear la organización' },
      { status: 500 }
    )
  }
}
