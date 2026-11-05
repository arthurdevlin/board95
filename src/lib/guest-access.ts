import { createHash, timingSafeEqual } from "node:crypto";

export function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function matchesGuestToken(token: string, expectedHash: string | null) {
  if (!expectedHash || !/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(hashGuestToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return timingSafeEqual(actual, expected);
}

export function normalizeMalawiPhone(input: string) {
  if (input.length > 64) return null;
  const phone = input.replace(/[\s().-]/g, "");
  // Accept local, bare national and international forms, including a redundant
  // trunk zero after the country code. Always store and compare one format.
  const match = /^(?:(?:\+|00)?265)?0?([289]\d{8})$/.exec(phone);
  return match ? `+265${match[1]}` : null;
}

export function normalizeBookingReference(input: string) {
  const reference = input.replace(/\s/g, "").toLowerCase();
  return /^[a-z0-9]{8}$/.test(reference) ? reference : null;
}
