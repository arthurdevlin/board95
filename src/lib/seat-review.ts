// Only the seat fare is reviewed here. Pickup pricing has no defined
// per-seat/per-request rule yet, so it is deliberately excluded.
export function reviewSeats(
  raw: string | string[] | undefined,
  seatsAvailable: number,
  fareMWK: number,
): { seats: number; subtotalMWK: number } | { error: string } {
  const value = raw === undefined ? "1" : raw;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return { error: "Choose a whole number of seats, starting at 1." };
  }
  const seats = Number(value);
  if (!Number.isSafeInteger(seats) || seats > seatsAvailable) {
    return { error: "There are not enough seats available. Choose fewer seats." };
  }
  const subtotalMWK = seats * fareMWK;
  if (!Number.isSafeInteger(subtotalMWK) || subtotalMWK < 0) {
    return { error: "The fare cannot be calculated. Please try another trip." };
  }
  return { seats, subtotalMWK };
}
