import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cronAuthorized } from "../src/lib/emails/cron-auth.ts";
import { sendResendEmail } from "../src/lib/emails/resend.ts";
import { selectReminderRecipients } from "../src/lib/emails/recipients.ts";
import {
  buildReviewReminderEmail,
} from "../src/lib/emails/review-reminder-template.ts";
import {
  MAX_REMINDER_STEP_HOURS,
  highestDueStepHours,
  planReviewReminder,
  reminderIdempotencyKey,
  runPendingReviewReminders,
  type ReminderCandidate,
  type ReminderClaim,
  type ReminderState,
} from "../src/lib/emails/review-reminder.ts";
import { buildVerificationEmail } from "../src/lib/emails/verification-template.ts";
import {
  deliverVerificationNotice,
  sameInstant,
  verificationIdempotencyKey,
  verificationSendDecision,
  type DeliverVerificationInput,
} from "../src/lib/emails/verification-response.ts";
import type { OutboundEmail } from "../src/lib/emails/resend.ts";

const HOUR = 60 * 60 * 1000;
const START = "2026-11-21T12:00:00.000Z";
const START_MS = Date.parse(START);
const PANEL = "https://hilux.rifalo.do/admin/raffles";
const PURCHASES = "https://hilux.rifalo.do/admin/purchases";
const OWNER = "owner@example.com";
const RAFFLE_ID = "8f3c2a1b-4d5e-4a6b-9c0d-1e2f3a4b5c6d";
const ORG_ID = "11111111-2222-4333-8444-555555555555";
const REQUESTED = "2026-11-21T15:04:00.000Z";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function at(hours: number) {
  return new Date(START_MS + hours * HOUR);
}

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    orgId: ORG_ID,
    slug: "hilux",
    queueStartedAt: START,
    lastStepHours: 0,
    pendingCount: 2,
    oldestSubmittedAt: START,
    adminEmail: null,
    email: null,
    ...overrides,
  };
}

