"use server";

import { carHireExpiry, withTripHistory, withListingHistory } from "@/lib/listing-lifecycle";
import { formatTimestamp } from "@/lib/format";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dayRange, toMalawiDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { board95Url, deliverEmailDelivery, sendBoard95Email } from "@/lib/email";
import { allowRequest } from "@/lib/rate-limit";
import { hashGuestToken, matchesGuestToken, normalizeMalawiPhone, normalizeBookingReference } from "@/lib/guest-access";
import { removeCarPhoto, storeCarPhoto } from "@/lib/car-photo-storage";
import { CAR_HIRE_DISTRICTS, type CarHireDistrictCode } from "@/lib/car-hire-districts";
import { isDatabaseAmount, isSelfServiceApplicationKind } from "@/lib/validation";
import { parseTransportLocation, transportLocationName } from "@/lib/cities";
import { queueMobile } from "@/lib/mobile-notifications";
import { canApplyForOperator, canBrowseListings } from "@/lib/access";

export type BookingRequestState = {
  status: "idle" | "success" | "unavailable" | "error";
  message: string;
  reference?: string;
  guestChatUrl?: string;
};

function parseMalawiDeparture(date: string, time: string): Date | null {
  if (!dayRange(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const departureAt = new Date(`${date}T${time}:00+02:00`);
  return Number.isNaN(departureAt.getTime()) ? null : departureAt;
}

export async function saveProfileSettingsAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/sign-in?next=/settings");
  const name = String(formData.get("name") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  if (name.length < 2 || name.length > 100) throw new Error("Enter a name between 2 and 100 characters.");
  const phone = rawPhone ? normalizeMalawiPhone(rawPhone) : null;
  if (rawPhone && !phone) throw new Error("Enter a valid Malawi mobile number (08, 09 or 02 prefix).");
  const photo = formData.get("photo");
  let image: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 400 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
      throw new Error("Profile photos must be JPEG, PNG or WebP and no larger than 400 KB.");
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    image = `data:${photo.type};base64,${bytes.toString("base64")}`;
  }
  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { name, phone, ...(image ? { image } : {}) } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new Error("That mobile number is already in use.");
    throw error;
  }
  revalidatePath("/settings");
  revalidatePath("/account");
  revalidatePath("/");
  redirect("/settings?saved=1");
}

export async function applyForAccountTypeFromSignup(kind: "TAXI_OWNER" | "CAR_HIRER", displayName: string, phone: string) {
  if (!isSelfServiceApplicationKind(kind)) return { error: "Choose a taxi-driver or car-hire application." };
  const session = await getSession();
  if (!session?.user?.id || !canApplyForOperator(session.user)) return { error: "Only passenger accounts can apply for an operator role." };
  const name = displayName.trim();
  const rawPhone = phone.replace(/[\s()-]/g, "");
  if (name.length < 2 || name.length > 100) return { error: "Enter a valid business or operator name." };
  if (!/^(?:\+265|0)(?:8|9|2)\d{8}$/.test(rawPhone)) return { error: "Enter a valid Malawi mobile number." };
  const existing = await prisma.application.findFirst({ where: { userId: session.user.id, kind, status: { in: ["PENDING", "APPROVED"] } } });
  if (!existing) {
    await prisma.application.create({ data: { userId: session.user.id, kind, displayName: name, phone: rawPhone.startsWith("+") ? rawPhone : `+265${rawPhone.slice(1)}` } });
    await sendBoard95Email({
      to: process.env.BOARD95_ADMIN_EMAIL,
      subject: `New ${kind === "TAXI_OWNER" ? "taxi driver" : "car-hire provider"} application`,
      lines: [`${name} submitted a ${kind === "TAXI_OWNER" ? "taxi driver" : "car-hire provider"} application.`, `Applicant: ${session.user.name} · ${session.user.email}`, `Mobile: ${rawPhone}`],
      action: { label: "Review application", href: board95Url("/admin") },
    });
  }
  revalidatePath("/admin");
  revalidatePath("/operator");
  revalidatePath("/car-hire/dashboard");
  revalidatePath("/account");
  return { error: null };
}

export async function requestSeatAction(
  _previousState: BookingRequestState,
  formData: FormData,
): Promise<BookingRequestState> {
  const session = await getSession();
  if (!canBrowseListings(session?.user)) return { status: "error", message: "Provider accounts can only preview their own listings. Use a passenger account to book." };
  const bookingLimit = session
    ? await allowRequest("signed-in-booking", 20, 10 * 60 * 1000)
    : await allowRequest("guest-booking", 8, 10 * 60 * 1000);
  if (!bookingLimit) {
    return { status: "error", message: "Too many booking attempts. Wait a few minutes and try again." };
  }
  const guestName = String(formData.get("guestName") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").replace(/[\s()-]/g, "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pickupRequested = formData.get("pickupRequested") === "on";
  const pickupLocation = String(formData.get("pickupLocation") ?? "").trim();

  if (guestName.length < 2 || guestName.length > 100) {
    return { status: "error", message: "Enter the passenger’s name (2–100 characters)." };
  }
  const phone = normalizeMalawiPhone(rawPhone);
  if (!phone) return { status: "error", message: "Enter a valid Malawi mobile number, such as 0993 661 661, 993661661 or +265 993 661 661." };
  if (!(await allowRequest("booking-phone", 3, 60 * 60 * 1000, phone))) {
    return { status: "error", message: "Too many booking attempts for this mobile number. Try again later." };
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { status: "error", message: "Enter a valid email address or leave it blank." };
  }
  if (pickupRequested && (pickupLocation.length < 3 || pickupLocation.length > 200)) {
    return { status: "error", message: "Enter a pickup location (3–200 characters)." };
  }

  const tripIdValue = formData.get("tripId");
  if (typeof tripIdValue !== "string" || !tripIdValue.trim() || tripIdValue.length > 64) {
    return { status: "error", message: "This trip could not be identified. Refresh and try again." };
  }

  const tripId = tripIdValue.trim();
  const now = new Date();
  const guestAccessToken = session?.user?.id ? null : randomBytes(32).toString("base64url");

  let result: string;
  try {
    result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          fareMWK: true,
          departureAt: true,
          seatsAvailable: true,
          pickupAvailable: true,
          pickupFeeMWK: true,
          schedule: { select: { active: true } },
          cancelled: true,
          scheduleOverride: true,
          vehicle: { select: { active: true } },
          operator: { select: { active: true, verified: true, owner: { select: { active: true } } } },
        },
      });

      if (!trip || trip.cancelled || trip.vehicle?.active === false || (trip.schedule?.active === false && !trip.scheduleOverride) || trip.seatsAvailable <= 0 || !trip.operator.active || !trip.operator.verified || trip.operator.owner?.active === false || trip.departureAt <= now || (pickupRequested && !trip.pickupAvailable)) {
        return "unavailable" as const;
      }

      const existingOpenBooking = await tx.booking.findFirst({
        where: { tripId: trip.id, guestPhone: phone, status: { in: ["PENDING", "ACCEPTED"] } },
        select: { id: true },
      });
      if (existingOpenBooking) return "duplicate" as const;

      const totalMWK = trip.fareMWK + (pickupRequested ? trip.pickupFeeMWK ?? 0 : 0);
      if (!isDatabaseAmount(totalMWK)) return "unavailable" as const;
      const booking = await tx.booking.create({
        data: {
          tripId: trip.id,
          seats: 1,
          totalMWK,
          userId: session?.user?.id ?? null,
          guestName,
          guestPhone: phone,
          guestEmail: email || null,
          whatsappUpdates: formData.get("whatsappUpdates") === "on",
          pickupRequested,
          pickupLocation: pickupRequested ? pickupLocation : null,
          status: "PENDING",
          guestAccessTokenHash: guestAccessToken ? hashGuestToken(guestAccessToken) : null,
          guestAccessTokenExpiresAt: guestAccessToken ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null,
        },
      });

      await queueMobile(`trip:${booking.id}:received`, phone, `Board95 booking received. Reference ${booking.id.slice(-8).toUpperCase()}. Pending operator confirmation. Recover at ${board95Url("/bookings/lookup")}`, formData.get("whatsappUpdates") === "on", undefined, tx);
      return `created:${booking.id}` as const;
    }, { isolationLevel: "Serializable" });
  } catch {
    return {
      status: "error",
      message: "We couldn’t submit your request. Please try again.",
    };
  }

  revalidatePath("/");
  revalidatePath("/transport");
  if (session?.user?.id) revalidatePath("/account");

  if (result === "unavailable") {
    return {
      status: "unavailable",
      message: "This trip is full, has departed, or is no longer available. Refresh the results and try another trip.",
    };
  }

  if (result === "duplicate") {
    return { status: "error", message: "There is already a pending or confirmed request for this trip and mobile number." };
  }

  revalidatePath("/operator");
  revalidatePath("/admin");

  const bookingId = result.slice("created:".length);
  const bookingForEmail = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: { select: { email: true } }, trip: { include: { operator: { include: { owner: { select: { email: true } } } } } }, tripHistory: { include: { operator: { include: { owner: { select: { email: true } } } } } } },
  }).then((row) => row ? withTripHistory(row) : null);
  if (bookingForEmail) {
    const route = `${transportLocationName(bookingForEmail.trip.origin)} to ${transportLocationName(bookingForEmail.trip.destination)}`;
    const reference = bookingForEmail.id.slice(-8).toUpperCase();
    const departure = formatTimestamp(bookingForEmail.trip.departureAt);
    const operatorEmail = bookingForEmail.trip.operator.owner?.email ?? process.env.BOARD95_ADMIN_EMAIL;
    await Promise.all([
      sendBoard95Email({ to: operatorEmail, subject: "New passenger booking", lines: [`A new request is waiting for ${route}.`, `Passenger: ${bookingForEmail.guestName ?? "Passenger"} · ${bookingForEmail.guestPhone ?? "No mobile"}`, `Departure: ${departure}. Reference: ${reference}.`], action: { label: "Open operator dashboard", href: board95Url("/operator") } }),
      sendBoard95Email({ to: bookingForEmail.guestEmail ?? bookingForEmail.user?.email, subject: "Booking request received", lines: [`Your request for ${route} is pending operator confirmation.`, `Departure: ${departure}. Reference: ${reference}.`], action: guestAccessToken ? { label: "Find your booking", href: board95Url("/bookings/lookup") } : undefined }),
    ]);
  }
  return {
    status: "success",
    message: "Your request is saved and is pending confirmation from the operator.",
    reference: bookingId.slice(-8).toUpperCase(),
    guestChatUrl: guestAccessToken ? `/bookings/${bookingId}/chat?token=${encodeURIComponent(guestAccessToken)}` : undefined,
  };
}

