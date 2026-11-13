import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, afterEach } from "node:test";
import { BROWSER_FORWARDED_EVENTS, buildTicketVoucherEvent, resetMetaCapiForTests, sendMetaCapiEvent } from "../src/lib/meta-capi.ts";
import { claimOnce } from "../src/lib/meta-browser.ts";
import { ticketVoucherEventId } from "../src/lib/meta-host.ts";
import {
  checkoutAttributionMetadata,
  checkoutPlanPurchaseEvent,
  invoicePlanPurchaseEvent,
  planPurchaseEventId,
  reportCheckoutPlanPurchase,
} from "../src/lib/meta-plan-purchase.ts";
import { sha256 } from "../src/lib/meta-user-data.ts";
import { stripAuthFromAnalyticsProperties, stripAuthFromUrl } from "../src/lib/posthog-url.ts";

const SOURCE = "https://www.rifalo.do/admin/billing?checkout=success";
const SESSION_ID = "cs_test_a1b2c3d4e5f6";
const EMAIL = "Buyer@Mail.com";
const TOKEN = "test-token-not-a-real-secret-value";

const savedEnv = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  META_PIXEL_ID: process.env.META_PIXEL_ID,
  META_CAPI_ACCESS_TOKEN: process.env.META_CAPI_ACCESS_TOKEN,
  META_CAPI_TEST_EVENT_CODE: process.env.META_CAPI_TEST_EVENT_CODE,
  META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetMetaCapiForTests();
}

function paidPlus(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    mode: "subscription",
    payment_status: "paid",
    amount_total: 2000,
    currency: "usd",
    customer_email: EMAIL,
    customer_details: { email: EMAIL, name: "Ana Pérez", phone: null },
    metadata: {
      org_id: "org-1",
      plan: "plus",
      meta_fbp: "fb.1.1710000000000.123456",
      meta_fbc: "fb.1.1710000000000.IwAR0abc",
      meta_event_source_url: SOURCE,
    },
    ...overrides,
  };
}

describe("plan Purchase", () => {
  it("reports a paid Plus checkout in USD with a stable event id", () => {
    const event = checkoutPlanPurchaseEvent(paidPlus());
    assert.ok(event);
    assert.equal(event.eventName, "Purchase");
    assert.equal(event.eventId, `plan_${SESSION_ID}`);
    assert.equal(event.eventId, planPurchaseEventId(SESSION_ID));
    assert.equal(event.customData.value, 20);
    assert.equal(event.customData.currency, "USD");
    assert.deepEqual(event.customData.content_ids, ["plus"]);
    assert.equal(event.customData.content_name, "Plus");
    assert.equal(event.customData.order_id, SESSION_ID);
    assert.equal(event.user?.email, EMAIL);
    assert.equal(event.fbp, "fb.1.1710000000000.123456");
  });

  it("uses the amount actually paid, including a discount", () => {
    const discounted = checkoutPlanPurchaseEvent(paidPlus({ amount_total: 1500 }));
    assert.equal(discounted?.customData.value, 15);
    const unlimited = checkoutPlanPurchaseEvent(
      paidPlus({
        amount_total: 5000,
        metadata: { ...paidPlus().metadata, plan: "unlimited" },
      }),
    );
    assert.equal(unlimited?.customData.value, 50);
    assert.equal(unlimited?.customData.currency, "USD");
    assert.deepEqual(unlimited?.customData.content_ids, ["unlimited"]);
    assert.equal(unlimited?.customData.content_name, "Ilimitado");
  });

  it("does not report unpaid, free, zero, or non-USD checkouts", () => {
    assert.equal(checkoutPlanPurchaseEvent(paidPlus({ payment_status: "unpaid" })), null);
    assert.equal(checkoutPlanPurchaseEvent(paidPlus({ payment_status: "no_payment_required" })), null);
    assert.equal(checkoutPlanPurchaseEvent(paidPlus({ mode: "payment" })), null);
    assert.equal(
      checkoutPlanPurchaseEvent(paidPlus({ metadata: { ...paidPlus().metadata, plan: "free" } })),
      null,
    );
    assert.equal(checkoutPlanPurchaseEvent(paidPlus({ amount_total: 0 })), null);
    assert.equal(checkoutPlanPurchaseEvent(paidPlus({ currency: "dop", amount_total: 2000 })), null);
    assert.equal(checkoutPlanPurchaseEvent(paidPlus(), SOURCE, "someone-else"), null);
  });

  it("reports renewals from the invoice id and skips the first invoice", () => {
    const metadata = {
      plan: "plus",
      meta_fbp: "fb.1.1710000000000.123456",
      meta_event_source_url: SOURCE,
    };
    assert.equal(
      invoicePlanPurchaseEvent({
        id: "in_first",
        billingReason: "subscription_create",
        amountPaid: 2000,
        currency: "usd",
        status: "paid",
        metadata,
      }),
      null,
    );
    const renewal = invoicePlanPurchaseEvent({
      id: "in_renewal_123456",
      billingReason: "subscription_cycle",
      amountPaid: 2000,
      currency: "usd",
      status: "paid",
      email: EMAIL,
      metadata,
    });
    assert.ok(renewal);
    assert.equal(renewal.eventName, "Purchase");
    assert.equal(renewal.eventId, "plan_in_renewal_123456");
    assert.notEqual(renewal.eventId, planPurchaseEventId(SESSION_ID));
    assert.equal(renewal.customData.value, 20);
    assert.equal(renewal.customData.currency, "USD");
  });

  it("keeps the same event id for the same Stripe id", () => {
    assert.equal(planPurchaseEventId(SESSION_ID), planPurchaseEventId(SESSION_ID));
    assert.equal(checkoutPlanPurchaseEvent(paidPlus())?.eventId, checkoutPlanPurchaseEvent(paidPlus())?.eventId);
  });
});

