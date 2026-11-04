import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type ListingKind = "trip" | "car-hire";

export async function listingHistoryScope(user: { id: string; role: string }, kind: ListingKind) {
  let trips: Prisma.TripHistoryWhereInput = { id: "" };
  let cars: Prisma.CarHireListingHistoryWhereInput = { id: "" };
  if (user.role === "ADMIN") return { trips: {}, cars: {} };
  if (kind === "car-hire") {
    if (user.role !== "CAR_HIRER") return null;
    cars = { ownerId: user.id };
  } else {
    if (user.role !== "OWNER" && user.role !== "CUSTOMER") return null;
    const memberships = await prisma.operatorMember.findMany({ where: { userId: user.id, operator: { kind: "BUS_COMPANY" } }, select: { operatorId: true } });
    if (user.role !== "OWNER" && memberships.length === 0) return null;
    trips = { operator: { OR: [{ ownerId: user.id }, { id: { in: memberships.map((member) => member.operatorId) } }] } };
  }
  return { trips, cars };
}
