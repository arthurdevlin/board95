CREATE TYPE "CarHireDistrict" AS ENUM (
  'BALAKA', 'BLANTYRE', 'CHIKWAWA', 'CHIRADZULU', 'CHITIPA', 'DEDZA', 'DOWA', 'KARONGA',
  'KASUNGU', 'LIKOMA', 'LILONGWE', 'MACHINGA', 'MANGOCHI', 'MCHINJI', 'MULANJE',
  'MWANZA', 'MZIMBA', 'NENO', 'NKHATABAY', 'NKHOTAKOTA', 'NSANJE', 'NTCHEU', 'NTCHISI',
  'PHALOMBE', 'RUMPHI', 'SALIMA', 'THYOLO', 'ZOMBA'
);

ALTER TABLE "CarHireListing" ADD COLUMN "district" "CarHireDistrict";

UPDATE "CarHireListing"
SET "district" = CASE "city"::text
  WHEN 'Blantyre' THEN 'BLANTYRE'::"CarHireDistrict"
  WHEN 'Lilongwe' THEN 'LILONGWE'::"CarHireDistrict"
  WHEN 'Mzuzu' THEN 'MZIMBA'::"CarHireDistrict"
END;

ALTER TABLE "CarHireListing" ALTER COLUMN "district" SET NOT NULL;
DROP INDEX "CarHireListing_city_available_idx";
ALTER TABLE "CarHireListing" DROP COLUMN "city";
CREATE INDEX "CarHireListing_district_available_idx" ON "CarHireListing"("district", "available");
