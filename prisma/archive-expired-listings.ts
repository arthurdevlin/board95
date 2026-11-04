import "dotenv/config";
import { archiveExpiredListings } from "../src/lib/archive-listings";
import { prisma } from "../src/lib/prisma";

archiveExpiredListings().then((counts) => {
  console.log(`Archived ${counts.trips} expired trips and ${counts.carHire} expired car-hire listings.`);
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Listing cleanup failed.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
