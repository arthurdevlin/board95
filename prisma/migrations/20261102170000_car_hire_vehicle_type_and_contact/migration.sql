CREATE TYPE "CarHireVehicleType" AS ENUM ('SALOON', 'SUV', 'PICKUP', 'MINIBUS', 'BUS', 'TRUCK', 'LORRY', 'VAN', 'OTHER');

ALTER TABLE "CarHireListing"
  ADD COLUMN "vehicleType" "CarHireVehicleType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "lorryCapacityTons" INTEGER,
  ADD COLUMN "contactPhone" TEXT;

UPDATE "CarHireListing" AS listing
SET "contactPhone" = owner.phone
FROM "user" AS owner
WHERE listing."ownerId" = owner.id AND owner.phone IS NOT NULL;
