import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { beforeEach, describe, it } from "node:test";
import { busManagementScope, resizeDepartureSeats } from "../src/lib/operator-management.ts";

const mocks = {
  "@/lib/session": "export async function getSession() { return globalThis.busManagementTest.session; }",
  "@/lib/prisma": "export const prisma = { async $transaction(callback) { globalThis.busManagementTest.transactions++; return callback(globalThis.busManagementTest.tx); } };",
  "next/cache": "export function updateTag() {} export function revalidatePath() {}",
};
registerHooks({ resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(mocks, specifier)) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { saveBusDepartureAction, saveBusVehicleAction, setBusVehicleActiveAction } = await import("../src/lib/bus-management-actions.ts");
const initial = { status: "idle", message: "" };
beforeEach(() => { globalThis.busManagementTest = { session: { user: { id: "company-admin", role: "CUSTOMER" } }, transactions: 0, tx: {} }; });
function departureForm() {
  const form = new FormData();
  for (const [name, value] of Object.entries({ tripId: "day-one", vehicleId: "replacement", time: "08:00", departurePoint: "New stage", fareMWK: "20000", seats: "40" })) form.set(name, value);
  return form;
}
function departureTx({ reserved = 5, openBookings = 0 } = {}) {
  const changes = [];
  const tx = {
    trip: {
      async findFirst(query) {
        if (query.select) return null;
        assert.deepEqual(query.where.operator.members, { some: { userId: "company-admin", role: "ADMIN" } });
        return { id: "day-one", operatorId: "company", origin: "Blantyre", serviceDate: "2090-01-01", departureAt: new Date("2090-01-01T04:30:00Z"), seatsTotal: 52, seatsAvailable: 52 - reserved, operator: { active: true, verified: true } };
      },
      async update(query) { changes.push(query); },
    },
    vehicle: { async findFirst(query) { assert.equal(query.where.operatorId, "company"); return { id: "replacement", seats: 40 }; } },
    departurePoint: { async findFirst() { return { id: "new-stage" }; } },
    booking: { async count() { return openBookings; }, async updateMany(query) { changes.push(query); } },
  };
  return { tx, changes };
}

describe("bus day changes", () => {
  it("changes only the selected service date and preserves reserved seats", async () => {
    const { tx, changes } = departureTx();
    globalThis.busManagementTest.tx = tx;
    const result = await saveBusDepartureAction(initial, departureForm());
    assert.equal(result.status, "success");
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].where, { id: "day-one" });
    assert.equal(changes[0].data.departureAt.toISOString(), "2090-01-01T06:00:00.000Z");
    assert.equal(changes[0].data.vehicleId, "replacement");
    assert.equal(changes[0].data.departurePointId, "new-stage");
    assert.equal(changes[0].data.fareMWK, 20000);
    assert.equal(changes[0].data.seatsAvailable, 35);
    assert.equal(changes[0].data.scheduleOverride, true);
  });
  it("rejects a bus with fewer seats than existing reservations", async () => {
    const { tx, changes } = departureTx({ reserved: 45 });
    globalThis.busManagementTest.tx = tx;
    assert.equal((await saveBusDepartureAction(initial, departureForm())).status, "error");
    assert.equal(changes.length, 0);
  });
  it("requires explicit confirmation to cancel passenger bookings", async () => {
    const { tx, changes } = departureTx({ openBookings: 2 });
    globalThis.busManagementTest.tx = tx;
    const form = departureForm();
    form.set("cancelled", "on");
    assert.equal((await saveBusDepartureAction(initial, form)).status, "error");
    assert.equal(changes.length, 0);
    form.set("confirmCancellation", "on");
    assert.equal((await saveBusDepartureAction(initial, form)).status, "success");
    assert.equal(changes[0].data.status, "CANCELLED");
    assert.equal(changes[1].data.cancelled, true);
    assert.equal(changes[1].data.scheduleOverride, true);
  });
  it("rejects staff and other-company access through the server action", async () => {
    globalThis.busManagementTest.tx = { trip: { async findFirst(query) { assert.equal(query.where.operator.members.some.role, "ADMIN"); return null; } } };
    assert.equal((await saveBusDepartureAction(initial, departureForm())).status, "error");
  });
});

