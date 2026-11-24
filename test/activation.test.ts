import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ACTIVATION_DAY1_BODY,
  ACTIVATION_DAY1_SUBJECT,
  ACTIVATION_DAY3_BODY,
  ACTIVATION_DAY3_SUBJECT,
  activationCopyIssues,
} from "../src/lib/activation-copy.ts";
import {
  activationTargets,
  classifyOrganizer,
  decideClaim,
  organizerRaffleLink,
  previewOrganizerSync,
  toResendContactBody,
  type OrganizerInput,
} from "../src/lib/activation-contacts.ts";
import { buildActivationEmail } from "../src/lib/activation-email.ts";
import {
  createResendApi,
  parseBroadcastList,
  parseMetricTotals,
  segmentIdFromEnv,
  syncOrganizerContacts,
} from "../src/lib/activation-resend.ts";

const NOW = new Date("2026-11-24T14:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function organizer(overrides: Partial<OrganizerInput> = {}): OrganizerInput {
  return {
    userId: "user-1",
    email: "Ana@Rifalo.do",
    emailConfirmed: true,
    fullName: "Ana Pérez",
    signupAt: new Date(NOW.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    unsubscribed: false,
    orgs: [
      {
        slug: "ana",
        name: "Ana Pérez",
        customDomain: null,
        createdAt: "2026-11-20T00:00:00.000Z",
        hasActiveRaffle: true,
        ticketsSold: 0,
      },
    ],
    ...overrides,
  };
}

describe("organizer sync mapping", () => {
  it("maps the public raffle link, properties, and the no-sales segment", () => {
    const custom = classifyOrganizer(
      organizer({
        orgs: [
          {
            slug: "ana",
            name: "Ana Pérez",
            customDomain: "https://AnaRifa.com/inicio",
            createdAt: "2026-11-20T00:00:00.000Z",
            hasActiveRaffle: true,
            ticketsSold: 0,
          },
        ],
      }),
      "localhost:3000",
    );
    assert.equal(custom.action, "sync");
    if (custom.action !== "sync") return;
    assert.equal(custom.contact.email, "ana@rifalo.do");
    assert.equal(custom.contact.firstName, "Ana");
    assert.equal(custom.contact.raffleLink, "https://anarifa.com");
    assert.equal(custom.contact.noSales, true);
    assert.equal(custom.contact.hasFirstSale, false);
    assert.equal(custom.contact.signupDate, "2026-11-23");

    const slugLink = organizerRaffleLink({ slug: "ana", customDomain: null }, "localhost:3000");
    assert.equal(slugLink, "https://ana.rifalo.do");
    assert.equal(
      organizerRaffleLink({ slug: "ana", customDomain: null }, "rifalo.do"),
      "https://ana.rifalo.do",
    );

    const body = toResendContactBody(custom.contact);
    assert.equal(body.first_name, "Ana");
    assert.equal(body.properties.org_slug, "ana");
    assert.equal(body.properties.raffle_link, "https://anarifa.com");
    assert.equal(body.properties.has_published_raffle, "true");
    assert.equal(body.properties.tickets_sold, 0);
    assert.equal(body.properties.has_first_sale, "false");
    assert.equal("unsubscribed" in body, false);

    const withSales = classifyOrganizer(
      organizer({
        fullName: null,
        orgs: [
          {
            slug: "vieja",
            name: "Rifa Vieja",
            customDomain: null,
            createdAt: "2026-11-01T00:00:00.000Z",
            hasActiveRaffle: true,
            ticketsSold: 4,
          },
          {
            slug: "nueva",
            name: "Rifa Nueva",
            customDomain: null,
            createdAt: "2026-11-22T00:00:00.000Z",
            hasActiveRaffle: true,
            ticketsSold: 0,
          },
        ],
      }),
    );
    assert.equal(withSales.action, "sync");
    if (withSales.action !== "sync") return;
    assert.equal(withSales.contact.ticketsSold, 4);
    assert.equal(withSales.contact.noSales, false);
    assert.equal(withSales.contact.hasFirstSale, true);
    assert.equal(withSales.contact.orgSlug, "nueva");
    assert.equal(withSales.contact.raffleLink, "https://nueva.rifalo.do");
    assert.equal(withSales.contact.firstName, "Rifa");
  });

  it("skips test orgs, unconfirmed mail, and unsubscribes", () => {
    assert.equal(classifyOrganizer(organizer({ emailConfirmed: false })).action, "skip");
    assert.equal(classifyOrganizer(organizer({ unsubscribed: true })).action, "skip");
    assert.equal(
      classifyOrganizer(
        organizer({
          orgs: [
            {
              slug: "cura",
              name: "Cura",
              customDomain: null,
              createdAt: "2026-11-01T00:00:00.000Z",
              hasActiveRaffle: true,
              ticketsSold: 0,
            },
          ],
        }),
      ).action,
      "skip",
    );
    const preview = previewOrganizerSync([
      organizer(),
      organizer({ userId: "b", email: "nuevo@rifalo.do", emailConfirmed: false }),
      organizer({ userId: "c", email: "baja@rifalo.do", unsubscribed: true }),
    ]);
    assert.equal(preview.willSync, 1);
    assert.equal(preview.noSales, 1);
    assert.equal(preview.unconfirmed, 1);
    assert.equal(preview.unsubscribed, 1);
  });

  it("upserts an existing contact and moves the no-sales segment", async () => {
    const calls: { method: string; url: string; body: unknown }[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ method: init?.method || "GET", url, body });
      assert.equal((init?.headers as Record<string, string>)["User-Agent"], "rifalo-raffles");
      assert.equal(String((init?.headers as Record<string, string>).Authorization).startsWith("Bearer "), true);
      if (url.endsWith("/contacts") && init?.method === "POST") {
        return jsonResponse(409, { message: "Contact already exists" });
      }
      return jsonResponse(200, { id: "contact-1", data: [] });
    };
    const decision = classifyOrganizer(organizer({ orgs: organizer().orgs.map((org) => ({ ...org, ticketsSold: 2 })) }));
    assert.equal(decision.action, "sync");
    if (decision.action !== "sync") return;

    const api = createResendApi("test-key", fetchImpl);
    const result = await syncOrganizerContacts({
      contacts: [decision.contact],
      api,
      organizersSegmentId: "78261eea-8f8b-4381-83c6-79fa7120f1cf",
      noSalesSegmentId: "11111111-1111-4111-8111-111111111111",
      sleep: async () => {},
    });
    assert.equal(result.synced, 1);
    assert.equal(result.failed, 0);
    const patch = calls.find((call) => call.method === "PATCH");
    assert.ok(patch);
    assert.match(patch.url, /\/contacts\/ana%40rifalo\.do$/);
    assert.equal("unsubscribed" in (patch.body as object), false);
    assert.equal((patch.body as { properties: { tickets_sold: number } }).properties.tickets_sold, 2);
    assert.ok(calls.some((call) => call.method === "POST" && call.url.includes("/segments/78261eea")));
    assert.ok(calls.some((call) => call.method === "DELETE" && call.url.includes("/segments/11111111")));
    assert.equal(segmentIdFromEnv("no_sales", {}), null);
  });
});

