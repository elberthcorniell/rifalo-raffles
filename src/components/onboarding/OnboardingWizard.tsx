'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Moon,
  Sun,
  Pipette,
  MessageCircle,
} from 'lucide-react'
import { OnboardingShell } from '@/components/onboarding/OnboardingShell'
import { useOrg } from '@/components/OrgBrandProvider'
import { getTenantUrl } from '@/lib/constants'
import {
  DEFAULT_ORG_THEME,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  normalizeOrgTheme,
  type OrgTheme,
  type Organization,
} from '@/types/org'
import { extractPaletteFromImage, isHexColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { OrgBrand } from '@/types/org'

const BANKS = [
  'Banreservas',
  'Banco Popular',
  'BHD',
  'Santa Cruz',
  'Promerica',
  'Banco Caribe',
  'López de Haro',
  'Asociación Popular',
  'Asociación Cibao',
  'Qik',
  'Otro',
]

type RaffleSummary = { id: string; title: string }

function formatRd(amount: number) {
  return `RD$ ${amount.toLocaleString('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function OnboardingWizard() {
  const router = useRouter()
  const { setBrandState } = useOrg()
  const [bootLoading, setBootLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR)
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR)
  const [theme, setTheme] = useState<OrgTheme>(DEFAULT_ORG_THEME)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const [bank, setBank] = useState('')
  const [customBank, setCustomBank] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountType, setAccountType] = useState('Ahorros')
  const [holderName, setHolderName] = useState('')

  const [raffleTitle, setRaffleTitle] = useState('')
  const [raffleDescription, setRaffleDescription] = useState('')
  const [ticketPrice, setTicketPrice] = useState('100')
  const [rangeEnd, setRangeEnd] = useState('100')
  const [endDate, setEndDate] = useState('')
  const [raffleImage, setRaffleImage] = useState<File | null>(null)
  const [createdRaffle, setCreatedRaffle] = useState<RaffleSummary | null>(null)

  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/onboarding')
        const json = await res.json()
        if (!json.success) {
          setError(json.error || 'Error al cargar')
          return
        }
        if (json.data.completed) {
          router.replace('/admin')
          return
        }

        const o = json.data.org as Organization
        const brand = json.data.brand as OrgBrand
        if (cancelled) return

        setSlug(o.slug)
        setName(o.name || '')
        setTagline(o.tagline || '')
        setLogoPath(o.logo_path)
        setLogoPreview(brand?.logo && !brand.logo.endsWith('/logo.jpg') ? brand.logo : null)
        setPrimaryColor(o.primary_color || DEFAULT_PRIMARY_COLOR)
        setSecondaryColor(o.secondary_color || DEFAULT_SECONDARY_COLOR)
        setTheme(normalizeOrgTheme(o.theme))
        if (json.data.raffle) {
          setCreatedRaffle(json.data.raffle)
        }

        if (json.data.hasRaffle) {
          setStep(5)
          fetch('/api/admin/onboarding', { method: 'POST' }).catch(() => {})
        } else if (json.data.hasBankAccount) {
          setStep(4)
        }
      } catch {
        if (!cancelled) setError('Error al cargar la configuración')
      } finally {
        if (!cancelled) setBootLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const siteUrl = slug ? getTenantUrl(slug) : ''
  const raffleUrl = createdRaffle ? getTenantUrl(slug, `/raffles/${createdRaffle.id}`) : siteUrl
  const ticketCount = Math.max(1, parseInt(rangeEnd, 10) || 0)
  const priceNum = parseFloat(ticketPrice)

  const saveOrg = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/org', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Error al guardar')
    setBrandState(json.data.org, json.data.brand)
    return json.data
  }

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveOrg({ name: name.trim(), tagline })
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('bucket', 'raffle-images')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al subir logo')
      setLogoPath(json.data.path)
      setLogoPreview(json.data.publicUrl)
      try {
        const objectUrl = URL.createObjectURL(file)
        const palette = await extractPaletteFromImage(objectUrl)
        URL.revokeObjectURL(objectUrl)
        setPrimaryColor(palette.primary)
        setSecondaryColor(palette.secondary)
      } catch {
        // optional
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleExtractColors = async () => {
    if (!logoPreview) return
    setExtracting(true)
    setError(null)
    try {
      const palette = await extractPaletteFromImage(logoPreview)
      setPrimaryColor(palette.primary)
      setSecondaryColor(palette.secondary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron extraer colores')
    } finally {
      setExtracting(false)
    }
  }

  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!isHexColor(primaryColor) || !isHexColor(secondaryColor)) {
        throw new Error('Usa colores en formato #RRGGBB')
      }
      await saveOrg({
        logoPath,
        primaryColor,
        secondaryColor,
        theme,
      })
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const bankName = bank === 'Otro' ? customBank.trim() : bank
      if (!bankName) throw new Error('Elige un banco')
      const res = await fetch('/api/admin/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bankName,
          bank: bankName,
          accountNumber: accountNumber.trim(),
          accountType,
          holderName: holderName.trim(),
          currency: 'DOP',
          isActive: true,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al guardar la cuenta')
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la cuenta')
    } finally {
      setSaving(false)
    }
  }

  const handleRaffleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let imagePath: string | undefined
      if (raffleImage) {
        const fd = new FormData()
        fd.append('file', raffleImage)
        fd.append('bucket', 'raffle-images')
        const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        const uploadJson = await uploadRes.json()
        if (!uploadJson.success) throw new Error(uploadJson.error || 'Error al subir imagen')
        imagePath = uploadJson.data.path
      }

      const end = Math.max(1, parseInt(rangeEnd, 10) || 1)
      const res = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: raffleTitle.trim(),
          description: raffleDescription,
          ticketPrice: parseFloat(ticketPrice),
          minTickets: 1,
          endDate: endDate || null,
          featured: true,
          status: 'active',
          imagePath,
          rangeStart: 1,
          rangeEnd: end,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al crear la rifa')

      setCreatedRaffle({ id: json.data.id, title: json.data.title })

      const done = await fetch('/api/admin/onboarding', { method: 'POST' })
      const doneJson = await done.json()
      if (!doneJson.success) throw new Error(doneJson.error || 'Error al completar')

      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la rifa')
    } finally {
      setSaving(false)
    }
  }

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('No se pudo copiar')
    }
  }

  const whatsappHref = useMemo(() => {
    const title = createdRaffle?.title || name
    const text = `¡Participa en ${title}! ${raffleUrl}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }, [createdRaffle?.title, name, raffleUrl])

  if (bootLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#1976D2]" />
      </div>
    )
  }

  return (
    <OnboardingShell currentStep={step} orgName={name}>
      {step === 1 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0B2447]">Tu organización</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Así te verán tus clientes en el sitio público.
            </p>
          </div>
          <form onSubmit={handleOrgSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nombre</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Mi Rifa RD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Eslogan</Label>
              <Input
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="La suerte te acompaña"
              />
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Tu sitio</p>
              <p className="font-mono text-sm text-[#0B2447] break-all">{siteUrl}</p>
            </div>
            {error && <ErrorBox message={error} />}
            <Button
              type="submit"
              className="w-full bg-[#1976D2] hover:bg-[#1565C0]"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
            </Button>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0B2447]">Tu marca</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Logo, colores y apariencia. Puedes cambiarlos después.
            </p>
          </div>

          <div
            className={cn(
              'rounded-lg border p-4 flex items-center gap-4',
              theme === 'dark' ? 'border-white/10' : 'border-black/5'
            )}
            style={{
              background:
                theme === 'dark'
                  ? `linear-gradient(135deg, #0f172a 0%, ${primaryColor} 55%, ${secondaryColor} 100%)`
                  : `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            }}
          >
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo"
                className="h-14 w-auto rounded bg-white/90 p-1 object-contain"
              />
            ) : (
              <div className="h-14 w-14 rounded bg-white/20" />
            )}
            <div className="text-white min-w-0">
              <p className="font-bold text-lg truncate">{name || 'Tu marca'}</p>
              <p className="text-sm text-white/80 line-clamp-2">
                {tagline || 'Tu eslogan aparecerá aquí'}
              </p>
            </div>
          </div>

          <form onSubmit={handleBrandSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Logo</Label>
              <Input
                type="file"
                accept="image/*"
                disabled={uploadingLogo}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoUpload(file)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Apariencia</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium',
                    theme === 'light'
                      ? 'border-[#0B2447] bg-[#0B2447] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <Sun className="h-4 w-4" />
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium',
                    theme === 'dark'
                      ? 'border-[#0B2447] bg-[#0B2447] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <Moon className="h-4 w-4" />
                  Oscuro
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label>Colores</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExtractColors}
                disabled={!logoPreview || extracting || uploadingLogo}
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Pipette className="h-4 w-4 mr-2" />
                )}
                Extraer del logo
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primario</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Acento</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    id="secondaryColor"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {error && <ErrorBox message={error} />}

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button
                type="button"
                variant="outline"
                className="sm:ml-auto"
                onClick={() => {
                  setError(null)
                  setStep(3)
                }}
              >
                Saltar
              </Button>
              <Button
                type="submit"
                className="bg-[#1976D2] hover:bg-[#1565C0]"
                disabled={saving || uploadingLogo}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0B2447]">Cuenta para cobrar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tus clientes verán estos datos al pagar por transferencia.
            </p>
          </div>
          <form onSubmit={handleBankSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={bank} onValueChange={setBank} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un banco" />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bank === 'Otro' && (
              <div className="space-y-2">
                <Label htmlFor="customBank">Nombre del banco</Label>
                <Input
                  id="customBank"
                  value={customBank}
                  onChange={(e) => setCustomBank(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Número de cuenta</Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
                className="font-mono"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ahorros">Ahorros</SelectItem>
                    <SelectItem value="Corriente">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="holderName">Titular</Label>
                <Input
                  id="holderName"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Nombre del titular"
                />
              </div>
            </div>
            {error && <ErrorBox message={error} />}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button
                type="submit"
                className="sm:ml-auto bg-[#1976D2] hover:bg-[#1565C0]"
                disabled={saving || !bank}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0B2447]">Tu primera rifa</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Se publicará de inmediato para que puedas compartirla.
            </p>
          </div>
          <form onSubmit={handleRaffleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="raffleTitle">Título</Label>
              <Input
                id="raffleTitle"
                value={raffleTitle}
                onChange={(e) => setRaffleTitle(e.target.value)}
                required
                placeholder="Toyota Hilux 2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="raffleDescription">Descripción</Label>
              <Textarea
                id="raffleDescription"
                value={raffleDescription}
                onChange={(e) => setRaffleDescription(e.target.value)}
                rows={3}
                placeholder="Cuéntales qué se pueden ganar"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ticketPrice">Precio del boleto (RD$)</Label>
                <Input
                  id="ticketPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rangeEnd">Cantidad de boletos</Label>
                <Input
                  id="rangeEnd"
                  type="number"
                  min="1"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="rounded-md border bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Ingreso esperado</span>
                <span className="font-semibold text-[#0B2447]">
                  {formatRd((Number.isFinite(priceNum) ? priceNum : 0) * ticketCount)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ticketCount.toLocaleString('es-DO')} boletos ×{' '}
                {formatRd(Number.isFinite(priceNum) ? priceNum : 0)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de cierre (opcional)</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Imagen del premio</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setRaffleImage(e.target.files?.[0] || null)}
              />
            </div>
            {error && <ErrorBox message={error} />}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Atrás
              </Button>
              <Button
                type="submit"
                className="sm:ml-auto bg-[#1976D2] hover:bg-[#1565C0]"
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publicar y obtener enlace'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 5 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-2xl font-bold text-[#0B2447]">¡Tu rifa ya está en línea!</h1>
            <p className="text-sm text-muted-foreground">
              Comparte el enlace para empezar a vender boletos.
            </p>
          </div>

          <ShareRow
            label="Enlace de tu rifa"
            value={raffleUrl}
            copied={copied === 'raffle'}
            onCopy={() => copy('raffle', raffleUrl)}
          />
          <ShareRow
            label="Sitio de tu organización"
            value={siteUrl}
            copied={copied === 'site'}
            onCopy={() => copy('site', siteUrl)}
          />

          <div className="grid sm:grid-cols-2 gap-2">
            <Button asChild className="bg-[#25D366] hover:bg-[#1ebe5d]">
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={raffleUrl} target="_blank" rel="noreferrer">
                Ver rifa
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
          <Button
            className="w-full bg-[#1976D2] hover:bg-[#1565C0]"
            onClick={() => {
              window.location.href = '/admin'
            }}
          >
            Ir al panel
          </Button>
        </Card>
      )}
    </OnboardingShell>
  )
}

function ErrorBox({ message }: { message: string }) {
  return <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{message}</p>
}

function ShareRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Input value={value} readOnly className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={onCopy} className="shrink-0">
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
