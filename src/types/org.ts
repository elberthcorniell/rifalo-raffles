export type OrgTheme = 'light' | 'dark' | 'custom'

export interface ThemeColors {
  background: string
  backgroundAlt: string
  foreground: string
  card: string
  muted: string
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  background: '#FFFFFF',
  backgroundAlt: '#F5F7FB',
  foreground: '#0B2447',
  card: '#FFFFFF',
  muted: '#64748B',
}

function hexOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.trim()) ? value.trim() : fallback
}

export function normalizeThemeColors(value: unknown): ThemeColors {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    background: hexOr(raw.background, DEFAULT_THEME_COLORS.background),
    backgroundAlt: hexOr(raw.backgroundAlt, DEFAULT_THEME_COLORS.backgroundAlt),
    foreground: hexOr(raw.foreground, DEFAULT_THEME_COLORS.foreground),
    card: hexOr(raw.card, DEFAULT_THEME_COLORS.card),
    muted: hexOr(raw.muted, DEFAULT_THEME_COLORS.muted),
  }
}

export type CheckoutFieldKey = 'name' | 'email' | 'phone'

export interface CheckoutFields {
  name: boolean
  email: boolean
  phone: boolean
}

export const DEFAULT_CHECKOUT_FIELDS: CheckoutFields = {
  name: true,
  email: false,
  phone: true,
}

export function normalizeCheckoutFields(value: unknown): CheckoutFields {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const next: CheckoutFields = {
    name: raw.name !== false,
    email: raw.email === true,
    phone: raw.phone !== false,
  }
  if (!next.name && !next.email && !next.phone) {
    return { ...DEFAULT_CHECKOUT_FIELDS }
  }
  return next
}

export type OrgPlan = 'free' | 'plus' | 'unlimited'

export interface Organization {
  id: string
  slug: string
  name: string
  logo_path: string | null
  tagline: string
  email: string | null
  phone: string | null
  admin_email: string | null
  location: string | null
  primary_color: string
  secondary_color: string
  theme?: OrgTheme
  theme_colors?: ThemeColors | null
  show_hero_copy?: boolean
  show_how_it_works?: boolean
  show_raffles?: boolean
  show_trust_benefits?: boolean
  show_testimonials?: boolean
  footer_bg_color?: string | null
  footer_text_color?: string | null
  heading_font?: string
  body_font?: string
  checkout_fields?: CheckoutFields
  facebook_url: string | null
  instagram_url: string | null
  twitter_url: string | null
  plan?: OrgPlan
  plan_override?: OrgPlan | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  stripe_subscription_status?: string | null
  custom_domain?: string | null
  onboarding_completed_at?: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
}

export type OrgMemberRole = 'owner' | 'admin'

export interface OrgMember {
  org_id: string
  user_id: string
  role: OrgMemberRole
  created_at?: string
}

export interface OrgBrand {
  name: string
  slug: string
  url: string
  domain: string
  tagline: string
  email: string
  phone: string
  logo: string
  adminEmail: string
  copyright: string
  twitter_handle: string
  social: {
    facebook: string
    instagram: string
    twitter: string
  }
  location: string
  primaryColor: string
  secondaryColor: string
  theme: OrgTheme
  themeColors: ThemeColors
  showHeroCopy: boolean
  showHowItWorks: boolean
  showRaffles: boolean
  showTrustBenefits: boolean
  showTestimonials: boolean
  footerBgColor: string
  footerTextColor: string
  headingFont: string
  bodyFont: string
}

export const DEFAULT_PRIMARY_COLOR = '#0B2447'
export const DEFAULT_SECONDARY_COLOR = '#1976D2'
export const DEFAULT_ORG_THEME: OrgTheme = 'light'

export function normalizeOrgTheme(value: unknown): OrgTheme {
  if (value === 'dark' || value === 'custom') return value
  return 'light'
}
