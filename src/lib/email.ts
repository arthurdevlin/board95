import { prisma } from "@/lib/prisma";

type Board95Email = {
  to: string | null | undefined;
  subject: string;
  lines: string[];
  action?: { label: string; href: string };
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendBoard95Email({ to, subject, lines, action }: Board95Email) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!to) return false;

  let deliveryId: string;
  try {
    const delivery = await prisma.emailDelivery.create({ data: { recipient: to, subject, lines, action: action ?? undefined } });
    deliveryId = delivery.id;
  } catch {
    console.error("Board95 could not queue an email; the related operation was saved.");
    return false;
  }
  if (!apiKey || !from) return false;
  return deliverEmail(deliveryId, { to, subject, lines, action }, apiKey, from);
}

export async function deliverEmailDelivery(deliveryId: string) {
  const delivery = await prisma.emailDelivery.findUnique({ where: { id: deliveryId } });
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (delivery?.status === "SENT") return true;
  if (!delivery || !apiKey || !from) return false;
  const action = delivery.action as { label: string; href: string } | null;
  const lines = delivery.lines as string[];
  return deliverEmail(delivery.id, { to: delivery.recipient, subject: delivery.subject, lines, action: action ?? undefined }, apiKey, from);
}

async function deliverEmail(deliveryId: string, email: Board95Email, apiKey: string, from: string) {
  const { to, subject, lines, action } = email;
  const actionHtml = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.href)}" style="display:inline-block;background:#173e78;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">${escapeHtml(action.label)}</a></p>`
    : "";
  const html = `<div style="font-family:Arial,sans-serif;color:#172a43;line-height:1.6;max-width:560px;margin:auto"><p style="font-weight:700;color:#173e78">BOARD95</p><h1 style="font-size:22px">${escapeHtml(subject)}</h1>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}${actionHtml}<p style="border-top:1px solid #d8e1ed;padding-top:14px;color:#596c83;font-size:12px">This message relates to a Board95 booking. Replies to this email are not monitored.</p></div>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `board95-email/${deliveryId}` },
      body: JSON.stringify({ from, to: [to], subject: `Board95: ${subject}`, html, text: lines.join("\n\n") }),
      signal: AbortSignal.timeout(5000),
    });
    await prisma.emailDelivery.update({ where: { id: deliveryId }, data: { attempts: { increment: 1 }, status: response.ok ? "SENT" : "FAILED", lastError: response.ok ? null : `Resend HTTP ${response.status}`, sentAt: response.ok ? new Date() : null } }).catch(() => {
      console.error("Board95 could not update the email delivery status.");
    });
    if (!response.ok) console.error(`Board95 email delivery failed (HTTP ${response.status}).`);
    return response.ok;
  } catch {
    await prisma.emailDelivery.update({ where: { id: deliveryId }, data: { attempts: { increment: 1 }, status: "FAILED", lastError: "Delivery request failed." } }).catch(() => undefined);
    console.error("Board95 email delivery failed; the booking operation was saved.");
    return false;
  }
}

export function board95Url(path: string) {
  return new URL(path, process.env.BETTER_AUTH_URL ?? "http://localhost:3000").toString();
}
