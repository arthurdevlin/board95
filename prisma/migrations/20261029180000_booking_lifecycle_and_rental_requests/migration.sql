CREATE TYPE "CarHireRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "Booking" ADD COLUMN "guestAccessTokenHash" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestAccessTokenExpiresAt" TIMESTAMP(3);

ALTER TABLE "BookingMessage" ALTER COLUMN "senderId" DROP NOT NULL;
ALTER TABLE "BookingMessage" DROP CONSTRAINT "BookingMessage_senderId_fkey";
ALTER TABLE "BookingMessage" ADD COLUMN "guestSenderName" TEXT;
ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CarHireRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "passengerId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "guestEmail" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "totalMWK" INTEGER NOT NULL,
    "status" "CarHireRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CarHireRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CarHireRequest_listingId_startsAt_endsAt_idx" ON "CarHireRequest"("listingId", "startsAt", "endsAt");
CREATE INDEX "CarHireRequest_passengerId_createdAt_idx" ON "CarHireRequest"("passengerId", "createdAt");
CREATE INDEX "CarHireRequest_status_createdAt_idx" ON "CarHireRequest"("status", "createdAt");
ALTER TABLE "CarHireRequest" ADD CONSTRAINT "CarHireRequest_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "CarHireListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarHireRequest" ADD CONSTRAINT "CarHireRequest_passengerId_fkey"
FOREIGN KEY ("passengerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RateLimitBucket" (
    "keyHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "action" JSONB,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");
