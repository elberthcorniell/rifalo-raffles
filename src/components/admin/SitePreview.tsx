'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ExternalLink } from 'lucide-react'
import { getRootDomain } from '@/lib/constants'
import {
  getBrandCssVars,
  getThemeSurfaceCssVars,
  isHexColor,
  resolveFooterColors,
} from '@/lib/colors'
import { fontFamilyValue, googleFontsHref } from '@/lib/fonts'
import { OrgBrandScope, useOrg } from '@/components/OrgBrandProvider'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import HowItWorks from '@/components/HowItWorks'
import RaffleGrid from '@/components/RaffleGrid'
import TrustBenefits from '@/components/TrustBenefits'
import Footer from '@/components/Footer'
import { TestimonialsList } from '@/components/TestimonialsList'
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  type OrgBrand,
  type OrgTheme,
  type ThemeColors,
} from '@/types/org'
import type { Testimonial } from '@/types/testimonial'

const DESIGN_WIDTH = 1040

function PreviewTestimonials() {
  const [items, setItems] = useState<Testimonial[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/testimonials')
        const json = await res.json()
        if (!cancelled && json.success && Array.isArray(json.data)) {
          setItems(json.data)
        }
      } catch {
        // section stays empty
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return <TestimonialsList testimonials={items} />
}

export function SitePreview({
  name,
  tagline,
  logo,
  email,
  phone,
  location,
  primaryColor,
  secondaryColor,
  theme,
  themeColors,
  slug,
  siteUrl,
  facebookUrl,
  instagramUrl,
  twitterUrl,
  showHeroCopy,
  showHowItWorks,
  showTrustBenefits,
  showTestimonials,
  footerBgColor,
  footerTextColor,
  headingFont,
  bodyFont,
}: {
  name: string
  tagline: string
  logo: string | null
  email: string
  phone: string
  location: string
  primaryColor: string
  secondaryColor: string
  theme: OrgTheme
  themeColors: ThemeColors
  slug: string
  siteUrl: string
  facebookUrl: string
  instagramUrl: string
  twitterUrl: string
  showHeroCopy: boolean
  showHowItWorks: boolean
  showTrustBenefits: boolean
  showTestimonials: boolean
  footerBgColor: string
  footerTextColor: string
  headingFont: string
  bodyFont: string
}) {
  const saved = useOrg().brand
  const frameRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.38)
  const [contentHeight, setContentHeight] = useState(1600)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => {
      const width = frame.clientWidth
      if (width > 0) setScale(width / DESIGN_WIDTH)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const measure = () => setContentHeight(content.scrollHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [theme, name, tagline, logo, email, phone, location, showHeroCopy, showHowItWorks, showTrustBenefits, showTestimonials, footerBgColor, footerTextColor, headingFont, bodyFont])

  const primary = isHexColor(primaryColor) ? primaryColor : DEFAULT_PRIMARY_COLOR
  const secondary = isHexColor(secondaryColor) ? secondaryColor : DEFAULT_SECONDARY_COLOR
  const custom = theme === 'custom'
  const footer = resolveFooterColors(primary, footerBgColor, footerTextColor)
  const domain = slug ? `${slug}.${getRootDomain()}` : 'tu-sitio'
  const draft: OrgBrand = {
    ...saved,
    name: name.trim() || saved.name,
    tagline,
    logo: logo || saved.logo,
    email,
    phone,
    location,
    primaryColor: primary,
    secondaryColor: secondary,
    theme,
    themeColors,
    showHeroCopy,
    showHowItWorks,
    showTrustBenefits,
    showTestimonials,
    footerBgColor: footer.bg,
    footerTextColor: footer.text,
    headingFont,
    bodyFont,
    social: {
      facebook: facebookUrl.trim() || '#',
      instagram: instagramUrl.trim() || '#',
      twitter: twitterUrl.trim() || '#',
    },
  }
  const canvasStyle: CSSProperties = {
    width: DESIGN_WIDTH,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    ...getBrandCssVars(primary, secondary),
    ...(custom ? getThemeSurfaceCssVars(themeColors) : {}),
    ['--font-heading' as string]: fontFamilyValue(headingFont),
    ['--font-body' as string]: fontFamilyValue(bodyFont),
    ...(custom
      ? { backgroundColor: themeColors.background, color: themeColors.foreground }
      : {}),
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex shrink-0 gap-1" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-500">
          {domain}
        </div>
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#1976D2] hover:underline"
        >
          Abrir
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div
        ref={frameRef}
        className="overflow-y-auto overflow-x-hidden bg-slate-100"
        style={{ height: 'calc(100vh - 13rem)' }}
      >
        <div style={{ height: Math.max(contentHeight * scale, 1), position: 'relative' }}>
          <div
            ref={contentRef}
            className={theme === 'dark' ? 'site-preview-root storefront dark' : 'site-preview-root storefront'}
            style={canvasStyle}
          >
            <link rel="stylesheet" href={googleFontsHref([headingFont, bodyFont])} />
            <OrgBrandScope brand={draft}>
              <Header />
              <main>
                <Hero showCopy={showHeroCopy} showHowItWorks={showHowItWorks} />
                {showHowItWorks && <HowItWorks />}
                <RaffleGrid />
                {showTrustBenefits && <TrustBenefits />}
                {showTestimonials && <PreviewTestimonials />}
              </main>
              <Footer showHowItWorks={showHowItWorks} showTestimonials={showTestimonials} />
            </OrgBrandScope>
          </div>
        </div>
      </div>
    </div>
  )
}
