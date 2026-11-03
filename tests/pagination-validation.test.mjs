import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePageParam, readPage } from "../src/lib/pagination.ts";
import { isDatabaseAmount, isSelfServiceApplicationKind, MAX_DATABASE_INT } from "../src/lib/validation.ts";
import { formatDate, formatMWK, formatTimestamp } from "../src/lib/format.ts";
import { dayRange, toMalawiDate, toMalawiTime } from "../src/lib/dates.ts";

describe("page parameters", () => {
  it("keeps zero, negatives, malformed values and missing values on page one", () => {
    for (const value of [undefined, [], "0", "-1", "NaN", "Infinity", "1.5", "2junk", ""]) {
      assert.equal(parsePageParam(value), 1);
    }
  });

  it("handles repeated query keys and caps excessively large offsets", () => {
    assert.equal(parsePageParam(["3", "0"]), 3);
    assert.equal(parsePageParam("9".repeat(400)), 100_000);
  });

  it("starts count and row reads together and reads only the requested slice", async () => {
    let releaseCount;
    const count = new Promise((resolve) => { releaseCount = resolve; });
    const calls = [];
    const result = await readPage(2, 25, () => count, async (skip, take) => {
      calls.push([skip, take]);
      releaseCount(51);
      return ["row"];
    });
    assert.deepEqual(calls, [[25, 25]]);
    assert.deepEqual(result, { rows: ["row"], total: 51, page: 2, pageCount: 3 });
  });

  it("recovers a stale page after rows are deleted", async () => {
    const calls = [];
    const result = await readPage(99, 25, async () => 26, async (skip, take) => {
      calls.push([skip, take]);
      return skip === 25 ? ["last row"] : [];
    });
    assert.equal(result.page, 2);
    assert.deepEqual(result.rows, ["last row"]);
    assert.deepEqual(calls, [[2450, 25], [25, 25]]);
  });

  it("returns a valid first page for an empty table", async () => {
    const result = await readPage(1, 25, async () => 0, async () => []);
    assert.deepEqual(result, { rows: [], total: 0, page: 1, pageCount: 1 });
  });

  it("propagates database failures instead of presenting an empty result", async () => {
    await assert.rejects(readPage(1, 25, async () => { throw new Error("database unavailable"); }, async () => []), /database unavailable/);
  });
});

describe("amount and role boundaries", () => {
  it("accepts supported whole-kwacha amounts and optional zero fees", () => {
    assert.equal(isDatabaseAmount(1), true);
    assert.equal(isDatabaseAmount(MAX_DATABASE_INT), true);
    assert.equal(isDatabaseAmount(0, 0), true);
  });

  it("rejects PostgreSQL integer overflow including calculated totals", () => {
    for (const value of [0, -1, 1.5, NaN, Infinity, MAX_DATABASE_INT + 1, MAX_DATABASE_INT * 60]) {
      assert.equal(isDatabaseAmount(value), false);
    }
  });

  it("prevents self-service bus-company and administrator applications at runtime", () => {
    assert.equal(isSelfServiceApplicationKind("TAXI_OWNER"), true);
    assert.equal(isSelfServiceApplicationKind("CAR_HIRER"), true);
    for (const value of ["BUS_COMPANY", "ADMIN", "OWNER", "", null, {}]) {
      assert.equal(isSelfServiceApplicationKind(value), false);
    }
  });
});

describe("Malawi date and display boundaries", () => {
  it("handles midnight across the UTC day boundary", () => {
    const date = new Date("2026-11-02T22:30:00Z");
    assert.equal(toMalawiDate(date), "2026-11-03");
    assert.equal(toMalawiTime(date), "00:30");
    // ICU releases differ in whether they insert a comma after the weekday.
    assert.equal(formatDate("2026-11-03").replace(",", ""), "Tue 3 Nov");
    assert.match(formatTimestamp(date), /3 Nov 2026/);
  });

  it("accepts leap days and rejects non-leap years", () => {
    assert.ok(dayRange("2028-02-29"));
    assert.equal(dayRange("2027-02-29"), null);
  });

  it("preserves whole-kwacha formatting", () => {
    assert.equal(formatMWK(18000), "MWK 18,000");
  });
});
