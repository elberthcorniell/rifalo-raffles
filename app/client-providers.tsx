"use client";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthRecoveryRedirect } from "@/components/AuthRecoveryRedirect";
import { PostHogInit } from "./posthog-init";

export function ClientProviders() {
  return (
    <>
      <AuthRecoveryRedirect />
      <PostHogInit />
      <TooltipProvider>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </>
  );
}




