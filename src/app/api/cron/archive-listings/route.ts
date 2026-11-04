import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { archiveExpiredListings } from "@/lib/archive-listings";

export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Cleanup scheduler is not configured.", { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });
  const counts = await archiveExpiredListings();
  revalidateTag("public-trips", "max");
  for (const path of ["/operator", "/car-hire", "/car-hire/dashboard", "/account", "/admin"]) revalidatePath(path);
  return Response.json(counts, { headers: { "Cache-Control": "no-store" } });
}
