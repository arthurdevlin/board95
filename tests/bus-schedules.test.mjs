import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { beforeEach, describe, it } from "node:test";

const mocks = {
  "@/lib/session": "export async function getSession() { return globalThis.busScheduleTest.session; }",
  "@/lib/prisma": "export const prisma = { async $transaction(callback) { const state = globalThis.busScheduleTest; state.transactions++; return callback(state.tx); } };",
  "next/cache": "export function cacheLife() {} export function cacheTag() {} export function updateTag() {} export function revalidatePath() {}",
};
registerHooks({ resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(mocks, specifier)) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { ensureBusDepartures } = await import("../src/lib/bus-schedules.ts");
const { saveBusScheduleAction } = await import("../src/lib/bus-schedule-actions.ts");
const initial = { status: "idle", message: "" };
beforeEach(() => { globalThis.busScheduleTest = { session: null, transactions: 0, tx: {} }; });

function validForm() {
  const form = new FormData();
  for (const [name, value] of Object.entries({ operatorId: "company", vehicleId: "bus", origin: "Blantyre", destination: "Lilongwe", time: "06:30", departurePoint: "Company stage", fareMWK: "18000", seats: "52", active: "on" })) form.set(name, value);
  for (let day = 0; day < 7; day++) form.append("weekdays", String(day));
  return form;
}

describe("persistent bus departures", () => {
  it("repeated reads keep the same dated trips and do not reset remaining seats", async () => {
    const state = globalThis.busScheduleTest;
    const rows = [];
    const schedule = { id: "service", operatorId: "company", vehicleId: "bus", departurePointId: "stage", origin: "Blantyre", destination: "Lilongwe", departureTime: "06:30", weekdays: [0, 1, 2, 3, 4, 5, 6], fareMWK: 18000, seatsTotal: 52, pickupAvailable: false, pickupFeeMWK: null };
    state.tx = {
      busSchedule: { async findMany(query) { assert.equal(query.where.active, true); assert.equal(query.where.operator.verified, true); return [schedule]; } },
      trip: {
        async findMany() { return rows; },
        async createMany(query) { assert.equal(query.skipDuplicates, true); rows.push(...query.data); },
      },
    };
    await ensureBusDepartures("2090-01-01");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].serviceDate, "2090-01-01");
    rows[0].seatsAvailable = 3;
    await ensureBusDepartures("2090-01-01");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].seatsAvailable, 3);
    // Querying the next day starts with that day's own full seat inventory.
    state.tx.trip.findMany = async (query) => rows.filter((row) => row.serviceDate >= query.where.serviceDate.gte && row.serviceDate < query.where.serviceDate.lt);
    await ensureBusDepartures("2090-01-02");
    assert.equal(rows.length, 2);
    assert.equal(rows[1].seatsAvailable, 52);
  });

  it("does not add another trip on a booked service date after its timetable time changes", async () => {
    const state = globalThis.busScheduleTest;
    state.tx = {
      busSchedule: { async findMany() { return [{ id: "service", departureTime: "08:00", weekdays: [0, 1, 2, 3, 4, 5, 6] }]; } },
      trip: { async findMany() { return [{ scheduleId: "service", serviceDate: "2090-01-01" }]; }, async createMany() { assert.fail("A booked day must not be duplicated"); } },
    };
    await ensureBusDepartures("2090-01-01");
  });

  it("does not populate historical searches", async () => {
    await ensureBusDepartures("2020-01-01");
    assert.equal(globalThis.busScheduleTest.transactions, 0);
  });
});

