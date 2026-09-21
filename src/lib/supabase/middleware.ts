import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  isValidSlug,
  RESERVED_SLUGS,
} from '@/lib/constants'
import { orgAdminPath, ONBOARDING_PATH } from '@/lib/onboarding'
import { ORG_ID_HEADER, ORG_SLUG_HEADER, PATHNAME_HEADER, parseHost } from '@/lib/tenant-host'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
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

  // --- Apex: rewrite / to platform landing; allow /signup /login ---
  if (resolved.kind === 'apex') {
    let supabaseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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
      await supabase.auth.getUser()
    }

    // Rewrite apex home and auth pages under /platform (URL stays / , /signup, /login)
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

    // Block tenant-only routes on apex
    if (pathname.startsWith('/admin') || pathname.startsWith('/raffles') || pathname.startsWith('/verify-tickets')) {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = '/platform/not-found'
      return NextResponse.rewrite(rewriteUrl)
    }

    return supabaseResponse
  }

  // --- Tenant subdomain ---
  if (resolved.kind === 'tenant' && resolved.slug) {
    if (
      !isValidSlug(resolved.slug) ||
      (RESERVED_SLUGS as readonly string[]).includes(resolved.slug)
    ) {
      return new NextResponse('Not Found', { status: 404 })
    }

    const service = createServiceClient()
    if (!service) {
      return new NextResponse('Service unavailable', { status: 503 })
    }

    const { data: org } = await service
      .from('organizations')
      .select('id, slug, onboarding_completed_at')
      .eq('slug', resolved.slug)
      .maybeSingle()

    if (!org) {
      return new NextResponse('Organization not found', { status: 404 })
    }

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

    // Block platform-only paths on tenant
    if (pathname.startsWith('/platform') || pathname === '/signup' || pathname === '/login') {
      return new NextResponse('Not Found', { status: 404 })
    }

    return supabaseResponse
  }

  // --- Custom domain (unlimited plan) ---
  if (resolved.kind === 'unknown') {
    const service = createServiceClient()
    if (!service) {
      return new NextResponse('Service unavailable', { status: 503 })
    }

    const hostOnly = resolved.host.toLowerCase()
    const { data: orgByDomain } = await service
      .from('organizations')
      .select('id, slug, plan, custom_domain, onboarding_completed_at')
      .eq('custom_domain', hostOnly)
      .eq('plan', 'unlimited')
      .maybeSingle()

    if (!orgByDomain) {
      return new NextResponse('Not Found', { status: 404 })
    }

    requestHeaders.set(ORG_ID_HEADER, orgByDomain.id)
    requestHeaders.set(ORG_SLUG_HEADER, orgByDomain.slug)

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
        .eq('org_id', orgByDomain.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!membership) {
        return tenantRedirect(request, '/admin/login', { error: 'unauthorized' })
      }

      if (!isOnboardingRoute && !orgByDomain.onboarding_completed_at) {
        return tenantRedirect(request, ONBOARDING_PATH)
      }
    }

    if (isLoginRoute && user) {
      const { data: membership } = await service
        .from('org_members')
        .select('role')
        .eq('org_id', orgByDomain.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (membership) {
        return tenantRedirect(request, orgAdminPath(orgByDomain))
      }
    }

    if (pathname.startsWith('/platform') || pathname === '/signup' || pathname === '/login') {
      return new NextResponse('Not Found', { status: 404 })
    }

    return supabaseResponse
  }

  return new NextResponse('Not Found', { status: 404 })
}
