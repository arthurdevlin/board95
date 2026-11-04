import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { registerHooks, createRequire } from "node:module";
import { readFileSync } from "node:fs";

// Exercise the actual server actions without sending notifications or touching a database.
const require = createRequire(import.meta.url);
const ts = require("typescript");
globalThis.board95ActionTest = { session: null, sideEffects: 0 };
const mocks = {
  "@/lib/session": "export async function getSession() { return globalThis.board95ActionTest.session; }",
  "@/lib/prisma": `export const prisma = new Proxy({}, { get(_target, key) {
    const state = globalThis.board95ActionTest;
    if (key === 'carHireListing' && state.renewQueries) return {
      async updateMany(query) { state.renewQueries.push(query); return { count: state.renewCount ?? 1 }; },
    };
    if (key === 'trip' && state.tripQueries) return {
      async count(query) { state.tripQueries.push(query); return 0; },
      async findMany(query) { state.tripQueries.push(query); return []; },
    };
    if (key === 'operator' && state.companyQueries) return { async findMany(query) { state.companyQueries.push(query); return [{ id: 'company-with-no-trips', name: 'Registered company' }]; } };
    if (key === '$transaction' && state.bookingTrip) return async (callback) => callback({ trip: { async findUnique() { return state.bookingTrip; } } });
    state.sideEffects++; throw new Error('Unexpected database access');
  } });`,
  "next/cache": "export function revalidatePath() {} export function updateTag() {} export function cacheLife() {} export function cacheTag() {}",
  "next/navigation": "export function redirect() { throw new Error('Unexpected redirect'); }",
  "better-auth/crypto": "export async function hashPassword() { throw new Error('Unexpected password hashing'); }",
  "@/lib/email": "export function board95Url() {} export function deliverEmailDelivery() {} export function sendBoard95Email() {}",
  "@/lib/rate-limit": "export async function allowRequest() { return globalThis.board95ActionTest.allowRequests ?? false; }",
  "@/lib/car-photo-storage": "export function removeCarPhoto() {} export function storeCarPhoto() {}",
  "@/lib/bus-schedules": "export async function ensureBusDepartures() {}",
};
const actionsUrl = new URL("../src/lib/actions.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(mocks, specifier)) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === actionsUrl) return { format: "module", source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { requestSeatAction, requestCarHireAction, submitAccountApplicationAction, applyForAccountTypeFromSignup, setUserPasswordAction, renewCarHireListingAction } = await import(actionsUrl);
const { parseFilters, searchTrips, getRegisteredBusCompanies, getUpcomingTrips } = await import("../src/lib/trips.ts");

beforeEach(() => { globalThis.board95ActionTest = { session: null, sideEffects: 0 }; });

describe("homepage departing soon", () => {
  for (const [label, now, included, excluded] of [
    ["eight-hour cutoff", "2026-11-04T06:00:00Z", ["2026-11-04T06:00:01Z", "2026-11-04T14:00:00Z"], ["2026-11-04T05:59:59Z", "2026-11-04T06:00:00Z", "2026-11-04T14:00:01Z", "2026-11-05T06:00:00Z"]],
    ["late evening stays on today's Malawi date", "2026-11-04T20:00:00Z", ["2026-11-04T20:30:00Z", "2026-11-04T21:59:59Z"], ["2026-11-04T22:00:00Z", "2026-11-05T01:00:00Z"]],
    ["Malawi date can differ from UTC date", "2026-11-04T22:30:00Z", ["2026-11-04T23:00:00Z", "2026-11-05T06:30:00Z"], ["2026-11-04T22:30:00Z", "2026-11-05T06:30:01Z", "2026-11-05T22:00:00Z"]],
  ]) {
    it(label, async () => {
      globalThis.board95ActionTest.tripQueries = [];
      await getUpcomingTrips(6, new Date(now));
      const [query] = globalThis.board95ActionTest.tripQueries;
      const matches = (value) => { const date = new Date(value); const range = query.where.departureAt; return date > range.gt && date <= range.lte && date < range.lt; };
      for (const date of included) assert.equal(matches(date), true, `${date} should appear`);
      for (const date of excluded) assert.equal(matches(date), false, `${date} should be excluded`);
      assert.equal(query.where.cancelled, false);
      assert.equal(query.where.vehicle.active, true);
      assert.equal(query.where.operator.active, true);
      assert.equal(query.where.operator.verified, true);
      assert.deepEqual(query.orderBy, [{ departureAt: "asc" }, { id: "asc" }]);
      assert.equal(query.take, 6);
    });
  }
});

describe("company filters and preview scope", () => {
  it("offers registered company choices even when they have no upcoming departures", async () => {
    globalThis.board95ActionTest.companyQueries = [];
    const companies = await getRegisteredBusCompanies();
    assert.equal(companies[0].id, "company-with-no-trips");
    const query = globalThis.board95ActionTest.companyQueries[0];
    assert.equal(query.where.kind, "BUS_COMPANY");
    assert.equal(query.where.trips, undefined);
    assert.deepEqual(query.select, { id: true, name: true });
  });
  it("preserves the company filter and restricts its results to buses", () => {
    const filters = parseFilters({ company: ["company-1", "company-2"], type: "taxi" });
    assert.equal(filters.company, "company-1");
    assert.equal(filters.type, "bus");
    assert.equal(parseFilters({ company: "!invalid" }).company, undefined);
  });

  it("keeps a requested company inside the provider's ownership or membership scope", async () => {
    globalThis.board95ActionTest.tripQueries = [];
    await searchTrips({ company: "another-company" }, 1, "provider");
    for (const query of globalThis.board95ActionTest.tripQueries) {
      assert.deepEqual(query.where.operator, { OR: [{ ownerId: "provider" }, { members: { some: { userId: "provider" } } }] });
      assert.equal(query.where.operatorId, "another-company");
      assert.equal(query.where.type, "BUS");
    }
    assert.equal(globalThis.board95ActionTest.tripQueries.length, 2);
  });

  it("keeps public results restricted to approved, active operators", async () => {
    globalThis.board95ActionTest.tripQueries = [];
    await searchTrips({}, 1);
    for (const query of globalThis.board95ActionTest.tripQueries) {
      assert.equal(query.where.operator.active, true);
      assert.equal(query.where.operator.verified, true);
      assert.ok(query.where.departureAt.gte instanceof Date);
    }
  });
});

describe("server action listing permissions", () => {
  it("blocks new bookings for a paused recurring bus even through a stale listing", async () => {
    globalThis.board95ActionTest.allowRequests = true;
    globalThis.board95ActionTest.bookingTrip = { id: "daily-trip", schedule: { active: false }, seatsAvailable: 52, departureAt: new Date("2090-01-01T10:00:00Z"), operator: { active: true, verified: true } };
    const form = new FormData();
    form.set("guestName", "Passenger");
    form.set("phone", "0991 234 567");
    form.set("tripId", "daily-trip");
    const result = await requestSeatAction({ status: "idle", message: "" }, form);
    assert.equal(result.status, "unavailable");
    assert.equal(globalThis.board95ActionTest.sideEffects, 0);
  });
  for (const user of [{ id: "provider", role: "OWNER" }, { id: "provider", role: "CAR_HIRER" }, { id: "staff", role: "CUSTOMER", isBusMember: true }]) {
    it(`rejects booking and rental requests from ${user.role}${user.isBusMember ? " bus members" : ""} before database access`, async () => {
      globalThis.board95ActionTest.session = { user };
      for (const action of [requestSeatAction, requestCarHireAction]) {
        const result = await action({ status: "idle", message: "" }, new FormData());
        assert.equal(result.status, "error");
        assert.match(result.message, /only preview their own listings/);
      }
      assert.equal(globalThis.board95ActionTest.sideEffects, 0);
    });
  }

  it("keeps guests, passengers and administrators eligible for booking validation", async () => {
    for (const user of [null, { id: "passenger", role: "CUSTOMER" }, { id: "admin", role: "ADMIN" }]) {
      globalThis.board95ActionTest.session = user ? { user } : null;
      const result = await requestSeatAction({ status: "idle", message: "" }, new FormData());
      assert.match(result.message, /Too many booking attempts/);
    }
  });

  it("rejects company members applying through either entry point", async () => {
    globalThis.board95ActionTest.session = { user: { id: "staff", role: "CUSTOMER", isBusMember: true } };
    await assert.rejects(submitAccountApplicationAction(new FormData()), /Only passenger accounts/);
    assert.match((await applyForAccountTypeFromSignup("TAXI_OWNER", "Example", "0991234567")).error, /Only passenger accounts/);
    assert.equal(globalThis.board95ActionTest.sideEffects, 0);
  });
});

describe("assigning passwords", () => {
  it("returns mismatches inline without changing credentials", async () => {
    globalThis.board95ActionTest.session = { user: { id: "admin", role: "ADMIN" } };
    const form = new FormData();
    form.set("userId", "target");
    form.set("password", "example-password-1");
    form.set("confirmPassword", "example-password-2");
    assert.deepEqual(await setUserPasswordAction({ status: "idle", message: "" }, form), { status: "error", message: "The passwords do not match." });
    assert.equal(globalThis.board95ActionTest.sideEffects, 0);
  });

  it("retains server validation when client validation is bypassed", async () => {
    globalThis.board95ActionTest.session = { user: { id: "admin", role: "ADMIN" } };
    const form = new FormData();
    form.set("userId", "target");
    form.set("password", "short");
    form.set("confirmPassword", "short");
    assert.equal((await setUserPasswordAction({ status: "idle", message: "" }, form)).status, "error");
    assert.equal(globalThis.board95ActionTest.sideEffects, 0);
  });

  it("requires system administrator access", async () => {
    globalThis.board95ActionTest.session = { user: { id: "staff", role: "CUSTOMER", isBusMember: true } };
    await assert.rejects(setUserPasswordAction({ status: "idle", message: "" }, new FormData()), /Administrator access required/);
  });
});


describe("listing renewal permissions", () => {
  it("limits renewal to the signed-in owner and an unexpired listing", async () => {
    const state = globalThis.board95ActionTest;
    state.session = { user: { id: "owner-1", role: "CAR_HIRER" } };
    state.renewQueries = [];
    const form = new FormData(); form.set("listingId", "listing-1");
    await renewCarHireListingAction(form);
    const query = state.renewQueries[0];
    assert.equal(query.where.ownerId, "owner-1");
    assert.equal(query.where.id, "listing-1");
    assert.equal(query.where.expiresAt.gt.getTime(), query.data.renewedAt.getTime());
    assert.equal(query.data.expiresAt.getTime() - query.data.renewedAt.getTime(), 7 * 86400000);
    assert.equal(query.data.available, undefined);
  });

  it("rejects expired or another owner's listing without recreating it", async () => {
    const state = globalThis.board95ActionTest;
    state.session = { user: { id: "owner-1", role: "CAR_HIRER" } };
    state.renewQueries = []; state.renewCount = 0;
    const form = new FormData(); form.set("listingId", "listing-1");
    await assert.rejects(renewCarHireListingAction(form), /expired or was not found/);
    assert.equal(state.renewQueries.length, 1);
  });

  it("rejects guests and passengers before database access", async () => {
    for (const user of [null, { id: "passenger", role: "CUSTOMER" }, { id: "owner", role: "OWNER" }]) {
      globalThis.board95ActionTest.session = user ? { user } : null;
      await assert.rejects(renewCarHireListingAction(new FormData()), /access required/);
    }
    assert.equal(globalThis.board95ActionTest.sideEffects, 0);
  });
});
