"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initMetaPixel, isMetaBrowserEnabled, rememberFbclid } from "@/lib/meta-browser";

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();

  // Init during render so checkout events in child effects already have fbq.
  if (typeof window !== "undefined" && isMetaBrowserEnabled()) {
    try {
      initMetaPixel(pixelId);
    } catch {
      // A blocked pixel must not break the page.
    }
  }

  useEffect(() => {
    if (!isMetaBrowserEnabled()) return;
    try {
      rememberFbclid();
      initMetaPixel(pixelId);
      window.fbq?.("track", "PageView");
    } catch {
      // A blocked pixel must not break the page.
    }
  }, [pathname, pixelId]);

  return null;
}
