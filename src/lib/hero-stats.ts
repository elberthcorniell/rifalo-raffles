import { unstable_cache } from 'next/cache'
import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'
import { formatHeroProof, type HeroProofCounts } from '@/lib/hero-proof'

const REVALIDATE_SECONDS = 60 * 60
const TEST_RAFFLE_ID_LIMIT = 1000

/**
 * Live raffles: status active, excluding obvious test titles.
 * Tickets sold: tickets.status = sold, minus sold tickets on those test raffles
 * (any raffle status). Anon cannot read these tables; public server reads use
 * the service-role client, same as the rest of the public raffle catalog.
 */
async function loadHeroProofCounts(): Promise<HeroProofCounts> {
  const supabase = createAdminClient()

  const live = await supabase
    .from('raffles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .not('title', 'ilike', '%prueba%')
    .not('title', 'ilike', 'test')

  if (live.error) throw new Error(live.error.message)

  const [prueba, exactTest] = await Promise.all([
    supabase.from('raffles').select('id').ilike('title', '%prueba%').limit(TEST_RAFFLE_ID_LIMIT),
    supabase.from('raffles').select('id').ilike('title', 'test').limit(TEST_RAFFLE_ID_LIMIT),
  ])

  if (prueba.error) throw new Error(prueba.error.message)
  if (exactTest.error) throw new Error(exactTest.error.message)
  if ((prueba.data?.length ?? 0) >= TEST_RAFFLE_ID_LIMIT) {
    throw new Error('Too many test raffles to exclude safely')
  }

  const testIds = [
    ...new Set([
      ...(prueba.data ?? []).map((row) => row.id as string),
      ...(exactTest.data ?? []).map((row) => row.id as string),
    ]),
  ]

  const sold = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sold')

  if (sold.error || sold.count == null) {
    throw new Error(sold.error?.message || 'Missing sold-ticket count')
  }

  let soldOnTests = 0
  if (testIds.length > 0) {
    const testSold = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sold')
      .in('raffle_id', testIds)

    if (testSold.error || testSold.count == null) {
      throw new Error(testSold.error?.message || 'Missing test-raffle ticket count')
    }
    soldOnTests = testSold.count
  }

  return {
    liveRaffles: live.count ?? 0,
    ticketsSold: Math.max(0, sold.count - soldOnTests),
  }
}

const getCachedHeroProofCounts = unstable_cache(loadHeroProofCounts, ['platform-hero-proof-v1'], {
  revalidate: REVALIDATE_SECONDS,
})

export async function getHeroProofLine(): Promise<string> {
  if (!hasSupabaseConfig()) return formatHeroProof(null)
  try {
    return formatHeroProof(await getCachedHeroProofCounts())
  } catch (error) {
    console.error('Hero social proof unavailable, using fallback', error)
    return formatHeroProof(null)
  }
}
