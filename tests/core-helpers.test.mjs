import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayRange, toMalawiDate } from "../src/lib/dates.ts";
import { hashGuestToken, matchesGuestToken, normalizeMalawiPhone, normalizeBookingReference } from "../src/lib/guest-access.ts";

describe("normalizeMalawiPhone", () => {
  it("normalizes local and international Malawi numbers", () => {
    assert.equal(normalizeMalawiPhone("0991 234 567"), "+265991234567");
    assert.equal(normalizeMalawiPhone("+265 991 234 567"), "+265991234567");
    assert.equal(normalizeMalawiPhone("0221 234 567"), "+265221234567");
  });

  it("rejects unsupported prefixes and lengths", () => {
    assert.equal(normalizeMalawiPhone("0771 234 567"), null);
    assert.equal(normalizeMalawiPhone("0991 234 56"), null);
  });

  it("matches bare, local and country-code variants to the same Malawi number", () => {
    for (const phone of ["993661661", "0993661661", "0993 661 661", "265993661661", "+265993661661", "+265 (0) 993-661-661", "2650993661661", "00265993661661", " 993.661.661 "]) assert.equal(normalizeMalawiPhone(phone), "+265993661661", phone);
    for (const phone of ["893661661", "0893661661", "265893661661", "+265 893 661 661"]) assert.equal(normalizeMalawiPhone(phone), "+265893661661", phone);
  });

  it("does not accept other countries, repeated country codes or arbitrary text", () => {
    for (const phone of ["+264993661661", "265265993661661", "call0993661661", "99366166", "9936616610", "0993+661661"]) assert.equal(normalizeMalawiPhone(phone), null, phone);
  });
});

describe("booking references", () => {
  it("ignores case and copied spaces without accepting partial references", () => {
    assert.equal(normalizeBookingReference("AbC123xY"), "abc123xy");
    assert.equal(normalizeBookingReference(" ABC1 23XY\n"), "abc123xy");
    for (const reference of ["ABC1234", "ABC123456", "ABC-1234", "", "ABC!2345"]) assert.equal(normalizeBookingReference(reference), null);
  });
});

describe("dayRange", () => {
  it("returns Malawi midnight boundaries for a real calendar date", () => {
    const range = dayRange("2026-10-26");
    assert.ok(range);
    assert.equal(range.start.toISOString(), "2026-10-25T22:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-10-26T22:00:00.000Z");
    assert.equal(toMalawiDate(range.start), "2026-10-26");
  });

  it("rejects malformed and impossible dates", () => {
    assert.equal(dayRange("2026-02-31"), null);
    assert.equal(dayRange("26-10-2026"), null);
  });
});

describe("matchesGuestToken", () => {
  it("matches the expected token hash and rejects other tokens", () => {
    const token = "QWERTYuiopASDFGHjklZXCVBnm0123456789abcdEFG";
    const hash = hashGuestToken(token);
    assert.equal(matchesGuestToken(token, hash), true);
    assert.equal(matchesGuestToken(`${token}x`, hash), false);
    assert.equal(matchesGuestToken(token, null), false);
  });
});
