import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Run periodically using your deployment scheduler. Active buckets are untouched.
async function main() {
  const result = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  console.log(`Removed ${result.count} expired rate-limit buckets.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Rate-limit cleanup failed.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
