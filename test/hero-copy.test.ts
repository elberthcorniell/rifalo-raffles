import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_HERO_COPY, heroCopyForUtms } from "../src/lib/hero-copy.ts";

const VARIANTS = {
  "1A": {
    title: "Influencer: tus DMs no son una caja registradora.",
    subtitle:
      "Pon un link en tu bio. Tus seguidores compran, suben el comprobante y reciben su número. Tú solo apruebas los pagos.",
  },
  "1C": {
    title: "Influencer: que nadie diga que tu rifa está arreglada.",
    subtitle:
      "Tú no escoges los números. El sistema los asigna al azar y cada seguidor los consulta cuando quiera con su WhatsApp.",
  },
  "2A": {
    title: "Dueño de negocio: tu rifa con tu logo, no en un chat.",
    subtitle:
      "Tus clientes compran en una página con tu nombre y tus colores, y pagan por transferencia directo a la cuenta del negocio.",
  },
  "3A": {
    title: "Fundación: que todo el dinero de la rifa se vea claro.",
    subtitle:
      "La gente transfiere directo a la cuenta de la organización. Rifalo no recibe ese dinero. Ustedes ven los boletos vendidos, los pagos pendientes y los aprobados en un solo panel.",
  },
} as const;

const CAMPAIGNS = ["rifalo_manual_v3", "rifalo_motion_v1"] as const;

const MOTION_ALIASES = {
  "2A-M1": "2A",
  "2A-M2": "2A",
  "3A-M1": "3A",
} as const;

describe("heroCopyForUtms", () => {
  it("returns the paired copy for rifalo_manual_v3 and rifalo_motion_v1", () => {
    for (const campaign of CAMPAIGNS) {
      for (const [content, copy] of Object.entries(VARIANTS)) {
        assert.deepEqual(heroCopyForUtms(campaign, content), copy);
      }
      for (const [content, parent] of Object.entries(MOTION_ALIASES)) {
        assert.deepEqual(heroCopyForUtms(campaign, content), VARIANTS[parent]);
      }
    }
  });

  it("trims both values before matching", () => {
    assert.deepEqual(heroCopyForUtms("  rifalo_manual_v3  ", " 1A "), VARIANTS["1A"]);
  });

  it("uses the first value when a param is repeated", () => {
    assert.deepEqual(
      heroCopyForUtms(["rifalo_manual_v3", "other"], ["2A", "1A"]),
      VARIANTS["2A"],
    );
  });

  it("ignores utm_content unless the campaign matches", () => {
    assert.deepEqual(heroCopyForUtms(undefined, "1A"), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms("other_campaign", "1A"), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms("", "1A"), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms(undefined, "2A-M1"), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms("other_campaign", "3A-M1"), DEFAULT_HERO_COPY);
  });

  it("falls back when the pair is missing or unknown", () => {
    assert.deepEqual(heroCopyForUtms(undefined, undefined), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms("rifalo_manual_v3", undefined), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms("rifalo_motion_v1", undefined), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms("rifalo_manual_v3", "1B"), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms("rifalo_motion_v1", "1B"), DEFAULT_HERO_COPY);
    assert.deepEqual(heroCopyForUtms("rifalo_manual_v3", "1a"), DEFAULT_HERO_COPY);
  });
});
