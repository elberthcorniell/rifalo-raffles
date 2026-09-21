"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn, getImageSrc } from "@/lib/utils";
import type { Raffle } from "@/types/raffle";

interface RaffleCardProps {
  raffle: Raffle;
  onPurchase?: () => void;
  className?: string;
}

const RaffleCard = ({ raffle, onPurchase, className }: RaffleCardProps) => {
  const router = useRouter();
  const pct =
    raffle.totalTickets > 0
      ? Math.min((raffle.soldTickets / raffle.totalTickets) * 100, 100)
      : 0;

  const handlePurchase = () => {
    if (onPurchase) {
      onPurchase();
      return;
    }
    router.push(`/raffles/${raffle.id}`);
  };

  return (
    <Card
      className={cn(
        "w-full bg-gradient-card border-card-border overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1",
        className
      )}
    >
      <div className="relative">
        {raffle.featured && (
          <div className="absolute top-4 left-4 z-10">
            <Badge className="bg-secondary text-secondary-foreground font-semibold">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Destacada
            </Badge>
          </div>
        )}
        <div className="relative h-64 overflow-hidden bg-muted">
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
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-2">{raffle.title}</h3>
          <p className="text-muted-foreground text-sm line-clamp-2">{raffle.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <span className="font-bold text-xl text-foreground">
            RD${raffle.ticketPrice.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">por boleto</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-end text-xs text-muted-foreground">
            <span>{pct.toFixed(1)}% vendido</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-secondary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <Button
          className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary font-bold py-6 text-base"
          size="lg"
          onClick={handlePurchase}
        >
          <Ticket className="w-5 h-5 mr-2" />
          Comprar boleto ya
        </Button>
      </div>
    </Card>
  );
};

export default RaffleCard;
