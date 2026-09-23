export type OrgTheme = 'light' | 'dark'

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
}

export const DEFAULT_PRIMARY_COLOR = '#0B2447'
export const DEFAULT_SECONDARY_COLOR = '#1976D2'
export const DEFAULT_ORG_THEME: OrgTheme = 'light'

export function normalizeOrgTheme(value: unknown): OrgTheme {
  return value === 'dark' ? 'dark' : 'light'
}
