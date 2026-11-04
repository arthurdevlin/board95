export const DAY_MS = 24 * 60 * 60 * 1000;
export const CAR_HIRE_LIFETIME_MS = 7 * DAY_MS;

export function carHireExpiry(now = new Date()) {
  return new Date(now.getTime() + CAR_HIRE_LIFETIME_MS);
}

export function listingExpiryState(expiresAt: Date, now = new Date()) {
  const remaining = expiresAt.getTime() - now.getTime();
  return remaining <= 0 ? "expired" : remaining <= DAY_MS ? "expiring" : "active";
}

// Both relations use the same selected fields. Fail closed if an invalid row has neither.
export function withTripHistory<R extends { trip: object | null; tripHistory: object | null }>(row: R) {
  const trip = row.trip ?? row.tripHistory;
  if (!trip) throw new Error("Booking listing history is missing.");
  return { ...row, trip: trip as NonNullable<R["trip"]> };
}

export function withListingHistory<R extends { listing: object | null; listingHistory: object | null }>(row: R) {
  const listing = row.listing ?? row.listingHistory;
  if (!listing) throw new Error("Rental listing history is missing.");
  return { ...row, listing: listing as NonNullable<R["listing"]> };
}