function getAdministratorId() {
  return getSession().then((session) => {
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      throw new Error("Administrator access required.");
    }
    return session.user.id;
  });
}

export async function createBusCompanyAction(formData: FormData) {
  await getAdministratorId();
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizeMalawiPhone(String(formData.get("phone") ?? ""));
  if (name.length < 2 || name.length > 100 || !phone) throw new Error("Enter a company name and valid Malawi mobile number.");
  await prisma.operator.create({ data: { name, phone, kind: "BUS_COMPANY", verified: true, active: true } });
  updateTag("public-trips");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/operator");
}

export async function assignBusCompanyMemberAction(formData: FormData) {
  await getAdministratorId();
  const operatorId = String(formData.get("operatorId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("memberRole") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!operatorId || operatorId.length > 64 || !["ADMIN", "STAFF"].includes(role) || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid bus company, name, email and access level.");
  if (password || confirmPassword) {
    if (password.length < 8 || password.length > 128) throw new Error("Set a password between 8 and 128 characters.");
    if (password !== confirmPassword) throw new Error("The passwords do not match.");
  }
  const operator = await prisma.operator.findFirst({ where: { id: operatorId, kind: "BUS_COMPANY" } });
  if (!operator) throw new Error("Bus company not found.");
  let user = await prisma.user.findUnique({ where: { email } });
  let invited = false;
  if (!user) {
    if (name.length < 2) throw new Error("Enter the new local account holder's name.");
    if (!password) throw new Error("Set a password for the new company account.");
    const passwordHash = await hashPassword(password);
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email, emailVerified: false, role: "CUSTOMER" } });
      await tx.account.create({ data: { userId: created.id, accountId: created.id, providerId: "credential", password: passwordHash } });
      return created;
    });
    invited = true;
  } else if (!user.active) {
    throw new Error("This account is blocked. Unblock it before assigning it to a company.");
  } else if (user.role !== "CUSTOMER") {
    throw new Error("Only passenger/local accounts can be assigned as bus company users.");
  }
  await prisma.operatorMember.upsert({
    where: { operatorId_userId: { operatorId, userId: user.id } },
    create: { operatorId, userId: user.id, role: role as "ADMIN" | "STAFF" },
    update: { role: role as "ADMIN" | "STAFF" },
  });
  if (invited) {
    await sendBoard95Email({ to: email, subject: "Bus company account created", lines: ["A Board95 administrator created a local account for you and assigned " + (role === "ADMIN" ? "company administrator" : "local staff") + " access to " + operator.name + ".", "Sign in to Board95 with the password provided by your administrator."], action: { label: "Open Board95", href: board95Url("/operator") } });
  } else {
    await sendBoard95Email({ to: email, subject: "Bus company access assigned", lines: ["Your account has been assigned " + (role === "ADMIN" ? "bus company administrator" : "local staff") + " access for " + operator.name + ".", "Sign in to Board95 and open the operator dashboard from your account menu."], action: { label: "Open Board95", href: board95Url("/operator") } });
  }
  revalidatePath("/admin");
  revalidatePath("/operator");
}

export async function setOperatorApprovalAction(formData: FormData) {
  await getAdministratorId();
  const operatorId = String(formData.get("operatorId") ?? "");
  const approvedValue = formData.get("approved");
  if (approvedValue !== "true" && approvedValue !== "false") throw new Error("Invalid approval status.");
  const approved = approvedValue === "true";
  if (!operatorId || operatorId.length > 64) throw new Error("Invalid operator.");
  const operator = await prisma.operator.findUnique({ where: { id: operatorId }, include: { owner: { select: { email: true } } } });
  if (!operator) throw new Error("Operator not found.");
  await prisma.operator.update({ where: { id: operatorId }, data: { verified: approved } });
  const memberEmails = await prisma.operatorMember.findMany({ where: { operatorId }, select: { user: { select: { email: true } } } });
  await Promise.all([operator.owner?.email, ...memberEmails.map((member) => member.user.email)].filter((email): email is string => Boolean(email)).map((email) => sendBoard95Email({ to: email, subject: approved ? "Operator profile approved" : "Operator approval changed", lines: ["A Board95 administrator " + (approved ? "approved" : "changed the approval status of") + " " + operator.name + ".", "Contact Board95 support if you need help."], action: { label: "Open operator dashboard", href: board95Url("/operator") } })));
  updateTag("public-trips");
  revalidatePath("/admin");
  revalidatePath("/operator");
}

export async function setOperatorActiveAction(formData: FormData) {
  await getAdministratorId();
  const operatorId = String(formData.get("operatorId") ?? "");
  const activeValue = formData.get("active");
  if (activeValue !== "true" && activeValue !== "false") throw new Error("Invalid operator status.");
  const active = activeValue === "true";
  if (!operatorId || operatorId.length > 64) throw new Error("Invalid operator.");
  const operator = await prisma.operator.findUnique({ where: { id: operatorId }, include: { owner: { select: { email: true } } } });
  if (!operator) throw new Error("Operator not found.");
  await prisma.operator.update({ where: { id: operatorId }, data: { active } });
  const memberEmails = await prisma.operatorMember.findMany({ where: { operatorId }, select: { user: { select: { email: true } } } });
  await Promise.all([operator.owner?.email, ...memberEmails.map((member) => member.user.email)].filter((email): email is string => Boolean(email)).map((email) => sendBoard95Email({ to: email, subject: active ? "Operator account restored" : "Operator account blocked", lines: ["A Board95 administrator " + (active ? "restored" : "blocked") + " the " + operator.kind.replace("_", " ").toLowerCase() + " profile for " + operator.name + ".", "Contact Board95 support if you need help."], action: { label: "Open operator dashboard", href: board95Url("/operator") } })));
  updateTag("public-trips");
  revalidatePath("/admin");
  revalidatePath("/operator");
  revalidatePath("/transport");
}

