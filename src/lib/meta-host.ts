const RIFALO_ROOT = "rifalo.do";

const EVENT_ID_RE = /^[A-Za-z0-9_.:-]{8,128}$/;
const FBP_RE = /^fb\.\d\.\d{10,13}\.\d{1,20}$/;
const FBC_RE = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{1,300}$/;
const FBCLID_RE = /^[A-Za-z0-9_-]{1,200}$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

export function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

/**
 * Production Rifalo hosts only. Customer custom domains, localhost, and
 * Vercel preview hostnames do not match.
 */
export function isRifaloProductionHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === RIFALO_ROOT || host === `www.${RIFALO_ROOT}`) return true;
  return host.endsWith(`.${RIFALO_ROOT}`) && !host.endsWith(`.${RIFALO_ROOT}.${RIFALO_ROOT}`);
}

export function hostnameFromHeaderValue(value: string | null | undefined): string {
  return normalizeHostname((value || "").split(",")[0] || "");
}

export function sanitizeMetaEventId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return EVENT_ID_RE.test(id) ? id : null;
}

export function sanitizeFbp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cookie = value.trim();
  return FBP_RE.test(cookie) ? cookie : null;
}

export function sanitizeFbc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cookie = value.trim();
  return FBC_RE.test(cookie) ? cookie : null;
}

/** Build _fbc from a click id: fb.1.<timestamp ms>.<fbclid>. */
export function buildFbc(fbclid: string, timestampMs: number): string | null {
  const id = fbclid.trim();
  const timestamp = Math.floor(timestampMs);
  if (!FBCLID_RE.test(id) || !Number.isFinite(timestamp) || timestamp < 1_000_000_000_000) {
    return null;
  }
  return sanitizeFbc(`fb.1.${timestamp}.${id}`);
}

export function sanitizeClientIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ip = value.split(",")[0]?.trim() || "";
  if (!ip || ip.length > 64) return null;
  if (IPV4_RE.test(ip)) {
    const parts = ip.split(".").map((part) => Number(part));
    if (parts.some((part) => part > 255)) return null;
    return ip;
  }
  if (ip.includes(":") && IPV6_RE.test(ip)) return ip;
  return null;
}

export function sanitizeUserAgent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const agent = value.trim().replace(/\s+/g, " ");
  if (!agent) return null;
  return agent.slice(0, 512);
}

/** Keep an https page URL only when it is on a Rifalo production host. */
export function sanitizeEventSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    if (!isRifaloProductionHost(url.hostname)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function cookieFromHeader(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export type PurchaseMetaRecord = {
  meta_fbp: string | null;
  meta_fbc: string | null;
  meta_client_ip: string | null;
  meta_client_user_agent: string | null;
  meta_event_source_url: string;
  eventId: string;
};

/**
 * Attribution captured when the buyer submits a voucher.
 * Returns null unless this request is allowed to talk to Meta.
 */
export function buildPurchaseMeta(input: {
  serverEnabled: boolean;
  requestHost: string;
  clientIp: string | null;
  userAgent: string | null;
  eventId: string | null;
  fbp: string | null;
  fbc: string | null;
  eventSourceUrl: string | null;
  cookieFbp: string | null;
  cookieFbc: string | null;
  fallbackEventId: string;
}): PurchaseMetaRecord | null {
  if (!input.serverEnabled || !isRifaloProductionHost(input.requestHost)) return null;

  const host = normalizeHostname(input.requestHost);
  const eventSourceUrl =
    sanitizeEventSourceUrl(input.eventSourceUrl) || `https://${host}/`;
  const eventId = sanitizeMetaEventId(input.eventId) || sanitizeMetaEventId(input.fallbackEventId);
  if (!eventId) return null;

  return {
    meta_fbp: sanitizeFbp(input.fbp) || sanitizeFbp(input.cookieFbp),
    meta_fbc: sanitizeFbc(input.fbc) || sanitizeFbc(input.cookieFbc),
    meta_client_ip: sanitizeClientIp(input.clientIp),
    meta_client_user_agent: sanitizeUserAgent(input.userAgent),
    meta_event_source_url: eventSourceUrl,
    eventId,
  };
}
