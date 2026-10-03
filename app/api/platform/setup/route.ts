import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserOrgs } from '@/lib/tenant'
import {
  getTenantUrl,
  isValidSlug,
  RESERVED_SLUGS,
  slugifyOrgName,
} from '@/lib/constants'
import { orgAdminPath } from '@/lib/onboarding'
import { isHexColor, normalizeHexColor } from '@/lib/colors'
import {
  DEFAULT_ORG_SITE_SECTIONS,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  normalizeOrgTheme,
  type Organization,
} from '@/types/org'

function text(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function imageFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  if (!value || typeof value === 'string') return null
  if (value.size === 0) return null
  return value
}

async function uploadImage(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Sube un archivo de imagen')
  }
  const rawExt = file.name.split('.').pop() || 'jpg'
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${orgId}/${Date.now()}_${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await admin.storage.from('raffle-images').upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

function setupPayload(org: Organization, raffle: { id: string; title: string }) {
  return {
    slug: org.slug,
    name: org.name,
    adminUrl: getTenantUrl(org.slug, orgAdminPath({ ...org, onboarding_completed_at: org.onboarding_completed_at || new Date().toISOString() })),
    siteUrl: getTenantUrl(org.slug),
    raffleUrl: getTenantUrl(org.slug, `/raffles/${raffle.id}`),
    raffleId: raffle.id,
    raffleTitle: raffle.title,
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Debes crear tu cuenta para publicar la rifa' },
        { status: 401 }
      )
    }

    const form = await request.formData()
    const name = text(form, 'name')
    let slug = text(form, 'slug').toLowerCase()
    const primaryColor = normalizeHexColor(text(form, 'primaryColor'), DEFAULT_PRIMARY_COLOR)
    const secondaryColor = normalizeHexColor(text(form, 'secondaryColor'), DEFAULT_SECONDARY_COLOR)
    const theme = normalizeOrgTheme(text(form, 'theme') || 'light')
    const bankName = text(form, 'bankName')
    const accountNumber = text(form, 'accountNumber')
    const accountType = text(form, 'accountType') || 'Ahorros'
    const holderName = text(form, 'holderName')
    const raffleTitle = text(form, 'raffleTitle')
    const raffleDescription = text(form, 'raffleDescription')
    const ticketPrice = Number(text(form, 'ticketPrice'))
    const rangeEnd = parseInt(text(form, 'rangeEnd'), 10)
    const endDateRaw = text(form, 'endDate')
    const logo = imageFile(form, 'logo')
    const raffleImage = imageFile(form, 'raffleImage')

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'El nombre de la organización es requerido' },
        { status: 400 }
      )
    }
    if (!slug) slug = slugifyOrgName(name)
    if (!isValidSlug(slug) || (RESERVED_SLUGS as readonly string[]).includes(slug)) {
      return NextResponse.json(
        { success: false, error: 'Subdominio inválido. Usa 3–32 caracteres: letras, números y guiones.' },
        { status: 400 }
      )
    }
    if (!isHexColor(primaryColor) || !isHexColor(secondaryColor)) {
      return NextResponse.json(
        { success: false, error: 'Usa colores en formato #RRGGBB' },
        { status: 400 }
      )
    }
    if (!bankName || !accountNumber) {
      return NextResponse.json(
        { success: false, error: 'Completa los datos de la cuenta para cobrar' },
        { status: 400 }
      )
    }
    if (!raffleTitle || !Number.isFinite(ticketPrice) || ticketPrice < 0) {
      return NextResponse.json(
        { success: false, error: 'Título y precio de la rifa son requeridos' },
        { status: 400 }
      )
    }
    if (!Number.isFinite(rangeEnd) || rangeEnd < 1) {
      return NextResponse.json(
        { success: false, error: 'Indica cuántos boletos tendrá la rifa' },
        { status: 400 }
      )
    }

    let endDate: string | null = null
    if (endDateRaw) {
      const parsed = new Date(endDateRaw)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { success: false, error: 'La fecha de cierre no es válida' },
          { status: 400 }
        )
      }
      endDate = parsed.toISOString()
    }

    const admin = createAdminClient()
    const existingOrgs = await getUserOrgs(user.id)
    let org = existingOrgs[0] ?? null

    if (org?.onboarding_completed_at) {
      const { data: raffles } = await admin
        .from('raffles')
        .select('id, title')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const raffle = raffles?.[0]
      if (raffle) {
        return NextResponse.json({
          success: true,
          data: { ...setupPayload(org, raffle), already: true },
        })
      }
    }

    if (!org) {
      const { data: taken } = await admin
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      if (taken) {
        return NextResponse.json(
          { success: false, error: 'Este subdominio ya está en uso' },
          { status: 409 }
        )
      }

      const adminEmail = user.email || null
      const { data: created, error: orgError } = await admin
        .from('organizations')
        .insert({
          slug,
          name,
          tagline: '',
          email: adminEmail,
          admin_email: adminEmail,
          created_by: user.id,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          theme,
          ...DEFAULT_ORG_SITE_SECTIONS,
        })
        .select('*')
        .single()

      if (orgError || !created) {
        return NextResponse.json(
          { success: false, error: orgError?.message || 'Error al crear la organización' },
          { status: 500 }
        )
      }

      const { error: memberError } = await admin.from('org_members').insert({
        org_id: created.id,
        user_id: user.id,
        role: 'owner',
      })

      if (memberError) {
        await admin.from('organizations').delete().eq('id', created.id)
        return NextResponse.json(
          { success: false, error: 'Error al asignar permisos' },
          { status: 500 }
        )
      }

      org = created as Organization
    }

    const updates: Record<string, unknown> = {
      name,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      theme,
    }

    if (logo) {
      try {
        updates.logo_path = await uploadImage(admin, org.id, logo)
      } catch (err) {
        return NextResponse.json(
          { success: false, error: err instanceof Error ? err.message : 'Error al subir el logo' },
          { status: 400 }
        )
      }
    }

    const { data: updated, error: updateError } = await admin
      .from('organizations')
      .update(updates)
      .eq('id', org.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return NextResponse.json(
        { success: false, error: updateError?.message || 'Error al guardar la organización' },
        { status: 500 }
      )
    }
    org = updated as Organization

    const { count: bankCount } = await admin
      .from('bank_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)

    if (!bankCount) {
      const { error: bankError } = await admin.from('bank_accounts').insert({
        org_id: org.id,
        name: bankName,
        bank: bankName,
        account_number: accountNumber,
        account_type: accountType,
        holder_name: holderName || null,
        currency: 'DOP',
        is_active: true,
      })
      if (bankError) {
        return NextResponse.json(
          { success: false, error: bankError.message || 'Error al guardar la cuenta' },
          { status: 500 }
        )
      }
    }

    const { data: existingRaffles } = await admin
      .from('raffles')
      .select('id, title')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(1)

    let raffle = existingRaffles?.[0] ?? null

    if (!raffle) {
      let imagePath: string | null = null
      if (raffleImage) {
        try {
          imagePath = await uploadImage(admin, org.id, raffleImage)
        } catch (err) {
          return NextResponse.json(
            {
              success: false,
              error: err instanceof Error ? err.message : 'Error al subir la imagen del premio',
            },
            { status: 400 }
          )
        }
      }

      const { data: createdRaffle, error: raffleError } = await admin
        .from('raffles')
        .insert({
          org_id: org.id,
          title: raffleTitle,
          description: raffleDescription,
          ticket_price: ticketPrice,
          min_tickets: 1,
          end_date: endDate,
          featured: true,
          status: 'active',
          image_path: imagePath,
        })
        .select('id, title')
        .single()

      if (raffleError || !createdRaffle) {
        return NextResponse.json(
          { success: false, error: raffleError?.message || 'Error al crear la rifa' },
          { status: 500 }
        )
      }

      const { error: rangeError } = await admin.rpc('generate_ticket_range', {
        p_raffle_id: createdRaffle.id,
        p_start: 1,
        p_end: rangeEnd,
      })

      if (rangeError) {
        await admin.from('raffles').delete().eq('id', createdRaffle.id)
        return NextResponse.json(
          { success: false, error: rangeError.message || 'Error al generar los boletos' },
          { status: 400 }
        )
      }

      raffle = createdRaffle
    }

    if (!org.onboarding_completed_at) {
      const completedAt = new Date().toISOString()
      const { error: doneError } = await admin
        .from('organizations')
        .update({ onboarding_completed_at: completedAt })
        .eq('id', org.id)

      if (doneError) {
        return NextResponse.json({ success: false, error: doneError.message }, { status: 500 })
      }
      org = { ...org, onboarding_completed_at: completedAt }
    }

    return NextResponse.json({ success: true, data: setupPayload(org, raffle) })
  } catch (error) {
    console.error('Platform setup error:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo publicar la rifa' },
      { status: 500 }
    )
  }
}
