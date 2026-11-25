import { createBrowserClient } from '@supabase/ssr'

/** Preview deployments have no Supabase env, so pages must render without a browser client. */
export function hasSupabaseBrowserConfig(
  url: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
): boolean {
  return Boolean(url && anonKey)
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
