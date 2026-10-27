"use client";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthRecoveryRedirect } from "@/components/AuthRecoveryRedirect";
import { DisableZoom } from "@/components/DisableZoom";
import { PostHogInit } from "./posthog-init";
import { MetaPixel } from "@/components/MetaPixel";

export function ClientProviders({ metaPixelId }: { metaPixelId?: string | null }) {
  return (
    <>
      <AuthRecoveryRedirect />
      <DisableZoom />
      <PostHogInit />
      {metaPixelId ? <MetaPixel pixelId={metaPixelId} /> : null}
      <TooltipProvider>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </>
  );
}




