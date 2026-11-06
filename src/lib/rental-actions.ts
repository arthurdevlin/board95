"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeBookingReference, normalizeMalawiPhone, hashGuestToken } from "@/lib/guest-access";
import { allowRequest } from "@/lib/rate-limit";
import { queueMobile } from "@/lib/mobile-notifications";
import { rentalAccess } from "@/lib/rental-access";

export async function lookupGuestRentalAction(_state: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const reference = normalizeBookingReference(String(form.get("reference") ?? ""));
  const phone = normalizeMalawiPhone(String(form.get("phone") ?? ""));
  if (!reference || !phone) return { error: "Enter your 8-character reference and the mobile number used to request the car." };
  if (!await allowRequest("guest-rental-lookup", 5, 15 * 60 * 1000)) return { error: "Too many attempts. Try again in 15 minutes." };
  const matches = await prisma.carHireRequest.findMany({ where: { id: { endsWith: reference, mode: "insensitive" }, guestPhone: phone, passengerId: null }, select: { id: true }, take: 2 });
  if (matches.length !== 1) return { error: "We could not match that rental reference and mobile number." };
  const token = randomBytes(32).toString("base64url");
  await prisma.carHireRequest.update({ where: { id: matches[0].id }, data: { guestAccessTokenHash: hashGuestToken(token), guestAccessTokenExpiresAt: new Date(Date.now() + 30 * 86400000) } });
  redirect(`/rentals/${matches[0].id}?token=${token}`);
}

export async function sendRentalMessageAction(_state: { error: string | null }, form: FormData) {
  const id = String(form.get("requestId") ?? "");
  const token = String(form.get("token") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!body || body.length > 2000) return { error: "Write a message of 1–2,000 characters." };
  if (!await allowRequest("rental-message", 20, 60000)) return { error: "Please wait before sending more messages." };
  const access = await rentalAccess(id, token);
  if (!access) return { error: "Your access has expired. Recover the rental again." };
  await prisma.rentalMessage.create({ data: { requestId: id, senderId: access.userId ?? null, body } });
  revalidatePath(`/rentals/${id}`);
  return { error: null };
}

export async function completeRentalAction(form: FormData) {
  const id = String(form.get("requestId") ?? "");
  const access = await rentalAccess(id, "");
  if (!access?.owner || access.rental.endsAt > new Date()) throw new Error("Only the owner can complete a rental after its end date.");
  const completed = await prisma.carHireRequest.updateMany({ where: { id, status: "ACCEPTED", endsAt: { lte: new Date() } }, data: { status: "COMPLETED" } });
  if (completed.count) await queueMobile(`rental:${id}:completed`, access.rental.guestPhone, `Board95 rental completed. Reference ${id.slice(-8).toUpperCase()}. Recover your rental to leave a verified rating.`, access.rental.whatsappUpdates);
  revalidatePath("/car-hire/dashboard");
  revalidatePath(`/rentals/${id}`);
}
