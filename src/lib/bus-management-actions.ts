"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { busManagementScope, resizeDepartureSeats } from "@/lib/operator-management";
import { toMalawiDate } from "@/lib/dates";
import { isDatabaseAmount } from "@/lib/validation";

export type BusManagementState = { status: "idle" | "success" | "error"; message: string; vehicleId?: string };
type Manager = { id: string; role: string };
class BusInputError extends Error {}
type ChangeResult = { message: string; vehicleId?: string; tripId?: string };

async function runBusChange(change: (tx: Prisma.TransactionClient, user: Manager, scope: Prisma.OperatorWhereInput) => Promise<ChangeResult>): Promise<BusManagementState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Bus company administrator access required." };
  const scope = busManagementScope(session.user);
  if (!scope) return { status: "error", message: "Bus company administrator access required." };
  let result: ChangeResult;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        result = await prisma.$transaction((tx) => change(tx, session.user, scope), { isolationLevel: "Serializable", timeout: 30_000 });
        break;
      } catch (error) {
        if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
      }
    }
  } catch (error) {
    return { status: "error", message: error instanceof BusInputError ? error.message : error && typeof error === "object" && "code" in error && error.code === "P2002" ? "That number plate or departure is already registered." : "Could not apply your changes. Refresh and try again." };
  }
  updateTag("bus-schedules");
  updateTag("public-trips");
  for (const path of ["/", "/operator", "/transport", "/account", "/admin"]) revalidatePath(path);
  revalidatePath("/operator/schedules/[scheduleId]", "page");
  if (result.tripId) { revalidatePath(`/operator/trips/${result.tripId}`); revalidatePath(`/bookings/[bookingId]/chat`, "page"); }
  if (result.vehicleId) revalidatePath(`/operator/vehicles/${result.vehicleId}`);
  return { status: "success", message: result.message, vehicleId: result.vehicleId };
}

export async function saveBusDepartureAction(_previous: BusManagementState, form: FormData): Promise<BusManagementState> {
  return runBusChange(async (tx, user, scope) => {
    const tripId = String(form.get("tripId") ?? "");
    const trip = await tx.trip.findFirst({ where: { id: tripId, type: "BUS", operator: scope }, include: { operator: true } });
    if (!trip) throw new BusInputError("Departure not found or company administrator access is missing.");
    if (trip.departureAt <= new Date()) throw new BusInputError("This departure has already left and cannot be changed.");
    if (!trip.operator.active || !trip.operator.verified) throw new BusInputError("The bus company must be active and approved.");
    const cancelled = form.get("cancelled") === "on";
    const vehicleId = String(form.get("vehicleId") ?? "");
    const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, operatorId: trip.operatorId, active: true } });
    if (!vehicle) throw new BusInputError("Choose an active bus from this company.");
    const time = String(form.get("time") ?? "");
    const serviceDate = trip.serviceDate ?? toMalawiDate(trip.departureAt);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new BusInputError("Choose a valid departure time.");
    const departureAt = new Date(`${serviceDate}T${time}:00+02:00`);
    if (departureAt <= new Date()) throw new BusInputError("Choose a future time on this service day.");
    const departureName = String(form.get("departurePoint") ?? "").trim();
    const fareMWK = Number(form.get("fareMWK"));
    const seatsTotal = Number(form.get("seats"));
    const pickupAvailable = form.get("pickupAvailable") === "on";
    const pickupFeeMWK = pickupAvailable ? Number(form.get("pickupFeeMWK") ?? 0) : null;
    if (departureName.length < 2 || departureName.length > 100 || !Number.isInteger(seatsTotal) || seatsTotal < 1 || seatsTotal > vehicle.seats || !isDatabaseAmount(fareMWK) || (pickupFeeMWK !== null && !isDatabaseAmount(pickupFeeMWK, 0)) || !isDatabaseAmount(fareMWK + (pickupFeeMWK ?? 0))) throw new BusInputError("Check the stage, fare and seats. Seats cannot exceed the selected bus capacity.");
    const reserved = trip.seatsTotal - trip.seatsAvailable;
    if (!cancelled && seatsTotal < reserved) throw new BusInputError(`This departure already has ${reserved} reserved seats. Choose a bus and seat count that can hold them.`);
    if (!cancelled && await tx.trip.findFirst({ where: { id: { not: trip.id }, vehicleId, departureAt, cancelled: false }, select: { id: true } })) throw new BusInputError("This bus already has another departure at that time.");
    const openBookings = cancelled ? await tx.booking.count({ where: { tripId, status: { in: ["PENDING", "ACCEPTED"] } } }) : 0;
    if (openBookings && form.get("confirmCancellation") !== "on") throw new BusInputError(`Confirm cancellation of this departure and its ${openBookings} pending or accepted bookings.`);
    if (cancelled) await tx.booking.updateMany({ where: { tripId, status: { in: ["PENDING", "ACCEPTED"] } }, data: { status: "CANCELLED", ...(user.role === "ADMIN" ? { reviewedByAdmin: true } : {}) } });
    let point = await tx.departurePoint.findFirst({ where: { operatorId: trip.operatorId, city: trip.origin, name: departureName, kind: "STATION" } });
    if (!point) point = await tx.departurePoint.create({ data: { operatorId: trip.operatorId, city: trip.origin, name: departureName, kind: "STATION" } });
    await tx.trip.update({ where: { id: trip.id }, data: { vehicleId, departureAt, departurePointId: point.id, fareMWK, seatsTotal, seatsAvailable: cancelled ? seatsTotal : seatsTotal - reserved, pickupAvailable, pickupFeeMWK, cancelled, scheduleOverride: true } });
    return { tripId, message: cancelled ? `This day's departure is cancelled.${openBookings ? ` ${openBookings} booking(s) were cancelled; their history is retained.` : ""}` : "Changes applied to this departure only. Other days and the Daily Bus Schedule are unchanged." };
  });
}

