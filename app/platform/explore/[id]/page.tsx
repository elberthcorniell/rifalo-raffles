'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PlatformHeader } from '@/components/platform/PlatformHeader'
import PurchaseDialog from '@/components/PurchaseDialog'
import PurchaseButton from '@/components/PurchaseButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Clock, ExternalLink, ShieldCheck, Ticket } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getImageSrc } from '@/lib/utils'
import type { Raffle } from '@/types/raffle'
import type { CheckoutFields } from '@/types/org'
import { SHOW_EXPLORE } from '@/lib/constants'

type PlatformRafflePayload = {
  raffle: Raffle
  org: {
    id: string
    name: string
    slug: string
    checkoutFields: CheckoutFields
    siteUrl: string
    raffleUrl: string
  }
}

export default function PlatformExploreRafflePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [payload, setPayload] = useState<PlatformRafflePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)

  useEffect(() => {
    if (!SHOW_EXPLORE) {
      router.replace('/')
      return
    }

    const fetchRaffle = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/platform/raffles/${params.id}`)
        const result = await response.json()

        if (result.success) {
          setPayload(result.data)
        } else {
          setError(result.error || 'Error al cargar la rifa')
          toast({
            title: 'Error',
            description: result.error || 'Error al cargar la rifa',
            variant: 'destructive',
          })
        }
      } catch {
        const errorMessage = 'Error al cargar la rifa'
        setError(errorMessage)
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchRaffle()
    }
  }, [params.id, toast, router])

  const raffle = payload?.raffle ?? null
  const org = payload?.org ?? null
  const remainingTickets = raffle ? raffle.totalTickets - raffle.soldTickets : 0
  const progressPercentage =
    raffle && raffle.totalTickets > 0
      ? Math.min(100, (raffle.soldTickets / raffle.totalTickets) * 100)
      : 0
  const progressLabel =
    progressPercentage > 0 && progressPercentage < 1
      ? '<1%'
      : `${Math.round(progressPercentage)}%`

  return (
    <div className="min-h-screen bg-background font-poppins pb-24 md:pb-0">
      <PlatformHeader />
      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <Button variant="ghost" asChild className="mb-6 -ml-2">
          <Link href="/explore">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Rifas verificadas
          </Link>
        </Button>

        {loading ? (
          <div className="space-y-8">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border bg-card px-6 py-16 text-center space-y-4">
            <p className="text-lg font-semibold text-[#111111]">{error}</p>
            <Button asChild>
              <Link href="/explore">Ver rifas verificadas</Link>
            </Button>
          </div>
        ) : raffle && org ? (
          <div className="space-y-8">
            <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden bg-muted">
              <img
                src={getImageSrc(raffle.image)}
                alt={raffle.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (target.src !== '/placeholder.svg') {
                    target.src = '/placeholder.svg'
                  }
                }}
              />
              <div className="absolute top-4 left-4">
                <Badge className="bg-[#FFD000] text-black font-semibold gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Verificada
                </Badge>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{org.name}</p>
                  <h1 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">
                    {raffle.title}
                  </h1>
                  <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">
                    {raffle.description}
                  </p>
                </div>

                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-primary" />
                        <span className="text-sm text-muted-foreground">Precio por boleto</span>
                      </div>
                      <span className="font-bold text-2xl">
                        RD${raffle.ticketPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm text-muted-foreground">Tiempo restante</span>
                      </div>
                      <span className="font-bold text-xl">{raffle.timeLeft}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">
                        Boletos vendidos
                      </span>
                      <span className="text-sm font-bold">{progressLabel}</span>
                    </div>
                    <Progress value={progressPercentage} className="h-3" />
                    <p className="text-sm text-muted-foreground">
                      {raffle.soldTickets.toLocaleString('es-DO')} de{' '}
                      {raffle.totalTickets.toLocaleString('es-DO')} boletos
                    </p>
                  </div>
                </Card>

                <a
                  href={org.raffleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Ver en el sitio de {org.name}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="hidden md:block">
                <Card className="p-6 sticky top-24 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Comprar boletos</h2>
                    <p className="text-muted-foreground text-sm">
                      El pago va a las cuentas bancarias de {org.name}. Ellos confirman tu
                      comprobante.
                    </p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Precio por boleto</span>
                    <span className="font-bold text-xl">
                      RD${raffle.ticketPrice.toLocaleString()}
                    </span>
                  </div>
                  <PurchaseButton
                    onClick={() => setIsPurchaseDialogOpen(true)}
                    ticketPrice={raffle.ticketPrice}
                  />
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {raffle && org && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t shadow-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Desde</p>
                <p className="text-lg font-bold">
                  RD${raffle.ticketPrice.toLocaleString()}
                </p>
              </div>
              <PurchaseButton
                onClick={() => setIsPurchaseDialogOpen(true)}
                ticketPrice={raffle.ticketPrice}
                className="flex-1 py-6 text-base"
              />
            </div>
          </div>
          <PurchaseDialog
            open={isPurchaseDialogOpen}
            onOpenChange={setIsPurchaseDialogOpen}
            raffleId={raffle.id}
            raffleTitle={raffle.title}
            ticketPrice={raffle.ticketPrice}
            availableTickets={remainingTickets}
            minTickets={raffle.minTickets}
            bundles={raffle.bundles}
            accountsUrl={`/api/platform/raffles/${raffle.id}/accounts`}
            purchaseUrl="/api/platform/purchases/voucher"
            checkoutFieldsOverride={org.checkoutFields}
            afterPurchaseHref={`${org.siteUrl}/verify-tickets`}
          />
        </>
      )}
    </div>
  )
}