describe("pending review schedule", () => {
  it("sends at 1, 2, 4, 8 and 16 hours, and skips the hours in between", () => {
    let state: ReminderState | null = null;
    const sent: number[] = [];

    for (const hours of [0, 0.5, 1, 1.5, 2, 3, 4, 7, 8, 15, 16]) {
      const plan = planReviewReminder({
        state,
        oldestSubmittedAt: START,
        now: at(hours),
      });
      if (plan.action === "send") {
        sent.push(plan.stepHours);
        state = { queueStartedAt: plan.queueStartedAt, lastStepHours: plan.stepHours };
      } else if (plan.action === "wait" && !state) {
        state = { queueStartedAt: plan.queueStartedAt, lastStepHours: 0 };
      } else {
        assert.notEqual(plan.action, "clear");
        assert.notEqual(plan.action, "idle");
      }
    }

    assert.deepEqual(sent, [1, 2, 4, 8, 16]);
  });

  it("catches up with one email for the latest due step", () => {
    assert.equal(highestDueStepHours(5 * HOUR, 0), 4);
    assert.equal(highestDueStepHours(5 * HOUR, 4), null);
    assert.equal(highestDueStepHours(HOUR - 1, 0), null);
    assert.equal(highestDueStepHours(HOUR, 0), 1);
    assert.equal(highestDueStepHours(8 * HOUR, 2), 8);
    assert.equal(highestDueStepHours(MAX_REMINDER_STEP_HOURS * HOUR, 0), MAX_REMINDER_STEP_HOURS);
    assert.equal(
      highestDueStepHours(MAX_REMINDER_STEP_HOURS * HOUR, MAX_REMINDER_STEP_HOURS),
      null,
    );
  });

  it("keeps the original queue start while something is still pending", () => {
    const plan = planReviewReminder({
      state: { queueStartedAt: START, lastStepHours: 1 },
      oldestSubmittedAt: new Date(START_MS + 30 * 60 * 1000).toISOString(),
      now: at(1.5),
    });
    assert.equal(plan.action, "wait");
    if (plan.action === "wait") assert.equal(plan.queueStartedAt, START);
  });

  it("resets after the queue is empty and a new pending purchase arrives", () => {
    const cleared = planReviewReminder({
      state: { queueStartedAt: START, lastStepHours: 16 },
      oldestSubmittedAt: null,
      now: at(20),
    });
    assert.equal(cleared.action, "clear");

    const freshStart = new Date(START_MS + 30 * HOUR).toISOString();
    const tooSoon = planReviewReminder({
      state: null,
      oldestSubmittedAt: freshStart,
      now: new Date(Date.parse(freshStart) + 30 * 60 * 1000),
    });
    assert.equal(tooSoon.action, "wait");

    const due = planReviewReminder({
      state: null,
      oldestSubmittedAt: freshStart,
      now: new Date(Date.parse(freshStart) + HOUR),
    });
    assert.deepEqual(due, {
      action: "send",
      queueStartedAt: freshStart,
      stepHours: 1,
      previousStepHours: 0,
    });
  });

  it("does not send the same step twice and releases the claim when delivery fails", async () => {
    let state: ReminderState = { queueStartedAt: START, lastStepHours: 0 };
    const sent: OutboundEmail[] = [];
    const warnings: string[] = [];

    const run = (sendOk: boolean) =>
      runPendingReviewReminders({
        now: at(5),
        apiKey: "re_test_key",
        loadCandidates: async () => [
          candidate({
            queueStartedAt: state.queueStartedAt,
            lastStepHours: state.lastStepHours,
          }),
        ],
        loadRecipients: async () => [OWNER],
        panelUrl: () => PURCHASES,
        claim: async (claim: ReminderClaim) => {
          if (state.lastStepHours !== claim.previousStepHours) return false;
          if (state.queueStartedAt !== claim.queueStartedAt) return false;
          state = { queueStartedAt: state.queueStartedAt, lastStepHours: claim.stepHours };
          return true;
        },
        release: async (claim: ReminderClaim) => {
          if (state.lastStepHours === claim.stepHours) {
            state = { queueStartedAt: state.queueStartedAt, lastStepHours: claim.previousStepHours };
          }
        },
        send: async (message) => {
          sent.push(message);
          return { ok: sendOk };
        },
        log: { warn: (message) => warnings.push(message), error: () => {} },
      });

    const failed = await run(false);
    assert.equal(failed.sent, 0);
    assert.equal(state.lastStepHours, 0);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, OWNER);
    assert.equal(sent[0].idempotencyKey, reminderIdempotencyKey(ORG_ID, START, 4, OWNER));

    const delivered = await run(true);
    assert.equal(delivered.sent, 1);
    assert.equal(state.lastStepHours, 4);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].idempotencyKey, sent[0].idempotencyKey);

    const again = await run(true);
    assert.equal(again.sent, 0);
    assert.equal(sent.length, 2);
    assert.deepEqual(warnings, []);
  });

  it("no-ops without an API key and does not read the queue", async () => {
    let loaded = 0;
    const warnings: string[] = [];
    const result = await runPendingReviewReminders({
      apiKey: "  ",
      loadCandidates: async () => {
        loaded += 1;
        return [candidate()];
      },
      loadRecipients: async () => {
        throw new Error("should not load recipients");
      },
      panelUrl: () => PURCHASES,
      claim: async () => {
        throw new Error("should not claim");
      },
      release: async () => {
        throw new Error("should not release");
      },
      send: async () => {
        throw new Error("should not send");
      },
      log: { warn: (message) => warnings.push(message), error: () => {} },
    });

    assert.deepEqual(result, { ok: true, skipped: "missing_api_key", examined: 0, sent: 0 });
    assert.equal(loaded, 0);
    assert.deepEqual(warnings, [
      "RESEND_API_KEY is not configured. Skipping pending-review reminders.",
    ]);
  });

  it("does not claim a step when a parallel run already took it", async () => {
    let sent = 0;
    const result = await runPendingReviewReminders({
      now: at(1),
      apiKey: "re_test_key",
      loadCandidates: async () => [candidate()],
      loadRecipients: async () => [OWNER, " Owner@Example.com "],
      panelUrl: () => PURCHASES,
      claim: async () => false,
      release: async () => {
        throw new Error("unclaimed step is not released");
      },
      send: async () => {
        sent += 1;
        return { ok: true };
      },
      log: { warn: () => {}, error: () => {} },
    });
    assert.equal(result.sent, 0);
    assert.equal(sent, 0);
  });
});

describe("pending review copy", () => {
  it("states the count, the wait, and the purchases link", () => {
    const one = buildReviewReminderEmail({
      pendingCount: 1,
      waitingHours: 1,
      panelUrl: PURCHASES,
    });
    assert.equal(one.subject, "Tienes compras por revisar");
    assert.match(one.text, /Tienes 1 compra pendiente de revisar/);
    assert.match(one.text, /al menos 1 hora esperando/);
    assert.match(one.text, new RegExp(PURCHASES));
    assert.match(one.html, new RegExp(PURCHASES));

    const many = buildReviewReminderEmail({
      pendingCount: 3,
      waitingHours: 4,
      panelUrl: PURCHASES,
    });
    assert.match(many.text, /Tienes 3 compras pendientes de revisar/);
    assert.match(many.text, /al menos 4 horas esperando/);
    assert.equal(many.html.includes("<script"), false);
  });
});

