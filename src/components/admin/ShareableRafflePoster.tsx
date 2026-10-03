'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useOrg } from '@/components/OrgBrandProvider'
import {
  ensurePosterFont,
  formatPosterPrice,
  posterFileName,
  renderRafflePoster,
} from '@/lib/raffle-share-image'
import type { Raffle } from '@/types/raffle'

function pickRaffle(raffles: Raffle[]) {
  return (
    raffles.find((raffle) => raffle.featured && raffle.status === 'active') ||
    raffles.find((raffle) => raffle.status === 'active') ||
    raffles.find((raffle) => raffle.featured) ||
    raffles[0] ||
    null
  )
}

export function ShareableRafflePoster() {
  const { toast } = useToast()
  const { brand, org } = useOrg()
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<Blob | null>(null)
  const [busy, setBusy] = useState<'download' | 'share' | null>(null)
  const previewRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/raffles')
      .then((response) => response.json())
      .then((json) => {
        if (cancelled || !json.success || !Array.isArray(json.data)) return
        const list = json.data as Raffle[]
        setRaffles(list)
        setSelectedId(pickRaffle(list)?.id ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  const raffle = raffles.find((item) => item.id === selectedId) ?? null

  const shareTarget = useMemo(() => {
    if (!raffle || typeof window === 'undefined') return null
    const origin = org?.custom_domain ? `https://${org.custom_domain}` : window.location.origin
    const host = org?.custom_domain || window.location.host
    return {
      url: `${origin}/raffles/${raffle.id}`,
      siteLabel: host.replace(/^www\./, ''),
    }
  }, [raffle, org?.custom_domain])

  useEffect(() => {
    if (!raffle || !shareTarget) return
    let cancelled = false
    setRendering(true)
    ;(async () => {
      try {
        await ensurePosterFont()
        if (cancelled) return
        const blob = await renderRafflePoster({
          title: raffle.title,
          description: raffle.description,
          imageUrl: raffle.image,
          ticketPrice: raffle.ticketPrice,
          soldTickets: raffle.soldTickets,
          totalTickets: raffle.totalTickets,
          timeLeft: raffle.timeLeft,
          endDate: raffle.endDate,
          featured: raffle.featured,
          status: raffle.status,
          orgName: brand.name,
          siteLabel: shareTarget.siteLabel,
          primaryColor: brand.primaryColor,
          secondaryColor: brand.secondaryColor,
        })
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        if (previewRef.current) URL.revokeObjectURL(previewRef.current)
        previewRef.current = url
        setImageFile(blob)
        setPreviewUrl(url)
      } catch (error) {
        if (cancelled) return
        toast({
          title: 'No se pudo crear la imagen',
          description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
          variant: 'destructive',
        })
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [raffle, shareTarget, brand.name, brand.primaryColor, brand.secondaryColor, toast])

  const download = (blob: Blob) => {
    if (!raffle) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = posterFileName(raffle.title)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const onDownload = async () => {
    if (!imageFile) return
    setBusy('download')
    download(imageFile)
    toast({ title: 'Imagen descargada', description: 'Lista para publicar en tus redes.' })
    setBusy(null)
  }

  const onShare = async () => {
    const blob = imageFile
    if (!blob || !raffle || !shareTarget) return
    setBusy('share')
    const file = new File([blob], posterFileName(raffle.title), { type: 'image/png' })
    const text = `Participa en ${raffle.title}. Boletos desde ${formatPosterPrice(raffle.ticketPrice)}. ${shareTarget.url}`
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: raffle.title, text })
        return
      }
      download(blob)
      toast({
        title: 'Imagen descargada',
        description: 'Este navegador no puede compartir archivos. Publica la imagen desde tu galería.',
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast({
        title: 'No se pudo compartir',
        description: 'Descarga la imagen e intenta de nuevo.',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <Card className="p-5 md:p-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr] md:items-center">
          <div className="mx-auto aspect-[4/5] w-full max-w-[240px] animate-pulse rounded-2xl bg-slate-100" />
          <div className="space-y-3">
            <div className="h-4 w-32 rounded bg-slate-100" />
            <div className="h-7 w-56 rounded bg-slate-100" />
            <div className="h-4 w-full max-w-md rounded bg-slate-100" />
          </div>
        </div>
      </Card>
    )
  }

  if (!raffle) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
        <div>
          <h2 className="text-lg font-semibold text-[#0B2447]">Imagen para compartir</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea una rifa para generar una imagen lista para Instagram, WhatsApp y Facebook.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/raffles">Nueva rifa</Link>
        </Button>
      </Card>
    )
  }

  const available = Math.max(0, raffle.totalTickets - raffle.soldTickets)

  return (
    <Card className="overflow-hidden p-5 md:p-6">
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
        <div className="mx-auto w-full max-w-[280px]">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`Imagen para compartir: ${raffle.title}`}
              className={`w-full rounded-2xl shadow-[0_24px_50px_-24px_rgba(11,36,71,0.65)] ${
                rendering ? 'opacity-70' : ''
              }`}
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-slate-100">
              <Loader2 className="h-6 w-6 animate-spin text-[#1976D2]" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-[#1976D2]">Imagen para redes</p>
            <h2 className="text-xl font-bold text-[#0B2447]">Comparte tu rifa</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Foto, título y precio, lista para Instagram, WhatsApp o Facebook.
            </p>
          </div>

          {raffles.length > 1 && (
            <Select value={raffle.id} onValueChange={setSelectedId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Elige una rifa" />
              </SelectTrigger>
              <SelectContent>
                {raffles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <dl className="grid max-w-md grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Precio</dt>
              <dd className="font-semibold text-[#0B2447]">{formatPosterPrice(raffle.ticketPrice)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Quedan</dt>
              <dd className="font-semibold text-[#0B2447]">
                {raffle.totalTickets > 0 ? available.toLocaleString('es-DO') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Cierra</dt>
              <dd className="font-semibold text-[#0B2447]">
                {!raffle.endDate || raffle.timeLeft === 'Sin fecha' ? 'Abierta' : raffle.timeLeft}
              </dd>
            </div>
          </dl>

          {shareTarget && (
            <p className="break-all text-sm text-muted-foreground">{shareTarget.url}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={onDownload} disabled={!previewUrl || busy != null || rendering}>
              {busy === 'download' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              Descargar imagen
            </Button>
            <Button
              variant="outline"
              onClick={onShare}
              disabled={!previewUrl || busy != null || rendering}
            >
              {busy === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />}
              Compartir
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
