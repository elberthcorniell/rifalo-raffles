import { planFromPriceId } from "@/lib/stripe";
import {
  sanitizeClientIp,
  sanitizeEventSourceUrl,
  sanitizeFbc,
  sanitizeFbp,
  sanitizeMetaEventId,
  sanitizeUserAgent,
} from "@/lib/meta-host";
import { sha256 } from "@/lib/meta-user-data";
import { sendMetaCapiEvent, type MetaCapiEvent } from "@/lib/meta-capi";

export type PaidPlan = "plus" | "unlimited";

const STRIPE_METADATA_MAX = 500;

export const META_FBP_KEY = "meta_fbp";
export const META_FBC_KEY = "meta_fbc";
export const META_IP_KEY = "meta_client_ip";
export const META_UA_KEY = "meta_user_agent";
export const META_URL_KEY = "meta_event_source_url";

const PLAN_CONTENT: Record<PaidPlan, { contentName: string; contentId: string }> = {
  plus: { contentName: "Plus", contentId: "plus" },
  unlimited: { contentName: "Ilimitado", contentId: "unlimited" },
};

export function planPurchaseEventId(sourceId: string): string | null {
  const trimmed = sourceId.trim();
  if (!trimmed) return null;
  const direct = sanitizeMetaEventId(`plan_${trimmed}`);
  if (direct) return direct;
  return sanitizeMetaEventId(`plan_${sha256(trimmed).slice(0, 40)}`);
}

export function resolvePaidPlan(
  metadataPlan: string | null | undefined,
  priceId: string | null | undefined,
): PaidPlan | null {
  const fromPrice = priceId ? planFromPriceId(priceId) : "free";
  if (fromPrice === "plus" || fromPrice === "unlimited") return fromPrice;
  if (metadataPlan === "plus" || metadataPlan === "unlimited") return metadataPlan;
  return null;
}

/** Stripe minor units (cents) to the dollars actually charged. */
export function usdAmountFromMinor(
  amount: number | null | undefined,
  currency: string | null | undefined,
): number | null {
  if (!currency || currency.toLowerCase() !== "usd") return null;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const dollars = Math.round(amount) / 100;
  if (dollars <= 0 || dollars > 100_000) return null;
  return dollars;
}

function metadataValue(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, STRIPE_METADATA_MAX);
}

/** Attribution captured when checkout starts. Values are Stripe-metadata safe. */
export function checkoutAttributionMetadata(input: {
  fbp?: unknown;
  fbc?: unknown;
  clientIp?: unknown;
  userAgent?: unknown;
  eventSourceUrl?: unknown;
}): Record<string, string> {
  const entries: Array<[string, string | null]> = [
    [META_FBP_KEY, sanitizeFbp(input.fbp)],
    [META_FBC_KEY, sanitizeFbc(input.fbc)],
    [META_IP_KEY, sanitizeClientIp(input.clientIp)],
    [META_UA_KEY, metadataValue(sanitizeUserAgent(input.userAgent))],
    [META_URL_KEY, metadataValue(sanitizeEventSourceUrl(input.eventSourceUrl))],
  ];
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

type Attribution = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  eventSourceUrl?: string | null;
};

function buildPurchaseEvent(
  sourceId: string,
  plan: PaidPlan,
  value: number,
  attribution: Attribution,
): MetaCapiEvent | null {
  const eventId = planPurchaseEventId(sourceId);
  const eventSourceUrl = sanitizeEventSourceUrl(attribution.eventSourceUrl);
  if (!eventId || !eventSourceUrl) return null;
  const content = PLAN_CONTENT[plan];
  return {
    eventName: "Purchase",
    eventId,
    eventSourceUrl,
    clientIpAddress: attribution.clientIp,
    clientUserAgent: attribution.userAgent,
    fbp: attribution.fbp,
    fbc: attribution.fbc,
    user: {
      email: attribution.email,
      phone: attribution.phone,
      name: attribution.name,
    },
    customData: {
      content_ids: [content.contentId],
      content_name: content.contentName,
      content_type: "product",
      value,
      currency: "USD",
      num_items: 1,
      order_id: sourceId,
    },
  };
}

