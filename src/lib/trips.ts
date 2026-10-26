import { CITIES, type City, type TransportType } from "@/lib/cities";
import { dayRange, toMalawiDate, toMalawiTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// What the UI needs to draw a card. We deliberately do NOT hand raw database
// rows to components: if the table changes, only the mapper below changes.
export type TripListing = {
  id: string;
  type: TransportType;
  origin: City;
  destination: City;
  date: string; // "YYYY-MM-DD", Malawi time
  departureTime: string; // "HH:mm", Malawi time
  departurePoint: string;
  fareMWK: number;
  seatsTotal: number;
  seatsAvailable: number;
  vehicle: { model: string; plate: string };
  pickup: { available: boolean; extraFeeMWK?: number };
  operator: { name: string; verified: boolean; phone?: string };
};

const tripInclude = {
  operator: true,
  vehicle: true,
  departurePoint: true,
} satisfies Prisma.TripInclude;

type TripRow = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

function toListing(row: TripRow): TripListing {
  return {
    id: row.id,
    type: row.type === "BUS" ? "bus" : "taxi",
    origin: row.origin,
    destination: row.destination,
    date: toMalawiDate(row.departureAt),
    departureTime: toMalawiTime(row.departureAt),
    departurePoint: row.departurePoint.name,
    fareMWK: row.fareMWK,
    seatsTotal: row.seatsTotal,
    seatsAvailable: row.seatsAvailable,
    vehicle: { model: row.vehicle.model, plate: row.vehicle.plate },
    pickup: {
      available: row.pickupAvailable,
      extraFeeMWK: row.pickupFeeMWK ?? undefined,
    },
    operator: {
      name: row.operator.name,
      verified: row.operator.verified,
      // Only bus companies show a public phone. Taxi owners' contact details
      // are released after a booking is accepted.
      phone:
        row.operator.kind === "BUS_COMPANY"
          ? (row.operator.phone ?? undefined)
          : undefined,
    },
  };
}

export type Filters = {
  origin?: City;
  destination?: City;
  date?: string;
  type?: TransportType;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Query-string values are user input, so we validate every one.
// Anything unrecognised is ignored.
export function parseFilters(params: RawParams): Filters {
  const origin = first(params.origin);
  const destination = first(params.destination);
  const date = first(params.date);
  const type = first(params.type);

  return {
    origin: CITIES.find((c) => c === origin),
    destination: CITIES.find((c) => c === destination),
    date: date && dayRange(date) ? date : undefined,
    type: type === "bus" || type === "taxi" ? type : undefined,
  };
}

// The database does the filtering and sorting. Never load every trip and
// filter in JavaScript: that gets slow as the table grows.
export async function searchTrips(filters: Filters): Promise<TripListing[]> {
  const where: Prisma.TripWhereInput = {
    operator: { active: true },
  };
  if (filters.origin) where.origin = filters.origin;
  if (filters.destination) where.destination = filters.destination;
  if (filters.type) where.type = filters.type === "bus" ? "BUS" : "TAXI";

  const range = filters.date ? dayRange(filters.date) : null;
  if (range) {
    where.departureAt = { gte: range.start, lt: range.end };
  } else {
    where.departureAt = { gte: new Date() }; // no date picked: upcoming only
  }

  const rows = await prisma.trip.findMany({
    where,
    include: tripInclude,
    orderBy: { departureAt: "asc" },
  });
  return rows.map(toListing);
}

export async function getUpcomingTrips(limit: number): Promise<TripListing[]> {
  const rows = await prisma.trip.findMany({
    where: { operator: { active: true }, departureAt: { gte: new Date() } },
    include: tripInclude,
    orderBy: { departureAt: "asc" },
    take: limit,
  });
  return rows.map(toListing);
}
