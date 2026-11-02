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
  const phone = input.replace(/[\s()-]/g, "");
  if (!/^(?:\+265|0)(?:8|9|2)\d{8}$/.test(phone)) return null;
  return phone.startsWith("+") ? phone : `+265${phone.slice(1)}`;
}
