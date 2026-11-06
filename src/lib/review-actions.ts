"use server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { matchesGuestToken } from "@/lib/guest-access";
import { rentalAccess } from "@/lib/rental-access";
import { withTripHistory } from "@/lib/listing-lifecycle";
import { revalidatePath } from "next/cache";
import { allowRequest } from "@/lib/rate-limit";

export async function submitServiceReview(_state: { message: string }, form: FormData) {
  const id = String(form.get("id") ?? ""); const kind = String(form.get("kind") ?? "");
  const token = String(form.get("token") ?? ""); const score = Number(form.get("score")); const note = String(form.get("note") ?? "").trim();
  if (!Number.isInteger(score) || score < 1 || score > 5 || note.length > 300 || !["trip", "rental"].includes(kind)) return { message: "Choose a score from 1–5 and a note up to 300 characters." };
  if (!await allowRequest("service-review", 10, 60000)) return { message: "Please wait before trying again." };
  let data;
  if (kind === "rental") {
    const access = await rentalAccess(id, token);
    if (!access?.passenger || access.rental.status !== "COMPLETED" || access.rental.endsAt > new Date()) return { message: "Only the passenger can review a completed rental after its end date." };
    data = { rentalRequestId: id, carListingId: access.rental.listing.id, providerUserId: access.rental.listing.ownerId, score, note };
  } else {
    const session = await getSession();
    const row = await prisma.booking.findUnique({ where: { id }, include: { trip: true, tripHistory: true } });
    if (!row) return { message: "Booking unavailable." };
    const booking = withTripHistory(row);
    const passenger = Boolean(session?.user.id && row.userId === session.user.id) || (!row.userId && Boolean(row.guestAccessTokenExpiresAt && row.guestAccessTokenExpiresAt > new Date() && matchesGuestToken(token, row.guestAccessTokenHash)));
    if (!passenger || row.status !== "COMPLETED" || booking.trip.departureAt > new Date()) return { message: "Only the passenger can review a completed trip after departure." };
    data = { bookingId: id, operatorId: booking.trip.operatorId, vehicleId: booking.trip.vehicleId, score, note };
  }
  try { await prisma.serviceReview.create({ data }); } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return { message: "You have already reviewed this booking." };
    throw error;
  }
  for (const path of ["/", "/transport", "/car-hire", `/rentals/${id}`, `/bookings/${id}/chat`]) revalidatePath(path);
  return { message: "Thank you. Your verified review is now public." };
}
