import assert from "node:assert/strict";
import test from "node:test";
import { reviewSeats } from "./seat-review.ts";

test("defaults to one seat and calculates a multi-seat fare", () => {
  assert.deepEqual(reviewSeats(undefined, 3, 18000), { seats: 1, subtotalMWK: 18000 });
  assert.deepEqual(reviewSeats("3", 3, 18000), { seats: 3, subtotalMWK: 54000 });
});

test("rejects malformed, repeated, fractional and unsafe seat counts", () => {
  for (const value of ["", "0", "-1", "1.5", "1e2", " 2", "01", "Infinity", "9007199254740992", ["1", "2"]]) {
    assert.ok("error" in reviewSeats(value, 10, 18000));
  }
});

test("rechecks availability including a trip that has sold out", () => {
  assert.ok("error" in reviewSeats("3", 2, 18000));
  assert.ok("error" in reviewSeats(undefined, 0, 18000));
});

test("rejects an invalid or overflowing fare", () => {
  assert.ok("error" in reviewSeats("2", 2, Number.MAX_SAFE_INTEGER));
  assert.ok("error" in reviewSeats("1", 2, -1));
});

