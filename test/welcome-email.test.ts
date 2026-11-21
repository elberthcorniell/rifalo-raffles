import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { requestWelcomeEmail } from "../src/lib/emails/request-welcome.ts";
import {
  buildWelcomeEmail,
  raffleShareMessage,
  whatsappShareUrl,
} from "../src/lib/emails/welcome-template.ts";
import {
  DEFAULT_EMAIL_FROM,
  WELCOME_EMAIL_MAX_AGE_MS,
  WELCOME_EMAIL_SENT_AT_KEY,
  handleWelcomeEmail,
  isRecentSignup,
  resolveEmailFrom,
  type OutboundWelcomeEmail,
  type WelcomeAuthUser,
  type WelcomeLinks,
} from "../src/lib/emails/welcome.ts";

const RAFFLE_URL = "https://hilux.rifalo.do/raffles/8f3c2a1b-4d5e-4a6b-9c0d-1e2f3a4b5c6d";
const PANEL_URL = "https://hilux.rifalo.do/admin";
const TITLE = "Toyota Hilux 2024";
const USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SESSION_EMAIL = "Dueno@Example.com";
const NOW = new Date("2026-11-19T17:00:00.000Z");

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function owner(overrides: Partial<WelcomeAuthUser> = {}): WelcomeAuthUser {
  return {
    id: USER_ID,
    email: SESSION_EMAIL,
    created_at: new Date(NOW.getTime() - 60_000).toISOString(),
    user_metadata: {},
    ...overrides,
  };
}

const links: WelcomeLinks = {
  raffleTitle: TITLE,
  raffleUrl: RAFFLE_URL,
  panelUrl: PANEL_URL,
};

describe("welcome email template", () => {
  it("includes the raffle URL, the panel, and the WhatsApp share link", () => {
    const email = buildWelcomeEmail({
      raffleTitle: TITLE,
      raffleUrl: RAFFLE_URL,
      panelUrl: PANEL_URL,
    });
    const share = whatsappShareUrl(raffleShareMessage(TITLE, RAFFLE_URL));

    assert.equal(email.subject, "Tu rifa ya está en línea");
    assert.ok(email.html.includes(RAFFLE_URL));
    assert.ok(email.text.includes(RAFFLE_URL));
    assert.ok(email.html.includes(PANEL_URL));
    assert.ok(email.text.includes(PANEL_URL));
    assert.ok(email.html.includes(share));
    assert.ok(email.text.includes(share));
    assert.ok(share.startsWith("https://wa.me/?text="));
    assert.ok(share.includes(encodeURIComponent(RAFFLE_URL)));
    assert.match(email.html, /Kit de bienvenida/);
    assert.match(email.text, /Tips para compartir/);
    assert.match(email.text, /Bajar el afiche: https:\/\/hilux\.rifalo\.do\/admin/);
    assert.equal(email.html.includes("<img"), false);
  });

  it("does not compare a prize with the ticket price", () => {
    const email = buildWelcomeEmail({
      raffleTitle: TITLE,
      raffleUrl: RAFFLE_URL,
      panelUrl: PANEL_URL,
    });
    const rendered = `${email.subject}\n${email.html}\n${email.text}`;
    assert.equal(/precio|premio/i.test(rendered), false);
    assert.equal(/por solo|comparad[oa]|m[aá]s barat/i.test(rendered), false);

    const source = read("../src/lib/emails/welcome-template.ts");
    assert.equal(/precio|premio|ticketPrice|ticket_price|prizeValue/i.test(source), false);
  });

  it("escapes the title and appends optional kit sections", () => {
    const email = buildWelcomeEmail({
      raffleTitle: 'Hilux <2024> & "oro"',
      raffleUrl: RAFFLE_URL,
      panelUrl: PANEL_URL,
      posterUrl: "https://cdn.example.com/afiche.png",
      extraSections: [
        {
          id: "pagos",
          title: "Revisa los pagos",
          paragraphs: ["Aprueba los comprobantes desde el panel."],
        },
      ],
    });

    assert.ok(email.html.includes("Hilux &lt;2024&gt; &amp; &quot;oro&quot;"));
    assert.equal(email.html.includes("<script"), false);
    assert.ok(email.html.includes('src="https://cdn.example.com/afiche.png"'));
    assert.ok(email.html.includes("Ver afiche"));
    assert.match(email.text, /Revisa los pagos/);
    assert.match(email.text, /Aprueba los comprobantes desde el panel/);
  });

  it("drops a non-http poster link", () => {
    const email = buildWelcomeEmail({
      raffleTitle: TITLE,
      raffleUrl: RAFFLE_URL,
      panelUrl: PANEL_URL,
      posterUrl: "javascript:alert(1)",
    });
    assert.equal(email.html.includes("javascript:"), false);
    assert.match(email.text, /Bajar el afiche/);
  });
});

