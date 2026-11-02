import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function allowRequest(scope: string, limit: number, windowMs: number) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-real-ip")
    ?? "local-unknown";
  const keyHash = createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "board95-local-rate-limit")
    .update(`${scope}:${ip}`)
    .digest("hex");
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const bucket = await prisma.rateLimitBucket.findUnique({ where: { keyHash } });
    if (!bucket) {
      try {
        await prisma.rateLimitBucket.create({ data: { keyHash, attempts: 1, resetAt } });
        return true;
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error;
        continue;
      }
    }
    if (bucket.resetAt <= now) {
      const reset = await prisma.rateLimitBucket.updateMany({ where: { keyHash, resetAt: bucket.resetAt }, data: { attempts: 1, resetAt } });
      if (reset.count === 1) return true;
      continue;
    }
    const updated = await prisma.rateLimitBucket.updateMany({ where: { keyHash, resetAt: bucket.resetAt, attempts: { lt: limit } }, data: { attempts: { increment: 1 } } });
    return updated.count === 1;
  }
  return false;
}
