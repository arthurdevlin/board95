// Prisma Int columns are signed 32-bit PostgreSQL integers.
export const MAX_DATABASE_INT = 2_147_483_647;

export function isDatabaseAmount(value: number, minimum = 1) {
  return Number.isSafeInteger(value) && value >= minimum && value <= MAX_DATABASE_INT;
}

export function isSelfServiceApplicationKind(value: unknown): value is "TAXI_OWNER" | "CAR_HIRER" {
  return value === "TAXI_OWNER" || value === "CAR_HIRER";
}