describe("bus company schedule management", () => {
  it("rejects guests and car-hire providers before reading the database", async () => {
    for (const session of [null, { user: { id: "car-owner", role: "CAR_HIRER" } }]) {
      globalThis.busScheduleTest.session = session;
      assert.equal((await saveBusScheduleAction(initial, validForm())).status, "error");
    }
    assert.equal(globalThis.busScheduleTest.transactions, 0);
  });

  it("requires company administrator membership and rejects local staff", async () => {
    const state = globalThis.busScheduleTest;
    state.session = { user: { id: "staff", role: "CUSTOMER" } };
    state.tx = { operator: { async findFirst(query) {
      assert.deepEqual(query.where.members, { some: { userId: "staff", role: "ADMIN" } });
      assert.equal(query.where.kind, "BUS_COMPANY");
      return null;
    } } };
    const result = await saveBusScheduleAction(initial, validForm());
    assert.equal(result.status, "error");
    assert.match(result.message, /administrator/);
  });

  it("edits fares while leaving all booked departure records intact", async () => {
    const state = globalThis.busScheduleTest;
    state.session = { user: { id: "company-admin", role: "CUSTOMER" } };
    const queries = [];
    state.tx = {
      operator: { async findFirst() { return { id: "company" }; } },
      vehicle: { async findFirst() { return { id: "bus", operatorId: "company", seats: 52, active: true }; } },
      busSchedule: {
        async findFirst(query) { return query.where.operatorId ? { id: "service", vehicle: { id: "bus", operatorId: "company", seats: 52 } } : null; },
        async update(query) { queries.push(query); },
      },
      departurePoint: { async findFirst() { return { id: "stage" }; } },
      trip: { async deleteMany(query) { queries.push(query); } },
    };
    const form = validForm();
    form.set("scheduleId", "service");
    form.set("fareMWK", "20000");
    assert.equal((await saveBusScheduleAction(initial, form)).status, "success");
    assert.equal(queries[0].data.fareMWK, 20000);
    assert.deepEqual(queries[1].where.bookings, { none: {} });
    assert.equal(queries[1].where.scheduleOverride, false);
    assert.equal(queries[1].where.scheduleId, "service");
    assert.ok(queries[1].where.departureAt.gt instanceof Date);
  });

  it("creates a schedule using a saved company bus without creating or editing a vehicle", async () => {
    const state = globalThis.busScheduleTest;
    state.session = { user: { id: "company-admin", role: "CUSTOMER" } };
    let saved;
    state.tx = {
      operator: { async findFirst() { return { id: "company" }; } },
      vehicle: { async findFirst(query) { assert.deepEqual(query.where, { id: "bus", operatorId: "company" }); return { id: "bus", seats: 52, active: true }; } },
      busSchedule: { async findFirst() { return null; }, async create(query) { saved = query.data; } },
      departurePoint: { async findFirst() { return { id: "stage" }; } },
    };
    const form = validForm();
    // Old clients cannot overwrite fleet details through schedule creation.
    form.set("vehicleModel", "Changed model");
    form.set("plate", "ANOTHER-PLATE");
    assert.equal((await saveBusScheduleAction(initial, form)).status, "success");
    assert.equal(saved.vehicleId, "bus");
    assert.equal(saved.seatsTotal, 52);
  });

  it("reassigns a timetable to a saved replacement bus while protecting booked departures", async () => {
    const state = globalThis.busScheduleTest;
    state.session = { user: { id: "company-admin", role: "CUSTOMER" } };
    const changes = [];
    state.tx = {
      operator: { async findFirst() { return { id: "company" }; } },
      vehicle: { async findFirst() { return { id: "replacement", seats: 40, active: true }; } },
      busSchedule: {
        async findFirst(query) { return query.where.operatorId ? { id: "service", vehicleId: "bus" } : null; },
        async update(query) { changes.push(query); },
      },
      departurePoint: { async findFirst() { return { id: "stage" }; } },
      trip: { async deleteMany(query) { changes.push(query); } },
    };
    const form = validForm();
    form.set("scheduleId", "service"); form.set("vehicleId", "replacement"); form.set("seats", "40");
    assert.equal((await saveBusScheduleAction(initial, form)).status, "success");
    assert.equal(changes[0].data.vehicleId, "replacement");
    assert.equal(changes[0].data.seatsTotal, 40);
    assert.deepEqual(changes[1].where.bookings, { none: {} });
    assert.equal(changes[1].where.scheduleOverride, false);
  });

  it("rejects missing buses, other-company buses, removed buses and excessive capacity", async () => {
    const state = globalThis.busScheduleTest;
    state.session = { user: { id: "company-admin", role: "CUSTOMER" } };
    const missing = validForm(); missing.delete("vehicleId");
    assert.equal((await saveBusScheduleAction(initial, missing)).status, "error");
    assert.equal(state.transactions, 0);
    for (const vehicle of [null, { id: "bus", seats: 52, active: false }, { id: "bus", seats: 40, active: true }]) {
      state.tx = {
        operator: { async findFirst() { return { id: "company" }; } },
        vehicle: { async findFirst(query) { assert.equal(query.where.operatorId, "company"); return vehicle; } },
      };
      assert.equal((await saveBusScheduleAction(initial, validForm())).status, "error");
    }
  });

  it("rejects conflicting assignments on overlapping operating days", async () => {
    const state = globalThis.busScheduleTest;
    state.session = { user: { id: "company-admin", role: "CUSTOMER" } };
    state.tx = {
      operator: { async findFirst() { return { id: "company" }; } },
      vehicle: { async findFirst() { return { id: "bus", seats: 52, active: true }; } },
      busSchedule: { async findFirst(query) {
        assert.equal(query.where.vehicleId, "bus");
        assert.equal(query.where.departureTime, "06:30");
        assert.deepEqual(query.where.weekdays.hasSome, [0, 1, 2, 3, 4, 5, 6]);
        return { id: "conflicting-service" };
      } },
    };
    const result = await saveBusScheduleAction(initial, validForm());
    assert.equal(result.status, "error");
    assert.match(result.message, /already has a service/);
  });

  it("rejects operating days, times and fare overflow submitted outside the form", async () => {
    globalThis.busScheduleTest.session = { user: { id: "admin", role: "ADMIN" } };
    for (const [name, value] of [["weekdays", "7"], ["time", "25:00"], ["fareMWK", "2147483648"]]) {
      const form = validForm();
      form.set(name, value);
      assert.equal((await saveBusScheduleAction(initial, form)).status, "error");
    }
    assert.equal(globalThis.busScheduleTest.transactions, 0);
  });
});
