import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { matchesGuestToken } from "@/lib/guest-access";
import { withListingHistory } from "@/lib/listing-lifecycle";

export async function rentalAccess(id: string, token: string) {
  const session = await getSession();
  const row = await prisma.carHireRequest.findUnique({ where: { id }, include: { listing: true, listingHistory: true } });
  if (!row) return null;
  const rental = withListingHistory(row);
  const userId = session?.user.id;
  const owner = Boolean(userId && (userId === rental.listing.ownerId || session?.user.role === "ADMIN"));
  const passenger = Boolean(userId && userId === rental.passengerId);
  const guest = !rental.passengerId && Boolean(rental.guestAccessTokenExpiresAt && rental.guestAccessTokenExpiresAt > new Date() && matchesGuestToken(token, rental.guestAccessTokenHash));
  return owner || passenger || guest ? { rental, userId: owner || passenger ? userId : undefined, owner, passenger: !owner && (passenger || guest) } : null;
}
