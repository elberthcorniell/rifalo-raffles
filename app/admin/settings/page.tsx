'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2, ExternalLink, Pipette, Sun, Moon } from 'lucide-react'
import { getRootDomain, getTenantUrl } from '@/lib/constants'
import { useOrg } from '@/components/OrgBrandProvider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DEFAULT_CHECKOUT_FIELDS,
  DEFAULT_ORG_THEME,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  normalizeCheckoutFields,
  normalizeOrgTheme,
  type CheckoutFieldKey,
  type CheckoutFields,
  type OrgTheme,
} from '@/types/org'
import {
  evaluateBrandContrast,
  extractPaletteFromImage,
  isHexColor,
} from '@/lib/colors'
import { cn } from '@/lib/utils'

export default function AdminSettingsPage() {
  const { setBrandState } = useOrg()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [location, setLocation] = useState('')
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR)
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR)
  const [theme, setTheme] = useState<OrgTheme>(DEFAULT_ORG_THEME)
  const [checkoutFields, setCheckoutFields] = useState<CheckoutFields>(
    DEFAULT_CHECKOUT_FIELDS
  )
  const [facebookUrl, setFacebookUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [customDomain, setCustomDomain] = useState('')
  const [plan, setPlan] = useState<'free' | 'plus' | 'unlimited'>('free')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/org')
        const json = await res.json()
        if (json.success) {
          const o = json.data.org
          setSlug(o.slug)
          setName(o.name || '')
          setTagline(o.tagline || '')
          setEmail(o.email || '')
          setPhone(o.phone || '')
          setAdminEmail(o.admin_email || '')
          setLocation(o.location || '')
          setPrimaryColor(o.primary_color || DEFAULT_PRIMARY_COLOR)
          setSecondaryColor(o.secondary_color || DEFAULT_SECONDARY_COLOR)
          setTheme(normalizeOrgTheme(o.theme))
          setCheckoutFields(normalizeCheckoutFields(o.checkout_fields))
          setFacebookUrl(o.facebook_url || '')
          setInstagramUrl(o.instagram_url || '')
          setTwitterUrl(o.twitter_url || '')
          setLogoPath(o.logo_path)
          setLogoPreview(json.data.brand?.logo || null)
          setCustomDomain(o.custom_domain || '')
          setPlan(o.plan === 'plus' || o.plan === 'unlimited' ? o.plan : 'free')
        } else {
          setError(json.error || 'Error al cargar')
        }
      } catch {
        setError('Error al cargar ajustes')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleLogoUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('bucket', 'raffle-images')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Error al subir logo')
        return
      }
      setLogoPath(json.data.path)
      setLogoPreview(json.data.publicUrl)
      // Soft-suggest colors from the new file (user can still tweak / re-extract)
      try {
        const objectUrl = URL.createObjectURL(file)
        const palette = await extractPaletteFromImage(objectUrl)
        URL.revokeObjectURL(objectUrl)
        setPrimaryColor(palette.primary)
        setSecondaryColor(palette.secondary)
      } catch {
        // upload succeeded; color extract is optional
      }
    } catch {
      setError('Error al subir logo')
    } finally {
      setUploading(false)
    }
  }

  const handleExtractColors = async () => {
    if (!logoPreview) {
      setError('Sube un logo primero para extraer colores')
      return
    }
    setExtracting(true)
    setError(null)
    setSuccess(null)
    try {
      const palette = await extractPaletteFromImage(logoPreview)
      setPrimaryColor(palette.primary)
      setSecondaryColor(palette.secondary)
      setSuccess('Colores detectados del logo. Guarda para aplicarlos al sitio.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron extraer colores del logo')
    } finally {
      setExtracting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          tagline,
          email,
          phone,
          adminEmail,
          logoPath,
          location,
          primaryColor,
          secondaryColor,
          theme,
          checkoutFields,
          facebookUrl,
          instagramUrl,
          twitterUrl,
          customDomain,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Error al guardar')
        return
      }
      setSuccess('Marca actualizada. Ya se refleja en tu sitio público.')
      setLogoPreview(json.data.brand?.logo || logoPreview)
      setBrandState(json.data.org, json.data.brand)
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const siteUrl = slug ? getTenantUrl(slug) : '#'

  const contrastIssues =
    isHexColor(primaryColor) && isHexColor(secondaryColor)
      ? evaluateBrandContrast(primaryColor, secondaryColor, theme)
      : []

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Marca y sitio</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Personaliza cómo se ve tu tienda pública. El subdominio no se puede cambiar.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={siteUrl} target="_blank" rel="noreferrer">
            Ver sitio público
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <Card className="p-4 overflow-hidden">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Vista previa</p>
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
            <p className="text-[11px] uppercase tracking-wider text-white/60 mt-1">
              Sitio {theme === 'dark' ? 'oscuro' : 'claro'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <section className="space-y-4">
            <h2 className="font-semibold text-[#0B2447]">Identidad</h2>
            <div className="space-y-2">
              <Label>Subdominio</Label>
              <Input
                value={`${slug}.${getRootDomain()}`}
                disabled
                className="font-mono bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customDomain">Dominio personalizado</Label>
              <Input
                id="customDomain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="rifas.midominio.com"
                disabled={plan !== 'unlimited'}
                className="font-mono"
              />
              {plan !== 'unlimited' ? (
                <p className="text-xs text-muted-foreground">
                  Disponible en el plan Ilimitado.{' '}
                  <Link href="/admin/billing" className="text-[#1976D2] hover:underline">
                    Mejorar plan
                  </Link>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Crea un CNAME apuntando a{' '}
                  <span className="font-mono">{getRootDomain()}</span>. No
                  configuramos SSL automáticamente.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la marca</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">Eslogan</Label>
              <Input
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Tu mensaje en el hero del sitio"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex flex-wrap items-center gap-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-16 w-auto rounded border bg-white" />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleLogoUpload(file)
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sube la imagen y luego guarda los cambios.
              </p>
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="font-semibold text-[#0B2447]">Colores</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExtractColors}
                disabled={!logoPreview || extracting || uploading}
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Pipette className="h-4 w-4 mr-2" />
                )}
                Extraer del logo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Detecta primario y acento a partir del logo. También se sugiere al subir uno nuevo.
            </p>
            <div className="space-y-2">
              <Label>Apariencia del sitio</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors',
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
                    'flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors',
                    theme === 'dark'
                      ? 'border-[#0B2447] bg-[#0B2447] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <Moon className="h-4 w-4" />
                  Oscuro
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Fondos y textos del sitio público. El panel de admin siempre queda claro.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Color primario</Label>
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
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Fondos, footer, textos fuertes</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Color de acento</Label>
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
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Botones y destacados</p>
              </div>
            </div>
            {contrastIssues.length > 0 && (
              <div
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 space-y-2"
                role="status"
              >
                <p className="text-sm font-semibold text-amber-950">
                  Problemas de contraste detectados
                </p>
                <ul className="space-y-1.5">
                  {contrastIssues.map((issue) => (
                    <li key={issue.id} className="text-sm text-amber-900 flex gap-2">
                      <span
                        className={cn(
                          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          issue.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'
                        )}
                      />
                      <span>
                        {issue.message}{' '}
                        <span className="text-amber-700/80 font-mono text-xs">
                          ({issue.ratio}:1, mínimo {issue.required}:1)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-800/80">
                  {theme === 'dark'
                    ? 'En sitio oscuro usa un primario más claro o un acento más vivo. Puedes guardar igual: el sitio intentará compensar títulos y botones.'
                    : 'En sitio claro usa un primario más oscuro o un acento con más contraste.'}
                </p>
              </div>
            )}
          </section>

          <section className="space-y-4 border-t pt-6">
            <h2 className="font-semibold text-[#0B2447]">Contacto</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email de contacto</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="República Dominicana"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Email de notificaciones</Label>
              <Input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Recibe avisos de nuevas compras"
              />
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <h2 className="font-semibold text-[#0B2447]">Datos del cliente</h2>
            <p className="text-xs text-muted-foreground -mt-2">
              Elige qué pides al comprar boletos. Nombre y WhatsApp vienen activos por defecto.
            </p>
            <div className="space-y-2">
              {(
                [
                  {
                    key: 'name' as CheckoutFieldKey,
                    title: 'Nombre completo',
                    hint: 'Cómo identificas al comprador',
                  },
                  {
                    key: 'email' as CheckoutFieldKey,
                    title: 'Correo electrónico',
                    hint: 'Para enviar confirmación cuando verifiques el pago',
                  },
                  {
                    key: 'phone' as CheckoutFieldKey,
                    title: 'Número de WhatsApp',
                    hint: 'También se usa para buscar boletos',
                  },
                ] as const
              ).map((field) => {
                const enabledCount = Number(checkoutFields.name) + Number(checkoutFields.email) + Number(checkoutFields.phone)
                const locked = checkoutFields[field.key] && enabledCount === 1
                return (
                  <label
                    key={field.key}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={checkoutFields[field.key]}
                      disabled={locked}
                      onCheckedChange={(checked) => {
                        const next = { ...checkoutFields, [field.key]: checked === true }
                        if (!next.name && !next.email && !next.phone) return
                        setCheckoutFields(next)
                      }}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium text-[#0B2447]">{field.title}</span>
                      <span className="block text-xs text-muted-foreground">{field.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <h2 className="font-semibold text-[#0B2447]">Redes sociales</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/tu-pagina"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/tu-cuenta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter">X / Twitter</Label>
                <Input
                  id="twitter"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  placeholder="https://x.com/tu-cuenta"
                />
              </div>
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">{success}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              className="bg-[#1976D2] hover:bg-[#1565C0]"
              disabled={saving || uploading || extracting}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar marca'}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/admin">Volver al dashboard</Link>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