describe("verification response", () => {
  const base = {
    status: "verified",
    requestedAt: REQUESTED,
    sentFor: null,
    apiKey: "re_test_key",
  };

  it("sends once per request and again only after a new request", () => {
    assert.equal(verificationSendDecision(base).send, true);
    assert.equal(
      verificationSendDecision({ ...base, sentFor: REQUESTED }).skip,
      "already_sent",
    );
    assert.equal(
      verificationSendDecision({
        ...base,
        sentFor: "2026-11-21T15:04:00.000+00:00",
      }).skip,
      "already_sent",
    );
    assert.equal(sameInstant(REQUESTED, "2026-11-21T15:04:00.000+00:00"), true);

    const nextRequest = "2026-11-22T15:04:00.000Z";
    const again = verificationSendDecision({ ...base, requestedAt: nextRequest, sentFor: REQUESTED });
    assert.equal(again.send, true);
    assert.equal(again.requestKey, nextRequest);
    assert.notEqual(
      verificationIdempotencyKey(RAFFLE_ID, REQUESTED, OWNER),
      verificationIdempotencyKey(RAFFLE_ID, nextRequest, OWNER),
    );
  });

  it("skips anything that is not a stored request", () => {
    assert.equal(verificationSendDecision({ ...base, status: "pending" }).skip, "not_a_response");
    assert.equal(verificationSendDecision({ ...base, requestedAt: null }).skip, "no_request");
    assert.equal(verificationSendDecision({ ...base, requestedAt: "   " }).skip, "no_request");
    assert.equal(verificationSendDecision({ ...base, apiKey: "" }).skip, "missing_api_key");
  });

  it("includes the decision, the note, and the panel", () => {
    const approved = buildVerificationEmail({
      title: "Hilux <2024>",
      panelUrl: PANEL,
      outcome: "verified",
    });
    assert.equal(approved.subject, "Tu rifa fue verificada");
    assert.match(approved.text, /Quedó verificada/);
    assert.match(approved.text, /Ir a mi panel: https:\/\/hilux\.rifalo\.do\/admin\/raffles/);
    assert.equal(approved.text.includes("Motivo"), false);
    assert.ok(approved.html.includes("Hilux &lt;2024&gt;"));
    assert.equal(approved.html.includes("<2024>"), false);

    const rejected = buildVerificationEmail({
      title: "Hilux",
      panelUrl: PANEL,
      outcome: "rejected",
      note: "La foto del premio no coincide.",
    });
    assert.equal(rejected.subject, "Tu rifa fue rechazada");
    assert.match(rejected.text, /Quedó rechazada/);
    assert.match(rejected.text, /Motivo: La foto del premio no coincide/);
    assert.match(rejected.html, /La foto del premio no coincide/);
    assert.match(rejected.text, /volver a solicitar la verificación/);
  });

  it("shows a note on an approval only when one was stored", () => {
    const email = buildVerificationEmail({
      title: "Hilux",
      panelUrl: PANEL,
      outcome: "verified",
      note: "Visible en el catálogo.",
    });
    assert.match(email.text, /Nota: Visible en el catálogo/);
  });

  function delivery(overrides: Partial<DeliverVerificationInput> = {}): DeliverVerificationInput {
    return {
      raffleId: RAFFLE_ID,
      title: "Hilux",
      panelUrl: PANEL,
      status: "rejected",
      requestedAt: REQUESTED,
      sentFor: null,
      note: "Falta el premio.",
      apiKey: "re_test_key",
      loadRecipients: async () => [OWNER],
      send: async () => ({ ok: true }),
      markSent: async () => {},
      log: { warn: () => {}, error: () => {} },
      ...overrides,
    };
  }

  it("sends to the owner once and records that request", async () => {
    const sent: OutboundEmail[] = [];
    const marked: string[] = [];
    const result = await deliverVerificationNotice(
      delivery({
        loadRecipients: async () => [OWNER, "other@example.com"],
        send: async (message) => {
          sent.push(message);
          return { ok: true };
        },
        markSent: async (requestedAt) => {
          marked.push(requestedAt);
        },
      }),
    );

    assert.deepEqual(result, { ok: true, sent: true });
    assert.deepEqual(
      sent.map((message) => message.to),
      [OWNER, "other@example.com"],
    );
    assert.equal(sent[0].idempotencyKey, verificationIdempotencyKey(RAFFLE_ID, REQUESTED, OWNER));
    assert.notEqual(sent[0].idempotencyKey, sent[1].idempotencyKey);
    assert.match(sent[0].text, /Falta el premio/);
    assert.match(sent[0].html, new RegExp(PANEL));
    assert.deepEqual(marked, [REQUESTED]);
  });

  it("does not load or send when that request was already emailed", async () => {
    const result = await deliverVerificationNotice(
      delivery({
        sentFor: REQUESTED,
        loadRecipients: async () => {
          throw new Error("already sent");
        },
        send: async () => {
          throw new Error("already sent");
        },
        markSent: async () => {
          throw new Error("already sent");
        },
      }),
    );
    assert.deepEqual(result, { ok: true, skipped: "already_sent" });
  });

  it("no-ops without an API key", async () => {
    const warnings: string[] = [];
    const result = await deliverVerificationNotice(
      delivery({
        apiKey: "",
        loadRecipients: async () => {
          throw new Error("missing key");
        },
        send: async () => {
          throw new Error("missing key");
        },
        log: { warn: (message) => warnings.push(message), error: () => {} },
      }),
    );
    assert.deepEqual(result, { ok: true, skipped: "missing_api_key" });
    assert.deepEqual(warnings, [
      "RESEND_API_KEY is not configured. Skipping verification email.",
    ]);
  });

  it("does not record the request when delivery fails", async () => {
    let marked = 0;
    const result = await deliverVerificationNotice(
      delivery({
        send: async () => ({ ok: false }),
        markSent: async () => {
          marked += 1;
        },
        log: { warn: () => {}, error: () => {} },
      }),
    );
    assert.deepEqual(result, { ok: true, skipped: "send_failed" });
    assert.equal(marked, 0);
  });

  it("does not send when there is no http panel link", async () => {
    let sent = 0;
    const result = await deliverVerificationNotice(
      delivery({
        panelUrl: "javascript:alert(1)",
        send: async () => {
          sent += 1;
          return { ok: true };
        },
      }),
    );
    assert.deepEqual(result, { ok: true, skipped: "no_panel" });
    assert.equal(sent, 0);
  });
});

