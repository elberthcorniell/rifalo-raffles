import {
  buildFbc,
  isRifaloProductionHost,
  sanitizeEventSourceUrl,
  sanitizeFbc,
  sanitizeFbp,
} from "@/lib/meta-host";

export type MetaBrowserCommerce = {
  content_ids: string[];
  content_type: "product";
  value: number;
  currency: "DOP";
  num_items?: number;
  order_id?: string;
};

const FBC_STORAGE_KEY = "rifalo_meta_fbc";
const initializedPixels = new Set<string>();

type FbqStub = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: FbqStub;
};

declare global {
  interface Window {
    fbq?: FbqStub;
    _fbq?: FbqStub;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function rememberFbclid(now = Date.now()): string | null {
  if (typeof window === "undefined") return null;
  const existingCookie = sanitizeFbc(readCookie("_fbc"));
  if (existingCookie) return existingCookie;

  let stored: { fbclid?: string; fbc?: string } | null = null;
  try {
    const raw = window.localStorage.getItem(FBC_STORAGE_KEY);
    stored = raw ? (JSON.parse(raw) as { fbclid?: string; fbc?: string }) : null;
  } catch {
    stored = null;
  }

  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (fbclid) {
    if (stored?.fbclid === fbclid && sanitizeFbc(stored.fbc)) return sanitizeFbc(stored.fbc);
    const fbc = buildFbc(fbclid, now);
    if (!fbc) return sanitizeFbc(stored?.fbc);
    try {
      window.localStorage.setItem(FBC_STORAGE_KEY, JSON.stringify({ fbclid, fbc }));
    } catch {
      // Storage can be blocked. The in-memory value is still sent with this event.
    }
    return fbc;
  }

  return sanitizeFbc(stored?.fbc);
}

export function readMetaBrowserIds(): { fbp: string | null; fbc: string | null } {
  return {
    fbp: sanitizeFbp(readCookie("_fbp")),
    fbc: rememberFbclid(),
  };
}

export function isMetaBrowserEnabled(): boolean {
  return typeof window !== "undefined" && isRifaloProductionHost(window.location.hostname);
}

export function initMetaPixel(pixelId: string) {
  if (!isMetaBrowserEnabled() || !/^\d{5,20}$/.test(pixelId)) return;
  if (!window.fbq) {
    const fbq = function fbqStub(...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
        return;
      }
      fbq.queue.push(args);
    } as FbqStub;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  if (initializedPixels.has(pixelId)) return;
  window.fbq("init", pixelId);
  initializedPixels.add(pixelId);
}

export function trackMetaPixel(
  eventName: string,
  customData: MetaBrowserCommerce,
  eventId: string,
) {
  if (!isMetaBrowserEnabled() || typeof window.fbq !== "function") return;
  window.fbq("track", eventName, customData, { eventID: eventId });
}

function commercePayload(input: {
  contentIds: string[];
  value: number;
  numItems?: number;
  orderId?: string;
}): MetaBrowserCommerce | null {
  const contentIds = input.contentIds.filter((id) => typeof id === "string" && id.length > 0);
  if (!contentIds.length || !Number.isFinite(input.value) || input.value < 0) return null;
  const payload: MetaBrowserCommerce = {
    content_ids: contentIds,
    content_type: "product",
    value: Math.round(input.value * 100) / 100,
    currency: "DOP",
  };
  if (input.numItems != null && Number.isInteger(input.numItems) && input.numItems > 0) {
    payload.num_items = input.numItems;
  }
  if (input.orderId) payload.order_id = input.orderId;
  return payload;
}

function sendBrowserCapi(
  eventName: "ViewContent" | "InitiateCheckout",
  eventId: string,
  customData: MetaBrowserCommerce,
) {
  const eventSourceUrl = sanitizeEventSourceUrl(window.location.href);
  if (!eventSourceUrl) return;
  const ids = readMetaBrowserIds();
  void fetch("/api/meta/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl,
      fbp: ids.fbp,
      fbc: ids.fbc,
      customData,
    }),
  }).catch(() => {
    // A tracking failure must not affect the page.
  });
}

function trackBrowserAndServer(
  eventName: "ViewContent" | "InitiateCheckout",
  input: { contentIds: string[]; value: number; numItems?: number },
) {
  if (!isMetaBrowserEnabled()) return;
  const customData = commercePayload(input);
  if (!customData || typeof crypto === "undefined" || !crypto.randomUUID) return;
  const eventId = crypto.randomUUID();
  trackMetaPixel(eventName, customData, eventId);
  sendBrowserCapi(eventName, eventId, customData);
}

export function trackMetaViewContent(input: { contentIds: string[]; value: number }) {
  trackBrowserAndServer("ViewContent", input);
}

export function trackMetaInitiateCheckout(input: {
  contentIds: string[];
  value: number;
  numItems?: number;
}) {
  trackBrowserAndServer("InitiateCheckout", input);
}

export function trackMetaAddPaymentInfo(
  input: { contentIds: string[]; value: number; numItems: number },
  eventId: string,
) {
  const customData = commercePayload(input);
  if (!customData) return;
  trackMetaPixel("AddPaymentInfo", customData, eventId);
}

/**
 * Temporary conversion: the voucher submission is the Purchase.
 * eventId must be purchase_<purchaseId> so a later CAPI confirmation can reuse it.
 */
export function trackMetaPurchase(
  input: { contentIds: string[]; value: number; numItems: number; orderId: string },
  eventId: string,
) {
  const customData = commercePayload(input);
  if (!customData || !input.orderId) return;
  trackMetaPixel("Purchase", customData, eventId);
}
