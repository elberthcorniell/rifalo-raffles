/** Marketing-site paths. Tenant hosts must not serve these. */

export function isMarketingBlogPath(pathname: string): boolean {
  return pathname === '/blog' || pathname.startsWith('/blog/')
}

export function isBlogUnsubscribePath(pathname: string): boolean {
  return (
    pathname === '/baja' ||
    pathname.startsWith('/baja/') ||
    pathname === '/api/blog/unsubscribe'
  )
}
