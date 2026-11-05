import { transportLocationName } from "@/lib/cities";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listingHistoryScope } from "@/lib/listing-history";
import { csvRow, historyDateRange } from "@/lib/listing-history-format";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Sign in required.", { status: 401 });
  const query = new URL(request.url).searchParams;
  const kind = query.get("kind");
  if (kind !== "trip" && kind !== "car-hire") return new Response("Invalid listing kind.", { status: 400 });
  const scope = await listingHistoryScope(session.user, kind);
  if (!scope) return new Response("Access denied.", { status: 403 });
  const from = query.get("from") ?? "", to = query.get("to") ?? "";
  let dates;
  try { dates = historyDateRange(from, to); } catch {
    return new Response("Invalid date range.", { status: 400 });
  }
  const encoder = new TextEncoder();
  let cursor: string | undefined;
  let header = false;
  // Fetch in bounded batches, without loading the full archive into server memory.
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const pagination = { take: 250, orderBy: { id: "asc" as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
      if (kind === "trip") {
        const rows = await prisma.tripHistory.findMany({ where: { ...scope.trips, departureAt: dates }, ...pagination });
        if (!header) controller.enqueue(encoder.encode("\uFEFF" + csvRow(["ID", "Operator", "Type", "Origin", "Destination", "Departure UTC", "Published UTC", "Archived UTC", "Vehicle", "Plate", "Departure point", "Fare MWK", "Seats total", "Seats available", "Pickup available", "Pickup fee MWK"])));
        for (const row of rows) controller.enqueue(encoder.encode(csvRow([row.id, row.operatorName, row.type, transportLocationName(row.origin), transportLocationName(row.destination), row.departureAt, row.createdAt, row.archivedAt, row.vehicleModel, row.vehiclePlate, row.departurePointName, row.fareMWK, row.seatsTotal, row.seatsAvailable, row.pickupAvailable, row.pickupFeeMWK])));
        cursor = rows.at(-1)?.id;
        if (rows.length < 250) controller.close();
      } else {
        const rows = await prisma.carHireListingHistory.findMany({ where: { ...scope.cars, expiresAt: dates }, ...pagination });
        if (!header) controller.enqueue(encoder.encode("\uFEFF" + csvRow(["ID", "Owner", "Name", "Model", "Vehicle type", "Capacity tons", "District", "Contact phone", "Daily rate MWK", "Description", "Photo URL", "Available", "Published UTC", "Renewed UTC", "Expired UTC", "Archived UTC"])));
        for (const row of rows) controller.enqueue(encoder.encode(csvRow([row.id, row.ownerName, row.name, row.model, row.vehicleType, row.lorryCapacityTons, row.district, row.contactPhone, row.dailyRateMWK, row.description, row.photoUrl, row.available, row.createdAt, row.renewedAt, row.expiresAt, row.archivedAt])));
        cursor = rows.at(-1)?.id;
        if (rows.length < 250) controller.close();
      }
      header = true;
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="old-${kind}-listings-${from || "all"}-to-${to || "latest"}.csv"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
