"use client";

import { useState, useEffect } from "react";
import RaffleCard from "./RaffleCard";
import RaffleCardSkeleton from "./RaffleCardSkeleton";
import MobileRaffleBanner from "./MobileRaffleBanner";
import PurchaseDialog from "./PurchaseDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Raffle } from "@/types/raffle";

const RaffleGrid = () => {
  const [productName, setProductName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRaffles = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/raffles?page=1&limit=50");
        const result = await response.json();
        
        if (result.success) {
          setRaffles(result.data);
        } else {
          setError(result.error || "Error al cargar las rifas");
          toast({
            title: "Error",
            description: result.error || "Error al cargar las rifas",
            variant: "destructive"
          });
        }
      } catch (err) {
        const errorMessage = "Error al cargar las rifas";
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

    fetchRaffles();
  }, [toast]);

  const handlePurchaseClick = (raffle: Raffle) => {
    setSelectedRaffle(raffle);
    setIsPurchaseDialogOpen(true);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productName.trim() || !userEmail.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos del formulario.",
        variant: "destructive"
      });
      return;
    }

    // Close modal and show success message
    setIsOpen(false);
    setProductName("");
    setUserEmail("");
    
    toast({
      title: "¡Solicitud enviada!",
      description: "Recibirás una notificación cuando el producto esté disponible para rifar.",
    });
  };

  const firstRaffle = raffles.length > 0 ? raffles[0] : null;

  return (
    <section id="rifas" className="py-16 bg-background-alt pb-24 md:pb-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Rifas Activas
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Descubre increíbles productos tecnológicos y participa por una fracción de su precio real
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, index) => (
              <RaffleCardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Reintentar
            </Button>
          </div>
        ) : raffles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No hay rifas disponibles en este momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {raffles.map((raffle) => (
              <RaffleCard
                key={raffle.id}
                raffle={raffle}
                onPurchase={() => handlePurchaseClick(raffle)}
              />
            ))}
          </div>
        )}

        {/* Request Product Modal */}
        <div className="text-center mt-12">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-primary">
                Ver Más Rifas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">
                  ¿Qué producto te gustaría ver rifado?
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Nombre del producto</Label>
                  <Input
                    id="productName"
                    placeholder="Ej: PlayStation 5, Tesla Model 3, etc."
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Tu email para notificaciones</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    placeholder="tu@email.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary font-bold"
                >
                  Enviar Solicitud
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mobile Sticky Banner */}
      {firstRaffle && (
        <>
          <MobileRaffleBanner
            raffle={firstRaffle}
            onPurchaseClick={() => handlePurchaseClick(firstRaffle)}
          />
          {selectedRaffle && (
            <PurchaseDialog
              open={isPurchaseDialogOpen}
              onOpenChange={setIsPurchaseDialogOpen}
              raffleId={selectedRaffle.id}
              ticketPrice={selectedRaffle.ticketPrice}
              availableTickets={selectedRaffle.totalTickets - selectedRaffle.soldTickets}
              minTickets={selectedRaffle.minTickets}
            />
          )}
        </>
      )}
    </section>
  );
};

export default RaffleGrid;