describe("day-1 and day-3 eligibility", () => {
  it("sends day 1 inside the window and day 3 only with zero sales", () => {
    const fresh = activationTargets(organizer({ signupAt: hoursAgo(12) }), [], NOW);
    assert.deepEqual(fresh, { day1: false, day3: false });

    const day1 = activationTargets(organizer({ signupAt: hoursAgo(36) }), [], NOW);
    assert.deepEqual(day1, { day1: true, day3: false });

    const exactlyOneDay = activationTargets(organizer({ signupAt: new Date(NOW.getTime() - DAY).toISOString() }), [], NOW);
    assert.equal(exactlyOneDay.day1, true);

    const day3 = activationTargets(organizer({ signupAt: hoursAgo(24 * 4) }), [], NOW);
    assert.deepEqual(day3, { day1: false, day3: true });

    const sold = activationTargets(
      organizer({
        signupAt: hoursAgo(24 * 4),
        orgs: organizer().orgs.map((org) => ({ ...org, ticketsSold: 1 })),
      }),
      [],
      NOW,
    );
    assert.deepEqual(sold, { day1: false, day3: false });

    const tooLate = activationTargets(organizer({ signupAt: hoursAgo(24 * 6) }), [], NOW);
    assert.deepEqual(tooLate, { day1: false, day3: false });

    const unpublished = activationTargets(
      organizer({
        signupAt: hoursAgo(36),
        orgs: organizer().orgs.map((org) => ({ ...org, hasActiveRaffle: false })),
      }),
      [],
      NOW,
    );
    assert.deepEqual(unpublished, { day1: false, day3: false });

    const already = activationTargets(organizer({ signupAt: hoursAgo(36) }), [
      { kind: "day1", status: "sent", claimedAt: hoursAgo(1) },
    ], NOW);
    assert.equal(already.day1, false);

    const inFlight = activationTargets(organizer({ signupAt: hoursAgo(36) }), [
      { kind: "day1", status: "pending", claimedAt: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString() },
    ], NOW);
    assert.equal(inFlight.day1, false);

    const retry = activationTargets(organizer({ signupAt: hoursAgo(36) }), [
      { kind: "day1", status: "failed", claimedAt: hoursAgo(2) },
    ], NOW);
    assert.equal(retry.day1, true);
  });

  it("claims a send once and retries a failed or stale claim", () => {
    assert.equal(decideClaim(null, NOW), "insert");
    assert.equal(decideClaim({ status: "sent", claimedAt: hoursAgo(1) }, NOW), "skip");
    assert.equal(decideClaim({ status: "failed", claimedAt: hoursAgo(1) }, NOW), "retry");
    assert.equal(
      decideClaim({ status: "pending", claimedAt: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString() }, NOW),
      "skip",
    );
    assert.equal(decideClaim({ status: "pending", claimedAt: hoursAgo(1) }, NOW), "retry");
  });
});

