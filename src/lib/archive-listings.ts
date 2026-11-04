import { prisma } from "@/lib/prisma";
import { DAY_MS } from "@/lib/listing-lifecycle";

// Small, serializable transactions make snapshot + relink + deletion atomic and
// protect renewals, rescheduling and new requests from concurrent cleanup.
export async function archiveExpiredListings(now = new Date()) {
  const cutoff = new Date(now.getTime() - DAY_MS);
  const counts = { trips: 0, carHire: 0 };
  for (let batch = 0; batch < 20; batch++) {
    const runBatch = () => prisma.$transaction(async (tx) => {
      const trips = await tx.trip.findMany({ where: { departureAt: { lte: cutoff } }, orderBy: [{ departureAt: "asc" }, { id: "asc" }], take: 50, include: { operator: true, vehicle: true, departurePoint: true } });
      const cars = await tx.carHireListing.findMany({ where: { expiresAt: { lte: now } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 50, include: { owner: { select: { name: true } } } });
      for (const trip of trips) {
        const { operator, vehicle, departurePoint, ...data } = trip;
        await tx.tripHistory.create({ data: { ...data, archivedAt: now, operatorName: operator.name, vehicleModel: vehicle.model, vehiclePlate: vehicle.plate, departurePointName: departurePoint.name } });
        await tx.booking.updateMany({ where: { tripId: trip.id }, data: { tripId: null, tripHistoryId: trip.id } });
        await tx.trip.delete({ where: { id: trip.id } });
      }
      for (const car of cars) {
        const { owner, ...data } = car;
        // Keep descriptive details and the stored photo URL; never duplicate photo bytes.
        await tx.carHireListingHistory.create({ data: { ...data, ownerName: owner.name, archivedAt: now } });
        await tx.carHireRequest.updateMany({ where: { listingId: car.id }, data: { listingId: null, listingHistoryId: car.id } });
        await tx.carHireListing.delete({ where: { id: car.id } });
      }
      return { trips: trips.length, carHire: cars.length };
    }, { isolationLevel: "Serializable", timeout: 30_000 });
    let processed;
    for (let attempt = 0; ; attempt++) {
      try { processed = await runBatch(); break; } catch (error) {
        if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
      }
    }
    counts.trips += processed.trips;
    counts.carHire += processed.carHire;
    if (processed.trips < 50 && processed.carHire < 50) break;
  }
  return counts;
}
