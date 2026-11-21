import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { StorefrontDocument } from '@/components/storefront/StorefrontDocument'
import { getOrgFromHeaders } from '@/lib/tenant'
import { formatWinnerDate, listPublishedWinners } from '@/lib/winners'
import { plainLegalText } from '@/lib/legal-markdown'

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrgFromHeaders()
  if (!org) return { title: 'Ganadores' }
  return {
    title: `Ganadores | ${org.name}`,
    description: `Resultados publicados por ${org.name}.`,
  }
}

export default async function GanadoresPage() {
  const org = await getOrgFromHeaders()
  if (!org) notFound()

  const winners = await listPublishedWinners(org.id)
  const name = plainLegalText(org.name, 'el organizador')

  return (
    <StorefrontDocument
      title="Ganadores"
      description={`Resultados de las rifas de ${name}.`}
    >
      {winners.length === 0 ? (
        <Card className="border-dashed border-card-border bg-gradient-card px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Trophy className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Aún no hay ganadores</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Cuando {name} publique el resultado de un sorteo, el nombre y la rifa aparecerán aquí.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {winners.map((winner) => {
            const announced = formatWinnerDate(winner.announcedAt)
            return (
              <Card key={winner.id} className="border-card-border bg-gradient-card p-5 md:p-6">
                <p className="text-sm text-muted-foreground">{winner.raffleTitle}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{winner.name}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {winner.ticketLabel ? <span>Boleto {winner.ticketLabel}</span> : null}
                  {announced ? <span>{announced}</span> : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </StorefrontDocument>
  )
}
