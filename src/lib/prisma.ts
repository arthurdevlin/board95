import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Next.js dev mode reloads files often. Without this "global" trick, every
// reload would open a new database connection and we'd run out of them.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientConstructor?: typeof PrismaClient;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env for local development or your deployment environment.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// During hot reload, replace a singleton created by a different generated client.
const cachedPrisma = globalForPrisma.prisma;
const prisma = cachedPrisma && globalForPrisma.prismaClientConstructor === PrismaClient
  ? cachedPrisma
  : createClient();

export { prisma };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClientConstructor = PrismaClient;
}