export async function setUserActiveAction(formData: FormData) {
  const adminId = await getAdministratorId();
  const userId = String(formData.get("userId") ?? "");
  const activeValue = formData.get("active");
  if (activeValue !== "true" && activeValue !== "false") throw new Error("Invalid user status.");
  const active = activeValue === "true";
  if (!userId || userId === adminId || userId.length > 64) throw new Error("Invalid user.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new Error("User not found.");
  await prisma.user.update({ where: { id: userId }, data: { active } });
  await sendBoard95Email({ to: user.email, subject: active ? "Your Board95 account was restored" : "Your Board95 account was blocked", lines: ["A Board95 administrator " + (active ? "restored" : "blocked") + " your account.", "Contact Board95 support if you need help."] });
  updateTag("public-trips");
  revalidatePath("/admin");
}

export async function deleteUserAction(formData: FormData) {
  const adminId = await getAdministratorId();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === adminId || userId.length > 64) throw new Error("Invalid user.");
  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { active: true } });
    if (!target || target.active) throw new Error("Block this account before deleting it.");
    const rentalHistory = await tx.carHireRequest.findFirst({ where: { OR: [{ listing: { ownerId: userId } }, { listingHistory: { ownerId: userId } }] }, select: { id: true } });
    if (rentalHistory || await tx.carHireListingHistory.count({ where: { ownerId: userId } })) throw new Error("This provider has rental request history. Keep the account blocked to preserve passenger records.");
    await tx.operator.updateMany({ where: { ownerId: userId }, data: { ownerId: null, active: false } });
    await tx.user.delete({ where: { id: userId } });
  }, { isolationLevel: "Serializable" });
  updateTag("public-trips");
  revalidatePath("/admin");
}

export async function createAdminUserAction(formData: FormData) {
  await getAdministratorId();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const role = String(formData.get("role") ?? "CUSTOMER");
  const phone = rawPhone ? normalizeMalawiPhone(rawPhone) : null;
  if (name.length < 2 || name.length > 100) throw new Error("Enter a name between 2 and 100 characters.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (rawPhone && !phone) throw new Error("Enter a valid Malawi mobile number or leave the phone field blank.");
  if (password.length < 8 || password.length > 128) throw new Error("Set a password between 8 and 128 characters.");
  if (password !== confirmPassword) throw new Error("The passwords do not match.");
  if (role !== "CUSTOMER" && role !== "ADMIN") throw new Error("Choose a valid account type.");
  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, phone, emailVerified: false, role: role as "CUSTOMER" | "ADMIN" } });
      await tx.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new Error("An account already uses that email or mobile number.");
    throw error;
  }
  revalidatePath("/admin");
}

export type SetPasswordState = { status: "idle" | "success" | "error"; message: string };

export async function setUserPasswordAction(_previous: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  await getAdministratorId();
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!userId || userId.length > 64) return { status: "error", message: "Invalid user." };
  if (password.length < 8 || password.length > 128) return { status: "error", message: "Set a password between 8 and 128 characters." };
  if (password !== confirmPassword) return { status: "error", message: "The passwords do not match." };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { status: "error", message: "User not found." };
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const credential = await tx.account.findFirst({ where: { userId, providerId: "credential" }, select: { id: true } });
    if (credential) {
      await tx.account.update({ where: { id: credential.id }, data: { password: passwordHash } });
    } else {
      await tx.account.create({ data: { userId, accountId: userId, providerId: "credential", password: passwordHash } });
    }
    await tx.session.deleteMany({ where: { userId } });
  });
  revalidatePath("/admin");
  return { status: "success", message: "Password assigned. Existing sessions have been signed out." };
}

export async function submitAccountApplicationAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/sign-in?next=/account");
  if (!canApplyForOperator(session.user)) throw new Error("Only passenger accounts can apply for an operator or car-hire role.");
  const kind = String(formData.get("kind") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").replace(/[\s()-]/g, "");
  if (!isSelfServiceApplicationKind(kind)) throw new Error("Choose a taxi-owner or car-hire account type. Bus company profiles are created by administrators.");
  if (displayName.length < 2 || displayName.length > 100) throw new Error("Enter a valid business or operator name.");
  if (!/^(?:\+265|0)(?:8|9|2)\d{8}$/.test(rawPhone)) throw new Error("Enter a valid Malawi mobile number.");
  const openRequest = await prisma.application.findFirst({ where: { userId: session.user.id, kind: kind as "TAXI_OWNER" | "BUS_COMPANY" | "CAR_HIRER", status: "PENDING" } });
  if (openRequest) throw new Error("You already have a pending application of this type.");
  const approvedRequest = await prisma.application.findFirst({ where: { userId: session.user.id, kind: kind as "TAXI_OWNER" | "BUS_COMPANY" | "CAR_HIRER", status: "APPROVED" } });
  if (approvedRequest) throw new Error("This account type has already been approved for you.");
  await prisma.application.create({ data: { userId: session.user.id, kind: kind as "TAXI_OWNER" | "BUS_COMPANY" | "CAR_HIRER", displayName, phone: rawPhone.startsWith("+") ? rawPhone : `+265${rawPhone.slice(1)}` } });
  await sendBoard95Email({
    to: process.env.BOARD95_ADMIN_EMAIL,
    subject: "New account application",
    lines: [`${displayName} submitted a ${kind.replace("_", " ").toLowerCase()} application.`, `Applicant: ${session.user.name} · ${session.user.email}`, `Mobile: ${rawPhone}`],
    action: { label: "Review application", href: board95Url("/admin") },
  });
  revalidatePath("/account");
  revalidatePath("/admin");
}

export async function reviewAccountApplicationAction(formData: FormData) {
  await getAdministratorId();
  const applicationId = String(formData.get("applicationId") ?? "");
  const approved = formData.get("approved") === "true";
  if (!applicationId || applicationId.length > 64) throw new Error("Invalid application.");
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application || application.status !== "PENDING") throw new Error("This application is no longer pending.");
  await prisma.$transaction(async (tx) => {
    const changed = await tx.application.updateMany({ where: { id: application.id, status: "PENDING" }, data: { status: approved ? "APPROVED" : "DECLINED", reviewedAt: new Date(), reviewedByAdmin: true } });
    if (changed.count !== 1) throw new Error("This application has already been reviewed.");
    if (!approved) return;
    if (application.kind === "CAR_HIRER") {
      await tx.user.update({ where: { id: application.userId }, data: { role: "CAR_HIRER" } });
      return;
    }
    await tx.user.update({ where: { id: application.userId }, data: { role: "OWNER" } });
    await tx.operator.create({ data: {
      name: application.displayName,
      kind: application.kind === "BUS_COMPANY" ? "BUS_COMPANY" : "TAXI_OWNER",
      ownerId: application.userId,
      phone: application.phone,
      verified: true,
      active: true,
    } });
  });
  updateTag("public-trips");
  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/operator");
  revalidatePath("/car-hire/dashboard");
  const applicant = await prisma.user.findUnique({ where: { id: application.userId }, select: { email: true } });
  await sendBoard95Email({
    to: applicant?.email,
    subject: approved ? "Your application was approved" : "Your application was declined",
    lines: [approved ? `Your ${application.kind.replace("_", " ").toLowerCase()} application is approved by a Board95 administrator. You can now open your dashboard.` : `Your ${application.kind.replace("_", " ").toLowerCase()} application was declined by a Board95 administrator. Contact Board95 support if you need more information.`],
    action: approved ? { label: "Open your dashboard", href: board95Url(application.kind === "CAR_HIRER" ? "/car-hire/dashboard" : "/operator") } : undefined,
  });
}

