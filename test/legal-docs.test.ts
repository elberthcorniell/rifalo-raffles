import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultLegalMarkdown,
  LEGAL_MARKDOWN_MAX,
  normalizeStoredLegalMarkdown,
  resolveLegalMarkdown,
} from "../src/lib/legal-docs.ts";
import { plainLegalText, renderLegalMarkdown } from "../src/lib/legal-markdown.ts";
import { isTenantContentPath, WINNERS_PATH } from "../src/lib/storefront-paths.ts";
import { formatWinnerDate, listPublishedWinners } from "../src/lib/winners.ts";

describe("legal markdown", () => {
  it("escapes raw HTML instead of rendering it", () => {
    const html = renderLegalMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>');
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /<img/i);
    assert.match(html, /&lt;script&gt;/);
  });

  it("renders headings, lists, emphasis, and safe links", () => {
    const html = renderLegalMarkdown(
      ["# Título", "", "Un **dato** y un *detalle*.", "", "- Uno", "- Dos", "", "[Sitio](https://example.com/rifa)"].join(
        "\n",
      ),
    );
    assert.match(html, /<h1>Título<\/h1>/);
    assert.match(html, /<strong>dato<\/strong>/);
    assert.match(html, /<em>detalle<\/em>/);
    assert.match(html, /<ul><li>Uno<\/li><li>Dos<\/li><\/ul>/);
    assert.match(html, /href="https:\/\/example.com\/rifa"/);
  });

  it("does not turn unsafe URLs into links", () => {
    const html = renderLegalMarkdown(
      ["[x](javascript:alert(1))", "[y](data:text/html,hi)", "[z](https://example.com)"].join("\n"),
    );
    assert.doesNotMatch(html, /javascript:/i);
    assert.doesNotMatch(html, /data:text/i);
    assert.match(html, /href="https:\/\/example.com\/"/);
    assert.match(html, />x</);
    assert.match(html, />y</);
  });
});

describe("legal document defaults", () => {
  it("fills the organizer name and ignores a malicious name", () => {
    const html = renderLegalMarkdown(
      defaultLegalMarkdown("terms", {
        organizerName: '<img src=x onerror=alert(1)> **[click](javascript:alert(1))**',
      }),
    );
    assert.match(html, /img src=x onerror=alert\(1\)/);
    assert.doesNotMatch(html, /<img/i);
    assert.doesNotMatch(html, /<a /i);
    assert.doesNotMatch(html, /href\s*=\s*["']javascript/i);
    assert.doesNotMatch(html, /Ley\s+\d/i);
  });

  it("uses a stored document and falls back when it is blank", () => {
    const context = { organizerName: "Rifas del Caribe" };
    assert.equal(resolveLegalMarkdown("privacy", "Texto propio", context), "Texto propio");
    assert.match(resolveLegalMarkdown("privacy", "   ", context), /Rifas del Caribe/);
    assert.match(resolveLegalMarkdown("rules", null, context), /Rifas del Caribe/);
  });

  it("adds contact lines only when they look like contact details", () => {
    const withContact = defaultLegalMarkdown("support", {
      organizerName: "Rifas del Caribe",
      email: "hola@rifasdelcaribe.do",
      phone: "809-555-0199",
    });
    assert.match(withContact, /hola@rifasdelcaribe\.do/);
    assert.match(withContact, /809-555-0199/);

    const withoutContact = defaultLegalMarkdown("support", {
      organizerName: "Rifas del Caribe",
      email: "javascript:alert(1)",
      phone: "llama ya",
    });
    assert.doesNotMatch(withoutContact, /javascript:/i);
    assert.match(withoutContact, /pie de este sitio/);
  });

  it("rejects documents that are too long and stores blanks as empty", () => {
    assert.equal(normalizeStoredLegalMarkdown("  "), null);
    assert.equal(normalizeStoredLegalMarkdown(null), null);
    assert.throws(() => normalizeStoredLegalMarkdown("a".repeat(LEGAL_MARKDOWN_MAX + 1)));
  });
});

describe("storefront paths", () => {
  it("recognizes the tenant content routes", () => {
    assert.equal(isTenantContentPath(WINNERS_PATH), true);
    assert.equal(isTenantContentPath("/terminos"), true);
    assert.equal(isTenantContentPath("/privacidad/extra"), true);
    assert.equal(isTenantContentPath("/terminos-extra"), false);
    assert.equal(isTenantContentPath("/raffles/1"), false);
  });
});

describe("winners", () => {
  it("has no published winners without a database", async () => {
    assert.deepEqual(await listPublishedWinners("org-1"), []);
  });

  it("formats an announcement date for the Dominican Republic", () => {
    assert.equal(formatWinnerDate("2026-03-15T16:00:00.000Z"), "15 de marzo de 2026");
    assert.equal(formatWinnerDate(null), null);
    assert.equal(formatWinnerDate("no-es-fecha"), null);
  });

  it("strips markup characters from a public name", () => {
    assert.equal(plainLegalText("<b>Ana</b>", "el organizador"), "bAna/b");
    assert.equal(plainLegalText("   ", "el organizador"), "el organizador");
  });
});
