import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DEFAULT_HERO_COPY, heroCopyForUtms } from "../src/lib/hero-copy.ts";
import {
  HERO_CTA_HREF,
  HERO_CTA_LABEL,
  HERO_EYEBROW,
  HERO_PROOF_FALLBACK,
  HERO_PROOF_MIN_LIVE_RAFFLES,
  HERO_PROOF_MIN_TICKETS_SOLD,
  describeLiveRaffles,
  describeTicketsSold,
  formatHeroProof,
  isObviousTestRaffleTitle,
} from "../src/lib/hero-proof.ts";

const page = readFileSync(new URL("../app/platform/page.tsx", import.meta.url), "utf8");

describe("platform hero CTA", () => {
  it("keeps signup as the primary CTA for the default and a utm_content variant", () => {
    const variant = heroCopyForUtms("rifalo_manual_v3", "1A");
    const fallback = heroCopyForUtms(undefined, undefined);

    assert.deepEqual(fallback, DEFAULT_HERO_COPY);
    assert.notEqual(variant.title, fallback.title);
    assert.equal(variant.subtitle.length > 0, true);
    assert.equal(HERO_CTA_HREF, "/signup");
    assert.equal(HERO_CTA_LABEL, "Crea tu rifa gratis");
    assert.equal(HERO_EYEBROW, "¿Organizas rifas?");

    assert.match(page, /heroCopyForUtms\(params\.utm_campaign, params\.utm_content\)/);
    assert.match(page, /HERO_CTA_HREF/);
    assert.match(page, /HERO_CTA_LABEL/);
    assert.match(page, /getHeroProofLine/);
    assert.match(page, /\{hero\.title\}/);
    assert.match(page, /\{hero\.subtitle\}/);
    assert.doesNotMatch(page, /Lanza tu rifa gratis/);
  });
});

describe("formatHeroProof", () => {
  it("uses real counts only when they clear the threshold", () => {
    assert.equal(
      formatHeroProof({
        liveRaffles: HERO_PROOF_MIN_LIVE_RAFFLES,
        ticketsSold: HERO_PROOF_MIN_TICKETS_SOLD,
      }),
      "20 rifas activas · 100 boletos vendidos",
    );
    assert.equal(formatHeroProof({ liveRaffles: 13, ticketsSold: 12726 }), "12,726 boletos vendidos");
    assert.equal(formatHeroProof({ liveRaffles: 4, ticketsSold: 2500 }), "2,500 boletos vendidos");
    assert.equal(formatHeroProof({ liveRaffles: 20, ticketsSold: 99 }), "20 rifas activas");
  });

  it("falls back without numbers when counts are missing or too small", () => {
    assert.equal(formatHeroProof(null), HERO_PROOF_FALLBACK);
    assert.equal(formatHeroProof(undefined), HERO_PROOF_FALLBACK);
    assert.equal(formatHeroProof({ liveRaffles: 4, ticketsSold: 99 }), HERO_PROOF_FALLBACK);
    assert.equal(formatHeroProof({ liveRaffles: Number.NaN, ticketsSold: -3 }), HERO_PROOF_FALLBACK);
    assert.equal(HERO_PROOF_FALLBACK.includes("0"), false);
    assert.match(HERO_PROOF_FALLBACK, /República Dominicana/);
  });

  it("does not compare a prize with a ticket price", () => {
    const line = formatHeroProof({ liveRaffles: 13, ticketsSold: 12726 });
    assert.doesNotMatch(line, /RD\$|precio|vale|por boleto/i);
    assert.doesNotMatch(HERO_PROOF_FALLBACK, /RD\$|precio|vale/i);
    assert.doesNotMatch(HERO_CTA_LABEL, /RD\$|precio/i);
  });

  it("pluralizes a single raffle or ticket", () => {
    assert.equal(describeLiveRaffles(1), "1 rifa activa");
    assert.equal(describeTicketsSold(1), "1 boleto vendido");
  });

  it("flags obvious test raffle titles", () => {
    assert.equal(isObviousTestRaffleTitle("Rifa de prueba (no participar)"), true);
    assert.equal(isObviousTestRaffleTitle("  TEST "), true);
    assert.equal(isObviousTestRaffleTitle("Toyota Camry"), false);
    assert.equal(isObviousTestRaffleTitle("Test drive"), false);
  });
});
