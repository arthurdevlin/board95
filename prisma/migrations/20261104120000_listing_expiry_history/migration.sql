-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_tripId_fkey";

-- DropForeignKey
ALTER TABLE "CarHireRequest" DROP CONSTRAINT "CarHireRequest_listingId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "tripHistoryId" TEXT,
ALTER COLUMN "tripId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CarHireListing" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '7 days'),
ADD COLUMN     "renewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CarHireRequest" ADD COLUMN     "listingHistoryId" TEXT,
ALTER COLUMN "listingId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TripHistory" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "departurePointId" TEXT NOT NULL,
    "type" "TransportType" NOT NULL,
    "origin" "City" NOT NULL,
    "destination" "City" NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fareMWK" INTEGER NOT NULL,
    "seatsTotal" INTEGER NOT NULL,
    "seatsAvailable" INTEGER NOT NULL,
    "pickupAvailable" BOOLEAN NOT NULL DEFAULT false,
    "pickupFeeMWK" INTEGER,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorName" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "departurePointName" TEXT NOT NULL,

    CONSTRAINT "TripHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarHireListingHistory" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vehicleType" "CarHireVehicleType" NOT NULL DEFAULT 'OTHER',
    "lorryCapacityTons" INTEGER,
    "contactPhone" TEXT,
    "district" "CarHireDistrict" NOT NULL,
    "dailyRateMWK" INTEGER NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '7 days'),
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerName" TEXT NOT NULL,

    CONSTRAINT "CarHireListingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripHistory_origin_destination_departureAt_idx" ON "TripHistory"("origin", "destination", "departureAt");

-- CreateIndex
CREATE INDEX "TripHistory_departureAt_id_idx" ON "TripHistory"("departureAt", "id");

-- CreateIndex
CREATE INDEX "TripHistory_operatorId_departureAt_idx" ON "TripHistory"("operatorId", "departureAt");

-- CreateIndex
CREATE INDEX "TripHistory_vehicleId_departureAt_idx" ON "TripHistory"("vehicleId", "departureAt");

-- CreateIndex
CREATE INDEX "TripHistory_departurePointId_idx" ON "TripHistory"("departurePointId");

-- CreateIndex
CREATE INDEX "CarHireListingHistory_ownerId_idx" ON "CarHireListingHistory"("ownerId");

-- CreateIndex
CREATE INDEX "CarHireListingHistory_expiresAt_id_idx" ON "CarHireListingHistory"("expiresAt", "id");

-- CreateIndex
CREATE INDEX "CarHireListingHistory_district_available_idx" ON "CarHireListingHistory"("district", "available");

-- CreateIndex
CREATE INDEX "CarHireListingHistory_available_createdAt_id_idx" ON "CarHireListingHistory"("available", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CarHireListingHistory_ownerId_createdAt_id_idx" ON "CarHireListingHistory"("ownerId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Booking_tripHistoryId_idx" ON "Booking"("tripHistoryId");

-- CreateIndex
CREATE INDEX "CarHireListing_expiresAt_id_idx" ON "CarHireListing"("expiresAt", "id");

-- CreateIndex
CREATE INDEX "CarHireRequest_listingHistoryId_startsAt_endsAt_idx" ON "CarHireRequest"("listingHistoryId", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tripHistoryId_fkey" FOREIGN KEY ("tripHistoryId") REFERENCES "TripHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarHireRequest" ADD CONSTRAINT "CarHireRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "CarHireListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarHireRequest" ADD CONSTRAINT "CarHireRequest_listingHistoryId_fkey" FOREIGN KEY ("listingHistoryId") REFERENCES "CarHireListingHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_departurePointId_fkey" FOREIGN KEY ("departurePointId") REFERENCES "DeparturePoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarHireListingHistory" ADD CONSTRAINT "CarHireListingHistory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing listings retain the same seven-day lifetime as newly published ones.
UPDATE "CarHireListing" SET "expiresAt" = "createdAt" + interval '7 days';

-- A booking/request must always point to exactly one active or historical listing.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_listing_link_check"
CHECK (("tripId" IS NOT NULL)::int + ("tripHistoryId" IS NOT NULL)::int = 1);
ALTER TABLE "CarHireRequest" ADD CONSTRAINT "CarHireRequest_listing_link_check"
CHECK (("listingId" IS NOT NULL)::int + ("listingHistoryId" IS NOT NULL)::int = 1);
