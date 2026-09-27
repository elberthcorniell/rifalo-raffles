'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSessionHandoffUrl } from '@/lib/auth-handoff'
import { authErrorMessage } from '@/lib/auth-errors'
import { getRootDomain, slugifyOrgName, isValidSlug } from '@/lib/constants'
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
import {
  DEFAULT_ORG_THEME,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  type OrgTheme,
} from '@/types/org'
import { extractPaletteFromImage, isHexColor } from '@/lib/colors'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Rifa' },
  { id: 2, label: 'Organización' },
  { id: 3, label: 'Marca' },
  { id: 4, label: 'Cobros' },
  { id: 5, label: 'Cuenta' },
] as const

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

type SessionTokens = { access_token: string; refresh_token: string }

type Published = {
  slug: string
  name: string
  adminUrl: string
  siteUrl: string
  raffleUrl: string
  raffleTitle: string
}

function formatRd(amount: number) {
  return `RD$ ${amount.toLocaleString('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function CreateRaffleWizard() {
  const [bootLoading, setBootLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState<SessionTokens | null>(null)
  const [published, setPublished] = useState<Published | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [raffleTitle, setRaffleTitle] = useState('')
  const [raffleDescription, setRaffleDescription] = useState('')
  const [ticketPrice, setTicketPrice] = useState('100')
  const [rangeEnd, setRangeEnd] = useState('100')
  const [endDate, setEndDate] = useState('')
  const [raffleImage, setRaffleImage] = useState<File | null>(null)

  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoPreviewRef = useRef<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR)
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR)
  const [theme, setTheme] = useState<OrgTheme>(DEFAULT_ORG_THEME)
  const [extracting, setExtracting] = useState(false)

  const [bank, setBank] = useState('')
  const [customBank, setCustomBank] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountType, setAccountType] = useState('Ahorros')
  const [holderName, setHolderName] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const suggested = useMemo(() => slugifyOrgName(orgName), [orgName])
  const effectiveSlug = slugTouched ? slug : suggested
  const root = getRootDomain()
  const ticketCount = Math.max(1, parseInt(rangeEnd, 10) || 0)
  const priceNum = parseFloat(ticketPrice)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let redirecting = false
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        const current = data.session
        if (!current) return
        if (cancelled) return
        setSession({
          access_token: current.access_token,
          refresh_token: current.refresh_token,
        })
        setEmail(current.user.email || '')

        const res = await fetch('/api/platform/me/orgs')
        const json = await res.json()
        if (cancelled) return
        if (json.success && json.data?.length) {
          redirecting = true
          const adminUrl = json.data[0].adminUrl as string
          window.location.href = getSessionHandoffUrl(adminUrl, {
            access_token: current.access_token,
            refresh_token: current.refresh_token,
          })
        }
      } catch {
        // Guest flow continues.
      } finally {
        if (!cancelled && !redirecting) setBootLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current)
    }
  }, [])

  const rememberSession = (next: SessionTokens | null | undefined) => {
    if (!next?.access_token || !next.refresh_token) return null
    const tokens = { access_token: next.access_token, refresh_token: next.refresh_token }
    setSession(tokens)
    return tokens
  }

  const ensureAccount = async (): Promise<SessionTokens | null> => {
    if (session) return session

    const supabase = createClient()
    const { data: signData, error: signError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signError) {
      if (signError.message.toLowerCase().includes('already')) {
        const { data: inData, error: inError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (inError) {
          setError(authErrorMessage(inError))
          return null
        }
        return rememberSession(inData.session)
      }
      setError(authErrorMessage(signError, 'Error al registrarse'))
      return null
    }

    if (signData.user && !signData.session) {
      setInfo('Revisa tu correo para confirmar la cuenta. Luego vuelve a publicar tu rifa.')
      return null
    }

    return rememberSession(signData.session)
  }

  const publish = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setInfo(null)

    try {
      const tokens = await ensureAccount()
      if (!tokens) return

      const orgsRes = await fetch('/api/platform/me/orgs')
      const orgsJson = await orgsRes.json()
      if (orgsJson.success && orgsJson.data?.length && orgsJson.data[0].onboardingCompleted) {
        window.location.href = getSessionHandoffUrl(orgsJson.data[0].adminUrl, tokens)
        return
      }

      const bankName = bank === 'Otro' ? customBank.trim() : bank
      const form = new FormData()
      form.set('name', orgName.trim())
      form.set('slug', effectiveSlug)
      form.set('primaryColor', primaryColor)
      form.set('secondaryColor', secondaryColor)
      form.set('theme', theme)
      form.set('bankName', bankName)
      form.set('accountNumber', accountNumber.trim())
      form.set('accountType', accountType)
      form.set('holderName', holderName.trim())
      form.set('raffleTitle', raffleTitle.trim())
      form.set('raffleDescription', raffleDescription)
      form.set('ticketPrice', ticketPrice)
      form.set('rangeEnd', String(Math.max(1, parseInt(rangeEnd, 10) || 1)))
      if (endDate) form.set('endDate', endDate)
      if (logoFile) form.set('logo', logoFile)
      if (raffleImage) form.set('raffleImage', raffleImage)

      const res = await fetch('/api/platform/setup', { method: 'POST', body: form })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo publicar la rifa')
        return
      }

      setPublished(json.data as Published)
      setStep(6)
    } catch {
      setError('No se pudo publicar la rifa')
    } finally {
      setSaving(false)
    }
  }

  const handleLogo = async (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current)
    logoPreviewRef.current = objectUrl
    setLogoFile(file)
    setLogoPreview(objectUrl)
    try {
      const palette = await extractPaletteFromImage(objectUrl)
      setPrimaryColor(palette.primary)
      setSecondaryColor(palette.secondary)
    } catch {
      // Colors stay as chosen.
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
    if (!published) return ''
    const text = `¡Participa en ${published.raffleTitle}! ${published.raffleUrl}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }, [published])

  if (bootLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-black" />
      </div>
    )
  }

  return (
    <OnboardingShell currentStep={step} steps={STEPS} orgName={orgName}>
      {step === 1 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">Tu rifa</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Empieza por el premio. La cuenta la creas al final, cuando ya esté lista para publicarse.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              setStep(2)
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="raffleTitle">Título</Label>
              <Input
                id="raffleTitle"
                value={raffleTitle}
                onChange={(e) => setRaffleTitle(e.target.value)}
                required
                autoFocus
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
                <span className="font-semibold text-[#111111]">
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
              {raffleImage && (
                <p className="text-xs text-muted-foreground">{raffleImage.name}</p>
              )}
            </div>
            <Button type="submit" className="w-full bg-[#FFD000] text-black hover:bg-[#F0C400]">
              Continuar
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-black hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">Tu organización</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Elige el nombre y el enlace donde vivirá {raffleTitle || 'tu rifa'}.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const finalSlug = effectiveSlug.toLowerCase().trim()
              if (!isValidSlug(finalSlug)) {
                setError('Subdominio inválido. Usa 3–32 caracteres: letras, números y guiones.')
                return
              }
              setError(null)
              setStep(3)
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="orgName">Nombre</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(value) => {
                  const next = value.target.value
                  setOrgName(next)
                  if (!slugTouched) setSlug(slugifyOrgName(next))
                }}
                required
                minLength={2}
                autoFocus
                placeholder="Mi Rifa RD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Subdominio</Label>
              <Input
                id="slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                https://{effectiveSlug || 'tu-org'}.{root}
              </p>
            </div>
            {error && <ErrorBox message={error} />}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button
                type="submit"
                className="sm:ml-auto bg-[#FFD000] text-black hover:bg-[#F0C400]"
              >
                Continuar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">Tu marca</h1>
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
            ) : null}
            <p className="font-bold text-2xl text-white truncate">{orgName || 'Tu marca'}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!isHexColor(primaryColor) || !isHexColor(secondaryColor)) {
                setError('Usa colores en formato #RRGGBB')
                return
              }
              setError(null)
              setStep(4)
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label>Logo (opcional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogo(file)
                }}
              />
              <p className="text-xs text-muted-foreground">
                Si no subes uno, el sitio mostrará el nombre de tu organización.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Apariencia</Label>
              <div className="grid grid-cols-2 gap-2">
                <ThemeButton active={theme === 'light'} onClick={() => setTheme('light')}>
                  <Sun className="h-4 w-4" />
                  Claro
                </ThemeButton>
                <ThemeButton active={theme === 'dark'} onClick={() => setTheme('dark')}>
                  <Moon className="h-4 w-4" />
                  Oscuro
                </ThemeButton>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Colores</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExtractColors}
                disabled={!logoPreview || extracting}
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
              <ColorField
                id="primaryColor"
                label="Primario"
                value={primaryColor}
                onChange={setPrimaryColor}
              />
              <ColorField
                id="secondaryColor"
                label="Acento"
                value={secondaryColor}
                onChange={setSecondaryColor}
              />
            </div>
            {error && <ErrorBox message={error} />}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button
                type="button"
                variant="outline"
                className="sm:ml-auto"
                onClick={() => {
                  setError(null)
                  setStep(4)
                }}
              >
                Saltar
              </Button>
              <Button type="submit" className="bg-[#FFD000] text-black hover:bg-[#F0C400]">
                Continuar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">Cuenta para cobrar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tus clientes verán estos datos al pagar por transferencia.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const bankName = bank === 'Otro' ? customBank.trim() : bank
              if (!bankName) {
                setError('Elige un banco')
                return
              }
              setError(null)
              setStep(5)
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={bank} onValueChange={setBank}>
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
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Atrás
              </Button>
              <Button
                type="submit"
                className="sm:ml-auto bg-[#FFD000] text-black hover:bg-[#F0C400]"
                disabled={!bank}
              >
                Continuar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 5 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">
              {session ? 'Publica tu rifa' : 'Crea tu cuenta'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {session
                ? `Publicaremos ${raffleTitle || 'tu rifa'} en ${email || 'tu cuenta'}.`
                : 'Con esto publicamos la rifa y te dejamos el enlace para compartirla.'}
            </p>
          </div>
          <form onSubmit={publish} className="space-y-4">
            {!session && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}
            {error && <ErrorBox message={error} />}
            {info && (
              <p className="text-sm text-blue-700 bg-blue-50 rounded-md px-3 py-2">{info}</p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(4)} disabled={saving}>
                Atrás
              </Button>
              <Button
                type="submit"
                className="sm:ml-auto bg-[#FFD000] text-black hover:bg-[#F0C400]"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : session ? (
                  'Publicar mi rifa'
                ) : (
                  'Crear cuenta y publicar'
                )}
              </Button>
            </div>
          </form>
          {!session && (
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="font-semibold text-black hover:underline">
                Iniciar sesión
              </Link>
            </p>
          )}
        </Card>
      )}

      {step === 6 && published && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-2xl font-bold text-[#111111]">¡Tu rifa ya está en línea!</h1>
            <p className="text-sm text-muted-foreground">
              Comparte el link para empezar a vender boletos.
            </p>
          </div>
          <ShareRow
            label="Enlace de tu rifa"
            value={published.raffleUrl}
            copied={copied === 'raffle'}
            onCopy={() => copy('raffle', published.raffleUrl)}
          />
          <ShareRow
            label="Sitio de tu organización"
            value={published.siteUrl}
            copied={copied === 'site'}
            onCopy={() => copy('site', published.siteUrl)}
          />
          <div className="grid sm:grid-cols-2 gap-2">
            <Button asChild className="bg-[#25D366] hover:bg-[#1ebe5d]">
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={published.raffleUrl} target="_blank" rel="noreferrer">
                Ver rifa
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
          <Button
            className="w-full bg-[#FFD000] text-black hover:bg-[#F0C400]"
            onClick={() => {
              if (session) {
                window.location.href = getSessionHandoffUrl(published.adminUrl, session)
                return
              }
              window.location.href = published.adminUrl
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

function ThemeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium',
        active
          ? 'border-[#0B2447] bg-[#0B2447] text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={isHexColor(value) ? value : DEFAULT_PRIMARY_COLOR}
          onChange={(e) => onChange(e.target.value)}
          className="w-14 h-10 p-1 cursor-pointer"
        />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  )
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
