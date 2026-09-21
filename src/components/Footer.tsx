'use client'

import { useEffect, useState } from 'react'
import { Mail, Phone, MapPin } from "lucide-react";
import { useOrgBrand } from "@/components/OrgBrandProvider";

const Footer = () => {
  const brand = useOrgBrand();
  const [hasTestimonials, setHasTestimonials] = useState(false)

  useEffect(() => {
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
  }, [])

  return (
    <footer className="bg-primary text-primary-foreground">
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
            <p className="text-primary-foreground/80 text-sm">
              {brand.tagline || brand.name}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Enlaces Rápidos</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#rifas" className="text-primary-foreground/80 hover:text-secondary-glow transition-colors">Rifas Activas</a></li>
              <li><a href="#como-funciona" className="text-primary-foreground/80 hover:text-secondary-glow transition-colors">Cómo Funciona</a></li>
              <li><a href="#ganadores" className="text-primary-foreground/80 hover:text-secondary-glow transition-colors">Ganadores</a></li>
              {hasTestimonials && (
                <li><a href="#testimonios" className="text-primary-foreground/80 hover:text-secondary-glow transition-colors">Testimonios</a></li>
              )}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#terminos" className="text-primary-foreground/80 hover:text-secondary-glow transition-colors">Términos y Condiciones</a></li>
              <li><a href="#privacidad" className="text-primary-foreground/80 hover:text-secondary-glow transition-colors">Política de Privacidad</a></li>
              <li><a href="#reglamento" className="text-primary-foreground/80 hover:text-secondary-glow transition-colors">Reglamento de Rifas</a></li>
              <li><a href="#soporte" className="text-primary-foreground/80 hover:text-secondary-glow transition-colors">Soporte</a></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Contacto</h4>
            <div className="space-y-3 text-sm">
              {brand.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-secondary-glow" />
                  <span className="text-primary-foreground/80">{brand.email}</span>
                </div>
              )}
              {brand.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-secondary-glow" />
                  <span className="text-primary-foreground/80">{brand.phone}</span>
                </div>
              )}
              {brand.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-secondary-glow" />
                  <span className="text-primary-foreground/80">{brand.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-primary-foreground/60 text-sm">
              {brand.copyright}. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-6 text-sm">
              {(brand.social.facebook !== '#' ||
                brand.social.instagram !== '#' ||
                brand.social.twitter !== '#') && (
                <>
                  <span className="text-primary-foreground/60">Síguenos:</span>
                  <div className="flex gap-4">
                    {brand.social.facebook !== '#' && (
                      <a
                        href={brand.social.facebook}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-foreground/80 hover:text-secondary-glow transition-colors"
                      >
                        Facebook
                      </a>
                    )}
                    {brand.social.instagram !== '#' && (
                      <a
                        href={brand.social.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-foreground/80 hover:text-secondary-glow transition-colors"
                      >
                        Instagram
                      </a>
                    )}
                    {brand.social.twitter !== '#' && (
                      <a
                        href={brand.social.twitter}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-foreground/80 hover:text-secondary-glow transition-colors"
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
