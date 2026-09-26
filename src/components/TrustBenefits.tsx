'use client'

import { Eye, Truck, ShieldCheck, Headphones } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useOrgBrand } from "@/components/OrgBrandProvider";

const benefits = [
  {
    icon: Eye,
    title: "Sorteo Transparente",
    description:
      "Todos los sorteos se realizan en vivo para garantizar total transparencia y confianza.",
  },
  {
    icon: Truck,
    title: "Envío Gratis",
    description:
      "Recibe tu premio en cualquier parte de República Dominicana sin costo adicional de envío.",
  },
  {
    icon: ShieldCheck,
    title: "Pago Seguro",
    description:
      "Tu información y tus pagos están protegidos. Verificamos cada transacción manualmente.",
  },
  {
    icon: Headphones,
    title: "Soporte Dedicado",
    description:
      "Nuestro equipo está disponible por WhatsApp para responder cualquier pregunta que tengas.",
  },
];

const TrustBenefits = () => {
  const brand = useOrgBrand();
  const literal = brand.theme === 'custom';

  return (
    <section
      className={literal ? "py-20" : "py-20 bg-background"}
      style={literal ? { backgroundColor: brand.themeColors.background, color: brand.themeColors.foreground } : undefined}
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-secondary font-semibold text-sm uppercase tracking-wider mb-3">
            ¿Por qué elegirnos?
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Tu Confianza es Nuestra Prioridad
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Nos comprometemos a brindarte la mejor experiencia en cada rifa.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {benefits.map((benefit) => (
            <Card
              key={benefit.title}
              className="p-6 bg-gradient-card border-card-border text-center group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1"
              style={literal ? { background: brand.themeColors.card, color: brand.themeColors.foreground } : undefined}
            >
              <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-secondary/20 transition-colors">
                <benefit.icon className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {benefit.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed" style={literal ? { color: brand.themeColors.muted } : undefined}>
                {benefit.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBenefits;
