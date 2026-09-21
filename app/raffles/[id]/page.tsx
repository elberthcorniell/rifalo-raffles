"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PurchaseDialog from "@/components/PurchaseDialog";
import PurchaseButton from "@/components/PurchaseButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Ticket, Star, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getImageSrc } from "@/lib/utils";
import { Raffle } from "@/types/raffle";

export default function RaffleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);

  useEffect(() => {
    const fetchRaffle = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/raffles/${params.id}`);
        const result = await response.json();
        
        if (result.success) {
          setRaffle(result.data);
        } else {
          setError(result.error || "Error al cargar la rifa");
          toast({
            title: "Error",
            description: result.error || "Error al cargar la rifa",
            variant: "destructive"
          });
        }
      } catch (err) {
        const errorMessage = "Error al cargar la rifa";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchRaffle();
    }
  }, [params.id, toast]);

  const handleParticipate = () => {
    setIsPurchaseDialogOpen(true);
  };

  const progressPercentage = raffle ? (raffle.soldTickets / raffle.totalTickets) * 100 : 0;
  const remainingTickets = raffle ? raffle.totalTickets - raffle.soldTickets : 0;

  return (
    <div className="min-h-screen bg-background font-poppins pb-20 md:pb-0">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6 text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        {loading ? (
          <div className="space-y-8">
            <Skeleton className="h-96 w-full" />
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg mb-4">{error}</p>
            <Button onClick={() => router.back()}>
              Volver
            </Button>
          </div>
        ) : raffle ? (
          <div className="space-y-8">
            {/* Hero Image */}
            <div className="relative w-full h-96 rounded-lg overflow-hidden bg-muted">
              <img
                src={getImageSrc(raffle.image)}
                alt={raffle.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== "/placeholder.svg") {
                    target.src = "/placeholder.svg";
                  }
                }}
              />
              {raffle.featured && (
                <div className="absolute top-4 left-4 z-10">
                  <Badge className="bg-secondary text-secondary-foreground font-semibold">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Destacada
                  </Badge>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column - Details */}
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl font-bold text-gradient-primary mb-4">
                    {raffle.title}
                  </h1>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {raffle.description}
                  </p>
                </div>

                {/* Price and Time */}
                <Card className="p-6 bg-gradient-card border-card-border">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-primary" />
                        <span className="text-sm text-muted-foreground">Precio por boleto</span>
                      </div>
                      <span className="font-bold text-2xl text-primary">
                        RD${raffle.ticketPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-warning" />
                        <span className="text-sm text-muted-foreground">Tiempo restante</span>
                      </div>
                      <span className="text-warning font-bold text-xl">
                        {raffle.timeLeft}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Progress Section */}
                <Card className="p-6 bg-gradient-card border-card-border">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">
                        Boletos vendidos
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {raffle.soldTickets} / {raffle.totalTickets}
                      </span>
                    </div>
                    <div className="relative">
                      <Progress value={progressPercentage} className="h-4 progress-glow" />
                      <div className="absolute top-0 left-1/4 w-0.5 h-4 bg-background"></div>
                      <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-background"></div>
                      <div className="absolute top-0 left-3/4 w-0.5 h-4 bg-background"></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                    </div>
                    <div className="pt-2 border-t border-card-border">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-bold text-primary">{remainingTickets}</span> boletos disponibles
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Column - Purchase Card */}
              <div className="hidden md:block sticky top-24">
                <Card className="p-6 bg-gradient-card border-card-border">
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground mb-2">
                        Participa Ahora
                      </h2>
                      <p className="text-muted-foreground">
                        Compra tus boletos y aumenta tus posibilidades de ganar
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-background rounded-lg">
                        <span className="text-muted-foreground">Precio por boleto</span>
                        <span className="font-bold text-xl text-foreground">
                          RD${raffle.ticketPrice.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-background rounded-lg">
                        <span className="text-muted-foreground">Boletos disponibles</span>
                        <span className="font-bold text-xl text-foreground">
                          {remainingTickets}
                        </span>
                      </div>
                    </div>

                    <PurchaseButton
                      onClick={handleParticipate}
                      ticketPrice={raffle.ticketPrice}
                    />

                    <div className="pt-4 border-t border-card-border">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>Sorteo Transparente</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>Envío Gratis</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>Garantía Incluida</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Mobile Sticky Button */}
      {raffle && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t border-card-border shadow-lg p-4">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-primary">
                    RD${raffle.ticketPrice.toLocaleString()}
                  </p>
                </div>
                <PurchaseButton
                  onClick={handleParticipate}
                  ticketPrice={raffle.ticketPrice}
                  className="flex-1 py-6 text-base"
                />
              </div>
            </div>
          </div>
          <PurchaseDialog
            open={isPurchaseDialogOpen}
            onOpenChange={setIsPurchaseDialogOpen}
            raffleId={raffle.id}
            ticketPrice={raffle.ticketPrice}
            availableTickets={remainingTickets}
            minTickets={raffle.minTickets}
          />
        </>
      )}

      <Footer />
    </div>
  );
}

