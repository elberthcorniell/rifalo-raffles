'use client'

import { Search, Ticket, Trophy } from "lucide-react";
import { useOrgBrand } from "@/components/OrgBrandProvider";
const steps = [
  {
    icon: Search,
    title: "Elige tu Rifa",
    description:
      "Explora nuestras rifas activas y encuentra el premio que más te guste. Desde tecnología hasta vehículos.",
    step: "01",
  },
  {
    icon: Ticket,
    title: "Compra tus Boletos",
    description:
      "Selecciona la cantidad de boletos que deseas, completa tu pago de forma segura y recibe tu confirmación al instante.",
    step: "02",
  },
  {
    icon: Trophy,
    title: "¡Gana Premios!",
    description:
      "Espera el sorteo en vivo y si resultas ganador, recibe tu premio con envío gratis a cualquier parte de RD.",
    step: "03",
  },
];

const HowItWorks = () => {
  const brand = useOrgBrand();
  const literal = brand.theme === 'custom';

  return (
    <section
      id="como-funciona"
      className={literal ? "py-20" : "py-20 bg-background-alt"}
      style={literal ? { backgroundColor: brand.themeColors.backgroundAlt, color: brand.themeColors.foreground } : undefined}
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-secondary font-semibold text-sm uppercase tracking-wider mb-3">
            Proceso Simple
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            ¿Cómo Funciona?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Participar en nuestras rifas es fácil, rápido y seguro. Solo tres pasos te separan de ganar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.step}
              className="relative text-center group"
            >
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px border-t-2 border-dashed border-secondary/20" />
              )}

              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 group-hover:bg-secondary/20 transition-colors duration-300">
                  <step.icon className="w-10 h-10 text-secondary" />
                </div>
                <span className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-2">
                  Paso {step.step}
                </span>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs" style={literal ? { color: brand.themeColors.muted } : undefined}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
