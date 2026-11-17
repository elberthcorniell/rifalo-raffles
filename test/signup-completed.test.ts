import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, afterEach } from "node:test";
import { rememberLandingUtms, readSignupUtms, type UtmStorage } from "../src/lib/landing-utm.ts";
import {
  buildCompleteRegistrationEvent,
  resetMetaCapiForTests,
  sendMetaCapiEvent,
} from "../src/lib/meta-capi.ts";
import { trackMetaCompleteRegistration } from "../src/lib/meta-browser.ts";
import { isSignupEventId, signupEventId } from "../src/lib/meta-host.ts";
import { sha256 } from "../src/lib/meta-user-data.ts";
import { isNewlyCreatedAuthUser } from "../src/lib/signup-user.ts";

const USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const EMAIL = "NewUser@Example.com";
const SOURCE = "https://rifalo.do/signup";
const TOKEN = "test-token-not-a-real-secret-value";
const FBP = "fb.1.1710000000000.123456";
const FBC = "fb.1.1710000000000.IwAR0abc";

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

function memoryStorage(): UtmStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("signup account detection", () => {
  it("counts only a signUp that returned a real identity", () => {
    assert.equal(isNewlyCreatedAuthUser(null), false);
    assert.equal(isNewlyCreatedAuthUser({ id: USER_ID }), false);
    assert.equal(isNewlyCreatedAuthUser({ id: USER_ID, identities: [] }), false);
    assert.equal(
      isNewlyCreatedAuthUser({ id: USER_ID, identities: [{ provider: "email" }] }),
      true,
    );
  });

  it("uses one signup_<user id> for the pixel and CAPI", () => {
    const eventId = signupEventId(USER_ID.toUpperCase());
    assert.equal(eventId, `signup_${USER_ID}`);
    assert.equal(isSignupEventId(eventId || ""), true);
    assert.equal(signupEventId("not-a-user"), null);
    assert.equal(isSignupEventId("plan_cs_test_a1b2c3d4e5f6"), false);
    assert.equal(isSignupEventId("signup_not-a-uuid"), false);
  });
});

describe("signup landing UTMs", () => {
  it("keeps the session landing and falls back to the first touch", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    const search =
      "?utm_source=facebook&utm_medium=cpc&utm_campaign=spring&utm_content=ad1&utm_term=rifa";
    rememberLandingUtms(search, { local, session });
    assert.deepEqual(readSignupUtms({ local, session }), {
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: "spring",
      utm_content: "ad1",
      utm_term: "rifa",
    });

    rememberLandingUtms("?utm_campaign=later", { local, session });
    assert.equal(readSignupUtms({ local, session }).utm_campaign, "spring");

    const returnVisit = memoryStorage();
    rememberLandingUtms("?utm_campaign=return&utm_content=new", { local, session: returnVisit });
    assert.equal(readSignupUtms({ local, session: returnVisit }).utm_campaign, "return");
    assert.equal(readSignupUtms({ local, session: returnVisit }).utm_source, undefined);

    const bareSession = memoryStorage();
    assert.equal(readSignupUtms({ local, session: bareSession }).utm_campaign, "spring");
    assert.equal(readSignupUtms({ local, session: bareSession }).utm_term, "rifa");
  });

  it("drops blank campaign params", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    rememberLandingUtms("?utm_campaign=%20%20&utm_content=ok", { local, session });
    const utms = readSignupUtms({ local, session });
    assert.equal(utms.utm_campaign, undefined);
    assert.equal(utms.utm_content, "ok");
  });
});