export async function updateBookingStatusAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Operator access required.");
  const memberships = session.user.role === "CUSTOMER" ? await prisma.operatorMember.findMany({ where: { userId: session.user.id, operator: { kind: "BUS_COMPANY", active: true, verified: true } }, select: { operatorId: true } }) : [];
  if (!["OWNER", "ADMIN"].includes(session.user.role) && memberships.length === 0) throw new Error("Operator access required.");
  const bookingId = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!bookingId || !["ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED"].includes(status)) throw new Error("Invalid booking update.");
  if (session.user.role === "OWNER" && !["ACCEPTED", "DECLINED", "COMPLETED"].includes(status)) throw new Error("Operator access required for this status change.");

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      ...(session.user.role === "ADMIN" ? {} : session.user.role === "OWNER" ? { OR: [{ trip: { operator: { ownerId: session.user.id, active: true, verified: true } } }, { tripHistory: { operator: { ownerId: session.user.id, active: true, verified: true } } }] } : { OR: [{ trip: { operatorId: { in: memberships.map((membership) => membership.operatorId) } } }, { tripHistory: { operatorId: { in: memberships.map((membership) => membership.operatorId) } } }] }),
    },
    select: { id: true, userId: true, tripId: true, status: true, seats: true, reviewedByAdmin: true, guestPhone: true, whatsappUpdates: true, trip: { select: { departureAt: true, seatsTotal: true } }, tripHistory: { select: { departureAt: true, seatsTotal: true } } },
  }).then((row) => row ? withTripHistory(row) : null);
  if (!booking) throw new Error("Booking not found.");
  const nextStatus = status as "ACCEPTED" | "DECLINED" | "CANCELLED" | "COMPLETED";
  const canResolvePending = booking.status === "PENDING" && (nextStatus === "DECLINED" || (nextStatus === "ACCEPTED" && booking.tripId !== null && booking.trip.departureAt > new Date()));
  const canComplete = booking.status === "ACCEPTED" && nextStatus === "COMPLETED" && booking.trip.departureAt <= new Date();
  const canAdminCancel = session.user.role === "ADMIN" && ["PENDING", "ACCEPTED"].includes(booking.status) && nextStatus === "CANCELLED" && booking.trip.departureAt > new Date();
  if (!canResolvePending && !canComplete && !canAdminCancel) throw new Error("This booking cannot move to that status now.");

  await prisma.$transaction(async (tx) => {
    const changed = await tx.booking.updateMany({ where: { id: booking.id, status: booking.status }, data: { status: nextStatus, reviewedByAdmin: session.user.role === "ADMIN" || booking.reviewedByAdmin } });
    if (changed.count !== 1) throw new Error("This request has already been updated.");
    if (nextStatus === "ACCEPTED") {
      const reserved = await tx.trip.updateMany({ where: { id: booking.tripId ?? "", seatsAvailable: { gte: booking.seats }, departureAt: { gt: new Date() } }, data: { seatsAvailable: { decrement: booking.seats } } });
      if (reserved.count !== 1) throw new Error("There are not enough seats remaining to accept this booking.");
    }
    if (["DECLINED", "CANCELLED"].includes(nextStatus) && booking.status === "ACCEPTED") {
      const restored = await tx.trip.updateMany({ where: { id: booking.tripId ?? "", seatsAvailable: { lte: booking.trip.seatsTotal - booking.seats } }, data: { seatsAvailable: { increment: booking.seats } } });
      if (restored.count !== 1) throw new Error("Seat inventory could not be restored safely.");
    }
    await queueMobile(`trip:${booking.id}:${nextStatus}`, booking.guestPhone, `Board95 booking ${nextStatus.toLowerCase()}. Reference ${booking.id.slice(-8).toUpperCase()}. Details: ${board95Url("/bookings/lookup")}`, booking.whatsappUpdates, undefined, tx);
  });
  updateTag("public-trips");
  revalidatePath("/operator");
  revalidatePath("/admin");
  revalidatePath("/account");
  const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id }, include: { user: { select: { email: true } }, trip: { select: { origin: true, destination: true, departureAt: true } }, tripHistory: { select: { origin: true, destination: true, departureAt: true } } } }).then((row) => row ? withTripHistory(row) : null);
  await sendBoard95Email({
    to: updatedBooking?.guestEmail ?? updatedBooking?.user?.email,
    subject: `Booking ${nextStatus.toLowerCase()}`,
    lines: [`Your request for ${transportLocationName(updatedBooking?.trip.origin ?? "")} to ${transportLocationName(updatedBooking?.trip.destination ?? "")} is now ${nextStatus.toLowerCase()}.`, `Reference: ${booking.id.slice(-8).toUpperCase()}.`, ...(session.user.role === "ADMIN" ? ["This decision was made by a Board95 administrator."] : [])],
    action: { label: "View your booking", href: board95Url(booking.userId ? "/account" : "/bookings/lookup") },
  });
}

export async function cancelPassengerBookingAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "CUSTOMER") throw new Error("Passenger access required.");
  const bookingId = String(formData.get("bookingId") ?? "");
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId: session.user.id, status: { in: ["PENDING", "ACCEPTED"] } }, include: { trip: { select: { departureAt: true, seatsTotal: true } }, tripHistory: { select: { departureAt: true, seatsTotal: true } } } }).then((row) => row ? withTripHistory(row) : null);
  if (!booking || booking.trip.departureAt <= new Date()) throw new Error("Only future pending or accepted bookings can be cancelled.");
  await prisma.$transaction(async (tx) => {
    const changed = await tx.booking.updateMany({ where: { id: booking.id, userId: session.user.id, status: booking.status, trip: { departureAt: { gt: new Date() } } }, data: { status: "CANCELLED" } });
    if (changed.count !== 1) throw new Error("This booking has already changed or departed.");
    if (booking.status === "ACCEPTED") {
      const restored = await tx.trip.updateMany({ where: { id: booking.tripId ?? "", seatsAvailable: { lte: booking.trip.seatsTotal - booking.seats } }, data: { seatsAvailable: { increment: booking.seats } } });
      if (restored.count !== 1) throw new Error("Seat inventory could not be restored safely.");
    }
  });
  updateTag("public-trips");
  revalidatePath("/account");
  revalidatePath("/operator");
  revalidatePath("/admin");
  revalidatePath("/transport");
  const details = await prisma.booking.findUnique({ where: { id: booking.id }, select: { guestPhone: true, whatsappUpdates: true, trip: { select: { origin: true, destination: true, operator: { select: { owner: { select: { email: true } } } } } }, tripHistory: { select: { origin: true, destination: true, operator: { select: { owner: { select: { email: true } } } } } } } }).then((row) => row ? withTripHistory(row) : null);
  await queueMobile(`trip:${booking.id}:cancelled`, details?.guestPhone, `Board95 booking cancelled. Reference ${booking.id.slice(-8).toUpperCase()}.`, details?.whatsappUpdates);
  await Promise.all([
    sendBoard95Email({ to: session.user.email, subject: "Booking cancelled", lines: [`Your request for ${transportLocationName(details?.trip.origin ?? "")} to ${transportLocationName(details?.trip.destination ?? "")} was cancelled.`, `Reference: ${booking.id.slice(-8).toUpperCase()}.`] }),
    sendBoard95Email({ to: details?.trip.operator.owner?.email, subject: "Passenger cancelled a booking", lines: [`${booking.guestName ?? "A passenger"} cancelled a booking.`, `Reference: ${booking.id.slice(-8).toUpperCase()}.`] }),
  ]);
}

export async function retryPendingEmailsAction() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") throw new Error("Admin access required.");
  const pending = await prisma.emailDelivery.findMany({ where: { status: { in: ["PENDING", "FAILED"] } }, orderBy: { createdAt: "asc" }, take: 25, select: { id: true } });
  for (let index = 0; index < pending.length; index += 5) {
    await Promise.all(pending.slice(index, index + 5).map((delivery) => deliverEmailDelivery(delivery.id)));
  }
  revalidatePath("/admin");
}

export async function updateOperatorProfileAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["OWNER", "ADMIN"].includes(session.user.role)) throw new Error("Operator access required.");
  const operatorId = String(formData.get("operatorId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").replace(/[\s()-]/g, "");
  if (name.length < 2 || name.length > 100 || !/^(?:\+265|0)(?:8|9|2)\d{8}$/.test(rawPhone)) throw new Error("Enter a profile name and valid Malawi mobile number.");
  const result = await prisma.operator.updateMany({ where: { id: operatorId, ...(session.user.role === "ADMIN" ? {} : { ownerId: session.user.id }) }, data: { name, phone: rawPhone.startsWith("+") ? rawPhone : `+265${rawPhone.slice(1)}` } });
  if (result.count !== 1) throw new Error("Operator profile not found.");
  updateTag("public-trips");
  revalidatePath("/operator");
  revalidatePath(`/operator/profiles/${operatorId}`);
  revalidatePath("/transport");
}

