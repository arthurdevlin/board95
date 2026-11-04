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
  for (const [name, value] of Object.entries({ operatorId: "company", origin: "Blantyre", destination: "Lilongwe", time: "06:30", departurePoint: "Company stage", fareMWK: "18000", seats: "52", vehicleModel: "Coach", plate: "BT 1234", active: "on" })) form.set(name, value);
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