describe("ticket vouchers are not Purchase", () => {
  it("builds a custom DOP event for the voucher", () => {
    const purchaseId = "11111111-1111-4111-8111-111111111111";
    const event = buildTicketVoucherEvent({
      purchaseId,
      raffleId: "raffle-1",
      quantity: 2,
      totalAmount: 500,
      eventSourceUrl: "https://tienda.rifalo.do/explore/raffle-1",
      email: EMAIL,
    });
    assert.ok(event);
    assert.equal(event.eventName, "TicketVoucherSubmitted");
    assert.notEqual(event.eventName, "Purchase");
    assert.equal(event.eventId, ticketVoucherEventId(purchaseId));
    assert.equal(event.customData.currency, "DOP");
    assert.equal(event.customData.value, 500);
    assert.equal(BROWSER_FORWARDED_EVENTS.has("Purchase"), false);
    assert.equal(BROWSER_FORWARDED_EVENTS.has("TicketVoucherSubmitted"), false);
  });

  it("does not fire a standard Purchase from the voucher dialog", () => {
    const dialog = readFileSync(new URL("../src/components/PurchaseDialog.tsx", import.meta.url), "utf8");
    const voucher = readFileSync(new URL("../src/lib/voucher-purchase.ts", import.meta.url), "utf8");
    const browser = readFileSync(new URL("../src/lib/meta-browser.ts", import.meta.url), "utf8");
    assert.equal(dialog.includes("trackMetaPurchase"), false);
    assert.equal(dialog.includes("trackMetaTicketVoucherSubmitted"), true);
    assert.equal(voucher.includes("eventName: 'Purchase'"), false);
    assert.equal(voucher.includes('eventName: "Purchase"'), false);
    assert.equal(voucher.includes("buildTicketVoucherEvent"), true);
    const ticketFn = browser.slice(
      browser.indexOf("export function trackMetaTicketVoucherSubmitted"),
      browser.indexOf("export type PlanPurchasePixel"),
    );
    assert.match(ticketFn, /trackMetaCustomPixel/);
    assert.equal(ticketFn.includes('"Purchase"'), false);
    assert.match(browser, /function trackMetaCustomPixel[\s\S]*fbq\("trackCustom"/);
  });
});

describe("CAPI delivery", { concurrency: 1 }, () => {
  afterEach(() => {
    restoreEnv();
  });

  it("sends one Purchase for a paid plan and skips a retry with the same event id", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.META_PIXEL_ID = "1911591483127908";
    process.env.META_CAPI_ACCESS_TOKEN = TOKEN;
    process.env.META_CAPI_TEST_EVENT_CODE = "TEST12345";
    delete process.env.META_TEST_EVENT_CODE;
    const bodies: string[] = [];
    const logs: string[] = [];
    const originalFetch = globalThis.fetch;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    globalThis.fetch = (async (_url: string, init?: { body?: unknown }) => {
      bodies.push(String(init?.body || ""));
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    }) as typeof fetch;

    try {
      const event = checkoutPlanPurchaseEvent(paidPlus());
      assert.ok(event);
      const first = await sendMetaCapiEvent(event);
      const second = await sendMetaCapiEvent(event);
      assert.deepEqual(first, { sent: true });
      assert.deepEqual(second, { sent: false, reason: "duplicate" });
      assert.equal(bodies.length, 1);
      const params = new URLSearchParams(bodies[0]);
      const payload = JSON.parse(params.get("data") || "[]")[0];
      assert.equal(payload.event_name, "Purchase");
      assert.equal(payload.event_id, `plan_${SESSION_ID}`);
      assert.equal(payload.custom_data.currency, "USD");
      assert.equal(payload.custom_data.value, 20);
      assert.deepEqual(payload.custom_data.content_ids, ["plus"]);
      assert.equal(payload.custom_data.content_name, "Plus");
      assert.deepEqual(payload.user_data.em, [sha256("buyer@mail.com")]);
      assert.equal(JSON.stringify(payload).includes(EMAIL), false);
      assert.equal(JSON.stringify(payload).includes("buyer@mail.com"), false);
      assert.equal(params.get("test_event_code"), "TEST12345");
      assert.equal(logs.join("\n").includes(TOKEN), false);
      assert.equal(logs.join("\n").includes(EMAIL), false);
    } finally {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  it("does nothing and does not throw when the access token is missing", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.META_PIXEL_ID = "1911591483127908";
    delete process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.META_CAPI_TEST_EVENT_CODE;
    const logs: string[] = [];
    let fetched = false;
    const originalFetch = globalThis.fetch;
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      const result = await reportCheckoutPlanPurchase(paidPlus());
      assert.equal(result, undefined);
      assert.equal(fetched, false);
      assert.equal(logs.includes("Meta CAPI skipped: META_CAPI_ACCESS_TOKEN is not set"), true);
      assert.equal(logs.join("\n").includes(EMAIL), false);
      assert.equal(logs.join("\n").includes(TOKEN), false);
    } finally {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
    }
  });
});

describe("checkout attribution and browser dedup", () => {
  it("stores sanitized click ids and drops junk", () => {
    const metadata = checkoutAttributionMetadata({
      fbp: "fb.1.1710000000000.123456",
      fbc: "not a cookie",
      clientIp: "200.1.1.1, 10.0.0.1",
      userAgent: "Mozilla/5.0",
      eventSourceUrl: SOURCE,
    });
    assert.equal(metadata.meta_fbp, "fb.1.1710000000000.123456");
    assert.equal(metadata.meta_fbc, undefined);
    assert.equal(metadata.meta_client_ip, "200.1.1.1");
    assert.equal(metadata.meta_event_source_url, SOURCE);
    assert.equal(
      checkoutAttributionMetadata({ eventSourceUrl: "https://rifasmoramotors.com/admin/billing" })
        .meta_event_source_url,
      undefined,
    );
  });

  it("claims a plan Purchase once per event id", () => {
    const memory = new Set<string>();
    const stored = new Map<string, string>();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        stored.set(key, value);
      },
    };
    const eventId = planPurchaseEventId(SESSION_ID);
    assert.ok(eventId);
    assert.equal(claimOnce(eventId, storage, memory), true);
    assert.equal(claimOnce(eventId, storage, memory), false);
    assert.equal(claimOnce(eventId, storage, new Set()), false);
  });
});

describe("PostHog auth urls", () => {
  it("strips tokens from the hash and query of $current_url", () => {
    const cleaned = stripAuthFromUrl(
      "https://tienda.rifalo.do/auth/handoff?next=%2Fadmin#access_token=secret-access&refresh_token=secret-refresh",
    );
    assert.equal(cleaned.includes("secret-access"), false);
    assert.equal(cleaned.includes("secret-refresh"), false);
    assert.equal(cleaned.includes("access_token"), false);
    assert.equal(cleaned.includes("next=%2Fadmin") || cleaned.includes("next=/admin"), true);

    const properties: { [key: string]: unknown } = {
      $current_url: "https://www.rifalo.do/auth/reset-password?code=auth-code#access_token=abc",
      raffle_id: "keep-me",
    };
    stripAuthFromAnalyticsProperties(properties);
    assert.equal(String(properties.$current_url).includes("auth-code"), false);
    assert.equal(String(properties.$current_url).includes("access_token"), false);
    assert.equal(properties.raffle_id, "keep-me");
  });
});