describe("recipients and cron auth", () => {
  it("uses owner addresses and falls back only when none exist", () => {
    assert.deepEqual(
      selectReminderRecipients(["Owner@Example.com", "owner@example.com"], ["other@example.com"]),
      [OWNER],
    );
    assert.deepEqual(selectReminderRecipients([null, "nope"], [" Desk@Example.com "]), [
      "desk@example.com",
    ]);
    assert.deepEqual(selectReminderRecipients([], []), []);
  });

  it("rejects the cron unless the bearer secret matches", () => {
    assert.equal(cronAuthorized("Bearer secret", "secret"), true);
    assert.equal(cronAuthorized("Bearer secret", " other "), false);
    assert.equal(cronAuthorized("Bearer other", "secret"), false);
    assert.equal(cronAuthorized(null, "secret"), false);
    assert.equal(cronAuthorized("Bearer secret", ""), false);
    assert.equal(cronAuthorized("Bearer secret", "   "), false);
  });

  it("does not call Resend when the API key is missing", async () => {
    const result = await sendResendEmail(
      {
        to: OWNER,
        from: "Rifalo <hola@rifalo.do>",
        subject: "Prueba",
        html: "<p>Hola</p>",
        text: "Hola",
        idempotencyKey: "test/missing-key",
      },
      { apiKey: "  ", logLabel: "Test email" },
    );
    assert.deepEqual(result, { ok: false });
  });
});

describe("notification wiring", () => {
  it("emails from the superadmin response, after the decision is stored", () => {
    const route = read("../app/api/platform/superadmin/raffles/[id]/route.ts");
    const update = route.indexOf(".update(updates)");
    const failure = route.indexOf("if (error)", update);
    const notify = route.indexOf("await notifyRaffleVerificationResponse");
    assert.ok(update > -1 && failure > update && notify > failure);
    assert.match(route, /verification_response_email_for/);
  });

  it("protects the reminder cron with CRON_SECRET", () => {
    const route = read("../app/api/cron/pending-review-reminders/route.ts");
    const vercel = read("../vercel.json");
    assert.match(route, /cronAuthorized/);
    assert.match(route, /process\.env\.CRON_SECRET/);
    assert.equal(route.includes("resend.emails.send"), false);
    assert.match(vercel, /\/api\/cron\/pending-review-reminders/);
    assert.match(vercel, /\*\/15 \* \* \* \*/);
  });

  it("keeps the reminder clock until the pending queue is empty", () => {
    const sql = read("../supabase/migrations/20261121130914_owner_review_notifications.sql");
    assert.match(sql, /ON CONFLICT \(org_id\) DO NOTHING/);
    assert.match(sql, /DELETE FROM public\.org_review_reminders/);
    assert.match(sql, /verification_response_email_for/);
    assert.match(sql, /status = 'pending'/);
    assert.equal(sql.includes("SET queue_started_at"), false);
  });
});
