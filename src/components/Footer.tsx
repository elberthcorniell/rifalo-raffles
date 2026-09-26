'use client'

import { useEffect, useState } from 'react'
import { Mail, Phone, MapPin } from "lucide-react";
import { useOrgBrand } from "@/components/OrgBrandProvider";

const Footer = ({
  showHowItWorks,
  showTestimonials,
}: {
  showHowItWorks?: boolean
  showTestimonials?: boolean
}) => {
  const brand = useOrgBrand();
  const howItWorksVisible = showHowItWorks ?? brand.showHowItWorks
  const testimonialsVisible = showTestimonials ?? brand.showTestimonials
  const [hasTestimonials, setHasTestimonials] = useState(false)

  useEffect(() => {
    if (!testimonialsVisible) {
      setHasTestimonials(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/testimonials')
        const json = await res.json()
        if (!cancelled && json.success) {
          setHasTestimonials(Array.isArray(json.data) && json.data.length > 0)
        }
      } catch {
        // keep hidden
      }
    })()
    return () => {
      cancelled = true
    }
  }, [testimonialsVisible])

  return (
    <footer style={{ backgroundColor: brand.footerBgColor, color: brand.footerTextColor }}>
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img 
                src={brand.logo}
                alt={`${brand.name} Logo`}
                className="h-16 w-auto"
              />
            </div>
            <p className="opacity-80 text-sm">
              {brand.tagline || brand.name}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Enlaces Rápidos</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#rifas" className="opacity-80 hover:opacity-100 transition-opacity">Rifas Activas</a></li>
              {howItWorksVisible && (
                <li><a href="#como-funciona" className="opacity-80 hover:opacity-100 transition-opacity">Cómo Funciona</a></li>
              )}
              <li><a href="#ganadores" className="opacity-80 hover:opacity-100 transition-opacity">Ganadores</a></li>
              {testimonialsVisible && hasTestimonials && (
                <li><a href="#testimonios" className="opacity-80 hover:opacity-100 transition-opacity">Testimonios</a></li>
              )}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#terminos" className="opacity-80 hover:opacity-100 transition-opacity">Términos y Condiciones</a></li>
              <li><a href="#privacidad" className="opacity-80 hover:opacity-100 transition-opacity">Política de Privacidad</a></li>
              <li><a href="#reglamento" className="opacity-80 hover:opacity-100 transition-opacity">Reglamento de Rifas</a></li>
              <li><a href="#soporte" className="opacity-80 hover:opacity-100 transition-opacity">Soporte</a></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Contacto</h4>
            <div className="space-y-3 text-sm">
              {brand.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 opacity-80" />
                  <span className="opacity-80">{brand.email}</span>
                </div>
              )}
              {brand.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 opacity-80" />
                  <span className="opacity-80">{brand.phone}</span>
                </div>
              )}
              {brand.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 opacity-80" />
                  <span className="opacity-80">{brand.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-current/20 mt-8 pt-8 text-center">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="opacity-60 text-sm">
              {brand.copyright}. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-6 text-sm">
              {(brand.social.facebook !== '#' ||
                brand.social.instagram !== '#' ||
                brand.social.twitter !== '#') && (
                <>
                  <span className="opacity-60">Síguenos:</span>
                  <div className="flex gap-4">
                    {brand.social.facebook !== '#' && (
                      <a
                        href={brand.social.facebook}
                        target="_blank"
                        rel="noreferrer"
                        className="opacity-80 hover:opacity-100 transition-opacity"
                      >
                        Facebook
                      </a>
                    )}
                    {brand.social.instagram !== '#' && (
                      <a
                        href={brand.social.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="opacity-80 hover:opacity-100 transition-opacity"
                      >
                        Instagram
                      </a>
                    )}
                    {brand.social.twitter !== '#' && (
                      <a
                        href={brand.social.twitter}
                        target="_blank"
                        rel="noreferrer"
                        className="opacity-80 hover:opacity-100 transition-opacity"
                      >
                        Twitter
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
