import type { Prisma } from "@/generated/prisma/client";

export function busManagementScope(user: { id: string; role: string }): Prisma.OperatorWhereInput | null {
  if (user.role === "ADMIN") return { kind: "BUS_COMPANY" };
  if (user.role === "OWNER") return { kind: "BUS_COMPANY", ownerId: user.id };
  if (user.role === "CUSTOMER") return { kind: "BUS_COMPANY", members: { some: { userId: user.id, role: "ADMIN" } } };
  return null;
}

export function resizeDepartureSeats(total: number, available: number, capacity: number) {
  const reserved = total - available;
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(available) || available < 0 || available > total || !Number.isInteger(capacity) || capacity < 1 || capacity > 100 || reserved > capacity) return null;
  const seatsTotal = Math.min(total, capacity);
  return { seatsTotal, seatsAvailable: seatsTotal - reserved };
}
