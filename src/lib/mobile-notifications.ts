import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeMalawiPhone } from "@/lib/guest-access";

export async function queueMobile(eventKey: string, phone: string | null | undefined, body: string, whatsappUpdates = false, expiresAt = new Date(Date.now() + 86400000), db: Pick<Prisma.TransactionClient, "mobileNotification"> = prisma) {
  const normalized = normalizeMalawiPhone(phone ?? "");
  if (!normalized) return;
  await db.mobileNotification.upsert({ where: { eventKey }, update: {}, create: { eventKey, phone: normalized, body, whatsappUpdates, expiresAt } });
}

export async function processMobileNotifications() {
  const sid = process.env.TWILIO_ACCOUNT_SID; const secret = process.env.TWILIO_AUTH_TOKEN; const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !secret || !from) return { configured: false, processed: 0 };
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages`;
  const authorization = `Basic ${Buffer.from(`${sid}:${secret}`).toString("base64")}`;
  await prisma.mobileNotification.updateMany({ where: { status: { in: ["QUEUED", "WA_QUEUED"] }, expiresAt: { lte: new Date() } }, data: { status: "EXPIRED" } });
  const pending = await prisma.mobileNotification.findMany({ where: { status: { in: ["QUEUED", "SMS_PENDING", "WA_QUEUED", "WA_PENDING"] } }, orderBy: { createdAt: "asc" }, take: 10 });
  for (const notification of pending) {
    if (notification.providerSid && ["SMS_PENDING", "WA_PENDING"].includes(notification.status)) {
      try {
        const response = await fetch(`${endpoint}/${encodeURIComponent(notification.providerSid)}.json`, { headers: { Authorization: authorization }, signal: AbortSignal.timeout(10000), cache: "no-store" });
        if (!response.ok) continue;
        const message = await response.json();
        const status = ["delivered", "read"].includes(message.status) ? "DELIVERED" : ["failed", "undelivered", "canceled"].includes(message.status) ? notification.status === "SMS_PENDING" && notification.whatsappUpdates ? "WA_QUEUED" : "FAILED" : null;
        if (status) await prisma.mobileNotification.updateMany({ where: { id: notification.id, status: notification.status }, data: { status } });
      } catch { /* Keep pending; the next scheduled worker polls again. */ }
      continue;
    }
    const whatsapp = notification.status === "WA_QUEUED";
    if (whatsapp && (!process.env.TWILIO_WHATSAPP_FROM || !process.env.TWILIO_WHATSAPP_CONTENT_SID)) continue;
    const claimed = await prisma.mobileNotification.updateMany({ where: { id: notification.id, status: notification.status }, data: { status: "SENDING" } });
    if (!claimed.count) continue;
    const params = new URLSearchParams(whatsapp ? { To: `whatsapp:${notification.phone}`, From: process.env.TWILIO_WHATSAPP_FROM!, ContentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID!, ContentVariables: JSON.stringify({ "1": notification.body }) } : { To: notification.phone, From: from, Body: notification.body });
    try {
      const response = await fetch(`${endpoint}.json`, { method: "POST", headers: { Authorization: authorization, "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        // Ambiguous provider/server failures must not cause duplicate paid sends.
        const status = response.status >= 500 || response.status === 429 ? "UNKNOWN" : !whatsapp && notification.whatsappUpdates ? "WA_QUEUED" : "FAILED";
        await prisma.mobileNotification.update({ where: { id: notification.id }, data: { status } });
        continue;
      }
      const message = await response.json();
      if (typeof message.sid !== "string") throw new Error("Missing provider message ID");
      await prisma.mobileNotification.update({ where: { id: notification.id }, data: { providerSid: message.sid, status: whatsapp ? "WA_PENDING" : "SMS_PENDING" } });
    } catch { await prisma.mobileNotification.updateMany({ where: { id: notification.id, status: "SENDING" }, data: { status: "UNKNOWN" } }); }
  }
  return { configured: true, processed: pending.length };
}

export async function queueDepartureReminders(now = new Date()) {
  const until = new Date(now.getTime() + 60 * 60 * 1000);
  const bookings = await prisma.booking.findMany({ where: { status: "ACCEPTED", trip: { cancelled: false, departureAt: { gt: now, lte: until } } }, select: { id: true, guestPhone: true, whatsappUpdates: true, trip: { select: { departureAt: true } } }, take: 500 });
  for (const booking of bookings) await queueMobile(`trip:${booking.id}:reminder`, booking.guestPhone, `Board95: your confirmed trip departs within an hour. Reference ${booking.id.slice(-8).toUpperCase()}. Check your booking for the stage and departure time.`, booking.whatsappUpdates, booking.trip!.departureAt);
  const rentals = await prisma.carHireRequest.findMany({ where: { status: "ACCEPTED", startsAt: { gt: now, lte: until } }, select: { id: true, guestPhone: true, whatsappUpdates: true, startsAt: true }, take: 500 });
  for (const rental of rentals) await queueMobile(`rental:${rental.id}:reminder`, rental.guestPhone, `Board95: your confirmed rental starts within an hour. Reference ${rental.id.slice(-8).toUpperCase()}. Confirm collection arrangements with the owner.`, rental.whatsappUpdates, rental.startsAt);
}
