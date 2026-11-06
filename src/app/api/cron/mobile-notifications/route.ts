import { timingSafeEqual } from "node:crypto";
import { processMobileNotifications, queueDepartureReminders } from "@/lib/mobile-notifications";
export const maxDuration = 300;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Scheduler not configured", { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") ?? ""); const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });
  await queueDepartureReminders();
  const result = await processMobileNotifications();
  return Response.json(result, { status: result.configured ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