describe("bus fleet management", () => {
  it("adds a bus within the company administrator's scope", async () => {
    const changes = [];
    globalThis.busManagementTest.tx = {
      operator: { async findFirst(query) { assert.equal(query.where.members.some.role, "ADMIN"); return { id: "company" }; } },
      vehicle: { async create(query) { changes.push(query); return { id: "new-bus" }; } },
    };
    const form = new FormData();
    for (const [key, value] of Object.entries({ operatorId: "company", model: "Coach", plate: "bt 1234", seats: "52" })) form.set(key, value);
    const result = await saveBusVehicleAction(initial, form);
    assert.equal(result.status, "success");
    assert.equal(result.vehicleId, "new-bus");
    assert.equal(changes[0].data.plate, "BT 1234");
  });
  it("blocks removing a bus while it has upcoming bookings", async () => {
    globalThis.busManagementTest.tx = {
      vehicle: { async findFirst() { return { id: "bus" }; }, async update() { assert.fail("Bus with bookings must remain active"); } },
      booking: { async count() { return 1; } },
    };
    const form = new FormData(); form.set("vehicleId", "bus"); form.set("active", "false");
    assert.equal((await setBusVehicleActiveAction(initial, form)).status, "error");
  });
  it("removes an unbooked bus, pauses its timetables and preserves day exceptions", async () => {
    const changes = [];
    globalThis.busManagementTest.tx = {
      vehicle: { async findFirst() { return { id: "bus" }; }, async update(query) { changes.push(query); } },
      booking: { async count(query) { assert.equal(query.where.trip.vehicleId, "bus"); assert.equal(query.where.trip.OR, undefined); return 0; } },
      busSchedule: { async updateMany(query) { changes.push(query); } },
      trip: { async deleteMany(query) { changes.push(query); } },
    };
    const form = new FormData(); form.set("vehicleId", "bus"); form.set("active", "false");
    assert.equal((await setBusVehicleActiveAction(initial, form)).status, "success");
    assert.equal(changes[0].data.active, false);
    assert.equal(changes[1].where.scheduleOverride, false);
    assert.deepEqual(changes[1].where.bookings, { none: {} });
    assert.equal(changes[2].data.active, false);
  });
  it("rejects guests and car-hire providers before any database operation", async () => {
    for (const session of [null, { user: { id: "car-provider", role: "CAR_HIRER" } }]) {
      globalThis.busManagementTest.session = session;
      for (const action of [saveBusVehicleAction, setBusVehicleActiveAction, saveBusDepartureAction]) assert.equal((await action(initial, new FormData())).status, "error");
    }
    assert.equal(globalThis.busManagementTest.transactions, 0);
  });
});

describe("fleet and inventory permissions", () => {
  it("preserves reserved seats and rejects capacity underflow or corrupt inventory", () => {
    assert.deepEqual(resizeDepartureSeats(52, 42, 40), { seatsTotal: 40, seatsAvailable: 30 });
    assert.deepEqual(resizeDepartureSeats(40, 30, 52), { seatsTotal: 40, seatsAvailable: 30 });
    for (const args of [[52, 10, 40], [52, -1, 60], [52, 53, 60], [52, 42, 1.5]]) assert.equal(resizeDepartureSeats(...args), null);
  });
  it("uses administrator membership for local company accounts", () => {
    assert.deepEqual(busManagementScope({ id: "local", role: "CUSTOMER" }), { kind: "BUS_COMPANY", members: { some: { userId: "local", role: "ADMIN" } } });
    assert.equal(busManagementScope({ id: "hirer", role: "CAR_HIRER" }), null);
  });
});
