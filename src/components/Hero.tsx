"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Ticket, Sparkles, ArrowRight } from "lucide-react";
import { Raffle } from "@/types/raffle";
import PurchaseDialog from "@/components/PurchaseDialog";
import RaffleCard from "@/components/RaffleCard";
import RaffleCardSkeleton from "@/components/RaffleCardSkeleton";
import { useOrgBrand } from "@/components/OrgBrandProvider";
import { meetsContrast, THEME_SURFACES } from "@/lib/colors";

const Hero = ({
  showCopy = true,
  showHowItWorks = true,
  showRaffles = true,
}: {
  showCopy?: boolean
  showHowItWorks?: boolean
  showRaffles?: boolean
}) => {
  const brand = useOrgBrand();
  const [firstRaffle, setFirstRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  const surface =
    brand.theme === 'custom'
      ? brand.themeColors.background
      : THEME_SURFACES[brand.theme === 'dark' ? 'dark' : 'light']
  const primaryOkOnSurface = meetsContrast(brand.primaryColor, surface, 'aa-large')
  const secondaryOkOnSurface = meetsContrast(brand.secondaryColor, surface, 'aa-large')
  const titleClass = primaryOkOnSurface
    ? 'text-gradient-primary'
    : secondaryOkOnSurface
      ? 'text-gradient-secondary'
      : 'text-foreground'
  const outlineClass = primaryOkOnSurface
    ? 'border-primary/30 text-primary hover:bg-primary/10'
    : secondaryOkOnSurface
      ? 'border-secondary/40 text-secondary hover:bg-secondary/10'
      : 'border-foreground/30 text-foreground hover:bg-foreground/10'
  const literal = brand.theme === 'custom'
  const literalTitle = literal
    ? primaryOkOnSurface
      ? brand.primaryColor
      : secondaryOkOnSurface
        ? brand.secondaryColor
        : brand.themeColors.foreground
    : null
  const literalHero = literal
    ? `linear-gradient(135deg, ${brand.themeColors.background} 0%, ${brand.themeColors.backgroundAlt} 100%)`
    : null

  useEffect(() => {
    const fetchFirstRaffle = async () => {
      try {
        const response = await fetch("/api/raffles?page=1&limit=1");
        const result = await response.json();

        if (result.success && result.data.length > 0) {
          setFirstRaffle(result.data[0]);
        }
      } catch (err) {
        console.error("Error fetching first raffle:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFirstRaffle();
  }, []);

  const handleParticipate = () => {
    setPurchaseDialogOpen(true);
  };

  return (
    <section
      className={literal ? 'relative min-h-[85vh] flex items-center overflow-hidden' : 'relative min-h-[85vh] flex items-center bg-gradient-to-br from-background via-background-alt to-accent overflow-hidden'}
      style={literalHero ? { background: literalHero } : undefined}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 stars-container">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="star"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Decorative floating shapes */}
      <div className="absolute top-20 left-10 w-20 h-20 rounded-full bg-secondary/5 animate-float hidden lg:block" />
      <div className="absolute bottom-32 right-16 w-32 h-32 rounded-full bg-secondary/5 animate-float-delayed hidden lg:block" />
      <div className="absolute top-1/3 right-1/4 w-12 h-12 rounded-full bg-warning/10 animate-float hidden lg:block" />

      <div className="container mx-auto px-4 relative z-10 py-12 md:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto">
          <div className={showCopy ? 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center' : 'flex justify-center'}>
            {showCopy && (
            <div className="order-2 lg:order-1 text-center lg:text-left space-y-6 animate-fade-in-up">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-tight">
                <span className={literal ? undefined : titleClass} style={literalTitle ? { color: literalTitle } : undefined}>{brand.name}</span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed" style={literal ? { color: brand.themeColors.muted } : undefined}>
                {brand.tagline ||
                  'Participa en rifas de productos premium por una fracción de su precio. Sorteos transparentes y premios reales.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {showRaffles && (
                <Button
                  size="lg"
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary font-bold py-6 px-8 text-base"
                  onClick={() => {
                    document.getElementById("rifas")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Ticket className="w-5 h-5 mr-2" />
                  Ver Rifas Activas
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                )}
                {showHowItWorks && (
                <Button
                  size="lg"
                  variant="outline"
                  className={`${outlineClass} py-6 px-8 text-base font-semibold`}
                  onClick={() => {
                    document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Cómo Funciona
                </Button>
                )}
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-8 justify-center lg:justify-start pt-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">100%</p>
                  <p className="text-xs text-muted-foreground">Transparente</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">RD</p>
                  <p className="text-xs text-muted-foreground">Envío Gratis</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-secondary">En Vivo</p>
                  <p className="text-xs text-muted-foreground">Sorteos</p>
                </div>
              </div>
            </div>
            )}

            <div className={showCopy ? 'order-1 lg:order-2 flex justify-center lg:justify-end animate-fade-in-up-delayed' : 'flex justify-center w-full animate-fade-in-up'}>
              {loading ? (
                <RaffleCardSkeleton className="max-w-md" />
              ) : firstRaffle ? (
                <RaffleCard
                  raffle={firstRaffle}
                  onPurchase={handleParticipate}
                  className="max-w-md"
                />
              ) : (
                <div className="w-full max-w-md text-center py-20">
                  <Sparkles className="w-12 h-12 text-secondary/40 mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">
                    Próximamente nuevas rifas
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {firstRaffle && (
        <PurchaseDialog
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
          raffleId={firstRaffle.id}
          ticketPrice={firstRaffle.ticketPrice}
          availableTickets={firstRaffle.totalTickets - firstRaffle.soldTickets}
          minTickets={firstRaffle.minTickets}
        />
      )}
    </section>
  );
};

export default Hero;