export async function saveBusVehicleAction(_previous: BusManagementState, form: FormData): Promise<BusManagementState> {
  return runBusChange(async (tx, _user, scope) => {
    const operatorId = String(form.get("operatorId") ?? "");
    const vehicleId = String(form.get("vehicleId") ?? "");
    const operator = await tx.operator.findFirst({ where: { ...scope, id: operatorId } });
    if (!operator) throw new BusInputError("Bus company not found or administrator access is missing.");
    const model = String(form.get("model") ?? "").trim();
    const plate = String(form.get("plate") ?? "").trim().toUpperCase();
    const seats = Number(form.get("seats"));
    if (model.length < 2 || model.length > 80 || !/^[A-Z0-9 -]{3,20}$/.test(plate) || !Number.isInteger(seats) || seats < 1 || seats > 100) throw new BusInputError("Enter a bus model, valid plate and capacity between 1 and 100 seats.");
    if (!vehicleId) {
      const bus = await tx.vehicle.create({ data: { operatorId, model, plate, seats } });
      return { vehicleId: bus.id, message: "Bus added. Open Manage bus to add its Daily Bus Schedules." };
    }
    const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, operatorId } });
    if (!vehicle) throw new BusInputError("Bus not found in this company.");
    const trips = await tx.trip.findMany({ where: { vehicleId, departureAt: { gt: new Date() } }, select: { id: true, seatsTotal: true, seatsAvailable: true } });
    for (const trip of trips) {
      const inventory = resizeDepartureSeats(trip.seatsTotal, trip.seatsAvailable, seats);
      if (!inventory) throw new BusInputError("This capacity is smaller than the seats already reserved on an upcoming departure.");
      if (inventory.seatsTotal !== trip.seatsTotal) await tx.trip.update({ where: { id: trip.id }, data: inventory });
    }
    await tx.busSchedule.updateMany({ where: { vehicleId, seatsTotal: { gt: seats } }, data: { seatsTotal: seats } });
    await tx.vehicle.update({ where: { id: vehicleId }, data: { model, plate, seats } });
    return { vehicleId, message: "Bus details saved. Reservations and booking history have been preserved." };
  });
}

export async function setBusVehicleActiveAction(_previous: BusManagementState, form: FormData): Promise<BusManagementState> {
  return runBusChange(async (tx, _user, scope) => {
    const vehicleId = String(form.get("vehicleId") ?? "");
    const active = form.get("active") === "true";
    const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, operator: scope } });
    if (!vehicle) throw new BusInputError("Bus not found or company administrator access is missing.");
    if (!active) {
      const hasBookings = await tx.booking.count({ where: { status: { in: ["PENDING", "ACCEPTED"] }, trip: { vehicleId, departureAt: { gt: new Date() } } } });
      if (hasBookings) throw new BusInputError("This bus has upcoming passenger bookings. Reassign or cancel those day departures before removing the bus.");
      await tx.busSchedule.updateMany({ where: { vehicleId }, data: { active: false } });
      await tx.trip.deleteMany({ where: { vehicleId, scheduleId: { not: null }, scheduleOverride: false, departureAt: { gt: new Date() }, bookings: { none: {} } } });
    }
    await tx.vehicle.update({ where: { id: vehicleId }, data: { active } });
    return { vehicleId, message: active ? "Bus restored to the fleet. Enable its Daily Bus Schedules when ready." : "Bus removed from service and its timetables paused. History is retained." };
  });
}
