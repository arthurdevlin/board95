CREATE TABLE "Board95EmailSettings" (
    "id" TEXT NOT NULL DEFAULT 'board95',
    "primaryEmail" TEXT NOT NULL,
    "secondaryEmail" TEXT,
    CONSTRAINT "Board95EmailSettings_pkey" PRIMARY KEY ("id")
);
