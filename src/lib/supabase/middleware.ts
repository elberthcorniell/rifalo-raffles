import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  isValidSlug,
  RESERVED_SLUGS,
} from '@/lib/constants'
import { orgAdminPath, ONBOARDING_PATH } from '@/lib/onboarding'
import { ORG_ID_HEADER, ORG_SLUG_HEADER, PATHNAME_HEADER, parseHost } from '@/lib/tenant-host'
import { isSuperadminEmail, isSuperadminPath } from '@/lib/superadmin'
import { effectiveOrgPlan } from '@/lib/billing'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>

type TenantOrg = {
  id: string
  slug: string
  onboarding_completed_at: string | null
}

/** Left-most label, ignoring a leading www. Used when the host is not a known tenant subdomain. */
function assumeTenantSlug(host: string): string | null {
  const bare = host.replace(/^www\./, '')
  const [label, ...rest] = bare.split('.')
  if (!label || rest.length === 0) return null
  return label
}

async function lookupOrgByCustomDomain(service: ServiceClient, host: string): Promise<TenantOrg | null> {
  const domains = host.startsWith('www.') ? [host, host.slice(4)] : [host]
  for (const domain of domains) {
    const { data } = await service
      .from('organizations')
      .select('id, slug, plan, plan_override, custom_domain, onboarding_completed_at')
      .eq('custom_domain', domain)
      .maybeSingle()

    if (data && effectiveOrgPlan(data) === 'unlimited') return data
  }
  return null
}

async function lookupOrgBySlug(service: ServiceClient, slug: string): Promise<TenantOrg | null> {
  if (!isValidSlug(slug) || (RESERVED_SLUGS as readonly string[]).includes(slug)) return null
  const { data } = await service
    .from('organizations')
    .select('id, slug, onboarding_completed_at')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

/** Preserve subdomain when redirecting (nextUrl may use the bind host). */
function tenantRedirect(request: NextRequest, pathname: string, search?: Record<string, string>) {
  const host = request.headers.get('host') || 'localhost:3000'
  const proto = host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https'
  const url = new URL(`${proto}://${host}${pathname}`)
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      url.searchParams.set(k, v)
    }
  }
  return NextResponse.redirect(url)
}

async function continueAsTenant(
  request: NextRequest,
  requestHeaders: Headers,
  pathname: string,
  service: ServiceClient,
  org: TenantOrg
) {
  requestHeaders.set(ORG_ID_HEADER, org.id)
  requestHeaders.set(ORG_SLUG_HEADER, org.slug)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdminRoute = pathname.startsWith('/admin')
  const isLoginRoute = pathname === '/admin/login'
  const isOnboardingRoute = pathname === ONBOARDING_PATH

  if (isAdminRoute && !isLoginRoute) {
    if (!user) {
      return tenantRedirect(request, '/admin/login', { next: pathname })
    }

    const { data: membership } = await service
      .from('org_members')
      .select('role')
      .eq('org_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return tenantRedirect(request, '/admin/login', { error: 'unauthorized' })
    }

    if (!isOnboardingRoute && !org.onboarding_completed_at) {
      return tenantRedirect(request, ONBOARDING_PATH)
    }
  }

  if (isLoginRoute && user) {
    const { data: membership } = await service
      .from('org_members')
      .select('role')
      .eq('org_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) {
      return tenantRedirect(request, orgAdminPath(org))
    }
  }

  if (
    pathname.startsWith('/platform') ||
    pathname.startsWith('/superadmin') ||
    pathname === '/signup' ||
    pathname === '/login'
  ) {
    return new NextResponse('Not Found', { status: 404 })
  }

  return supabaseResponse
}

/** Apex and any host that does not resolve to an organization. */
async function continueAsPlatform(
  request: NextRequest,
  requestHeaders: Headers,
  pathname: string
) {
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let user: { email?: string | null } | null = null
  if (url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
    } catch {
      user = null
    }
  }

  // Rewrite home and auth pages under /platform (URL stays / , /signup, /login)
  if (pathname === '/' || pathname === '') {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = '/platform'
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    })
  }

  if (pathname === '/signup' || pathname === '/login') {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = `/platform${pathname}`
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    })
  }

  if (isSuperadminPath(pathname)) {
    if (!user) {
      return tenantRedirect(request, '/login', { next: '/superadmin' })
    }
    if (!isSuperadminEmail(user.email)) {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = '/platform/not-found'
      return NextResponse.rewrite(rewriteUrl)
    }
    return supabaseResponse
  }

  // Block tenant-only routes on the platform site
  if (pathname.startsWith('/admin') || pathname.startsWith('/raffles') || pathname.startsWith('/verify-tickets')) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = '/platform/not-found'
    return NextResponse.rewrite(rewriteUrl)
  }

  return supabaseResponse
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip static assets (but never skip `/`)
  if (
    pathname !== '/' &&
    (pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname))
  ) {
    return NextResponse.next({ request })
  }

  const hostname = request.headers.get('host') || 'localhost:3000'
  const resolved = parseHost(hostname)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(PATHNAME_HEADER, pathname)

  const service = resolved.kind === 'apex' ? null : createServiceClient()
  if (service) {
    const orgFromDomain = await lookupOrgByCustomDomain(service, resolved.host)
    if (orgFromDomain) {
      return continueAsTenant(request, requestHeaders, pathname, service, orgFromDomain)
    }

    const slug =
      resolved.kind === 'tenant' && resolved.slug ? resolved.slug : assumeTenantSlug(resolved.host)
    const org = slug ? await lookupOrgBySlug(service, slug) : null
    if (org) {
      return continueAsTenant(request, requestHeaders, pathname, service, org)
    }
  }

  return continueAsPlatform(request, requestHeaders, pathname)
}
