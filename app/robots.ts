import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { buildRobots, isMarketingHost } from '@/lib/robots-policy'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') || ''
  return buildRobots(isMarketingHost(host))
}
