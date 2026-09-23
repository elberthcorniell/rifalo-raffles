'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import type { OrgBrand, Organization } from '@/types/org'
import { DEFAULT_ORG_THEME, DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from '@/types/org'
import { PLATFORM, getPlatformUrl, getRootDomain } from '@/lib/constants'
import { getBrandCssVars } from '@/lib/colors'

interface OrgContextValue {
  org: Organization | null
  brand: OrgBrand
  loading: boolean
  setBrandState: (org: Organization, brand: OrgBrand) => void
  refreshBrand: () => Promise<void>
}

const fallbackBrand: OrgBrand = {
  name: PLATFORM.name,
  slug: '',
  url: getPlatformUrl(),
  domain: getRootDomain(),
  tagline: PLATFORM.tagline,
  email: PLATFORM.email,
  phone: '',
  logo: '/logo.jpg',
  adminEmail: PLATFORM.email,
  copyright: PLATFORM.copyright,
  twitter_handle: '',
  social: { facebook: '#', instagram: '#', twitter: '#' },
  location: '',
  primaryColor: DEFAULT_PRIMARY_COLOR,
  secondaryColor: DEFAULT_SECONDARY_COLOR,
  theme: DEFAULT_ORG_THEME,
}

const OrgContext = createContext<OrgContextValue>({
  org: null,
  brand: fallbackBrand,
  loading: false,
  setBrandState: () => {},
  refreshBrand: async () => {},
})

function isStorefrontPath(pathname: string | null) {
  return (
    !!pathname &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/platform') &&
    !pathname.startsWith('/superadmin')
  )
}

function applyBrandTheme(brand: OrgBrand | null, applyAppearance: boolean) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!brand) {
    for (const key of [
      '--primary',
      '--primary-glow',
      '--primary-foreground',
      '--secondary',
      '--secondary-glow',
      '--secondary-foreground',
    ]) {
      root.style.removeProperty(key)
    }
    root.classList.remove('dark')
    return
  }
  const vars = getBrandCssVars(brand.primaryColor, brand.secondaryColor)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  // Admin / platform stay light; only the public storefront follows org theme
  root.classList.toggle('dark', applyAppearance && brand.theme === 'dark')
}

export function OrgBrandProvider({
  children,
  initialOrg = null,
  initialBrand = null,
}: {
  children: ReactNode
  initialOrg?: Organization | null
  initialBrand?: OrgBrand | null
}) {
  const pathname = usePathname()
  const [org, setOrg] = useState<Organization | null>(initialOrg)
  const [brand, setBrand] = useState<OrgBrand>(initialBrand ?? fallbackBrand)
  const [loading, setLoading] = useState(false)

  // Keep client state in sync when the server layout re-renders with new brand data
  useEffect(() => {
    setOrg(initialOrg)
    setBrand(initialBrand ?? fallbackBrand)
  }, [initialOrg, initialBrand])

  const setBrandState = useCallback((nextOrg: Organization, nextBrand: OrgBrand) => {
    setOrg(nextOrg)
    setBrand(nextBrand)
  }, [])

  const refreshBrand = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/org')
      const json = await res.json()
      if (json.success) {
        setOrg(json.data.org)
        setBrand(json.data.brand)
      }
    } catch {
      // keep current
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (org) applyBrandTheme(brand, isStorefrontPath(pathname))
    else applyBrandTheme(null, false)
  }, [org, brand, pathname])

  return (
    <OrgContext.Provider value={{ org, brand, loading, setBrandState, refreshBrand }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrgBrand(): OrgBrand {
  return useContext(OrgContext).brand
}

export function useOrg(): OrgContextValue {
  return useContext(OrgContext)
}
