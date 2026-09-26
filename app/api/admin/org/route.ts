import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { effectiveOrgPlan } from '@/lib/billing'
import { getOrgBrand } from '@/lib/tenant'
import { isHexColor, normalizeHexColor } from '@/lib/colors'
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  normalizeCheckoutFields,
  normalizeOrgTheme,
  normalizeThemeColors,
} from '@/types/org'
import { isSiteFont } from '@/lib/fonts'
import { customDomainError, normalizeCustomDomain } from '@/lib/custom-domain'
import {
  describeCustomDomain,
  provisionCustomDomain,
  releaseCustomDomain,
  vercelDomainErrorMessage,
  vercelDomainsMode,
} from '@/lib/vercel-domains'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { org } = auth
  return NextResponse.json({
    success: true,
    data: {
      org: { ...org, plan: effectiveOrgPlan(org) },
      brand: getOrgBrand(org),
    },
  })
}

function cleanUrl(value: unknown): string | null {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (!s) return null
  if (s === '#') return null
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    return u.toString()
  } catch {
    return s
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  let previousDomain: string | null = null
  let attachedDomain: string | null = null
  let domainTouched = false
  if (body.name != null) updates.name = String(body.name).trim()
  if (body.tagline != null) updates.tagline = String(body.tagline)
  if (body.email !== undefined) updates.email = body.email || null
  if (body.phone !== undefined) updates.phone = body.phone || null
  if (body.adminEmail !== undefined) updates.admin_email = body.adminEmail || null
  if (body.logoPath !== undefined) updates.logo_path = body.logoPath || null
  if (body.location !== undefined) updates.location = body.location || null
  if (body.facebookUrl !== undefined) updates.facebook_url = cleanUrl(body.facebookUrl)
  if (body.instagramUrl !== undefined) updates.instagram_url = cleanUrl(body.instagramUrl)
  if (body.twitterUrl !== undefined) updates.twitter_url = cleanUrl(body.twitterUrl)

  if (body.primaryColor != null) {
    const c = normalizeHexColor(String(body.primaryColor), DEFAULT_PRIMARY_COLOR)
    if (!isHexColor(c)) {
      return NextResponse.json(
        { success: false, error: 'Color primario inválido (usa #RRGGBB)' },
        { status: 400 }
      )
    }
    updates.primary_color = c
  }
  if (body.secondaryColor != null) {
    const c = normalizeHexColor(String(body.secondaryColor), DEFAULT_SECONDARY_COLOR)
    if (!isHexColor(c)) {
      return NextResponse.json(
        { success: false, error: 'Color de acento inválido (usa #RRGGBB)' },
        { status: 400 }
      )
    }
    updates.secondary_color = c
  }
  if (body.theme != null) {
    updates.theme = normalizeOrgTheme(body.theme)
  }
  if (body.themeColors != null) {
    updates.theme_colors = normalizeThemeColors(body.themeColors)
  }
  if (body.showHeroCopy != null) {
    updates.show_hero_copy = body.showHeroCopy === true
  }
  if (body.showHowItWorks != null) {
    updates.show_how_it_works = body.showHowItWorks === true
  }
  if (body.showRaffles != null) {
    updates.show_raffles = body.showRaffles === true
  }
  if (body.showTrustBenefits != null) {
    updates.show_trust_benefits = body.showTrustBenefits === true
  }
  if (body.showTestimonials != null) {
    updates.show_testimonials = body.showTestimonials === true
  }
  if (body.footerBgColor != null) {
    const c = normalizeHexColor(String(body.footerBgColor), DEFAULT_PRIMARY_COLOR)
    if (!isHexColor(c)) {
      return NextResponse.json(
        { success: false, error: 'Color de fondo del footer inválido (usa #RRGGBB)' },
        { status: 400 }
      )
    }
    updates.footer_bg_color = c
  }
  if (body.footerTextColor != null) {
    const c = normalizeHexColor(String(body.footerTextColor), '#FFFFFF')
    if (!isHexColor(c)) {
      return NextResponse.json(
        { success: false, error: 'Color de texto del footer inválido (usa #RRGGBB)' },
        { status: 400 }
      )
    }
    updates.footer_text_color = c
  }
  if (body.headingFont != null) {
    const font = String(body.headingFont).trim()
    if (!isSiteFont(font)) {
      return NextResponse.json(
        { success: false, error: 'Fuente de títulos no permitida' },
        { status: 400 }
      )
    }
    updates.heading_font = font
  }
  if (body.bodyFont != null) {
    const font = String(body.bodyFont).trim()
    if (!isSiteFont(font)) {
      return NextResponse.json(
        { success: false, error: 'Fuente de párrafos no permitida' },
        { status: 400 }
      )
    }
    updates.body_font = font
  }
  if (body.checkoutFields != null) {
    updates.checkout_fields = normalizeCheckoutFields(body.checkoutFields)
  }

  if (body.customDomain !== undefined) {
    domainTouched = true
    const { effectiveOrgPlan } = await import('@/lib/billing')
    const plan = effectiveOrgPlan(org)
    if (plan !== 'unlimited' && body.customDomain) {
      return NextResponse.json(
        {
          success: false,
          error: 'El dominio personalizado está disponible en el plan Ilimitado.',
        },
        { status: 403 }
      )
    }
    const domain = normalizeCustomDomain(body.customDomain)
    if (domain) {
      const invalid = customDomainError(domain)
      if (invalid) {
        return NextResponse.json({ success: false, error: invalid }, { status: 400 })
      }
    }
    previousDomain = normalizeCustomDomain(org.custom_domain)
    if (domain && domain !== previousDomain) {
      const { data: taken } = await admin
        .from('organizations')
        .select('id')
        .eq('custom_domain', domain)
        .neq('id', org.id)
        .maybeSingle()
      if (taken) {
        return NextResponse.json(
          { success: false, error: 'Ese dominio ya está en uso.' },
          { status: 409 }
        )
      }
    }
    const mode = vercelDomainsMode()
    if (domain && mode === 'missing') {
      return NextResponse.json(
        {
          success: false,
          error: 'Falta VERCEL_TOKEN para registrar el dominio y emitir HTTPS.',
        },
        { status: 503 }
      )
    }
    if (domain && mode === 'ready') {
      try {
        await provisionCustomDomain(domain)
        if (domain !== previousDomain) attachedDomain = domain
      } catch (error) {
        console.error('provisionCustomDomain', error instanceof Error ? error.message : error)
        return NextResponse.json(
          { success: false, error: vercelDomainErrorMessage(error) },
          { status: 502 }
        )
      }
    }
    updates.custom_domain = domain
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('organizations')
    .update(updates)
    .eq('id', org.id)
    .select('*')
    .single()

  if (error) {
    if (attachedDomain) {
      await releaseCustomDomain(attachedDomain).catch((releaseError) => {
        console.error('releaseCustomDomain', releaseError instanceof Error ? releaseError.message : releaseError)
      })
    }
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Ese dominio ya está en uso.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const savedDomain = normalizeCustomDomain(data.custom_domain)
  if (previousDomain && previousDomain !== savedDomain && vercelDomainsMode() === 'ready') {
    await releaseCustomDomain(previousDomain).catch((releaseError) => {
      console.error('releaseCustomDomain', releaseError instanceof Error ? releaseError.message : releaseError)
    })
  }

  const domainStatus = domainTouched ? await describeCustomDomain(savedDomain) : null

  return NextResponse.json({
    success: true,
    data: {
      org: data,
      brand: getOrgBrand(data),
      domainStatus,
    },
  })
}
