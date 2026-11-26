import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readTenantRow, TenantLookupError, TENANT_UNAVAILABLE_BODY } from "../src/lib/tenant-lookup.ts";

describe("readTenantRow", () => {
  it("returns the row when Supabase answers", () => {
    assert.deepEqual(readTenantRow({ data: { id: "1", slug: "cura" }, error: null, status: 200 }), {
      id: "1",
      slug: "cura",
    });
  });

  it("returns null when no organization matches", () => {
    assert.equal(readTenantRow({ data: null, error: null, status: 200 }), null);
  });

  it("throws instead of reporting a missing org when Supabase rejects the query (402 restricted project)", () => {
    assert.throws(
      () => readTenantRow({ data: null, error: { message: "Payment Required", code: "" }, status: 402 }),
      (error: unknown) => error instanceof TenantLookupError && error.status === 402
    );
  });
});

describe("TENANT_UNAVAILABLE_BODY", () => {
  it("is brand agnostic and self-contained", () => {
    assert.ok(!/rifalo/i.test(TENANT_UNAVAILABLE_BODY));
    assert.ok(!/https?:|src=|href=|url\(/i.test(TENANT_UNAVAILABLE_BODY));
    assert.match(TENANT_UNAVAILABLE_BODY, /<html lang="es">/);
    assert.match(TENANT_UNAVAILABLE_BODY, /<meta name="robots" content="noindex">/);
    assert.match(TENANT_UNAVAILABLE_BODY, /Sitio temporalmente no disponible/);
  });
});
