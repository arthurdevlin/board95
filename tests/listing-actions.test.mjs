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
    if (key === 'trip' && state.sharedTripQueries) return {
      async findFirst(query) { state.sharedTripQueries.push(query); return state.sharedTripRow ?? null; },
    };
    if (state.publishQueries) {
      const operator = { async findFirst() { return { id: 'district-operator', kind: 'TAXI_OWNER' }; } };
      const tx = { operator,
        vehicle: {
          async findUnique() { return { id: 'district-vehicle', operatorId: 'district-operator', model: 'Test vehicle', seats: 4, active: true }; },
          async findFirst(query) { if (query.where.operatorId !== 'district-operator') throw new Error('Missing fleet company scope'); return { id: 'district-vehicle', operatorId: 'district-operator', model: 'Test vehicle', seats: 4, active: true }; },
        },
        departurePoint: { async findFirst() { return null; }, async create(query) { state.publishQueries.push({ kind: 'point', ...query }); return { id: 'district-stage' }; } },
        trip: { async findFirst() { return null; }, async create(query) { state.publishQueries.push({ kind: 'trip', ...query }); return { id: 'district-trip' }; } },
        busSchedule: { async findFirst() { return null; }, async create(query) { state.publishQueries.push({ kind: 'schedule', ...query }); return { id: 'district-schedule' }; } },
      };
      if (key === 'operator') return operator;
      if (key === '$transaction') return async (callback) => callback(tx);
    }

    if (key === 'carHireListing' && state.renewQueries) return {
      async updateMany(query) { state.renewQueries.push(query); return { count: state.renewCount ?? 1 }; },
    };
    if (key === 'trip' && state.tripQueries) return {
      async count(query) { state.tripQueries.push(query); return 0; },
      async findMany(query) { state.tripQueries.push(query); return []; },
    };
    if (key === 'operator' && state.companyQueries) return { async findMany(query) { state.companyQueries.push(query); return [{ id: 'company-with-no-trips', name: 'Registered company' }]; } };
    if (key === '$transaction' && state.bookingTrip) return async (callback) => callback({ trip: { async findUnique() { return state.bookingTrip; } } });
    if (key === 'booking' && state.lookupQueries) return {
      async findFirst(query) { state.lookupQueries.push(query); return state.lookupResult ?? null; },
      async update(query) { (state.lookupUpdates ??= []).push(query); return { id: query.where.id }; },
    };
    state.sideEffects++; throw new Error('Unexpected database access');
  } });`,
  "next/cache": "export function revalidatePath() {} export function updateTag() {} export function cacheLife() {} export function cacheTag() {}",
  "next/navigation": "export function redirect(destination) { throw Object.assign(new Error('Test redirect'), { destination }); }",
  "better-auth/crypto": "export async function hashPassword() { throw new Error('Unexpected password hashing'); }",
  "@/lib/email": "export function board95Url() {} export async function getBoard95AdminEmails() { return []; } export function deliverEmailDelivery() {} export function sendBoard95Email() {}",
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
const { createOperatorTripAction, requestSeatAction, requestCarHireAction, submitAccountApplicationAction, applyForAccountTypeFromSignup, setUserPasswordAction, renewCarHireListingAction, lookupGuestBookingAction } = await import(actionsUrl);
const { parseFilters, searchTrips, getRegisteredBusCompanies, getUpcomingTrips, getPublicTrip } = await import("../src/lib/trips.ts");

beforeEach(() => { globalThis.board95ActionTest = { session: null, sideEffects: 0 }; });

describe("guest booking lookup", () => {
  for (const phone of ["0993661661", "993661661", "265993661661", "+265 993 661 661", "+265 (0) 993-661-661"]) {
    it(`looks up mixed-case references with phone ${phone}`, async () => {
      const state = globalThis.board95ActionTest;
      state.allowRequests = true;
      state.lookupQueries = [];
      state.lookupResult = { id: "guest-booking-abc123xy" };
      const form = new FormData(); form.set("reference", " AbC1 23XY "); form.set("phone", phone);
      await assert.rejects(lookupGuestBookingAction({ error: null }, form), (error) => /^\/bookings\/guest-booking-abc123xy\/chat\?token=[A-Za-z0-9_-]{43}$/.test(error.destination ?? ""));
      assert.deepEqual(state.lookupQueries[0].where, { id: { endsWith: "abc123xy", mode: "insensitive" }, guestPhone: "+265993661661", userId: null });
      assert.match(state.lookupUpdates[0].data.guestAccessTokenHash, /^[a-f0-9]{64}$/);
      assert.ok(state.lookupUpdates[0].data.guestAccessTokenExpiresAt > new Date());
    });
  }
  it("does not issue access tokens for an unmatched phone and reference", async () => {
    const state = globalThis.board95ActionTest;
    state.allowRequests = true; state.lookupQueries = [];
    const form = new FormData(); form.set("reference", "ABC123XY"); form.set("phone", "993661662");
    assert.match((await lookupGuestBookingAction({ error: null }, form)).error, /could not match/i);
    assert.equal(state.lookupUpdates, undefined);
    assert.equal(state.lookupQueries[0].where.userId, null);
  });
  it("validates phone and reference before database calls", async () => {
    const form = new FormData();
    assert.match((await lookupGuestBookingAction({ error: null }, form)).error, /8-character/);
    form.set("reference", "ABC123XY"); form.set("phone", "short");
    assert.match((await lookupGuestBookingAction({ error: null }, form)).error, /mobile number/);
    assert.equal(globalThis.board95ActionTest.sideEffects, 0);
  });
  it("keeps guest lookup rate limits in place for valid requests", async () => {
    const form = new FormData(); form.set("reference", "ABC123XY"); form.set("phone", "993661661");
    assert.match((await lookupGuestBookingAction({ error: null }, form)).error, /Too many lookup attempts/);
    assert.equal(globalThis.board95ActionTest.sideEffects, 0);
  });
});

describe("homepage departing soon", () => {
  it("keeps the taxis and lifts section separate from bus departures", async () => {
    globalThis.board95ActionTest.tripQueries = [];
    await getUpcomingTrips(6, new Date("2026-11-05T06:00:00Z"), "taxi");
    assert.equal(globalThis.board95ActionTest.tripQueries[0].where.type, "TAXI");
  });
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

describe("shared trip links", () => {
  it("requires a future, public departure and returns null for unavailable links", async () => {
    const now = new Date("2030-01-01T08:00:00Z");
    globalThis.board95ActionTest.sharedTripQueries = [];
    assert.equal(await getPublicTrip("shared-departure", now), null);
    const { where } = globalThis.board95ActionTest.sharedTripQueries[0];
    assert.equal(where.id, "shared-departure");
    assert.deepEqual(where.departureAt, { gt: now });
    assert.equal(where.cancelled, false);
    assert.deepEqual(where.vehicle, { active: true });
    assert.deepEqual(where.operator, { active: true, verified: true, OR: [{ ownerId: null }, { owner: { active: true } }] });
    assert.deepEqual(where.OR, [{ scheduleId: null }, { scheduleOverride: true }, { schedule: { active: true } }]);
  });

  it("opens the exact departure without exposing a taxi owner's phone", async () => {
    const state = globalThis.board95ActionTest;
    state.sharedTripQueries = [];
    state.sharedTripRow = {
      id: "taxi-departure", operatorId: "operator", vehicleId: "vehicle", type: "TAXI",
      origin: "Blantyre", destination: "Lilongwe", departureAt: new Date("2030-01-01T08:00:00Z"),
      createdAt: new Date("2029-12-31T08:00:00Z"), fareMWK: 25000, seatsTotal: 4, seatsAvailable: 0,
      pickupAvailable: false, pickupFeeMWK: null, schedule: null,
      vehicle: { model: "Saloon", plate: "TEST" }, departurePoint: { name: "Station" },
      operator: { name: "Operator", verified: true, active: true, owner: { active: true }, kind: "TAXI_OWNER", phone: "+265991000000" },
    };
    const trip = await getPublicTrip("taxi-departure", new Date("2029-12-31T10:00:00Z"));
    assert.equal(trip.id, "taxi-departure");
    assert.equal(trip.departureTime, "10:00");
    assert.equal(trip.seatsAvailable, 0); // The existing card displays fully booked.
    assert.equal(trip.operator.phone, undefined);
    assert.equal(trip.departurePoint, "Station");
    assert.equal(trip.shareable, true);
    state.sharedTripRow.operator.verified = false;
    assert.equal((await getPublicTrip("taxi-departure")).shareable, false);
    state.sharedTripRow.operator.verified = true;
    state.sharedTripRow.operator.owner.active = false;
    assert.equal((await getPublicTrip("taxi-departure")).shareable, false);
  });
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


describe("district transport routes", () => {
  it("accepts every district in searches and normalizes Nkhata Bay", async () => {
    const { CITIES } = await import("../src/lib/cities.ts");
    for (const location of CITIES) assert.equal(parseFilters({ origin: location }).origin, location);
    assert.equal(parseFilters({ origin: " nkhata bay ", destination: "DEDZA" }).origin, "NkhataBay");
    assert.equal(parseFilters({ origin: "unknown" }).origin, undefined);
  });
  function districtForm(origin = "Nkhata Bay", destination = "Dedza") {
    const form = new FormData();
    for (const [key, value] of Object.entries({ operatorId: "district-operator", vehicleModel: "Test vehicle", plate: "TEST 123", seats: "4", origin, destination, date: "2090-01-01", time: "08:00", departurePoint: "District stage", fareMWK: "5000", active: "on" })) form.set(key, value);
    form.append("weekdays", "1");
    return form;
  }
  it("publishes a taxi departure using new districts and a correctly located stage", async () => {
    const state = globalThis.board95ActionTest;
    state.session = { user: { id: "admin", role: "ADMIN" } }; state.publishQueries = [];
    await createOperatorTripAction(districtForm());
    assert.equal(state.publishQueries.find(q => q.kind === "point").data.city, "NkhataBay");
    const data = state.publishQueries.find(q => q.kind === "trip").data;
    assert.equal(data.origin, "NkhataBay"); assert.equal(data.destination, "Dedza"); assert.equal(data.type, "TAXI");
  });
  it("saves Daily Bus Schedules for new district routes", async () => {
    const { saveBusScheduleAction } = await import("../src/lib/bus-schedule-actions.ts");
    const state = globalThis.board95ActionTest;
    state.session = { user: { id: "admin", role: "ADMIN" } }; state.publishQueries = [];
    const form = districtForm("Karonga", "Nkhata Bay");
    form.set("vehicleId", "district-vehicle");
    const result = await saveBusScheduleAction({ status: "idle", message: "" }, form);
    assert.equal(result.status, "success");
    const data = state.publishQueries.find(q => q.kind === "schedule").data;
    assert.equal(data.origin, "Karonga"); assert.equal(data.destination, "NkhataBay");
  });
  it("rejects unknown or identical districts before database access", async () => {
    globalThis.board95ActionTest.session = { user: { id: "admin", role: "ADMIN" } };
    await assert.rejects(createOperatorTripAction(districtForm("Unknown", "Dedza")), /route/);
    await assert.rejects(createOperatorTripAction(districtForm("dedza", "Dedza")), /route/);
    assert.equal(globalThis.board95ActionTest.sideEffects, 0);
  });
});
