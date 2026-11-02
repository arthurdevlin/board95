ALTER TYPE "UserRole" ADD VALUE 'CAR_HIRER';
CREATE TYPE "ApplicationKind" AS ENUM ('TAXI_OWNER', 'BUS_COMPANY', 'CAR_HIRER');
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

ALTER TABLE "user" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Booking" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN "pickupLocation" TEXT;

CREATE TABLE "CarHireListing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "dailyRateMWK" INTEGER NOT NULL,
    "description" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CarHireListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CarHireListing_ownerId_idx" ON "CarHireListing"("ownerId");
CREATE INDEX "CarHireListing_city_available_idx" ON "CarHireListing"("city", "available");

ALTER TABLE "CarHireListing" ADD CONSTRAINT "CarHireListing_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Trip_taxi_vehicle_malawi_day_key"
ON "Trip" ("vehicleId", (("departureAt" + INTERVAL '2 hours')::date))
WHERE "type" = 'TAXI';

CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ApplicationKind" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "displayName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Application_userId_createdAt_idx" ON "Application"("userId", "createdAt");
CREATE INDEX "Application_status_createdAt_idx" ON "Application"("status", "createdAt");
CREATE UNIQUE INDEX "Application_one_pending_per_user_kind_key" ON "Application"("userId", "kind") WHERE "status" = 'PENDING';
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