describe("welcome email delivery", () => {
  it("no-ops without an API key and does not send", async () => {
    const warnings: string[] = [];
    let sent = 0;
    let loaded = 0;
    const result = await handleWelcomeEmail({
      user: owner(),
      apiKey: "  ",
      now: NOW,
      loadLinks: async () => {
        loaded += 1;
        return links;
      },
      markSent: async () => {
        throw new Error("should not record a skipped send");
      },
      send: async () => {
        sent += 1;
        return { ok: true };
      },
      log: {
        warn: (message) => warnings.push(message),
        error: () => {},
      },
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, skipped: "missing_api_key" });
    assert.deepEqual(warnings, [
      "RESEND_API_KEY is not configured. Skipping welcome email.",
    ]);
    assert.equal(sent, 0);
    assert.equal(loaded, 0);
  });

  it("rejects a caller without a session and ignores any other address", async () => {
    let sentTo = "";
    const result = await handleWelcomeEmail({
      user: null,
      apiKey: "re_test_key",
      now: NOW,
      loadLinks: async () => links,
      markSent: async () => {},
      send: async (message) => {
        sentTo = message.to;
        return { ok: true };
      },
    });

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { ok: false, error: "unauthorized" });
    assert.equal(sentTo, "");

    const route = read("../app/api/emails/welcome/route.ts");
    assert.match(route, /supabase\.auth\.getUser\(/);
    assert.match(route, /WELCOME_EMAIL_SENT_AT_KEY/);
    assert.equal(route.includes("request.json"), false);
    assert.equal(route.includes("body.email"), false);
    assert.equal(route.includes("searchParams"), false);
  });

  it("sends only to the session email and records the flag once", async () => {
    const sent: OutboundWelcomeEmail[] = [];
    const recorded: string[] = [];
    const result = await handleWelcomeEmail({
      user: owner(),
      apiKey: "re_test_key",
      from: "",
      replyTo: " hola@rifalo.do ",
      now: NOW,
      loadLinks: async (userId) => {
        assert.equal(userId, USER_ID);
        return links;
      },
      markSent: async (sentAt) => {
        recorded.push(sentAt);
      },
      send: async (message) => {
        sent.push(message);
        return { ok: true };
      },
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, sent: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "dueno@example.com");
    assert.notEqual(sent[0].to, "otra-persona@example.com");
    assert.equal(sent[0].from, DEFAULT_EMAIL_FROM);
    assert.equal(resolveEmailFrom(undefined), DEFAULT_EMAIL_FROM);
    assert.equal(sent[0].replyTo, "hola@rifalo.do");
    assert.equal(sent[0].idempotencyKey, `welcome/${USER_ID}`);
    assert.ok(sent[0].html.includes(RAFFLE_URL));
    assert.ok(sent[0].text.includes(RAFFLE_URL));
    assert.equal(recorded.length, 1);
    assert.equal(Number.isNaN(Date.parse(recorded[0])), false);
  });

  it("does not send again when the flag is already set", async () => {
    let sent = 0;
    const result = await handleWelcomeEmail({
      user: owner({
        user_metadata: { [WELCOME_EMAIL_SENT_AT_KEY]: "2026-11-19T16:00:00.000Z" },
      }),
      apiKey: "re_test_key",
      now: NOW,
      loadLinks: async () => links,
      markSent: async () => {
        throw new Error("already recorded");
      },
      send: async () => {
        sent += 1;
        return { ok: true };
      },
    });

    assert.deepEqual(result.body, { ok: true, skipped: "already_sent" });
    assert.equal(sent, 0);
  });

  it("skips accounts that are not a new signup", () => {
    assert.equal(isRecentSignup(new Date(NOW.getTime() - 60_000).toISOString(), NOW), true);
    assert.equal(
      isRecentSignup(new Date(NOW.getTime() - WELCOME_EMAIL_MAX_AGE_MS).toISOString(), NOW),
      true,
    );
    assert.equal(
      isRecentSignup(new Date(NOW.getTime() - WELCOME_EMAIL_MAX_AGE_MS - 1).toISOString(), NOW),
      false,
    );
    assert.equal(isRecentSignup(undefined, NOW), false);
  });

  it("does not send or record the flag when delivery fails", async () => {
    let recorded = 0;
    const result = await handleWelcomeEmail({
      user: owner({ created_at: new Date(NOW.getTime() - WELCOME_EMAIL_MAX_AGE_MS - 1000).toISOString() }),
      apiKey: "re_test_key",
      now: NOW,
      loadLinks: async () => links,
      markSent: async () => {
        recorded += 1;
      },
      send: async () => ({ ok: true }),
    });
    assert.deepEqual(result.body, { ok: true, skipped: "not_new_signup" });
    assert.equal(recorded, 0);

    const failed = await handleWelcomeEmail({
      user: owner(),
      apiKey: "re_test_key",
      now: NOW,
      loadLinks: async () => null,
      markSent: async () => {
        recorded += 1;
      },
      send: async () => ({ ok: true }),
    });
    assert.deepEqual(failed.body, { ok: true, skipped: "no_raffle" });

    const rejected = await handleWelcomeEmail({
      user: owner(),
      apiKey: "re_test_key",
      now: NOW,
      loadLinks: async () => links,
      markSent: async () => {
        recorded += 1;
      },
      send: async () => {
        throw new Error("network");
      },
      log: { warn: () => {}, error: () => {} },
    });
    assert.deepEqual(rejected.body, { ok: true, skipped: "send_failed" });
    assert.equal(recorded, 0);
  });
});

describe("welcome email wiring", () => {
  it("asks for the mail only after a new signup publishes a raffle", () => {
    const wizard = read("../src/components/onboarding/CreateRaffleWizard.tsx");
    const ensure = wizard.slice(wizard.indexOf("const ensureAccount"), wizard.indexOf("const publish"));
    const already = ensure.indexOf("includes('already')");
    const signIn = ensure.indexOf("signInWithPassword");
    assert.equal(ensure.slice(already, signIn).includes("justSignedUp"), false);
    assert.equal(ensure.includes("requestWelcomeEmail"), false);
    assert.match(ensure, /justSignedUp\.current = true/);

    const publish = wizard.slice(wizard.indexOf("const publish"));
    const success = publish.indexOf("if (!json.success)");
    const call = publish.indexOf("requestWelcomeEmail()");
    assert.ok(success > -1 && call > success);
    assert.match(
      publish,
      /if \(justSignedUp\.current\) \{\s*justSignedUp\.current = false\s*requestWelcomeEmail\(\)/,
    );
  });

  it("swallows a failed request", async () => {
    const previousWindow = globalThis.window;
    const previousFetch = globalThis.fetch;
    let calls = 0;
    globalThis.window = {} as Window & typeof globalThis;
    globalThis.fetch = () => {
      calls += 1;
      return Promise.reject(new Error("offline"));
    };
    try {
      assert.doesNotThrow(() => requestWelcomeEmail());
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(calls, 1);
    } finally {
      globalThis.window = previousWindow;
      globalThis.fetch = previousFetch;
    }
  });
});
