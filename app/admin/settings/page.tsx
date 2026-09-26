'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2, ExternalLink, Pipette, Sun, Moon, Palette } from 'lucide-react'
import { getTenantUrl } from '@/lib/constants'
import { useOrg } from '@/components/OrgBrandProvider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  DEFAULT_CHECKOUT_FIELDS,
  DEFAULT_ORG_THEME,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  DEFAULT_THEME_COLORS,
  normalizeCheckoutFields,
  normalizeOrgTheme,
  normalizeThemeColors,
  type CheckoutFieldKey,
  type CheckoutFields,
  type OrgTheme,
  type ThemeColors,
} from '@/types/org'
import {
  contrastRatio,
  evaluateBrandContrast,
  extractPaletteFromImage,
  isHexColor,
  resolveFooterColors,
} from '@/lib/colors'
import { cn } from '@/lib/utils'
import { SitePreview } from '@/components/admin/SitePreview'
import {
  DEFAULT_SITE_FONT,
  SITE_FONTS,
  fontFamilyValue,
  googleFontsHref,
  normalizeSiteFont,
} from '@/lib/fonts'

export default function AdminSettingsPage() {
  const { setBrandState } = useOrg()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<string[]>([])
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
  const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_THEME_COLORS)
  const [showHeroCopy, setShowHeroCopy] = useState(true)
  const [showHowItWorks, setShowHowItWorks] = useState(true)
  const [showTrustBenefits, setShowTrustBenefits] = useState(true)
  const [showTestimonials, setShowTestimonials] = useState(true)
  const [footerBgColor, setFooterBgColor] = useState(DEFAULT_PRIMARY_COLOR)
  const [footerTextColor, setFooterTextColor] = useState('#FFFFFF')
  const [headingFont, setHeadingFont] = useState(DEFAULT_SITE_FONT)
  const [bodyFont, setBodyFont] = useState(DEFAULT_SITE_FONT)
  const [checkoutFields, setCheckoutFields] = useState<CheckoutFields>(
    DEFAULT_CHECKOUT_FIELDS
  )
  const [facebookUrl, setFacebookUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

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
          setThemeColors(normalizeThemeColors(o.theme_colors))
          setShowHeroCopy(o.show_hero_copy !== false)
          setShowHowItWorks(o.show_how_it_works !== false)
          setShowTrustBenefits(o.show_trust_benefits !== false)
          setShowTestimonials(o.show_testimonials !== false)
          const footer = resolveFooterColors(
            o.primary_color || DEFAULT_PRIMARY_COLOR,
            o.footer_bg_color,
            o.footer_text_color
          )
          setFooterBgColor(footer.bg)
          setFooterTextColor(footer.text)
          setHeadingFont(normalizeSiteFont(o.heading_font))
          setBodyFont(normalizeSiteFont(o.body_font))
          setCheckoutFields(normalizeCheckoutFields(o.checkout_fields))
          setFacebookUrl(o.facebook_url || '')
          setInstagramUrl(o.instagram_url || '')
          setTwitterUrl(o.twitter_url || '')
          setLogoPath(o.logo_path)
          setLogoPreview(json.data.brand?.logo || null)
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
    setError(null)
    setSuccess(null)
    if (!name.trim()) {
      setError('El nombre de la marca es obligatorio')
      setOpenSections((current) =>
        current.includes('identidad') ? current : ['identidad', ...current]
      )
      return
    }
    setSaving(true)
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
          themeColors,
          showHeroCopy,
          showHowItWorks,
          showTrustBenefits,
          showTestimonials,
          footerBgColor,
          footerTextColor,
          headingFont,
          bodyFont,
          checkoutFields,
          facebookUrl,
          instagramUrl,
          twitterUrl,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Error al guardar')
        return
      }
      setSuccess('Sitio actualizado. Ya se refleja en tu sitio público.')
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
      ? evaluateBrandContrast(primaryColor, secondaryColor, theme, themeColors.background)
      : []

  const preview = (
    <SitePreview
      name={name}
      tagline={tagline}
      logo={logoPreview}
      email={email}
      phone={phone}
      location={location}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      theme={theme}
      themeColors={themeColors}
      slug={slug}
      siteUrl={siteUrl}
      facebookUrl={facebookUrl}
      instagramUrl={instagramUrl}
      twitterUrl={twitterUrl}
      showHeroCopy={showHeroCopy}
      showHowItWorks={showHowItWorks}
      showTrustBenefits={showTrustBenefits}
      showTestimonials={showTestimonials}
      footerBgColor={footerBgColor}
      footerTextColor={footerTextColor}
      headingFont={headingFont}
      bodyFont={bodyFont}
    />
  )

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start lg:gap-8">
    <div className="max-w-3xl space-y-6 lg:max-w-none">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Sitio web</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Personaliza cómo se ve tu tienda pública.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={siteUrl} target="_blank" rel="noreferrer">
            Ver sitio público
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <Card className="p-4 overflow-hidden lg:hidden">
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
              Sitio {theme === 'dark' ? 'oscuro' : theme === 'custom' ? 'personalizado' : 'claro'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSave}>
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="w-full"
          >
          <AccordionItem value="identidad" className="border-slate-200">
            <AccordionTrigger className="py-4 text-base font-semibold text-[#0B2447] hover:no-underline">
              Identidad
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la marca</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
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
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="secciones" className="border-slate-200">
            <AccordionTrigger className="py-4 text-base font-semibold text-[#0B2447] hover:no-underline">
              Secciones
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
            <p className="text-xs text-muted-foreground -mt-2">
              Elige qué bloques aparecen en el inicio. Ocultar una sección no borra su contenido.
            </p>
            {(
              [
                {
                  checked: showHeroCopy,
                  onChange: setShowHeroCopy,
                  title: 'Texto junto a la rifa destacada',
                  hint: 'Nombre, eslogan, botones y estadísticas. Si lo ocultas, la portada muestra solo la rifa.',
                },
                {
                  checked: showHowItWorks,
                  onChange: setShowHowItWorks,
                  title: 'Cómo funciona',
                  hint: 'Los tres pasos debajo del inicio. Si la ocultas, también se quita su enlace del footer.',
                },
                {
                  checked: showTrustBenefits,
                  onChange: setShowTrustBenefits,
                  title: 'Por qué elegirnos',
                  hint: 'Sorteo transparente, envío, pago seguro y soporte.',
                },
                {
                  checked: showTestimonials,
                  onChange: setShowTestimonials,
                  title: 'Testimonios',
                  hint: 'Las opiniones de ganadores. Si la ocultas, no se muestran aunque existan, y se quita el enlace del footer.',
                },
              ] as const
            ).map((item) => (
              <label
                key={item.title}
                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer"
              >
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={(checked) => item.onChange(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium text-[#0B2447]">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
              </label>
            ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="colores" className="border-slate-200">
            <AccordionTrigger className="py-4 text-base font-semibold text-[#0B2447] hover:no-underline">
              Colores
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
            <div className="flex justify-end">
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
              <div className="grid grid-cols-3 gap-2">
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
                <button
                  type="button"
                  onClick={() => setTheme('custom')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors',
                    theme === 'custom'
                      ? 'border-[#0B2447] bg-[#0B2447] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <Palette className="h-4 w-4" />
                  Personalizado
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Fondos y textos del sitio público. El panel de admin siempre queda claro.
              </p>
              {theme === 'custom' && (
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  {(
                    [
                      ['background', 'Fondo'],
                      ['backgroundAlt', 'Fondo de secciones'],
                      ['foreground', 'Texto'],
                      ['muted', 'Texto secundario'],
                      ['card', 'Tarjetas'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`theme-${key}`}>{label}</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={themeColors[key]}
                          onChange={(e) =>
                            setThemeColors((current) => ({ ...current, [key]: e.target.value }))
                          }
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          id={`theme-${key}`}
                          value={themeColors[key]}
                          onChange={(e) =>
                            setThemeColors((current) => ({ ...current, [key]: e.target.value }))
                          }
                          className="font-mono"
                          pattern="^#[0-9A-Fa-f]{6}$"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <p className="text-xs text-muted-foreground">Fondos y textos fuertes</p>
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
              <div className="space-y-2">
                <Label htmlFor="footerBgColor">Fondo del footer</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={isHexColor(footerBgColor) ? footerBgColor : DEFAULT_PRIMARY_COLOR}
                    onChange={(e) => setFooterBgColor(e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    id="footerBgColor"
                    value={footerBgColor}
                    onChange={(e) => setFooterBgColor(e.target.value)}
                    className="font-mono"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="footerTextColor">Texto del footer</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={isHexColor(footerTextColor) ? footerTextColor : '#FFFFFF'}
                    onChange={(e) => setFooterTextColor(e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    id="footerTextColor"
                    value={footerTextColor}
                    onChange={(e) => setFooterTextColor(e.target.value)}
                    className="font-mono"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>
            </div>
            {isHexColor(footerBgColor) &&
              isHexColor(footerTextColor) &&
              (contrastRatio(footerTextColor, footerBgColor) ?? 0) < 4.5 && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                  El texto del footer no contrasta lo suficiente con el fondo.
                </p>
              )}
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
                    : theme === 'custom'
                      ? 'Ajusta el fondo del tema, o cambia el primario y el acento, hasta que el texto se lea bien.'
                      : 'En sitio claro usa un primario más oscuro o un acento con más contraste.'}
                </p>
              </div>
            )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tipografia" className="border-slate-200">
            <AccordionTrigger className="py-4 text-base font-semibold text-[#0B2447] hover:no-underline">
              Tipografía
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
            <p className="text-xs text-muted-foreground -mt-2">
              Poppins sigue siendo la fuente por defecto. Los títulos y los párrafos se pueden cambiar por separado.
            </p>
            <link rel="stylesheet" href={googleFontsHref(SITE_FONTS.map((font) => font.name))} />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="headingFont">Títulos</Label>
                <select
                  id="headingFont"
                  value={headingFont}
                  onChange={(e) => setHeadingFont(normalizeSiteFont(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  style={{ fontFamily: fontFamilyValue(headingFont) }}
                >
                  {SITE_FONTS.map((font) => (
                    <option
                      key={font.name}
                      value={font.name}
                      style={{ fontFamily: fontFamilyValue(font.name) }}
                    >
                      {font.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodyFont">Párrafos</Label>
                <select
                  id="bodyFont"
                  value={bodyFont}
                  onChange={(e) => setBodyFont(normalizeSiteFont(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  style={{ fontFamily: fontFamilyValue(bodyFont) }}
                >
                  {SITE_FONTS.map((font) => (
                    <option
                      key={font.name}
                      value={font.name}
                      style={{ fontFamily: fontFamilyValue(font.name) }}
                    >
                      {font.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="contacto" className="border-slate-200">
            <AccordionTrigger className="py-4 text-base font-semibold text-[#0B2447] hover:no-underline">
              Contacto
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
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
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cliente" className="border-slate-200">
            <AccordionTrigger className="py-4 text-base font-semibold text-[#0B2447] hover:no-underline">
              Datos del cliente
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
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
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="redes" className="border-slate-200">
            <AccordionTrigger className="py-4 text-base font-semibold text-[#0B2447] hover:no-underline">
              Redes sociales
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
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
            </AccordionContent>
          </AccordionItem>
          </Accordion>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">{success}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-6">
            <Button
              type="submit"
              className="bg-[#1976D2] hover:bg-[#1565C0]"
              disabled={saving || uploading || extracting}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar sitio'}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/admin">Volver al dashboard</Link>
            </Button>
          </div>
        </form>
      </Card>
    </div>
    <aside className="hidden lg:block sticky top-8">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
        Vista previa del sitio
      </p>
      {preview}
      <p className="text-xs text-muted-foreground mt-2">
        Se actualiza mientras editas. Guarda para publicarlo.
      </p>
    </aside>
    </div>
  )
}
