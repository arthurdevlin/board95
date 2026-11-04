import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createRequire, registerHooks } from "node:module";
import { readFileSync } from "node:fs";

const ts = createRequire(import.meta.url)("typescript");
globalThis.lifecycleTest = {};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/prisma") return { url: `data:text/javascript,${encodeURIComponent("export const prisma = { $transaction: (...args) => globalThis.lifecycleTest.transaction(...args), operatorMember: { findMany: (...args) => globalThis.lifecycleTest.memberships(...args) } };")}`, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    if (specifier === "./dates") return { url: new URL("../src/lib/dates.ts", import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts") && url.includes("/src/lib/")) return { format: "module", source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { DAY_MS, carHireExpiry, listingExpiryState, withTripHistory, withListingHistory } = await import("../src/lib/listing-lifecycle.ts");
const { csvRow, historyDateRange } = await import("../src/lib/listing-history-format.ts");
const { archiveExpiredListings } = await import("../src/lib/archive-listings.ts");
const { listingHistoryScope } = await import("../src/lib/listing-history.ts");
const now = new Date("2026-11-04T10:00:00.000Z");

describe("expiry and history boundaries", () => {
  it("warns exactly one day before expiry and expires at the precise instant", () => {
    assert.equal(carHireExpiry(now).getTime(), now.getTime() + 7 * DAY_MS);
    assert.equal(listingExpiryState(new Date(now.getTime() + DAY_MS + 1), now), "active");
    assert.equal(listingExpiryState(new Date(now.getTime() + DAY_MS), now), "expiring");
    assert.equal(listingExpiryState(new Date(now.getTime() + 1), now), "expiring");
    assert.equal(listingExpiryState(now, now), "expired");
  });
  it("keeps booking and rental display working after the active listing is deleted", () => {
    const trip = { origin: "Blantyre", destination: "Mzuzu" }, listing = { name: "Family SUV" };
    assert.equal(withTripHistory({ trip: null, tripHistory: trip }).trip, trip);
    assert.equal(withListingHistory({ listing: null, listingHistory: listing }).listing, listing);
    assert.equal(withTripHistory({ trip, tripHistory: null }).trip, trip);
    assert.throws(() => withTripHistory({ trip: null, tripHistory: null }), /missing/);
  });
  it("filters inclusive Malawi calendar dates including the UTC date boundary", () => {
    const range = historyDateRange("2026-11-04", "2026-11-04");
    assert.equal(range.gte.toISOString(), "2026-11-03T22:00:00.000Z");
    assert.equal(range.lt.toISOString(), "2026-11-04T22:00:00.000Z");
    assert.throws(() => historyDateRange("2026-02-30"), /valid dates/);
    assert.throws(() => historyDateRange("2026-11-05", "2026-11-04"), /valid dates/);
    assert.deepEqual(historyDateRange(), {});
  });
  it("exports parseable dates and protects quoted CSV fields from spreadsheet formulas", () => {
    assert.equal(csvRow(['A,"B"\nC', now, null, 100]), '"A,""B""\nC","2026-11-04T10:00:00.000Z","","100"\r\n');
    for (const input of ["=1+1", "+265991234567", "  @SUM(A1)", "\tformula", "-1+1"]) assert.ok(csvRow([input]).startsWith('"\''));
  });
});

describe("history access", () => {
  beforeEach(() => { globalThis.lifecycleTest = { memberships: async () => [{ operatorId: "my-company" }] }; });
  it("scopes car-hire history to its owner and rejects other provider types", async () => {
    assert.deepEqual((await listingHistoryScope({ id: "me", role: "CAR_HIRER" }, "car-hire")).cars, { ownerId: "me" });
    assert.equal(await listingHistoryScope({ id: "me", role: "OWNER" }, "car-hire"), null);
  });
  it("scopes bus staff to their companies and rejects passengers without membership", async () => {
    assert.deepEqual((await listingHistoryScope({ id: "staff", role: "CUSTOMER" }, "trip")).trips.operator.OR, [{ ownerId: "staff" }, { id: { in: ["my-company"] } }]);
    globalThis.lifecycleTest.memberships = async () => [];
    assert.equal(await listingHistoryScope({ id: "passenger", role: "CUSTOMER" }, "trip"), null);
  });
  it("permits administrators to view both archives", async () => {
    assert.deepEqual(await listingHistoryScope({ id: "admin", role: "ADMIN" }, "trip"), { trips: {}, cars: {} });
  });
});

describe("atomic listing cleanup", () => {
  let events, trip, car;
  beforeEach(() => {
    events = [];
    trip = { id: "trip-1", departureAt: new Date(now.getTime() - DAY_MS), operator: { name: "Operator" }, vehicle: { model: "Bus", plate: "ABC" }, departurePoint: { name: "Station" } };
    car = { id: "car-1", expiresAt: now, owner: { name: "Owner" }, photoUrl: "/stored-photo.webp" };
    globalThis.lifecycleTest.transaction = async (callback, options) => {
      assert.equal(options.isolationLevel, "Serializable");
      return callback({
        trip: {
          findMany: async ({ where }) => { assert.equal(where.departureAt.lte.getTime(), now.getTime() - DAY_MS); return trip ? [trip] : []; },
          delete: async (query) => { events.push(["delete-trip", query]); trip = null; },
        },
        carHireListing: {
          findMany: async ({ where }) => { assert.equal(where.expiresAt.lte.getTime(), now.getTime()); return car ? [car] : []; },
          delete: async (query) => { events.push(["delete-car", query]); car = null; },
        },
        tripHistory: { create: async (query) => { events.push(["archive-trip", query]); } },
        carHireListingHistory: { create: async (query) => { events.push(["archive-car", query]); } },
        booking: { updateMany: async (query) => { events.push(["link-bookings", query]); } },
        carHireRequest: { updateMany: async (query) => { events.push(["link-requests", query]); } },
      });
    };
  });
  it("archives snapshots and relinks dependent records before deleting active listings", async () => {
    assert.deepEqual(await archiveExpiredListings(now), { trips: 1, carHire: 1 });
    assert.deepEqual(events.map(([event]) => event), ["archive-trip", "link-bookings", "delete-trip", "archive-car", "link-requests", "delete-car"]);
    assert.equal(events[0][1].data.operatorName, "Operator");
    assert.equal(events[0][1].data.departurePointName, "Station");
    assert.deepEqual(events[1][1], { where: { tripId: "trip-1" }, data: { tripId: null, tripHistoryId: "trip-1" } });
    assert.deepEqual(events[4][1], { where: { listingId: "car-1" }, data: { listingId: null, listingHistoryId: "car-1" } });
    assert.deepEqual(await archiveExpiredListings(now), { trips: 0, carHire: 0 });
  });
  it("retries serialization conflicts but propagates other errors without deleting", async () => {
    const run = globalThis.lifecycleTest.transaction;
    let attempts = 0;
    globalThis.lifecycleTest.transaction = async (...args) => { if (++attempts < 3) throw { code: "P2034" }; return run(...args); };
    assert.deepEqual(await archiveExpiredListings(now), { trips: 1, carHire: 1 });
    assert.equal(attempts, 3);
    events.length = 0;
    globalThis.lifecycleTest.transaction = async () => { throw new Error("Database unavailable"); };
    await assert.rejects(archiveExpiredListings(now), /Database unavailable/);
    assert.equal(events.length, 0);
  });
});
