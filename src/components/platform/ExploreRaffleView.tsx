'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import PurchaseButton from '@/components/PurchaseButton'
import ReferralShare from '@/components/ReferralShare'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Clock, ExternalLink, ShieldCheck, Ticket } from 'lucide-react'
import { getImageSrc } from '@/lib/utils'
import { captureClientEvent } from '@/lib/explore-analytics'
import type { PlatformRafflePayload } from '@/lib/platform-raffle'

const PurchaseDialog = dynamic(() => import('@/components/PurchaseDialog'), {
  ssr: false,
})

function canOptimizeImage(src: string) {
  if (src.startsWith('/')) return true
  try {
    return new URL(src).hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

function ExploreHero({ src, alt }: { src: string; alt: string }) {
  const [current, setCurrent] = useState(src)
  const optimized = canOptimizeImage(current)

  const fallback = () => {
    if (current !== '/placeholder.svg') setCurrent('/placeholder.svg')
  }

  if (!optimized) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={current}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        onError={fallback}
      />
    )
  }

  return (
    <Image
      src={current}
      alt={alt}
      fill
      priority
      sizes="(max-width: 768px) 100vw, 1152px"
      className="object-cover"
      onError={fallback}
    />
  )
}

function preloadPurchaseDialog() {
  void import('@/components/PurchaseDialog')
}

export function ExploreRaffleView({
  payload,
  error,
}: {
  payload: PlatformRafflePayload | null
  error: string | null
}) {
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)
  const [dialogMounted, setDialogMounted] = useState(false)
  const raffle = payload?.raffle ?? null
  const org = payload?.org ?? null
  const currency = payload?.currency || 'DOP'

  useEffect(() => {
    if (!raffle) return
    let active = true
    const timer = window.setTimeout(() => {
      if (!active) return
      captureClientEvent('raffle_viewed', {
        raffle_id: raffle.id,
        raffle_title: raffle.title,
        ticket_price: raffle.ticketPrice,
        currency,
        source_page: 'explore',
      })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [raffle, currency])

  const remainingTickets = raffle ? raffle.totalTickets - raffle.soldTickets : 0
  const progressPercentage =
    raffle && raffle.totalTickets > 0
      ? Math.min(100, (raffle.soldTickets / raffle.totalTickets) * 100)
      : 0
  const progressLabel =
    progressPercentage > 0 && progressPercentage < 1
      ? '<1%'
      : `${Math.round(progressPercentage)}%`

  const openPurchase = () => {
    if (!raffle) return
    preloadPurchaseDialog()
    setDialogMounted(true)
    setIsPurchaseDialogOpen(true)
    captureClientEvent('buy_tickets_clicked', {
      raffle_id: raffle.id,
      ticket_price: raffle.ticketPrice,
    })
    captureClientEvent('raffle_purchase_started', {
      raffle_id: raffle.id,
      ticket_price: raffle.ticketPrice,
      available_tickets: remainingTickets,
      source_page: 'explore',
    })
  }

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <Button variant="ghost" asChild className="mb-6 -ml-2">
          <Link href="/explore">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Rifas verificadas
          </Link>
        </Button>

        {error || !raffle || !org ? (
          <div className="rounded-2xl border bg-card px-6 py-16 text-center space-y-4">
            <p className="text-lg font-semibold text-[#111111]">
              {error || 'Rifa no encontrada o no disponible'}
            </p>
            <Button asChild>
              <Link href="/explore">Ver rifas verificadas</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden bg-muted">
              <ExploreHero key={raffle.id} src={getImageSrc(raffle.image)} alt={raffle.title} />
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
                  </div>
                </Card>

                {raffle.referralEnabled && (
                  <ReferralShare
                    raffleId={raffle.id}
                    rewardTickets={raffle.referralRewardTickets || 1}
                  />
                )}

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

              <div className="hidden md:block" onPointerDown={preloadPurchaseDialog}>
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
                  <PurchaseButton onClick={openPurchase} ticketPrice={raffle.ticketPrice} />
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>

      {raffle && org && (
        <>
          <div
            className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t shadow-lg p-4"
            onPointerDown={preloadPurchaseDialog}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Desde</p>
                <p className="text-lg font-bold">RD${raffle.ticketPrice.toLocaleString()}</p>
              </div>
              <PurchaseButton
                onClick={openPurchase}
                ticketPrice={raffle.ticketPrice}
                className="flex-1 py-6 text-base"
              />
            </div>
          </div>
          {dialogMounted && (
            <PurchaseDialog
              open={isPurchaseDialogOpen}
              onOpenChange={setIsPurchaseDialogOpen}
              raffleId={raffle.id}
              raffleTitle={raffle.title}
              ticketPrice={raffle.ticketPrice}
              availableTickets={remainingTickets}
              totalTickets={raffle.totalTickets}
              minTickets={raffle.minTickets}
              bundles={raffle.bundles}
              accountsUrl={`/api/platform/raffles/${raffle.id}/accounts`}
              purchaseUrl="/api/platform/purchases/voucher"
              checkoutFieldsOverride={org.checkoutFields}
              afterPurchaseHref={`${org.siteUrl}/verify-tickets`}
              exploreAnalytics={{
                organizationId: org.id,
                currency,
              }}
            />
          )}
        </>
      )}
    </>
  )
}
