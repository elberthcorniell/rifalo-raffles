import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import {
  buildPurchaseMeta,
  cookieFromHeader,
  hostnameFromHeaderValue,
  isRifaloProductionHost,
  sanitizeClientIp,
  sanitizeEventSourceUrl,
  sanitizeFbc,
  sanitizeFbp,
  sanitizeMetaEventId,
  sanitizeUserAgent,
  type PurchaseMetaRecord,
} from "@/lib/meta-host";
import { buildMetaUserData } from "@/lib/meta-user-data";

const GRAPH_VERSION = "v21.0";

export type MetaEventName = "ViewContent" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";

export type MetaCommerceData = {
  content_ids: string[];
  content_type: "product";
  value: number;
  currency: "DOP";
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

export function isMetaServerEnabled(hostname: string): boolean {
  if (process.env.VERCEL_ENV !== "production") return false;
  return isRifaloProductionHost(hostname);
}

export function getMetaPixelId(): string | null {
  const id = process.env.META_PIXEL_ID?.trim() || "";
  return /^\d{5,20}$/.test(id) ? id : null;
}

export function resolveMetaPixelId(hostname: string): string | null {
  if (!isMetaServerEnabled(hostname)) return null;
  return getMetaPixelId();
}

function getAccessToken(): string | null {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim() || "";
  if (token.length < 20 || token.length > 500) return null;
  return token;
}

function getTestEventCode(): string | null {
  const code = process.env.META_TEST_EVENT_CODE?.trim() || "";
  if (!code) return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : null;
}

export async function readPurchaseMeta(formData: FormData): Promise<PurchaseMetaRecord | null> {
  const headerList = await headers();
  const requestHost = hostnameFromHeaderValue(
    headerList.get("x-forwarded-host") || headerList.get("host"),
  );
  const cookieHeader = headerList.get("cookie");
  return buildPurchaseMeta({
    serverEnabled: isMetaServerEnabled(requestHost),
    requestHost,
    clientIp: sanitizeClientIp(headerList.get("x-forwarded-for") || headerList.get("x-real-ip")),
    userAgent: headerList.get("user-agent"),
    eventId: formString(formData, "metaEventId"),
    fbp: formString(formData, "metaFbp"),
    fbc: formString(formData, "metaFbc"),
    eventSourceUrl: formString(formData, "metaEventSourceUrl"),
    cookieFbp: cookieFromHeader(cookieHeader, "_fbp"),
    cookieFbc: cookieFromHeader(cookieHeader, "_fbc"),
    fallbackEventId: randomUUID(),
  });
}

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

export function isMissingMetaColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message || "";
  return (
    error.code === "PGRST204" ||
    /meta_(fbp|fbc|client_ip|client_user_agent|event_source_url)/i.test(message)
  );
}

export function scheduleMetaCapiEvent(event: MetaCapiEvent) {
  const run = () =>
    sendMetaCapiEvent(event).catch((error) => {
      console.error(
        "Meta CAPI event failed:",
        event.eventName,
        error instanceof Error ? error.message : "unknown",
      );
    });

  try {
    after(run);
  } catch (error) {
    console.error(
      "Meta CAPI schedule failed:",
      error instanceof Error ? error.message : "unknown",
    );
    void run();
  }
}

export async function sendMetaCapiEvent(event: MetaCapiEvent): Promise<void> {
  const pixelId = getMetaPixelId();
  const accessToken = getAccessToken();
  const eventId = sanitizeMetaEventId(event.eventId);
  const eventSourceUrl = sanitizeEventSourceUrl(event.eventSourceUrl);
  if (!pixelId || !accessToken || !eventId || !eventSourceUrl) return;
  if (!isRifaloProductionHost(new URL(eventSourceUrl).hostname)) return;
  if (process.env.VERCEL_ENV !== "production") return;

  const userData = buildMetaUserData({
    email: event.user?.email,
    phone: event.user?.phone,
    name: event.user?.name,
    clientIpAddress: sanitizeClientIp(event.clientIpAddress),
    clientUserAgent: sanitizeUserAgent(event.clientUserAgent),
    fbp: sanitizeFbp(event.fbp),
    fbc: sanitizeFbc(event.fbc),
  });
  if (Object.keys(userData).length === 0) return;

  const customData: Record<string, string | number | string[]> = {
    content_ids: event.customData.content_ids,
    content_type: "product",
    value: event.customData.value,
    currency: "DOP",
  };
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
  const testEventCode = getTestEventCode();
  if (testEventCode) params.set("test_event_code", testEventCode);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      console.error("Meta CAPI rejected an event:", response.status, text.slice(0, 300));
      return;
    }
    try {
      const parsed = JSON.parse(text) as { events_received?: number; error?: unknown };
      if (parsed.error || parsed.events_received === 0) {
        console.error("Meta CAPI accepted no events:", text.slice(0, 300));
      }
    } catch {
      console.error("Meta CAPI returned an unreadable response:", text.slice(0, 300));
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function schedulePurchaseConversion(input: {
  purchaseId: string;
  raffleId: string | null | undefined;
  quantity: number;
  totalAmount: number;
  eventSourceUrl: string | null | undefined;
  clientIp: string | null | undefined;
  userAgent: string | null | undefined;
  fbp: string | null | undefined;
  fbc: string | null | undefined;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}) {
  if (process.env.VERCEL_ENV !== "production") return;
  const eventSourceUrl = sanitizeEventSourceUrl(input.eventSourceUrl);
  const purchaseId = sanitizeMetaEventId(input.purchaseId) ? input.purchaseId : null;
  if (!eventSourceUrl || !purchaseId || !input.raffleId) return;
  const quantity = Number(input.quantity);
  const value = Number(input.totalAmount);
  if (!Number.isInteger(quantity) || quantity < 1) return;
  if (!Number.isFinite(value) || value < 0) return;

  scheduleMetaCapiEvent({
    eventName: "Purchase",
    eventId: `purchase_${purchaseId}`,
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
      order_id: purchaseId,
    },
  });
}
