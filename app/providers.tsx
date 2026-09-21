"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { OrgBrandProvider } from "@/components/OrgBrandProvider";
import type { OrgBrand, Organization } from "@/types/org";

export function Providers({
  children,
  initialOrg = null,
  initialBrand = null,
}: {
  children: ReactNode;
  initialOrg?: Organization | null;
  initialBrand?: OrgBrand | null;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <OrgBrandProvider initialOrg={initialOrg} initialBrand={initialBrand}>
        {children}
      </OrgBrandProvider>
    </QueryClientProvider>
  );
}
