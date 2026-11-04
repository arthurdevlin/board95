CREATE TABLE "BusSchedule" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "departurePointId" TEXT NOT NULL,
    "origin" "City" NOT NULL,
    "destination" "City" NOT NULL,
    "departureTime" TEXT NOT NULL,
    "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "fareMWK" INTEGER NOT NULL,
    "seatsTotal" INTEGER NOT NULL,
    "pickupAvailable" BOOLEAN NOT NULL DEFAULT false,
    "pickupFeeMWK" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusSchedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusSchedule_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BusSchedule_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BusSchedule_departurePointId_fkey" FOREIGN KEY ("departurePointId") REFERENCES "DeparturePoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Trip" ADD COLUMN "scheduleId" TEXT, ADD COLUMN "serviceDate" TEXT;
ALTER TABLE "TripHistory" ADD COLUMN "scheduleId" TEXT, ADD COLUMN "serviceDate" TEXT;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "BusSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Trip_scheduleId_serviceDate_key" ON "Trip"("scheduleId", "serviceDate");
CREATE INDEX "BusSchedule_operatorId_active_idx" ON "BusSchedule"("operatorId", "active");
CREATE INDEX "BusSchedule_vehicleId_idx" ON "BusSchedule"("vehicleId");
CREATE INDEX "BusSchedule_departurePointId_idx" ON "BusSchedule"("departurePointId");