export async function deleteOperatorProfileAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["OWNER", "ADMIN"].includes(session.user.role)) throw new Error("Operator access required.");
  const operatorId = String(formData.get("operatorId") ?? "");
  const operator = await prisma.operator.findFirst({ where: { id: operatorId, ...(session.user.role === "ADMIN" ? {} : { ownerId: session.user.id }) }, include: { _count: { select: { vehicles: true, trips: true } } } });
  if (!operator) throw new Error("Operator profile not found.");
  if (operator._count.vehicles || operator._count.trips) throw new Error("This profile has vehicles or trip history. Block it from the admin dashboard instead of deleting its history.");
  await prisma.$transaction(async (tx) => {
    await tx.operator.delete({ where: { id: operatorId } });
    if (operator.ownerId) {
      const applicationKind = operator.kind === "BUS_COMPANY" ? "BUS_COMPANY" : "TAXI_OWNER";
      await tx.application.deleteMany({ where: { userId: operator.ownerId, kind: applicationKind, status: "APPROVED" } });
      const remainingOperators = await tx.operator.count({ where: { ownerId: operator.ownerId } });
      if (remainingOperators === 0) await tx.user.updateMany({ where: { id: operator.ownerId, role: "OWNER" }, data: { role: "CUSTOMER" } });
    }
  });
  updateTag("public-trips");
  revalidatePath("/account");
  revalidatePath("/operator");
  revalidatePath("/admin");
}

export async function updateVehicleAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["OWNER", "ADMIN"].includes(session.user.role)) throw new Error("Operator access required.");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const model = String(formData.get("model") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim().toUpperCase();
  if (model.length < 2 || model.length > 80 || !/^[A-Z0-9 -]{3,20}$/.test(plate)) throw new Error("Enter a valid vehicle model and plate number.");
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, ...(session.user.role === "ADMIN" ? {} : { operator: { ownerId: session.user.id } }) } });
  if (!vehicle) throw new Error("Vehicle not found.");
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { model, plate } });
  updateTag("public-trips");
  revalidatePath("/operator");
  revalidatePath(`/operator/vehicles/${vehicleId}`);
  revalidatePath("/transport");
}

export async function deleteVehicleAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["OWNER", "ADMIN"].includes(session.user.role)) throw new Error("Operator access required.");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, ...(session.user.role === "ADMIN" ? {} : { operator: { ownerId: session.user.id } }) }, include: { _count: { select: { trips: true, busSchedules: true } } } });
  if (!vehicle) throw new Error("Vehicle not found.");
  if (vehicle._count.busSchedules) throw new Error("This bus has a Daily Bus Schedule. Keep the vehicle and edit or pause its services instead.");
  if (vehicle._count.trips) throw new Error("This vehicle has trip history. Edit its details or remove its unbooked trips before deleting it.");
  await prisma.vehicle.delete({ where: { id: vehicleId } });
  updateTag("public-trips");
  revalidatePath("/operator");
  revalidatePath("/admin");
}

export async function updateTripScheduleAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["OWNER", "ADMIN"].includes(session.user.role)) throw new Error("Operator access required.");
  const tripId = String(formData.get("tripId") ?? "");
  const origin = parseTransportLocation(String(formData.get("origin") ?? ""));
  const destination = parseTransportLocation(String(formData.get("destination") ?? ""));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const departureName = String(formData.get("departurePoint") ?? "").trim();
  const fareMWK = Number(formData.get("fareMWK"));
  const pickupAvailable = formData.get("pickupAvailable") === "on";
  const pickupFeeMWK = pickupAvailable ? Number(formData.get("pickupFeeMWK") ?? 0) : null;
  if (!origin || !destination || origin === destination) throw new Error("Choose two different Malawi districts.");
  if (departureName.length < 2 || departureName.length > 100 || !isDatabaseAmount(fareMWK) || !isDatabaseAmount(fareMWK + (pickupFeeMWK ?? 0)) || (pickupFeeMWK !== null && (!isDatabaseAmount(pickupFeeMWK, 0)))) throw new Error("Check the departure date, time, location and fare.");
  const departureAt = parseMalawiDeparture(date, time);
  if (!departureAt || departureAt <= new Date()) throw new Error("Only valid future departures can be edited.");
  const trip = await prisma.trip.findFirst({ where: { id: tripId, ...(session.user.role === "ADMIN" ? {} : { operator: { ownerId: session.user.id, active: true, verified: true } }) }, include: { operator: true } });
  if (!trip) throw new Error("Trip not found or your operator profile is not approved.");
  if (trip.scheduleId) throw new Error("Edit this bus through its Daily Bus Schedule.");
  const dayRangeForTrip = dayRange(date);
  if (!dayRangeForTrip) throw new Error("Departure must be a valid calendar date.");
  const pointData = { city: origin, name: departureName, kind: trip.type === "BUS" ? "STATION" as const : "STAGE" as const, operatorId: trip.type === "BUS" ? trip.operatorId : null };
  await prisma.$transaction(async (tx) => {
    if (await tx.booking.count({ where: { tripId } })) throw new Error("This trip has booking history. Its schedule is locked to protect passengers; contact support to resolve it.");
    if (trip.type === "TAXI" && await tx.trip.findFirst({ where: { id: { not: trip.id }, vehicleId: trip.vehicleId, departureAt: { gte: dayRangeForTrip.start, lt: dayRangeForTrip.end } }, select: { id: true } })) {
      throw new Error("This taxi already has a trip on that day.");
    }
    const pointUsers = await tx.trip.count({ where: { departurePointId: trip.departurePointId } }) + await tx.busSchedule.count({ where: { departurePointId: trip.departurePointId } });
    const point = pointUsers === 1
      ? await tx.departurePoint.update({ where: { id: trip.departurePointId }, data: pointData })
      : await tx.departurePoint.create({ data: pointData });
    await tx.trip.update({ where: { id: trip.id }, data: { origin: origin, destination: destination, departureAt, departurePointId: point.id, fareMWK, pickupAvailable, pickupFeeMWK } });
  }, { isolationLevel: "Serializable" });
  updateTag("public-trips");
  revalidatePath("/operator");
  revalidatePath(`/operator/trips/${tripId}`);
  revalidatePath("/transport");
  revalidatePath("/");
}

export async function deleteTripScheduleAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["OWNER", "ADMIN"].includes(session.user.role)) throw new Error("Operator access required.");
  const tripId = String(formData.get("tripId") ?? "");
  const trip = await prisma.trip.findFirst({ where: { id: tripId, ...(session.user.role === "ADMIN" ? {} : { operator: { ownerId: session.user.id } }) }, include: { _count: { select: { bookings: true } } } });
  if (!trip) throw new Error("Trip not found.");
  if (trip.scheduleId) throw new Error("Pause this bus through its Daily Bus Schedule instead of deleting a daily departure.");
  if (trip._count.bookings) throw new Error("This trip has booking history and cannot be deleted. Contact passengers and support to cancel it safely.");
  await prisma.trip.delete({ where: { id: tripId } });
  updateTag("public-trips");
  revalidatePath("/operator");
  revalidatePath("/admin");
  revalidatePath("/transport");
  revalidatePath("/");
}

export async function archiveBookingHistoryAction() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "CUSTOMER") throw new Error("Passenger access required.");
  await prisma.booking.updateMany({
    where: { userId: session.user.id, archivedAt: null, status: { in: ["DECLINED", "CANCELLED", "COMPLETED"] } },
    data: { archivedAt: new Date() },
  });
  revalidatePath("/account");
}

export type GuestLookupState = { error: string | null };

