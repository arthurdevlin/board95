-- Index the predicates and ordering used by public search and dashboards.
-- Additive only: no data is modified or removed.
CREATE INDEX "Operator_ownerId_idx" ON "Operator"("ownerId");
CREATE INDEX "Vehicle_operatorId_idx" ON "Vehicle"("operatorId");
CREATE INDEX "Trip_departureAt_id_idx" ON "Trip"("departureAt", "id");
CREATE INDEX "Trip_operatorId_departureAt_idx" ON "Trip"("operatorId", "departureAt");
CREATE INDEX "Trip_vehicleId_departureAt_idx" ON "Trip"("vehicleId", "departureAt");
CREATE INDEX "Trip_departurePointId_idx" ON "Trip"("departurePointId");
CREATE INDEX "Booking_createdAt_id_idx" ON "Booking"("createdAt", "id");
CREATE INDEX "Booking_status_createdAt_id_idx" ON "Booking"("status", "createdAt", "id");
CREATE INDEX "Booking_userId_archivedAt_createdAt_idx" ON "Booking"("userId", "archivedAt", "createdAt");
CREATE INDEX "CarHireListing_available_createdAt_id_idx" ON "CarHireListing"("available", "createdAt", "id");
CREATE INDEX "CarHireListing_ownerId_createdAt_id_idx" ON "CarHireListing"("ownerId", "createdAt", "id");
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
