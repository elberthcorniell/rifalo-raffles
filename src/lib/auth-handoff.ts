type SessionTokens = {
  access_token: string
  refresh_token: string
}

/** Move an apex session onto a tenant host (cookies are host-only). */
export function getSessionHandoffUrl(targetUrl: string, session: SessionTokens): string {
  const dest = new URL(targetUrl, typeof window !== 'undefined' ? window.location.origin : undefined)
  const handoff = new URL('/auth/handoff', dest.origin)
  handoff.searchParams.set('next', `${dest.pathname}${dest.search}` || '/admin')
  handoff.hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }).toString()
  return handoff.toString()
}