export async function lookupGuestBookingAction(_previous: GuestLookupState, formData: FormData): Promise<GuestLookupState> {
  const reference = normalizeBookingReference(String(formData.get("reference") ?? ""));
  const phone = normalizeMalawiPhone(String(formData.get("phone") ?? ""));
  if (!reference) return { error: "Enter the 8-character reference from your booking confirmation. Uppercase and lowercase both work." };
  if (!phone) return { error: "Enter the mobile number used to book, such as 0993 661 661, 993661661, 265993661661 or +265 993 661 661." };
  if (!(await allowRequest("guest-booking-lookup", 5, 15 * 60 * 1000))) {
    return { error: "Too many lookup attempts. Wait 15 minutes before trying again." };
  }
  const booking = await prisma.booking.findFirst({
    where: { id: { endsWith: reference, mode: "insensitive" }, guestPhone: phone, userId: null },
    select: { id: true },
  });
  if (!booking) return { error: "We could not match that reference and mobile number to a guest booking. If you booked while signed in, open My bookings in your account." };
  const token = randomBytes(32).toString("base64url");
  await prisma.booking.update({ where: { id: booking.id }, data: { guestAccessTokenHash: hashGuestToken(token), guestAccessTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  redirect(`/bookings/${booking.id}/chat?token=${encodeURIComponent(token)}`);
}

export async function sendBookingMessageAction(formData: FormData): Promise<never> {
  const session = await getSession();
  const bookingId = String(formData.get("bookingId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const guestToken = String(formData.get("guestToken") ?? "");
  if (!bookingId || bookingId.length > 64 || body.length < 1 || body.length > 1000) throw new Error("Enter a message up to 1,000 characters.");
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      guestName: true,
      guestEmail: true,
      guestAccessTokenHash: true,
      guestAccessTokenExpiresAt: true,
      user: { select: { id: true, name: true, email: true } },
      trip: {
        select: {
          origin: true,
          destination: true,
          operatorId: true,
          operator: { select: { ownerId: true, owner: { select: { id: true, name: true, email: true } } } },
        },
      }, tripHistory: {
        select: {
          origin: true,
          destination: true,
          operatorId: true,
          operator: { select: { ownerId: true, owner: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  }).then((row) => row ? withTripHistory(row) : null);
  if (!booking) redirect(session ? "/account" : "/bookings/lookup");
  const guestAuthorized = Boolean(booking.userId === null && booking.guestAccessTokenExpiresAt && booking.guestAccessTokenExpiresAt > new Date() && matchesGuestToken(guestToken, booking.guestAccessTokenHash));
  if (!session?.user?.id && !guestAuthorized) redirect("/bookings/lookup");
  const isPassenger = Boolean(session?.user?.id && booking.userId === session.user.id);
  const companyMember = session?.user?.id ? await prisma.operatorMember.findUnique({ where: { operatorId_userId: { operatorId: booking.trip.operatorId, userId: session.user.id } }, select: { id: true } }) : null;
  const isOperator = Boolean(session?.user?.id && booking.trip.operator.ownerId === session.user.id && session.user.role === "OWNER") || Boolean(companyMember);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isPassenger && !isOperator && !isAdmin && !guestAuthorized) redirect(session ? "/account" : "/bookings/lookup");

  const chatPath = `/bookings/${bookingId}/chat`;
  const guestChatPath = `${chatPath}?token=${encodeURIComponent(guestToken)}`;
  if (!(await allowRequest("booking-message", 30, 10 * 60 * 1000))) {
    redirect(`${guestAuthorized ? guestChatPath : chatPath}${guestAuthorized ? "&" : "?"}notice=rate-limit`);
  }

  const senderName = guestAuthorized ? booking.guestName ?? "Passenger" : session?.user?.name ?? "Passenger";
  await prisma.bookingMessage.create({ data: { bookingId, senderId: guestAuthorized ? null : session?.user?.id ?? null, guestSenderName: guestAuthorized ? senderName : null, body } });
  const recipient = isPassenger
    ? booking.trip.operator.owner?.email ?? process.env.BOARD95_ADMIN_EMAIL
    : guestAuthorized ? booking.trip.operator.owner?.email : booking.guestEmail ?? booking.user?.email;
  const recipientName = isPassenger || guestAuthorized ? booking.trip.operator.owner?.name ?? "the service team" : booking.guestName ?? booking.user?.name ?? "Passenger";
  await sendBoard95Email({
    to: recipient,
    subject: "New message about your booking",
    lines: [`${senderName} sent a message about ${transportLocationName(booking.trip.origin)} to ${transportLocationName(booking.trip.destination)}.`, body],
    action: {
      label: `Reply to ${recipientName}`,
      href: board95Url(booking.userId === null && !guestAuthorized
        ? "/bookings/lookup"
        : `/sign-in?next=${encodeURIComponent(chatPath)}`),
    },
  });
  revalidatePath(chatPath);
  revalidatePath("/account");
  revalidatePath("/operator");
  redirect(guestAuthorized ? guestChatPath : chatPath);
}

export async function createOperatorTripAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Operator access required.");
  const operatorId = String(formData.get("operatorId") ?? "");
  const companyMembership = session.user.role === "CUSTOMER" ? await prisma.operatorMember.findUnique({ where: { operatorId_userId: { operatorId, userId: session.user.id } }, select: { role: true, operator: { select: { kind: true } } } }) : null;
  if (!["OWNER", "ADMIN"].includes(session.user.role) && (companyMembership?.role !== "ADMIN" || companyMembership.operator.kind !== "BUS_COMPANY")) throw new Error("Only a bus company administrator can publish trips.");

  const name = String(formData.get("vehicleModel") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim().toUpperCase();
  const seats = Number(formData.get("seats"));
  const origin = parseTransportLocation(String(formData.get("origin") ?? ""));
  const destination = parseTransportLocation(String(formData.get("destination") ?? ""));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const departureName = String(formData.get("departurePoint") ?? "").trim();
  const fareMWK = Number(formData.get("fareMWK"));
  const pickupAvailable = formData.get("pickupAvailable") === "on";
  const pickupFeeMWK = pickupAvailable ? Number(formData.get("pickupFeeMWK") ?? 0) : null;
  if (!operatorId || operatorId.length > 64 || name.length < 2 || name.length > 80 || !/^[A-Z0-9 -]{3,20}$/.test(plate)) throw new Error("Enter a valid operator, vehicle model and plate.");
  if (!Number.isSafeInteger(seats) || seats < 1 || seats > 100 || !origin || !destination || origin === destination) throw new Error("Check the route and seat count.");
  if (departureName.length < 2 || departureName.length > 100 || !isDatabaseAmount(fareMWK) || !isDatabaseAmount(fareMWK + (pickupFeeMWK ?? 0)) || (pickupFeeMWK !== null && (!isDatabaseAmount(pickupFeeMWK, 0)))) throw new Error("Check the departure date, time, location and fare.");
  const departureAt = parseMalawiDeparture(date, time);
  if (!departureAt || departureAt <= new Date()) throw new Error("Departure must be a valid future date and time.");

  const operator = await prisma.operator.findFirst({ where: { id: operatorId, ...(session.user.role === "ADMIN" ? {} : session.user.role === "OWNER" ? { ownerId: session.user.id } : { members: { some: { userId: session.user.id, role: "ADMIN" } } }), active: true, verified: true } });
  if (!operator) throw new Error("This operator has not been approved or is inactive.");
  const city = origin;
  const dayRangeForTrip = dayRange(date);
  if (!dayRangeForTrip) throw new Error("Departure must be a valid calendar date.");
  // Keep vehicle, departure point, and trip creation atomic. Serializable isolation
  // also prevents concurrent requests from bypassing the taxi-per-day check.
  await prisma.$transaction(async (tx) => {
    let vehicle = await tx.vehicle.findUnique({ where: { plate } });
    if (vehicle && vehicle.operatorId !== operator.id) throw new Error("That plate number belongs to a different operator.");
    if (!vehicle) {
      vehicle = await tx.vehicle.create({ data: { operatorId: operator.id, model: name, plate, seats } });
    }

    if (operator.kind === "TAXI_OWNER" && await tx.trip.findFirst({ where: { vehicleId: vehicle.id, departureAt: { gte: dayRangeForTrip.start, lt: dayRangeForTrip.end } }, select: { id: true } })) {
      throw new Error("This taxi already has a trip scheduled for that day. The limit is one taxi trip per vehicle per day.");
    }

    const point = await tx.departurePoint.create({ data: { city, name: departureName, kind: operator.kind === "BUS_COMPANY" ? "STATION" : "STAGE", operatorId: operator.kind === "BUS_COMPANY" ? operator.id : null } });
    await tx.trip.create({ data: {
      operatorId: operator.id,
      vehicleId: vehicle.id,
      departurePointId: point.id,
      type: operator.kind === "BUS_COMPANY" ? "BUS" : "TAXI",
      origin: city,
      destination: destination,
      departureAt,
      fareMWK,
      seatsTotal: vehicle.seats,
      seatsAvailable: vehicle.seats,
      pickupAvailable,
      pickupFeeMWK,
    } });
  }, { isolationLevel: "Serializable" });
  updateTag("public-trips");
  revalidatePath("/operator");
  revalidatePath("/transport");
  revalidatePath("/");
}

export async function createCarHireListingAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "CAR_HIRER") throw new Error("Car-hirer access required.");
  const name = String(formData.get("name") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const vehicleType = String(formData.get("vehicleType") ?? "");
  const contactPhone = normalizeMalawiPhone(String(formData.get("contactPhone") ?? ""));
  const rawLorryCapacity = String(formData.get("lorryCapacityTons") ?? "").trim();
  const lorryCapacityTons = rawLorryCapacity ? Number(rawLorryCapacity) : null;
  const district = String(formData.get("district") ?? "");
  const rate = Number(formData.get("dailyRateMWK"));
  const description = String(formData.get("description") ?? "").trim();
  const photo = formData.get("photo");
  if (name.length < 2 || name.length > 80 || model.length < 2 || model.length > 80) throw new Error("Enter a valid vehicle name and model.");
  if (!["SALOON", "SUV", "PICKUP", "MINIBUS", "BUS", "TRUCK", "LORRY", "VAN", "OTHER"].includes(vehicleType) || !contactPhone) throw new Error("Choose a vehicle type and enter a valid Malawi contact number.");
  if (vehicleType === "LORRY" && (!Number.isSafeInteger(lorryCapacityTons) || (lorryCapacityTons ?? 0) < 1 || (lorryCapacityTons ?? 0) > 100)) throw new Error("Enter the lorry capacity in tons (1–100).");
  if (!CAR_HIRE_DISTRICTS.some(([value]) => value === district) || !isDatabaseAmount(rate)) throw new Error("Choose a valid district and enter a daily rate.");
  const image = await readCarPhoto(photo);
  const storedPhoto = await storeCarPhoto(image.bytes, image.extension);
  try {
    await prisma.carHireListing.create({ data: { ownerId: session.user.id, expiresAt: carHireExpiry(), name, model, vehicleType: vehicleType as "SALOON" | "SUV" | "PICKUP" | "MINIBUS" | "BUS" | "TRUCK" | "LORRY" | "VAN" | "OTHER", lorryCapacityTons: vehicleType === "LORRY" ? lorryCapacityTons : null, contactPhone, district: district as CarHireDistrictCode, dailyRateMWK: rate, description: description.slice(0, 500) || null, photoUrl: storedPhoto.url } });
  } catch (error) {
    await storedPhoto.cleanup();
    throw error;
  }
  revalidatePath("/car-hire");
  revalidatePath("/car-hire/dashboard");
}

export async function updateCarHireListingAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["CAR_HIRER", "ADMIN"].includes(session.user.role)) throw new Error("Car-hirer access required.");
  const id = String(formData.get("listingId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const vehicleType = String(formData.get("vehicleType") ?? "");
  const contactPhone = normalizeMalawiPhone(String(formData.get("contactPhone") ?? ""));
  const rawLorryCapacity = String(formData.get("lorryCapacityTons") ?? "").trim();
  const lorryCapacityTons = rawLorryCapacity ? Number(rawLorryCapacity) : null;
  const district = String(formData.get("district") ?? "");
  const rate = Number(formData.get("dailyRateMWK"));
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 2 || name.length > 80 || model.length < 2 || model.length > 80) throw new Error("Enter a valid vehicle name and model.");
  if (!["SALOON", "SUV", "PICKUP", "MINIBUS", "BUS", "TRUCK", "LORRY", "VAN", "OTHER"].includes(vehicleType) || !contactPhone) throw new Error("Choose a vehicle type and enter a valid Malawi contact number.");
  if (vehicleType === "LORRY" && (!Number.isSafeInteger(lorryCapacityTons) || (lorryCapacityTons ?? 0) < 1 || (lorryCapacityTons ?? 0) > 100)) throw new Error("Enter the lorry capacity in tons (1–100).");
  if (!CAR_HIRE_DISTRICTS.some(([value]) => value === district) || !isDatabaseAmount(rate)) throw new Error("Choose a valid district and enter a daily rate.");
  const listing = await prisma.carHireListing.findFirst({ where: { id, ...(session.user.role === "ADMIN" ? {} : { ownerId: session.user.id }) } });
  if (!listing || listing.expiresAt <= new Date()) throw new Error("Vehicle listing has expired or was not found. Check Old listings.");
  const photoValue = formData.get("photo");
  let storedPhoto: Awaited<ReturnType<typeof storeCarPhoto>> | null = null;
  if (photoValue instanceof File && photoValue.size > 0) {
    const image = await readCarPhoto(photoValue);
    storedPhoto = await storeCarPhoto(image.bytes, image.extension);
  }
  try {
    await prisma.carHireListing.update({ where: { id }, data: { name, model, vehicleType: vehicleType as "SALOON" | "SUV" | "PICKUP" | "MINIBUS" | "BUS" | "TRUCK" | "LORRY" | "VAN" | "OTHER", lorryCapacityTons: vehicleType === "LORRY" ? lorryCapacityTons : null, contactPhone, district: district as CarHireDistrictCode, dailyRateMWK: rate, description: description.slice(0, 500) || null, ...(storedPhoto ? { photoUrl: storedPhoto.url } : {}) } });
  } catch (error) {
    if (storedPhoto) await storedPhoto.cleanup();
    throw error;
  }
  if (storedPhoto) await removeCarPhoto(listing.photoUrl).catch(() => undefined);
  revalidatePath("/car-hire");
  revalidatePath(`/car-hire/${id}`);
  revalidatePath("/car-hire/dashboard");
  revalidatePath("/admin");
}

export async function deleteCarHireListingAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["CAR_HIRER", "ADMIN"].includes(session.user.role)) throw new Error("Car-hirer access required.");
  const id = String(formData.get("listingId") ?? "");
  const listing = await prisma.carHireListing.findFirst({ where: { id, ...(session.user.role === "ADMIN" ? {} : { ownerId: session.user.id }) }, include: { _count: { select: { requests: true } } } });
  if (!listing) throw new Error("Vehicle listing not found.");
  if (listing._count.requests) throw new Error("This listing has rental request history. Unlist it to preserve those records.");
  await prisma.carHireListing.delete({ where: { id } });
  await removeCarPhoto(listing.photoUrl).catch(() => undefined);
  revalidatePath("/car-hire");
  revalidatePath("/car-hire/dashboard");
  revalidatePath("/admin");
}

export type CarHireRequestState = { guestChatUrl?: string; status: "idle" | "success" | "error"; message: string; reference?: string; totalMWK?: number };

type CarHireRequestOutcome =
  | { kind: "unavailable" | "self-request" | "invalid-total" | "conflict" }
  | { kind: "created"; request: { id: string }; listing: { name: string; owner: { name: string; email: string } }; totalMWK: number };

export async function requestCarHireAction(_previous: CarHireRequestState, formData: FormData): Promise<CarHireRequestState> {
  const session = await getSession();
  if (!canBrowseListings(session?.user)) return { status: "error", message: "Provider accounts can only preview their own listings. Use a passenger account to request a vehicle." };
  if (!(await allowRequest("car-hire-request", 8, 10 * 60 * 1000))) return { status: "error", message: "Too many requests. Wait a few minutes and try again." };
  const listingId = String(formData.get("listingId") ?? "");
  const guestName = String(formData.get("guestName") ?? session?.user?.name ?? "").trim();
  const phone = normalizeMalawiPhone(String(formData.get("phone") ?? session?.user?.phone ?? ""));
  const guestEmail = String(formData.get("email") ?? session?.user?.email ?? "").trim().toLowerCase();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  if (guestName.length < 2 || guestName.length > 100 || !phone) return { status: "error", message: "Enter your name and a valid Malawi mobile number." };
  if (guestEmail && (guestEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))) return { status: "error", message: "Enter a valid email address or leave it blank." };
  const startRange = dayRange(startDate);
  const endRange = dayRange(endDate);
  if (!startRange || !endRange) return { status: "error", message: "Choose real calendar dates for pickup and return." };
  const startsAt = startRange.start;
  const endsAt = endRange.start;
  const today = toMalawiDate(new Date());
  const days = Math.round((endsAt.getTime() - startsAt.getTime()) / 86400000);
  if (startDate < today || days < 1 || days > 60) return { status: "error", message: "Choose a rental period starting today or later, from 1 to 60 days." };
  const rentalToken = !session ? randomBytes(32).toString("base64url") : null;
  let outcome: CarHireRequestOutcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const listing = await tx.carHireListing.findFirst({
        where: { id: listingId, available: true, expiresAt: { gt: new Date() }, owner: { active: true } },
        select: { id: true, ownerId: true, name: true, dailyRateMWK: true, owner: { select: { name: true, email: true } } },
      });
      if (!listing) return { kind: "unavailable" as const };
      if (session?.user?.id === listing.ownerId) return { kind: "self-request" as const };
      const totalMWK = listing.dailyRateMWK * days;
      if (!isDatabaseAmount(totalMWK)) return { kind: "invalid-total" as const };
      const conflict = await tx.carHireRequest.findFirst({ where: { listingId, status: "ACCEPTED", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
      if (conflict) return { kind: "conflict" as const };
      const request = await tx.carHireRequest.create({ data: { listingId, guestAccessTokenHash: rentalToken ? hashGuestToken(rentalToken) : null, guestAccessTokenExpiresAt: rentalToken ? new Date(endsAt.getTime() + 30 * 86400000) : null, whatsappUpdates: formData.get("whatsappUpdates") === "on", passengerId: session?.user?.id ?? null, guestName, guestPhone: phone, guestEmail: guestEmail || null, startsAt, endsAt, totalMWK } });
      await queueMobile(`rental:${request.id}:received`, phone, `Board95 rental request received. Reference ${request.id.slice(-8).toUpperCase()}. Pending owner confirmation. Recover at ${board95Url("/bookings/lookup")}`, formData.get("whatsappUpdates") === "on", undefined, tx);
      return { kind: "created" as const, request, listing, totalMWK };
    }, { isolationLevel: "Serializable" });
  } catch {
    return { status: "error", message: "We could not save the request. Refresh and try again." };
  }
  if (outcome.kind !== "created") {
    const messages = {
      unavailable: "This vehicle is no longer available.",
      "self-request": "You cannot request your own vehicle.",
      "invalid-total": "This rental total is outside the supported range.",
      conflict: "Those dates have just been taken. Choose another period.",
    } as const;
    return { status: "error", message: messages[outcome.kind] };
  }
  const { request, listing, totalMWK } = outcome;
  const reference = request.id.slice(-8).toUpperCase();
  await Promise.all([
    sendBoard95Email({ to: listing.owner.email, subject: "New car-hire request", lines: [`${guestName} requested ${listing.name}.`, `Dates: ${startDate} to ${endDate} (${days} days).`, `Estimated total: MWK ${totalMWK}. Reference: ${reference}.`], action: { label: "Review request", href: board95Url("/car-hire/dashboard") } }),
    sendBoard95Email({ to: guestEmail || undefined, subject: "Car-hire request received", lines: [`Your request for ${listing.name} is pending the owner's response.`, `Dates: ${startDate} to ${endDate}. Estimated total: MWK ${totalMWK}. Reference: ${reference}.`] }),
  ]);
  revalidatePath("/car-hire/dashboard");
  revalidatePath("/account");
  return { status: "success", message: `Your request was sent to ${listing.owner.name}.`, reference, totalMWK, guestChatUrl: `/rentals/${request.id}${rentalToken ? `?token=${rentalToken}` : ""}` };
}

export async function reviewCarHireRequestAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["CAR_HIRER", "ADMIN"].includes(session.user.role)) throw new Error("Car-hire owner access required.");
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!requestId || !["ACCEPTED", "DECLINED"].includes(decision)) throw new Error("Invalid rental request decision.");
  const request = await prisma.$transaction(async (tx) => {
    const request = await tx.carHireRequest.findFirst({ where: { id: requestId, ...(session.user.role === "ADMIN" ? {} : { OR: [{ listing: { ownerId: session.user.id } }, { listingHistory: { ownerId: session.user.id } }] }) }, include: { listing: { include: { owner: true } }, listingHistory: { include: { owner: true } }, passenger: { select: { email: true } } } }).then((row) => row ? withListingHistory(row) : null);
    if (!request || request.status !== "PENDING") throw new Error("This rental request is no longer pending.");
    if (decision === "ACCEPTED") {
      const conflict = await tx.carHireRequest.findFirst({ where: { id: { not: request.id }, ...(request.listingId ? { listingId: request.listingId } : { listingHistoryId: request.listingHistoryId }), status: "ACCEPTED", startsAt: { lt: request.endsAt }, endsAt: { gt: request.startsAt } }, select: { id: true } });
      if (conflict) throw new Error("Another rental request already holds some of these dates.");
    }
    const updated = await tx.carHireRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: decision as "ACCEPTED" | "DECLINED", reviewedByAdmin: session.user.role === "ADMIN" } });
    if (updated.count !== 1) throw new Error("This rental request has already been reviewed.");
    await queueMobile(`rental:${request.id}:${decision}`, request.guestPhone, `Board95 rental ${decision.toLowerCase()}. Reference ${request.id.slice(-8).toUpperCase()}. Details: ${board95Url("/bookings/lookup")}`, request.whatsappUpdates, undefined, tx);
    return request;
  }, { isolationLevel: "Serializable" });
  await sendBoard95Email({ to: request.guestEmail ?? request.passenger?.email, subject: decision === "ACCEPTED" ? "Your car-hire request was accepted" : "Your car-hire request was declined", lines: [`${request.listing.owner.name} ${decision === "ACCEPTED" ? "accepted" : "declined"} your request for ${request.listing.name}.`, `Estimated total: MWK ${request.totalMWK}.`, ...(session.user.role === "ADMIN" ? ["This decision was made by a Board95 administrator."] : [])] });
  revalidatePath("/car-hire/dashboard");
  revalidatePath("/account");
}

