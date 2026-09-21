"use client";

import { useState, useEffect } from "react";
import { Raffle } from "@/types/raffle";
import MobileRaffleBanner from "./MobileRaffleBanner";
import PurchaseDialog from "./PurchaseDialog";

const StickyRaffleBanner = () => {
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    const fetchRaffle = async () => {
      try {
        const response = await fetch("/api/raffles?page=1&limit=1");
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setRaffle(result.data[0]);
        }
      } catch {
        // silently fail -- banner is non-critical
      }
    };
    fetchRaffle();
  }, []);

  if (!raffle) return null;

  return (
    <>
      <MobileRaffleBanner
        raffle={raffle}
        onPurchaseClick={() => setPurchaseOpen(true)}
      />
      <PurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        raffleId={raffle.id}
        ticketPrice={raffle.ticketPrice}
        availableTickets={raffle.totalTickets - raffle.soldTickets}
        minTickets={raffle.minTickets}
      />
    </>
  );
};

export default StickyRaffleBanner;
