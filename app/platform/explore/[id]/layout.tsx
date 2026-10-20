import type { Metadata } from 'next'
import { fetchCatalogRaffle } from '@/lib/raffle-catalog'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const raffle = await fetchCatalogRaffle(id)

  if (!raffle) {
    return { title: 'Rifa no encontrada' }
  }

  const title = `${raffle.title} - ${raffle.orgName}`
  const description =
    raffle.description ||
    `Participa por solo RD$${raffle.ticketPrice.toLocaleString()} y gana ${raffle.title}`
  const shareDescription = `${description} - Boletos desde RD$${raffle.ticketPrice.toLocaleString()}`

  return {
    title,
    description,
    openGraph: {
      title: `${raffle.title} | ${raffle.orgName}`,
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

export default function ExploreRaffleLayout({ children }: { children: React.ReactNode }) {
  return children
}
