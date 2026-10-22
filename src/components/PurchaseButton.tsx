"use client";

import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";
import { trackMetaInitiateCheckout } from "@/lib/meta-browser";

interface PurchaseButtonProps {
  onClick: () => void;
  ticketPrice?: number;
  raffleId?: string;
  /** Selected or minimum quantity, when the buyer already has one. */
  quantity?: number;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "compact";
}

export default function PurchaseButton({
  onClick,
  ticketPrice,
  raffleId,
  quantity,
  className = "",
  size = "lg",
  variant = "default",
}: PurchaseButtonProps) {
  const handleClick = () => {
    if (variant !== "compact" && raffleId && typeof ticketPrice === "number") {
      try {
        const knownQuantity =
          typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0
            ? quantity
            : undefined;
        trackMetaInitiateCheckout({
          contentIds: [raffleId],
          value: knownQuantity ? ticketPrice * knownQuantity : ticketPrice,
          numItems: knownQuantity,
        });
      } catch {
        // Tracking must not block opening checkout.
      }
    }
    onClick();
  };

  if (variant === "compact") {
    return (
      <Button
        className={`bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary font-bold ${className}`}
        size={size}
        onClick={handleClick}
      >
        <Ticket className="w-4 h-4 mr-2" />
        Comprar
      </Button>
    );
  }

  return (
    <Button
      className={`w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary font-bold py-6 text-lg ${className}`}
      size={size}
      onClick={handleClick}
    >
      <Ticket className="w-5 h-5 mr-2" />
      Comprar Boletos
    </Button>
  );
}