describe("CompleteRegistration CAPI", { concurrency: 1 }, () => {
  afterEach(() => {
    restoreEnv();
  });

  it("hashes email and phone and shares the signup event id", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.META_PIXEL_ID = "1911591483127908";
    process.env.META_CAPI_ACCESS_TOKEN = TOKEN;
    delete process.env.META_CAPI_TEST_EVENT_CODE;
    delete process.env.META_TEST_EVENT_CODE;
    const bodies: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: { body?: unknown }) => {
      bodies.push(String(init?.body || ""));
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    }) as typeof fetch;

    try {
      const eventId = signupEventId(USER_ID);
      assert.ok(eventId);
      const event = buildCompleteRegistrationEvent({
        eventId,
        eventSourceUrl: SOURCE,
        email: EMAIL,
        phone: "8095551234",
        clientIp: "200.1.1.1, 10.0.0.1",
        userAgent: "Mozilla/5.0",
        fbp: FBP,
        fbc: FBC,
      });
      assert.ok(event);
      assert.equal(event.eventName, "CompleteRegistration");
      assert.equal(event.eventId, eventId);
      assert.equal(event.customData, undefined);

      const first = await sendMetaCapiEvent(event);
      const second = await sendMetaCapiEvent(event);
      assert.deepEqual(first, { sent: true });
      assert.deepEqual(second, { sent: false, reason: "duplicate" });
      assert.equal(bodies.length, 1);

      const params = new URLSearchParams(bodies[0]);
      const payload = JSON.parse(params.get("data") || "[]")[0];
      assert.equal(payload.event_name, "CompleteRegistration");
      assert.equal(payload.event_id, eventId);
      assert.equal(payload.custom_data.status, "completed");
      assert.equal(payload.custom_data.value, undefined);
      assert.equal(payload.custom_data.currency, undefined);
      assert.deepEqual(payload.user_data.em, [sha256("newuser@example.com")]);
      assert.deepEqual(payload.user_data.ph, [sha256("18095551234")]);
      assert.equal(payload.user_data.fbp, FBP);
      assert.equal(payload.user_data.fbc, FBC);
      assert.equal(payload.user_data.client_ip_address, "200.1.1.1");
      assert.equal(payload.user_data.client_user_agent, "Mozilla/5.0");
      const serialized = JSON.stringify(payload);
      assert.equal(serialized.includes(EMAIL), false);
      assert.equal(serialized.includes("newuser@example.com"), false);
      assert.equal(serialized.includes("8095551234"), false);
      assert.equal(serialized.includes(TOKEN), false);

      const emailOnly = buildCompleteRegistrationEvent({
        eventId: signupEventId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb") || "",
        eventSourceUrl: SOURCE,
        email: EMAIL,
      });
      assert.ok(emailOnly);
      assert.deepEqual(await sendMetaCapiEvent(emailOnly), { sent: true });
      const emailOnlyPayload = JSON.parse(new URLSearchParams(bodies[1]).get("data") || "[]")[0];
      assert.equal(emailOnlyPayload.user_data.ph, undefined);
      assert.deepEqual(emailOnlyPayload.user_data.em, [sha256("newuser@example.com")]);
    } finally {
      globalThis.fetch = originalFetch;
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
      const event = buildCompleteRegistrationEvent({
        eventId: signupEventId(USER_ID) || "",
        eventSourceUrl: SOURCE,
        email: EMAIL,
      });
      assert.ok(event);
      const result = await sendMetaCapiEvent(event);
      assert.deepEqual(result, { sent: false, reason: "missing_token" });
      assert.equal(fetched, false);
      assert.equal(logs.includes("Meta CAPI skipped: META_CAPI_ACCESS_TOKEN is not set"), true);
      assert.equal(logs.join("\n").includes(EMAIL), false);
      assert.equal(logs.join("\n").includes(TOKEN), false);
    } finally {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
    }
  });

  it("rejects a registration that is not tied to a new user id", () => {
    assert.equal(
      buildCompleteRegistrationEvent({
        eventId: "signup_not-a-uuid",
        eventSourceUrl: SOURCE,
        email: EMAIL,
      }),
      null,
    );
    assert.equal(
      buildCompleteRegistrationEvent({
        eventId: signupEventId(USER_ID) || "",
        eventSourceUrl: "https://cliente.com/signup",
        email: EMAIL,
      }),
      null,
    );
  });
});

describe("CompleteRegistration pixel", () => {
  it("fires once on rifalo.do and stays quiet on other hosts", () => {
    const eventId = signupEventId(USER_ID);
    assert.ok(eventId);
    const calls: unknown[][] = [];
    const previous = globalThis.window;
    const restore = () => {
      if (previous === undefined) {
        delete (globalThis as { window?: Window }).window;
      } else {
        globalThis.window = previous;
      }
    };

    globalThis.window = {
      location: { hostname: "localhost" },
      fbq: (...args: unknown[]) => {
        calls.push(args);
      },
    } as unknown as Window & typeof globalThis;
    try {
      assert.equal(trackMetaCompleteRegistration(eventId), false);
      assert.equal(calls.length, 0);

      globalThis.window = {
        location: { hostname: "rifalo.do" },
        fbq: (...args: unknown[]) => {
          calls.push(args);
        },
      } as unknown as Window & typeof globalThis;
      assert.equal(trackMetaCompleteRegistration(eventId), true);
      assert.equal(trackMetaCompleteRegistration(eventId), false);
      assert.deepEqual(calls, [
        ["track", "CompleteRegistration", { status: true }, { eventID: eventId }],
      ]);
    } finally {
      restore();
    }
  });
});

describe("signup wiring", () => {
  it("fires only after a new signUp, including the email-confirmation return", () => {
    const wizard = read("../src/components/onboarding/CreateRaffleWizard.tsx");
    const ensure = wizard.slice(wizard.indexOf("const ensureAccount"), wizard.indexOf("const publish"));
    const already = ensure.indexOf("includes('already')");
    const signIn = ensure.indexOf("signInWithPassword");
    const report = ensure.indexOf("reportSignupCompleted");
    const confirmReturn = ensure.indexOf("signData.user && !signData.session");
    assert.ok(already > -1 && signIn > already);
    assert.ok(report > signIn);
    assert.ok(confirmReturn > report);
    assert.equal(ensure.slice(already, signIn).includes("reportSignupCompleted"), false);
    assert.equal(ensure.split("reportSignupCompleted").length - 1, 1);

    const reporter = read("../src/lib/signup-completed.ts");
    assert.match(reporter, /trackMetaCompleteRegistration\(eventId\)/);
    assert.match(reporter, /eventName: "CompleteRegistration"/);
    assert.match(reporter, /signupEventId\(input\.userId\)/);
    assert.match(
      reporter,
      /captureClientEvent\(\s*"user_signed_up",\s*Object\.keys\(utms\)\.length \? utms : undefined,\s*true\s*\)/,
    );
    assert.equal(reporter.includes("utm_campaign"), false);

    const init = read("../app/posthog-init.tsx");
    assert.match(init, /rememberLandingUtms\(window\.location\.search\)/);

    for (const file of [
      "../app/platform/signup/page.tsx",
      "../app/platform/login/page.tsx",
      "../app/admin/login/page.tsx",
      "../app/api/admin/team/route.ts",
    ]) {
      const source = read(file);
      assert.equal(source.includes("reportSignupCompleted"), false, file);
      assert.equal(source.includes("CompleteRegistration"), false, file);
      assert.equal(source.includes("user_signed_up"), false, file);
    }
  });
});
