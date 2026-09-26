'use client'

import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import { useOrgBrand } from "@/components/OrgBrandProvider";
import type { Testimonial } from "@/types/testimonial";

export function TestimonialsList({ testimonials }: { testimonials: Testimonial[] }) {
  const brand = useOrgBrand();
  const literal = brand.theme === 'custom';
  if (!testimonials.length) return null;

  return (
    <section
      id="testimonios"
      className={literal ? "py-20" : "py-20 bg-background-alt"}
      style={literal ? { backgroundColor: brand.themeColors.backgroundAlt, color: brand.themeColors.foreground } : undefined}
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-secondary font-semibold text-sm uppercase tracking-wider mb-3">
            Testimonios
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Lo Que Dicen Nuestros Ganadores
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Historias reales de personas que curaron su suerte.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              className="p-6 bg-gradient-card border-card-border hover:shadow-elegant transition-all duration-300"
              style={literal ? { background: brand.themeColors.card, color: brand.themeColors.foreground } : undefined}
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 text-warning fill-warning"
                  />
                ))}
              </div>

              <blockquote className="text-foreground/90 text-sm leading-relaxed mb-6">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3 pt-4 border-t border-card-border">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-foreground text-sm font-bold">
                    {testimonial.initials}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.roleLabel}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
