import {
  isRifaloProductionHost,
  sanitizeClientIp,
  sanitizeEventSourceUrl,
  sanitizeFbc,
  sanitizeFbp,
  sanitizeMetaEventId,
  sanitizeUserAgent,
  ticketVoucherEventId,
} from "@/lib/meta-host";
import { buildMetaUserData } from "@/lib/meta-user-data";

const GRAPH_VERSION = "v21.0";

export const TICKET_VOUCHER_EVENT_NAME = "TicketVoucherSubmitted";

/** Events the browser may ask the server to forward. Purchase is not one of them. */
export const BROWSER_FORWARDED_EVENTS = new Set<MetaEventName>([
  "ViewContent",
  "InitiateCheckout",
]);

export type MetaEventName =
  | "ViewContent"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | typeof TICKET_VOUCHER_EVENT_NAME;

export type MetaCurrency = "DOP" | "USD";

export type MetaCommerceData = {
  content_ids: string[];
  content_name?: string;
  content_type: "product";
  value: number;
  currency: MetaCurrency;
  num_items?: number;
  order_id?: string;
};

export type MetaCapiEvent = {
  eventName: MetaEventName;
  eventId: string;
  eventSourceUrl: string;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  user?: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
  };
  customData: MetaCommerceData;
};

export type MetaCapiSkipReason =
  | "invalid"
  | "not_production"
  | "missing_token"
  | "no_user_data"
  | "duplicate"
  | "rejected";

export type MetaCapiResult =
  | { sent: true }
  | { sent: false; reason: MetaCapiSkipReason };

const sentEventKeys = new Set<string>();
let warnedMissingToken = false;

export function resetMetaCapiForTests() {
  sentEventKeys.clear();
  warnedMissingToken = false;
}

export function getMetaPixelId(): string | null {
  const id = process.env.META_PIXEL_ID?.trim() || "";
  return /^\d{5,20}$/.test(id) ? id : null;
}

function getAccessToken(): string | null {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim() || "";
  if (token.length < 20 || token.length > 500) return null;
  return token;
}

/** Events Manager test code. META_TEST_EVENT_CODE remains as a legacy alias. */
export function getMetaTestEventCode(): string | null {
  const code =
    process.env.META_CAPI_TEST_EVENT_CODE?.trim() ||
    process.env.META_TEST_EVENT_CODE?.trim() ||
    "";
  if (!code) return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : null;
}

function warnMissingToken() {
  if (warnedMissingToken) return;
  warnedMissingToken = true;
  console.warn("Meta CAPI skipped: META_CAPI_ACCESS_TOKEN is not set");
}

function eventKey(eventName: string, eventId: string): string {
  return `${eventName}:${eventId}`;
}

/**
 * Send one event to Meta. Never throws. A missing access token is a no-op
 * with a single warning. The same event name + event id is sent once per
 * process; Meta also dedupes retries that share that event id.
 */
