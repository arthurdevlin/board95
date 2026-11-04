import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dayRange, toMalawiDate } from "@/lib/dates";
import { timetableDepartures } from "@/lib/bus-timetable";

// A rolling fortnight keeps services bookable without a daily posting task.
// Date-specific searches also materialize that date. The unique service-date
// key and serializable retry protect concurrent readers and timetable edits.
export async function ensureBusDepartures(date?: string) {
  "use cache";
  cacheLife({ stale: 15, revalidate: 15, expire: 30 });
  cacheTag("bus-schedules");
  const now = new Date();
  const firstDate = date ?? toMalawiDate(now);
  const range = dayRange(firstDate);
  if (!range || range.end <= now) return;
  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const schedules = await tx.busSchedule.findMany({
          where: { active: true, vehicle: { active: true }, operator: { kind: "BUS_COMPANY", active: true, verified: true, OR: [{ ownerId: null }, { owner: { active: true } }] } },
        });
        if (!schedules.length) return;
        const days = date ? 1 : 14;
        const endDate = new Date(range.start.getTime() + days * 86_400_000);
        const existing = await tx.trip.findMany({ where: { scheduleId: { in: schedules.map((schedule) => schedule.id) }, serviceDate: { gte: firstDate, lt: toMalawiDate(endDate) } }, select: { scheduleId: true, serviceDate: true } });
        const keys = new Set(existing.map((trip) => `${trip.scheduleId}:${trip.serviceDate}`));
        const rows = schedules.flatMap((schedule) => timetableDepartures(schedule.departureTime, schedule.weekdays, firstDate, days, now)
          .filter((departure) => !keys.has(`${schedule.id}:${departure.serviceDate}`))
          .map((departure) => ({
            ...departure, scheduleId: schedule.id, operatorId: schedule.operatorId,
            vehicleId: schedule.vehicleId, departurePointId: schedule.departurePointId,
            type: "BUS" as const, origin: schedule.origin, destination: schedule.destination,
            fareMWK: schedule.fareMWK, seatsTotal: schedule.seatsTotal, seatsAvailable: schedule.seatsTotal,
            pickupAvailable: schedule.pickupAvailable, pickupFeeMWK: schedule.pickupFeeMWK,
          })));
        if (rows.length) await tx.trip.createMany({ data: rows, skipDuplicates: true });
      }, { isolationLevel: "Serializable", timeout: 30_000 });
      return;
    } catch (error) {
      if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
    }
  }
}
