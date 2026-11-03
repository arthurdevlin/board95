import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayRange, toMalawiDate } from "../src/lib/dates.ts";
import { hashGuestToken, matchesGuestToken, normalizeMalawiPhone } from "../src/lib/guest-access.ts";

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
