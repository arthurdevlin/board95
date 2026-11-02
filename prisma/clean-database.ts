import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true } });
  if (admins.length !== 1) {
    throw new Error(`Cleanup stopped: expected exactly one admin account, found ${admins.length}. Resolve admin accounts before retrying.`);
  }

  const admin = admins[0];
  await prisma.$transaction(async (tx) => {
    await tx.bookingMessage.deleteMany();
    await tx.booking.deleteMany();
    await tx.carHireRequest.deleteMany();
    await tx.carHireListing.deleteMany();
    await tx.application.deleteMany();
    await tx.trip.deleteMany();
    await tx.departurePoint.deleteMany();
    await tx.vehicle.deleteMany();
    await tx.operator.deleteMany();
    await tx.session.deleteMany();
    await tx.user.deleteMany({ where: { id: { not: admin.id } } });
    await tx.verification.deleteMany();
    await tx.emailDelivery.deleteMany();
    await tx.rateLimitBucket.deleteMany();
  });

  const remaining = await prisma.user.findMany({ select: { email: true, role: true } });
  if (remaining.length !== 1 || remaining[0].role !== "ADMIN") {
    throw new Error("Cleanup verification failed: the database does not contain exactly one admin account.");
  }
  console.log(`Database cleaned. Preserved the admin account ${admin.email}; removed sample trips and other demo data.`);
}

main().finally(() => prisma.$disconnect());