export async function cancelCarHireRequestAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Sign in to manage your rental request.");
  const requestId = String(formData.get("requestId") ?? "");
  const request = await prisma.carHireRequest.findFirst({ where: { id: requestId, passengerId: session.user.id, status: { in: ["PENDING", "ACCEPTED"] } }, include: { listing: { include: { owner: { select: { email: true, name: true } } } }, listingHistory: { include: { owner: { select: { email: true, name: true } } } } } }).then((row) => row ? withListingHistory(row) : null);
  if (!request || request.startsAt <= new Date()) throw new Error("Only future rental requests can be cancelled.");
  const cancelled = await prisma.carHireRequest.updateMany({ where: { id: request.id, passengerId: session.user.id, status: request.status }, data: { status: "CANCELLED" } });
  if (cancelled.count !== 1) throw new Error("This rental request has already changed.");
  await queueMobile(`rental:${request.id}:cancelled`, request.guestPhone, `Board95 rental cancelled. Reference ${request.id.slice(-8).toUpperCase()}.`, request.whatsappUpdates);
  await sendBoard95Email({ to: request.listing.owner.email, subject: "Car-hire request cancelled", lines: [`${request.guestName} cancelled the request for ${request.listing.name}.`, `Dates: ${toMalawiDate(request.startsAt)} to ${toMalawiDate(request.endsAt)}.`] });
  revalidatePath("/account");
  revalidatePath("/car-hire/dashboard");
}