export type CheckoutPurchaseSource = {
  id: string;
  mode?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  customer_details?: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
  } | null;
  metadata?: Record<string, string> | null;
};

/**
 * Standard Purchase for a paid Plus or Unlimited checkout.
 * Unpaid, free, zero-amount, and non-USD sessions return null.
 */
export function checkoutPlanPurchaseEvent(
  session: CheckoutPurchaseSource,
  fallbackEventSourceUrl?: string | null,
  expectedOrgId?: string | null,
): MetaCapiEvent | null {
  if (session.mode !== "subscription") return null;
  if (session.payment_status !== "paid") return null;
  if (expectedOrgId && session.metadata?.org_id !== expectedOrgId) return null;
  const metadata = session.metadata || {};
  const plan = resolvePaidPlan(metadata.plan, null);
  const value = usdAmountFromMinor(session.amount_total, session.currency);
  if (!plan || value == null || !session.id) return null;
  return buildPurchaseEvent(session.id, plan, value, {
    email: session.customer_details?.email || session.customer_email,
    name: session.customer_details?.name,
    phone: session.customer_details?.phone,
    fbp: metadata[META_FBP_KEY],
    fbc: metadata[META_FBC_KEY],
    clientIp: metadata[META_IP_KEY],
    userAgent: metadata[META_UA_KEY],
    eventSourceUrl: metadata[META_URL_KEY] || fallbackEventSourceUrl,
  });
}

export type InvoicePurchaseSource = {
  id: string;
  billingReason?: string | null;
  amountPaid?: number | null;
  currency?: string | null;
  status?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  metadata?: Record<string, string> | null;
  priceId?: string | null;
  fallbackEventSourceUrl?: string | null;
};

/**
 * Renewal or plan-update payments. The first invoice (subscription_create)
 * is omitted because checkout.session.completed already reports it.
 */
export function invoicePlanPurchaseEvent(invoice: InvoicePurchaseSource): MetaCapiEvent | null {
  if (
    invoice.billingReason !== "subscription_cycle" &&
    invoice.billingReason !== "subscription_update"
  ) {
    return null;
  }
  if (invoice.status && invoice.status !== "paid") return null;
  const metadata = invoice.metadata || {};
  const plan = resolvePaidPlan(metadata.plan, invoice.priceId);
  const value = usdAmountFromMinor(invoice.amountPaid, invoice.currency);
  if (!plan || value == null || !invoice.id) return null;
  return buildPurchaseEvent(invoice.id, plan, value, {
    email: invoice.email,
    name: invoice.name,
    phone: invoice.phone,
    fbp: metadata[META_FBP_KEY],
    fbc: metadata[META_FBC_KEY],
    clientIp: metadata[META_IP_KEY],
    userAgent: metadata[META_UA_KEY],
    eventSourceUrl: metadata[META_URL_KEY] || invoice.fallbackEventSourceUrl,
  });
}

export async function reportCheckoutPlanPurchase(
  session: CheckoutPurchaseSource,
  fallbackEventSourceUrl?: string | null,
): Promise<void> {
  try {
    const event = checkoutPlanPurchaseEvent(session, fallbackEventSourceUrl);
    if (!event) return;
    await sendMetaCapiEvent(event);
  } catch (error) {
    console.error(
      "Meta plan Purchase skipped:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export async function reportInvoicePlanPurchase(invoice: InvoicePurchaseSource): Promise<void> {
  try {
    const event = invoicePlanPurchaseEvent(invoice);
    if (!event) return;
    await sendMetaCapiEvent(event);
  } catch (error) {
    console.error(
      "Meta plan Purchase skipped:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export function invoicePriceId(invoice: {
  lines?: {
    data?: Array<{
      pricing?: {
        price_details?: { price?: string | { id?: string | null } | null } | null;
      } | null;
    }> | null;
  } | null;
}): string | null {
  for (const line of invoice.lines?.data || []) {
    const price = line.pricing?.price_details?.price;
    if (!price) continue;
    if (typeof price === "string") return price;
    if (price.id) return price.id;
  }
  return null;
}
