import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { getMetaPixelId, sendMetaCapiEvent, type MetaCapiEvent } from "@/lib/meta-capi";
import {
  buildPurchaseMeta,
  cookieFromHeader,
  hostnameFromHeaderValue,
  isRifaloProductionHost,
  sanitizeClientIp,
  sanitizeUserAgent,
} from "@/lib/meta-host";

export {
  buildTicketVoucherEvent,
  getMetaPixelId,
  getMetaTestEventCode,
  sendMetaCapiEvent,
  TICKET_VOUCHER_EVENT_NAME,
} from "@/lib/meta-capi";
export type {
  MetaCapiEvent,
  MetaCapiResult,
  MetaCommerceData,
  MetaEventName,
} from "@/lib/meta-capi";

export function isMetaServerEnabled(hostname: string): boolean {
  if (process.env.VERCEL_ENV !== "production") return false;
  return isRifaloProductionHost(hostname);
}

export function resolveMetaPixelId(hostname: string): string | null {
  if (!isMetaServerEnabled(hostname)) return null;
  return getMetaPixelId();
}

export async function readPurchaseMeta(formData: FormData) {
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
