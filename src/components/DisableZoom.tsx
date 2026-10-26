"use client";

import { useEffect } from "react";

/** Safari ignores user-scalable=no. Block pinch and trackpad zoom directly. */
export function DisableZoom() {
  useEffect(() => {
    const blockGesture = (event: Event) => {
      event.preventDefault();
    };
    const blockWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    document.addEventListener("gesturestart", blockGesture, { passive: false });
    document.addEventListener("gesturechange", blockGesture, { passive: false });
    document.addEventListener("gestureend", blockGesture, { passive: false });
    document.addEventListener("wheel", blockWheelZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
      document.removeEventListener("wheel", blockWheelZoom);
    };
  }, []);

  return null;
}
