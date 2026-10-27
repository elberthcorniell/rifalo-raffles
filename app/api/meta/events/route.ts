import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  hostnameFromHeaderValue,
  isRifaloProductionHost,
  sanitizeClientIp,
  sanitizeEventSourceUrl,
  sanitizeFbc,
  sanitizeFbp,
  sanitizeMetaEventId,
  sanitizeUserAgent,
} from "@/lib/meta-host";
import {
  isMetaServerEnabled,
  scheduleMetaCapiEvent,
  type MetaCommerceData,
  type MetaEventName,
} from "@/lib/meta-server";

const BROWSER_EVENTS = new Set<MetaEventName>(["ViewContent", "InitiateCheckout"]);

function skipped() {
  return NextResponse.json({ ok: true, skipped: true });
}

function parseCommerce(value: unknown): MetaCommerceData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.content_type !== "product" || data.currency !== "DOP") return null;
  if (!Array.isArray(data.content_ids)) return null;
  const contentIds = data.content_ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 64)
    .slice(0, 5);
  if (!contentIds.length) return null;
  const amount = typeof data.value === "number" ? data.value : Number(data.value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return null;

  const commerce: MetaCommerceData = {
    content_ids: contentIds,
    content_type: "product",
    value: Math.round(amount * 100) / 100,
    currency: "DOP",
  };
  if (data.num_items != null) {
    const items = Number(data.num_items);
    if (!Number.isInteger(items) || items < 1 || items > 100_000) return null;
    commerce.num_items = items;
  }
  return commerce;
}

export async function POST(request: Request) {
  const headerList = await headers();
  const requestHost = hostnameFromHeaderValue(
    headerList.get("x-forwarded-host") || headerList.get("host"),
  );
  if (!isMetaServerEnabled(requestHost)) return skipped();

  const fetchSite = headerList.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return skipped();

  const source = headerList.get("origin") || headerList.get("referer");
  if (!source) return skipped();
  try {
    if (!isRifaloProductionHost(new URL(source).hostname)) return skipped();
  } catch {
    return skipped();
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const eventName = payload.eventName;
  if (typeof eventName !== "string" || !BROWSER_EVENTS.has(eventName as MetaEventName)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const eventId = sanitizeMetaEventId(payload.eventId);
  const eventSourceUrl = sanitizeEventSourceUrl(payload.eventSourceUrl);
  const customData = parseCommerce(payload.customData);
  if (!eventId || !eventSourceUrl || !customData) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  scheduleMetaCapiEvent({
    eventName: eventName as MetaEventName,
    eventId,
    eventSourceUrl,
    clientIpAddress: sanitizeClientIp(
      headerList.get("x-forwarded-for") || headerList.get("x-real-ip"),
    ),
    clientUserAgent: sanitizeUserAgent(headerList.get("user-agent")),
    fbp: sanitizeFbp(payload.fbp),
    fbc: sanitizeFbc(payload.fbc),
    customData,
  });

  return NextResponse.json({ ok: true });
}