export async function sendMetaCapiEvent(event: MetaCapiEvent): Promise<MetaCapiResult> {
  let claimedKey: string | null = null;
  try {
    const pixelId = getMetaPixelId();
    const eventId = sanitizeMetaEventId(event.eventId);
    const eventSourceUrl = sanitizeEventSourceUrl(event.eventSourceUrl);
    if (!eventId || !eventSourceUrl) return { sent: false, reason: "invalid" };
    if (!isRifaloProductionHost(new URL(eventSourceUrl).hostname)) {
      return { sent: false, reason: "invalid" };
    }
    if (process.env.VERCEL_ENV !== "production") {
      return { sent: false, reason: "not_production" };
    }
    if (!pixelId) return { sent: false, reason: "invalid" };
    if (event.customData.currency !== "DOP" && event.customData.currency !== "USD") {
      return { sent: false, reason: "invalid" };
    }
    if (!Number.isFinite(event.customData.value) || event.customData.value < 0) {
      return { sent: false, reason: "invalid" };
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      warnMissingToken();
      return { sent: false, reason: "missing_token" };
    }

    const userData = buildMetaUserData({
      email: event.user?.email,
      phone: event.user?.phone,
      name: event.user?.name,
      clientIpAddress: sanitizeClientIp(event.clientIpAddress),
      clientUserAgent: sanitizeUserAgent(event.clientUserAgent),
      fbp: sanitizeFbp(event.fbp),
      fbc: sanitizeFbc(event.fbc),
    });
    if (Object.keys(userData).length === 0) return { sent: false, reason: "no_user_data" };

    const dedupKey = eventKey(event.eventName, eventId);
    if (sentEventKeys.has(dedupKey)) return { sent: false, reason: "duplicate" };
    sentEventKeys.add(dedupKey);
    claimedKey = dedupKey;

    const customData: Record<string, string | number | string[]> = {
      content_ids: event.customData.content_ids,
      content_type: "product",
      value: event.customData.value,
      currency: event.customData.currency,
    };
    if (event.customData.content_name) customData.content_name = event.customData.content_name;
    if (event.customData.num_items != null) customData.num_items = event.customData.num_items;
    if (event.customData.order_id) customData.order_id = event.customData.order_id;

    const params = new URLSearchParams();
    params.set(
      "data",
      JSON.stringify([
        {
          event_name: event.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: eventSourceUrl,
          action_source: "website",
          user_data: userData,
          custom_data: customData,
        },
      ]),
    );
    params.set("access_token", accessToken);
    const testEventCode = getMetaTestEventCode();
    if (testEventCode) params.set("test_event_code", testEventCode);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        sentEventKeys.delete(dedupKey);
        claimedKey = null;
        console.error("Meta CAPI rejected an event:", event.eventName, response.status);
        return { sent: false, reason: "rejected" };
      }
      const text = await response.text();
      try {
        const parsed = JSON.parse(text) as {
          events_received?: number;
          error?: { code?: number; type?: string };
        };
        if (parsed.error || parsed.events_received === 0) {
          sentEventKeys.delete(dedupKey);
          claimedKey = null;
          console.error(
            "Meta CAPI accepted no events:",
            event.eventName,
            parsed.error?.type || "",
            parsed.error?.code || "",
          );
          return { sent: false, reason: "rejected" };
        }
      } catch {
        console.error("Meta CAPI returned an unreadable response:", event.eventName, response.status);
      }
      return { sent: true };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (claimedKey) sentEventKeys.delete(claimedKey);
    console.error(
      "Meta CAPI event failed:",
      event.eventName,
      error instanceof Error ? error.message : "unknown",
    );
    return { sent: false, reason: "rejected" };
  }
}

export function buildTicketVoucherEvent(input: {
  purchaseId: string;
  raffleId: string;
  quantity: number;
  totalAmount: number;
  eventSourceUrl: string;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}): MetaCapiEvent | null {
  const eventId = ticketVoucherEventId(input.purchaseId);
  const eventSourceUrl = sanitizeEventSourceUrl(input.eventSourceUrl);
  const quantity = Number(input.quantity);
  const value = Number(input.totalAmount);
  if (!eventId || !eventSourceUrl || !input.raffleId) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  if (!Number.isFinite(value) || value < 0) return null;

  return {
    eventName: TICKET_VOUCHER_EVENT_NAME,
    eventId,
    eventSourceUrl,
    clientIpAddress: input.clientIp,
    clientUserAgent: input.userAgent,
    fbp: input.fbp,
    fbc: input.fbc,
    user: {
      email: input.email,
      phone: input.phone,
      name: input.name,
    },
    customData: {
      content_ids: [input.raffleId],
      content_type: "product",
      value: Math.round(value * 100) / 100,
      currency: "DOP",
      num_items: quantity,
      order_id: input.purchaseId,
    },
  };
}