describe("activation copy", () => {
  it("uses the day-1 draft for the broadcast and keeps the day-3 follow-up", () => {
    assert.equal(ACTIVATION_DAY1_SUBJECT, "Organizador, así se vende tu primer boleto");
    assert.equal(ACTIVATION_DAY1_BODY.includes("Pon tu link en la bio de Instagram"), true);
    assert.equal(activationCopyIssues(ACTIVATION_DAY1_SUBJECT).length, 0);
    assert.equal(activationCopyIssues(ACTIVATION_DAY1_BODY).length, 0);
    assert.equal(activationCopyIssues(ACTIVATION_DAY3_SUBJECT).length, 0);
    assert.equal(activationCopyIssues(ACTIVATION_DAY3_BODY).length, 0);
    assert.match(ACTIVATION_DAY3_SUBJECT, /primeros 10/);
    assert.match(ACTIVATION_DAY3_BODY, /Responde este email/);

    const personal = buildActivationEmail({
      subject: "{nombre}, tu rifa",
      body: ACTIVATION_DAY1_BODY,
      mode: "personal",
      firstName: "Ana",
      raffleLink: "https://ana.rifalo.do",
      unsubscribeUrl: "https://www.rifalo.do/baja?token=abc",
    });
    assert.equal(personal.subject, "Ana, tu rifa");
    assert.match(personal.html, /Ver mi rifa/);
    assert.match(personal.html, /https:\/\/ana\.rifalo\.do/);
    assert.match(personal.html, /Hola, Ana\./);
    assert.doesNotMatch(personal.html, /\{\{\{contact\.first_name/);
    assert.match(personal.text, /Date de baja: https:\/\/www\.rifalo\.do\/baja\?token=abc/);

    const broadcast = buildActivationEmail({
      subject: ACTIVATION_DAY1_SUBJECT,
      body: "Hola, {{{FIRST_NAME}}}. Link: [link]",
      mode: "broadcast",
      unsubscribeUrl: "{{{RESEND_UNSUBSCRIBE_URL}}}",
    });
    assert.match(broadcast.html, /\{\{\{contact\.first_name\|organizador\}\}\}/);
    assert.match(broadcast.html, /\{\{\{raffle_link\}\}\}/);
    assert.match(broadcast.html, /href="\{\{\{raffle_link\}\}\}"/);
    assert.doesNotMatch(broadcast.html, /Ana/);
  });

  it("reads broadcast status and unique open and click totals", () => {
    const list = parseBroadcastList({
      data: [{ id: "b1", subject: "Hola", status: "sent", created_at: "2026-11-24T14:00:00.000Z" }],
    });
    assert.equal(list[0].status, "sent");
    assert.deepEqual(parseMetricTotals({ totals: { sent: 10, delivered: 9, opened: 8, unique_opened: 4, clicked: 3, unique_clicked: 2 } }), {
      sent: 10,
      delivered: 9,
      opened: 4,
      clicked: 2,
    });
  });

  it("keeps the automation off in the migration and on the single daily cron", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261124145155_organizer_activation.sql"),
      "utf8",
    );
    assert.match(sql, /enabled boolean NOT NULL DEFAULT false/);
    assert.match(sql, /organizer_activation_sends_email_kind_uidx/);
    assert.match(sql, /'no_sales'/);
    assert.match(sql, /¿ya le mandaste tu link a tus primeros 10\?/);
    const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
    assert.equal(vercel.crons.length, 1);
    const cron = fs.readFileSync(path.join(process.cwd(), "app/api/cron/pending-review-reminders/route.ts"), "utf8");
    assert.match(cron, /runOrganizerActivation/);
    assert.equal(cron.includes("resend.emails.send"), false);
  });
});

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