async function readCarPhoto(photo: FormDataEntryValue | null) {
  if (!(photo instanceof File) || photo.size < 1 || photo.size > 750 * 1024) throw new Error("Upload one car photo under 750 KB.");
  const bytes = Buffer.from(await photo.arrayBuffer());
  const extension = getCarPhotoExtension(bytes);
  if (!extension || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error("Use a valid JPEG, PNG or WebP car photo.");
  return { bytes, extension };
}

function getCarPhotoExtension(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function toggleCarHireListingAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["CAR_HIRER", "ADMIN"].includes(session.user.role)) throw new Error("Car-hirer access required.");
  const id = String(formData.get("listingId") ?? "");
  const availableValue = formData.get("available");
  if (availableValue !== "true" && availableValue !== "false") throw new Error("Invalid listing status.");
  const available = availableValue === "true";
  if (!id || id.length > 64) throw new Error("Invalid vehicle listing.");
  const result = await prisma.carHireListing.updateMany({ where: { id, expiresAt: { gt: new Date() }, ...(session.user.role === "ADMIN" ? {} : { ownerId: session.user.id }) }, data: { available } });
  if (result.count !== 1) throw new Error("Listing not found.");
  revalidatePath("/admin");
  revalidatePath("/car-hire");
  revalidatePath("/car-hire/dashboard");
}

export async function renewCarHireListingAction(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !["CAR_HIRER", "ADMIN"].includes(session.user.role)) throw new Error("Car-hirer access required.");
  const id = String(formData.get("listingId") ?? "");
  if (!id || id.length > 64) throw new Error("Invalid vehicle listing.");
  const now = new Date();
  const result = await prisma.carHireListing.updateMany({
    where: { id, expiresAt: { gt: now }, ...(session.user.role === "ADMIN" ? {} : { ownerId: session.user.id }) },
    data: { renewedAt: now, expiresAt: carHireExpiry(now) },
  });
  if (result.count !== 1) throw new Error("This listing has expired or was not found. Check Old listings and publish a new listing.");
  revalidatePath("/car-hire/dashboard");
  revalidatePath(`/car-hire/dashboard/${id}`);
  revalidatePath("/car-hire");
  revalidatePath("/admin");
}
