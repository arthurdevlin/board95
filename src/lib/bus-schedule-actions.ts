"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isDatabaseAmount } from "@/lib/validation";
import { parseTransportLocation } from "@/lib/cities";

export type BusScheduleState = { status: "idle" | "success" | "error"; message: string };
class ScheduleInputError extends Error {}

export async function saveBusScheduleAction(_previous: BusScheduleState, formData: FormData): Promise<BusScheduleState> {
  const session = await getSession();
  if (!session?.user.id || !["ADMIN", "OWNER", "CUSTOMER"].includes(session.user.role)) return { status: "error", message: "Bus company administrator access required." };
  const operatorId = String(formData.get("operatorId") ?? "");
  const scheduleId = String(formData.get("scheduleId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const origin = parseTransportLocation(String(formData.get("origin") ?? ""));
  const destination = parseTransportLocation(String(formData.get("destination") ?? ""));
  const departureTime = String(formData.get("time") ?? "");
  const weekdays = [...new Set(formData.getAll("weekdays").map(Number))].sort();
  const departureName = String(formData.get("departurePoint") ?? "").trim();
  const fareMWK = Number(formData.get("fareMWK"));
  const seatsTotal = Number(formData.get("seats"));
  const pickupAvailable = formData.get("pickupAvailable") === "on";
  const pickupFeeMWK = pickupAvailable ? Number(formData.get("pickupFeeMWK") ?? 0) : null;
  const active = formData.get("active") === "on";
  if (!operatorId || operatorId.length > 64 || scheduleId.length > 64) return { status: "error", message: "Choose a valid bus company and schedule." };
  if (!vehicleId || vehicleId.length > 64) return { status: "error", message: "Choose a saved bus from this company's fleet. Add a bus in Fleet management first if needed." };
  if (!origin || !destination || origin === destination) return { status: "error", message: "Choose two different Malawi districts." };
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(departureTime) || !weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return { status: "error", message: "Choose a departure time and at least one operating day." };
  if (departureName.length < 2 || departureName.length > 100 || !Number.isInteger(seatsTotal) || seatsTotal < 1 || seatsTotal > 100 || !isDatabaseAmount(fareMWK) || (pickupFeeMWK !== null && !isDatabaseAmount(pickupFeeMWK, 0)) || !isDatabaseAmount(fareMWK + (pickupFeeMWK ?? 0))) return { status: "error", message: "Check the stage, seat count, fare and pickup fee." };

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          const operator = await tx.operator.findFirst({ where: {
            id: operatorId, kind: "BUS_COMPANY", active: true, verified: true,
            ...(session.user.role === "ADMIN" ? {} : session.user.role === "OWNER" ? { ownerId: session.user.id } : { members: { some: { userId: session.user.id, role: "ADMIN" } } }),
          } });
          if (!operator) throw new ScheduleInputError("Only an administrator of this approved bus company can manage its schedules.");
          const existing = scheduleId ? await tx.busSchedule.findFirst({ where: { id: scheduleId, operatorId }, include: { vehicle: true } }) : null;
          if (scheduleId && !existing) throw new ScheduleInputError("Bus schedule not found.");
          const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, operatorId } });
          if (!vehicle) throw new ScheduleInputError("Choose a saved bus belonging to this company.");
          if (!vehicle.active && (active || existing?.vehicleId !== vehicle.id)) throw new ScheduleInputError("Restore this bus to the fleet before assigning it to a running timetable.");
          if (seatsTotal > vehicle.seats) throw new ScheduleInputError(`This bus has ${vehicle.seats} seats. The schedule cannot offer more seats than the bus holds.`);
          const conflict = await tx.busSchedule.findFirst({ where: { id: { not: scheduleId || undefined }, vehicleId: vehicle.id, departureTime, active: true, weekdays: { hasSome: weekdays } } });
          if (active && conflict) throw new ScheduleInputError("This bus already has a service at that time on one of the selected days.");
          let point = await tx.departurePoint.findFirst({ where: { operatorId, city: origin, name: departureName, kind: "STATION" } });
          if (!point) point = await tx.departurePoint.create({ data: { operatorId, city: origin, name: departureName, kind: "STATION" } });
          const data = { operatorId, vehicleId: vehicle.id, departurePointId: point.id, origin, destination, departureTime, weekdays, fareMWK, seatsTotal, pickupAvailable, pickupFeeMWK, active };
          if (existing) {
            await tx.busSchedule.update({ where: { id: existing.id }, data });
            // Booked departures retain their date, stage, fare and inventory.
            // Their service-date key prevents a second departure on that day.
            await tx.trip.deleteMany({ where: { scheduleId: existing.id, scheduleOverride: false, departureAt: { gt: new Date() }, bookings: { none: {} } } });
          } else {
            await tx.busSchedule.create({ data });
          }
        }, { isolationLevel: "Serializable" });
        break;
      } catch (error) {
        if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
      }
    }
  } catch (error) {
    return { status: "error", message: error instanceof ScheduleInputError ? error.message : "We could not save this bus schedule. Refresh and try again." };
  }
  updateTag("bus-schedules");
  updateTag("public-trips");
  for (const path of ["/", "/operator", "/transport", "/account", "/admin"]) revalidatePath(path);
  if (scheduleId) revalidatePath(`/operator/schedules/${scheduleId}`);
  revalidatePath("/operator/vehicles/[vehicleId]", "page");
  return { status: "success", message: scheduleId ? "Timetable saved. Booked departures keep their agreed details; changes apply to unbooked future departures." : "Bus timetable saved. Departures will appear automatically on its operating days." };
}
