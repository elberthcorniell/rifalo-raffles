import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readTenantRow, TenantLookupError } from "../src/lib/tenant-lookup.ts";

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
