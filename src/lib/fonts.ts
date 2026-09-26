export const DEFAULT_SITE_FONT = 'Poppins'

export const SITE_FONTS = [
  { name: 'Poppins', fallback: 'sans-serif' },
  { name: 'Inter', fallback: 'sans-serif' },
  { name: 'Montserrat', fallback: 'sans-serif' },
  { name: 'Nunito', fallback: 'sans-serif' },
  { name: 'DM Sans', fallback: 'sans-serif' },
  { name: 'Outfit', fallback: 'sans-serif' },
  { name: 'Raleway', fallback: 'sans-serif' },
  { name: 'Rubik', fallback: 'sans-serif' },
  { name: 'Work Sans', fallback: 'sans-serif' },
  { name: 'Lato', fallback: 'sans-serif' },
  { name: 'Open Sans', fallback: 'sans-serif' },
  { name: 'Roboto', fallback: 'sans-serif' },
  { name: 'Manrope', fallback: 'sans-serif' },
  { name: 'Plus Jakarta Sans', fallback: 'sans-serif' },
  { name: 'Figtree', fallback: 'sans-serif' },
  { name: 'Karla', fallback: 'sans-serif' },
  { name: 'Mulish', fallback: 'sans-serif' },
  { name: 'Quicksand', fallback: 'sans-serif' },
  { name: 'Urbanist', fallback: 'sans-serif' },
  { name: 'Playfair Display', fallback: 'serif' },
  { name: 'Merriweather', fallback: 'serif' },
  { name: 'Lora', fallback: 'serif' },
  { name: 'Libre Baskerville', fallback: 'serif' },
  { name: 'Oswald', fallback: 'sans-serif' },
] as const

export type SiteFontName = (typeof SITE_FONTS)[number]['name']

export function isSiteFont(value: string): value is SiteFontName {
  return SITE_FONTS.some((font) => font.name === value)
}

export function normalizeSiteFont(value: unknown): SiteFontName {
  const name = typeof value === 'string' ? value.trim() : ''
  return isSiteFont(name) ? name : DEFAULT_SITE_FONT
}

export function fontFamilyValue(value: unknown): string {
  const name = normalizeSiteFont(value)
  const font = SITE_FONTS.find((item) => item.name === name) ?? SITE_FONTS[0]
  return `'${font.name}', ${font.fallback}`
}

/** Stylesheet for the given Google fonts. Names outside the catalog are ignored. */
export function googleFontsHref(fonts: string[], weights = '400;600;700'): string {
  const unique = [...new Set(fonts.map((font) => normalizeSiteFont(font)))]
  const families = unique
    .map((name) => `family=${name.replace(/ /g, '+')}:wght@${weights}`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}
