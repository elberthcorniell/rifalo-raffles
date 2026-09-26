import type { ThemeColors } from '@/types/org'

/** Convert #RRGGBB to "H S% L%" for CSS hsl(var(--token)). */
export function hexToHslChannels(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim())
}

export function normalizeHexColor(value: string, fallback: string): string {
  const v = value.trim()
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v}`
  if (isHexColor(v)) return v
  return fallback
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Mix two hex colors. amount 0 returns `from`, 1 returns `to`. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = parseHexRgb(from)
  const b = parseHexRgb(to)
  if (!a || !b) return from
  const t = Math.max(0, Math.min(1, amount))
  const channel = (start: number, end: number) => Math.round(start + (end - start) * t)
  return (
    '#' +
    [channel(a.r, b.r), channel(a.g, b.g), channel(a.b, b.b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  )
}

/** Relative luminance per WCAG 2.1 */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHexRgb(hex)
  if (!rgb) return null
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** Contrast ratio of two hex colors (1–21). Null if either is invalid. */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  if (a == null || b == null) return null
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsContrast(
  fg: string,
  bg: string,
  level: 'aa' | 'aa-large' = 'aa'
): boolean {
  const ratio = contrastRatio(fg, bg)
  if (ratio == null) return false
  return level === 'aa-large' ? ratio >= 3 : ratio >= 4.5
}

/** Footer colors fall back to the brand primary and a readable text color. */
export function resolveFooterColors(
  primary: string,
  footerBg: string | null | undefined,
  footerText: string | null | undefined
): { bg: string; text: string } {
  const bg = isHexColor(footerBg || '') ? (footerBg as string).trim() : primary
  const text = isHexColor(footerText || '') ? (footerText as string).trim() : bestForegroundOn(bg)
  return { bg, text }
}

/** Best readable text color (near-white or near-black) on a solid fill. */
export function bestForegroundOn(bg: string): string {
  const white = contrastRatio('#FFFFFF', bg) ?? 0
  const black = contrastRatio('#0A0A0A', bg) ?? 0
  return white >= black ? '#FFFFFF' : '#0A0A0A'
}

/** Approx. page surfaces used by the storefront themes. */
export const THEME_SURFACES = {
  light: '#FFFFFF',
  dark: '#0F1419',
} as const

export type ContrastIssue = {
  id: string
  severity: 'error' | 'warn'
  message: string
  ratio: number
  required: number
}

/**
 * Check brand colors against the chosen site appearance (claro/oscuro).
 * Mirrors how the storefront uses primary (titles/outline) and secondary (CTAs).
 */
export function evaluateBrandContrast(
  primary: string,
  secondary: string,
  theme: 'light' | 'dark' | 'custom',
  customSurface?: string
): ContrastIssue[] {
  const surface =
    theme === 'custom'
      ? customSurface && isHexColor(customSurface)
        ? customSurface
        : THEME_SURFACES.light
      : THEME_SURFACES[theme]
  const issues: ContrastIssue[] = []

  const push = (
    id: string,
    message: string,
    fg: string,
    bg: string,
    required: number,
    severity: 'error' | 'warn' = 'error'
  ) => {
    const ratio = contrastRatio(fg, bg)
    if (ratio == null) return
    if (ratio < required) {
      issues.push({
        id,
        severity,
        message,
        ratio: Math.round(ratio * 10) / 10,
        required,
      })
    }
  }

  // Hero title / outline CTA use primary on page background (large text → 3:1)
  push(
    'primary-on-surface',
    theme === 'dark'
      ? 'El primario es demasiado oscuro para títulos sobre fondo oscuro'
      : theme === 'custom'
        ? 'El primario no contrasta con el fondo personalizado'
        : 'El primario es demasiado claro para títulos sobre fondo claro',
    primary,
    surface,
    3
  )

  // Accent as text (badge, “En Vivo”) on page background
  push(
    'secondary-on-surface',
    theme === 'dark'
      ? 'El acento no contrasta lo suficiente sobre el fondo oscuro'
      : theme === 'custom'
        ? 'El acento no contrasta lo suficiente sobre el fondo personalizado'
        : 'El acento no contrasta lo suficiente sobre el fondo claro',
    secondary,
    surface,
    3,
    'warn'
  )

  // Filled CTA: text on secondary fill (normal text → 4.5:1)
  const secondaryFg = bestForegroundOn(secondary)
  push(
    'text-on-secondary',
    secondaryFg === '#FFFFFF'
      ? 'El acento es demasiado claro: el texto blanco del botón no se lee'
      : 'El acento es demasiado oscuro: el texto del botón no se lee',
    secondaryFg,
    secondary,
    4.5
  )

  // Footer / solid primary fills
  const primaryFg = bestForegroundOn(primary)
  push(
    'text-on-primary',
    'El primario no tiene suficiente contraste con su texto (footer / bloques sólidos)',
    primaryFg,
    primary,
    4.5,
    'warn'
  )

  return issues
}

/** CSS custom-property values (H S% L%) for applying brand colors on :root / <html>. */
export function getBrandCssVars(primaryHex: string, secondaryHex: string): Record<string, string> {
  const primary = hexToHslChannels(primaryHex)
  const secondary = hexToHslChannels(secondaryHex)
  const primaryFg = hexToHslChannels(bestForegroundOn(primaryHex))
  const secondaryFg = hexToHslChannels(bestForegroundOn(secondaryHex))
  const vars: Record<string, string> = {}
  if (primary) {
    vars['--primary'] = primary
    vars['--primary-glow'] = primary
  }
  if (primaryFg) vars['--primary-foreground'] = primaryFg
  if (secondary) {
    vars['--secondary'] = secondary
    vars['--secondary-glow'] = secondary
  }
  if (secondaryFg) vars['--secondary-foreground'] = secondaryFg
  return vars
}

export const THEME_SURFACE_KEYS = [
  '--background',
  '--background-alt',
  '--foreground',
  '--card',
  '--card-foreground',
  '--card-border',
  '--popover',
  '--popover-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
] as const

/** HSL channel vars for a user-picked storefront theme. */
export function getThemeSurfaceCssVars(colors: ThemeColors): Record<string, string> {
  const set = (key: string, hex: string, vars: Record<string, string>) => {
    const channels = hexToHslChannels(hex)
    if (channels) vars[key] = channels
  }
  const border = mixHex(colors.background, colors.foreground, 0.16)
  const mutedFill = mixHex(colors.background, colors.foreground, 0.06)
  const vars: Record<string, string> = {}
  set('--background', colors.background, vars)
  set('--background-alt', colors.backgroundAlt, vars)
  set('--foreground', colors.foreground, vars)
  set('--card', colors.card, vars)
  set('--card-foreground', colors.foreground, vars)
  set('--card-border', border, vars)
  set('--popover', colors.card, vars)
  set('--popover-foreground', colors.foreground, vars)
  set('--muted', mutedFill, vars)
  set('--muted-foreground', colors.muted, vars)
  set('--accent', colors.backgroundAlt, vars)
  set('--accent-foreground', colors.foreground, vars)
  set('--border', border, vars)
  set('--input', border, vars)
  return vars
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
      .join('')
  )
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

type Swatch = { r: number; g: number; b: number; count: number; s: number; l: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar el logo para analizar colores'))
    img.src = src
  })
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function topCandidates<T>(ranked: T[], min = 3, max = 5): T[] {
  if (ranked.length === 0) return []
  const poolSize = Math.min(ranked.length, min + Math.floor(Math.random() * (max - min + 1)))
  return ranked.slice(0, Math.max(1, poolSize))
}

function deriveAccentFromPrimary(primary: Swatch): Swatch {
  const hsl = rgbToHsl(primary.r, primary.g, primary.b)
  const accentL = Math.min(62, Math.max(42, hsl.l + 18))
  const accentS = Math.min(90, hsl.s + 15)
  const factor = accentL / Math.max(hsl.l, 1)
  return {
    r: Math.min(255, primary.r * factor + 40),
    g: Math.min(255, primary.g * factor + 40),
    b: Math.min(255, primary.b * factor + 40),
    count: 1,
    s: accentS,
    l: accentL,
  }
}

/**
 * Extract primary (deeper) and accent (brighter/vivid) colors from an image URL or blob URL.
 * Ranks candidates, then randomly picks among the top 3–5 so re-runs feel varied.
 */
export async function extractPaletteFromImage(
  src: string
): Promise<{ primary: string; secondary: string }> {
  const img = await loadImage(src)
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas no disponible')

  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const buckets = new Map<string, Swatch>()

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue
    // Quantize to reduce noise
    const r = Math.round(data[i] / 24) * 24
    const g = Math.round(data[i + 1] / 24) * 24
    const b = Math.round(data[i + 2] / 24) * 24
    const { s, l } = rgbToHsl(r, g, b)
    // Skip near-white / near-black / very gray
    if (l > 92 || l < 8) continue
    if (s < 12 && l > 25 && l < 85) continue

    const key = `${r},${g},${b}`
    const existing = buckets.get(key)
    if (existing) {
      existing.count += 1
    } else {
      buckets.set(key, { r, g, b, count: 1, s, l })
    }
  }

  const swatches = [...buckets.values()].sort((a, b) => b.count - a.count)
  if (swatches.length === 0) {
    throw new Error('No se encontraron colores útiles en el logo')
  }

  // Prefer saturated, reasonably dark colors for primary
  const primaryRanked = [...swatches].sort((a, b) => {
    const score = (c: Swatch) => c.count * (1 + c.s / 50) * (1 + (55 - Math.abs(c.l - 35)) / 55)
    return score(b) - score(a)
  })
  const primary = pickRandom(topCandidates(primaryRanked))

  // Accent: vivid and visually distinct from primary
  const secondaryRanked = [...swatches]
    .filter((c) => colorDistance(c, primary) > 55)
    .sort((a, b) => {
      const score = (c: Swatch) => c.count * (1 + c.s / 40) * (1 + (60 - Math.abs(c.l - 50)) / 60)
      return score(b) - score(a)
    })

  const secondaryPool = topCandidates(secondaryRanked)
  const secondary =
    secondaryPool.length > 0 ? pickRandom(secondaryPool) : deriveAccentFromPrimary(primary)

  return {
    primary: rgbToHex(primary.r, primary.g, primary.b),
    secondary: rgbToHex(secondary.r, secondary.g, secondary.b),
  }
}
