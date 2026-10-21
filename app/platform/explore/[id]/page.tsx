import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SHOW_EXPLORE } from '@/lib/constants'
import { getVerifiedPlatformRaffle } from '@/lib/platform-raffle'
import { ExploreRaffleView } from '@/components/platform/ExploreRaffleView'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const result = await getVerifiedPlatformRaffle(id)

  if (result.kind === 'error') {
    return { title: 'Rifa no encontrada' }
  }

  const { raffle, org } = result.data
  const title = `${raffle.title} - ${org.name}`
  const description =
    raffle.description ||
    `Participa por solo RD$${raffle.ticketPrice.toLocaleString()} y gana ${raffle.title}`
  const shareDescription = `${description} - Boletos desde RD$${raffle.ticketPrice.toLocaleString()}`

  return {
    title,
    description,
    openGraph: {
      title: `${raffle.title} | ${org.name}`,
      description: shareDescription,
      type: 'website',
      images: [
        {
          url: raffle.image,
          width: 1200,
          height: 630,
          alt: raffle.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: raffle.title,
      description: shareDescription,
      images: [raffle.image],
    },
  }
}

export default async function PlatformExploreRafflePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!SHOW_EXPLORE) redirect('/')

  const { id } = await params
  const result = await getVerifiedPlatformRaffle(id)

  return (
    <ExploreRaffleView
      payload={result.kind === 'ready' ? result.data : null}
      error={result.kind === 'error' ? result.error : null}
    />
  )
}
