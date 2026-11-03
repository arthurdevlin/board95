import { CITIES, type City, type TransportType } from "@/lib/cities";
import { dayRange, toMalawiDate, toMalawiTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { parsePageParam, readPage } from "@/lib/pagination";
import { cacheLife, cacheTag } from "next/cache";

// What the UI needs to draw a card. We deliberately do NOT hand raw database
// rows to components: if the table changes, only the mapper below changes.
export type TripListing = {
  id: string;
  type: TransportType;
  origin: City;
  destination: City;
  date: string; // "YYYY-MM-DD", Malawi time
  departureTime: string; // "HH:mm", Malawi time
  createdAt: Date;
  departurePoint: string;
  fareMWK: number;
  seatsTotal: number;
  seatsAvailable: number;
  vehicle: { model: string; plate: string };
  pickup: { available: boolean; extraFeeMWK?: number };
  operator: { name: string; verified: boolean; phone?: string };
};

const tripSelect = {
  id: true,
  type: true,
  origin: true,
  destination: true,
  departureAt: true,
  createdAt: true,
  fareMWK: true,
  seatsTotal: true,
  seatsAvailable: true,
  pickupAvailable: true,
  pickupFeeMWK: true,
  operator: { select: { name: true, verified: true, kind: true, phone: true } },
  vehicle: { select: { model: true, plate: true } },
  departurePoint: { select: { name: true } },
} satisfies Prisma.TripSelect;

type TripRow = Prisma.TripGetPayload<{ select: typeof tripSelect }>;

function toListing(row: TripRow): TripListing {
  return {
    id: row.id,
    type: row.type === "BUS" ? "bus" : "taxi",
    origin: row.origin,
    destination: row.destination,
    date: toMalawiDate(row.departureAt),
    departureTime: toMalawiTime(row.departureAt),
    createdAt: row.createdAt,
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
  invalidDate?: boolean;
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
    invalidDate: Boolean(date && !dayRange(date)),
    type: type === "bus" || type === "taxi" ? type : undefined,
  };
}

export function parsePage(params: RawParams): number {
  return parsePageParam(params.page);
}

const SEARCH_PAGE_SIZE = 12;

export type TripSearchResult = {
  trips: TripListing[];
  page: number;
  pageSize: number;
  total: number;
};

// The database does the filtering and sorting. Never load every trip and
// filter in JavaScript: that gets slow as the table grows.
export async function searchTrips(filters: Filters, requestedPage = 1): Promise<TripSearchResult> {
  const where: Prisma.TripWhereInput = {
    operator: { active: true, verified: true, OR: [{ ownerId: null }, { owner: { active: true } }] },
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

  const { total, page, rows } = await readPage(requestedPage, SEARCH_PAGE_SIZE,
    () => prisma.trip.count({ where }),
    (skip, take) => prisma.trip.findMany({ where, select: tripSelect, orderBy: [{ departureAt: "asc" }, { id: "asc" }], skip, take }),
  );
  return { trips: rows.map(toListing), page, pageSize: SEARCH_PAGE_SIZE, total };
}

export async function getUpcomingTrips(limit: number): Promise<TripListing[]> {
  "use cache";
  cacheLife({ stale: 15, revalidate: 15, expire: 30 });
  cacheTag("public-trips");
  const rows = await prisma.trip.findMany({
    where: { operator: { active: true, verified: true, OR: [{ ownerId: null }, { owner: { active: true } }] }, departureAt: { gte: new Date() } },
    select: tripSelect,
    orderBy: [{ departureAt: "asc" }, { id: "asc" }],
    take: limit,
  });
  return rows.map(toListing);
}
