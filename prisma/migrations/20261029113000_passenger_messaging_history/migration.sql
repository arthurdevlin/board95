ALTER TABLE "Booking" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "BookingMessage" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingMessage_bookingId_createdAt_idx" ON "BookingMessage"("bookingId", "createdAt");
CREATE INDEX "BookingMessage_senderId_createdAt_idx" ON "BookingMessage"("senderId", "createdAt");
ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
