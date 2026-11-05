import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFbc,
  buildPurchaseMeta,
  isRifaloProductionHost,
  sanitizeEventSourceUrl,
} from "../src/lib/meta-host.ts";
import {
  buildMetaUserData,
  normalizeMetaPhone,
  sha256,
  splitMetaName,
} from "../src/lib/meta-user-data.ts";

describe("isRifaloProductionHost", () => {
  it("allows the production site and its subdomains", () => {
    assert.equal(isRifaloProductionHost("rifalo.do"), true);
    assert.equal(isRifaloProductionHost("www.rifalo.do"), true);
    assert.equal(isRifaloProductionHost("tienda.rifalo.do"), true);
    assert.equal(isRifaloProductionHost("WWW.Rifalo.do:443"), true);
  });

  it("rejects localhost, previews, and customer domains", () => {
    for (const host of [
      "localhost",
      "localhost:3000",
      "127.0.0.1",
      "cura-raffles.vercel.app",
      "rifalo-raffles-git-preview.vercel.app",
      "cliente.com",
      "www.cliente.com",
      "rifalo.do.cliente.com",
      "rifalo.do.evil.com",
      "",
    ]) {
      assert.equal(isRifaloProductionHost(host), false, host);
    }
  });
});

describe("buildFbc", () => {
  it("builds the Meta click cookie from fbclid", () => {
    assert.equal(buildFbc("IwAR0abc_def-123", 1710000000000), "fb.1.1710000000000.IwAR0abc_def-123");
    assert.equal(buildFbc("bad id", 1710000000000), null);
  });
});

describe("event source url", () => {
  it("drops customer domains and non-https urls", () => {
    assert.equal(sanitizeEventSourceUrl("https://www.rifalo.do/explore/abc?fbclid=1"), "https://www.rifalo.do/explore/abc?fbclid=1");
    assert.equal(sanitizeEventSourceUrl("https://cliente.com/raffles/1"), null);
    assert.equal(sanitizeEventSourceUrl("http://www.rifalo.do/explore/1"), null);
  });
});

describe("buildPurchaseMeta", () => {
  const base = {
    serverEnabled: true,
    requestHost: "www.rifalo.do",
    clientIp: "200.1.1.1, 10.0.0.1",
    userAgent: "Mozilla/5.0",
    eventId: "11111111-1111-4111-8111-111111111111",
    fbp: "fb.1.1710000000000.123456",
    fbc: null,
    eventSourceUrl: "https://www.rifalo.do/explore/raffle?fbclid=IwAR0abc",
    cookieFbp: null,
    cookieFbc: "fb.1.1710000000000.IwAR0abc",
    fallbackEventId: "22222222-2222-4222-8222-222222222222",
  };

  it("stores click ids and the buyer request on Rifalo", () => {
    const meta = buildPurchaseMeta(base);
    assert.ok(meta);
    assert.equal(meta.meta_fbp, base.fbp);
    assert.equal(meta.meta_fbc, base.cookieFbc);
    assert.equal(meta.meta_client_ip, "200.1.1.1");
    assert.equal(meta.meta_client_user_agent, "Mozilla/5.0");
    assert.equal(meta.eventId, base.eventId);
    assert.match(meta.meta_event_source_url, /^https:\/\/www\.rifalo\.do\/explore\/raffle/);
  });

  it("does not store attribution for customer domains, previews, or when the server gate is off", () => {
    assert.equal(buildPurchaseMeta({ ...base, requestHost: "cliente.com" }), null);
    assert.equal(buildPurchaseMeta({ ...base, requestHost: "app.vercel.app" }), null);
    assert.equal(buildPurchaseMeta({ ...base, serverEnabled: false }), null);
  });

  it("replaces a customer-domain source url with the Rifalo host", () => {
    const meta = buildPurchaseMeta({
      ...base,
      eventSourceUrl: "https://cliente.com/checkout",
    });
    assert.equal(meta?.meta_event_source_url, "https://www.rifalo.do/");
  });
});

describe("buyer hashing", () => {
  it("normalizes Dominican phones to 1809/1829/1849 without symbols", () => {
    assert.equal(normalizeMetaPhone("+1 (809) 555-1234"), "18095551234");
    assert.equal(normalizeMetaPhone("8095551234"), "18095551234");
    assert.equal(normalizeMetaPhone("18295551234"), "18295551234");
    assert.equal(normalizeMetaPhone("(849) 555-1234"), "18495551234");
    assert.equal(normalizeMetaPhone(""), null);
  });

  it("hashes normalized buyer data and never returns plaintext", () => {
    const userData = buildMetaUserData({
      email: " Buyer@Mail.com ",
      phone: "8095551234",
      name: "  Juan   Pérez ",
      clientIpAddress: "200.1.1.1",
      clientUserAgent: "Mozilla/5.0",
      fbp: "fb.1.1710000000000.123456",
      fbc: "fb.1.1710000000000.IwAR0abc",
    });
    const serialized = JSON.stringify(userData);
    assert.deepEqual(userData.em, [sha256("buyer@mail.com")]);
    assert.deepEqual(userData.ph, [sha256("18095551234")]);
    assert.deepEqual(splitMetaName("  Juan   Pérez "), { fn: "juan", ln: "pérez" });
    assert.deepEqual(userData.fn, [sha256("juan")]);
    assert.deepEqual(userData.ln, [sha256("pérez")]);
    assert.equal(serialized.includes("Buyer@Mail.com"), false);
    assert.equal(serialized.includes("buyer@mail.com"), false);
    assert.equal(serialized.includes("8095551234"), false);
    assert.equal(serialized.includes("Juan"), false);
    assert.equal(serialized.includes("Pérez"), false);
  });

  it("omits buyer fields the customer did not provide", () => {
    const userData = buildMetaUserData({
      clientIpAddress: "200.1.1.1",
      clientUserAgent: "Mozilla/5.0",
    });
    assert.deepEqual(userData, {
      client_ip_address: "200.1.1.1",
      client_user_agent: "Mozilla/5.0",
    });
  });
});
