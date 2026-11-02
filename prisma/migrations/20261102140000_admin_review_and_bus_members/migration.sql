CREATE TYPE "OperatorMemberRole" AS ENUM ('ADMIN', 'STAFF');

ALTER TABLE "Booking" ADD COLUMN "reviewedByAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN "reviewedByAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CarHireRequest" ADD COLUMN "reviewedByAdmin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Application" SET "reviewedByAdmin" = true WHERE "reviewedAt" IS NOT NULL AND "status" <> 'PENDING';

CREATE TABLE "OperatorMember" (
  "id" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OperatorMemberRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperatorMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperatorMember_operatorId_userId_key" ON "OperatorMember"("operatorId", "userId");
CREATE INDEX "OperatorMember_userId_role_idx" ON "OperatorMember"("userId", "role");
ALTER TABLE "OperatorMember" ADD CONSTRAINT "OperatorMember_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperatorMember" ADD CONSTRAINT "OperatorMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
