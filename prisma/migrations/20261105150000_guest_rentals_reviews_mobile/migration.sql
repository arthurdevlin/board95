-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "whatsappUpdates" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CarHireRequest" ADD COLUMN     "guestAccessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "guestAccessTokenHash" TEXT,
ADD COLUMN     "whatsappUpdates" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RentalMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReview" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "rentalRequestId" TEXT,
    "operatorId" TEXT,
    "vehicleId" TEXT,
    "carListingId" TEXT,
    "score" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileNotification" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "whatsappUpdates" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalMessage_requestId_createdAt_idx" ON "RentalMessage"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReview_bookingId_key" ON "ServiceReview"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReview_rentalRequestId_key" ON "ServiceReview"("rentalRequestId");

-- CreateIndex
CREATE INDEX "ServiceReview_operatorId_idx" ON "ServiceReview"("operatorId");

-- CreateIndex
CREATE INDEX "ServiceReview_vehicleId_idx" ON "ServiceReview"("vehicleId");

-- CreateIndex
CREATE INDEX "ServiceReview_carListingId_idx" ON "ServiceReview"("carListingId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileNotification_eventKey_key" ON "MobileNotification"("eventKey");

-- CreateIndex
CREATE INDEX "MobileNotification_status_createdAt_idx" ON "MobileNotification"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RentalMessage" ADD CONSTRAINT "RentalMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CarHireRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "CarHireRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TYPE "CarHireRequestStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TABLE "ServiceReview" ADD CONSTRAINT "review_score_range" CHECK (score BETWEEN 1 AND 5), ADD CONSTRAINT "review_one_source" CHECK (("bookingId" IS NOT NULL)::int + ("rentalRequestId" IS NOT NULL)::int = 1), ADD CONSTRAINT "review_note_length" CHECK (char_length(note) <= 300);

ALTER TABLE "ServiceReview" ADD COLUMN "providerUserId" TEXT;
CREATE INDEX "ServiceReview_providerUserId_idx" ON "ServiceReview"("providerUserId");

ALTER TABLE "MobileNotification" ADD COLUMN "expiresAt" TIMESTAMP(3);
