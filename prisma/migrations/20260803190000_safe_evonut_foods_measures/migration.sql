ALTER TYPE "NutritionSourceKind" ADD VALUE IF NOT EXISTS 'EVONUT';
ALTER TYPE "FoodMeasureMatchStatus" ADD VALUE IF NOT EXISTS 'UNLINKED';

ALTER TABLE "Food"
ADD COLUMN "importedFrom" TEXT,
ADD COLUMN "importedAt" TIMESTAMP(3);

ALTER TABLE "FoodNutrients"
ADD COLUMN "additionalNutrients" JSONB;

ALTER TABLE "FoodHouseholdMeasureReference"
ADD COLUMN "normalizedMeasureName" TEXT,
ADD COLUMN "foodSource" TEXT,
ADD COLUMN "linkMethod" TEXT,
ADD COLUMN "importedFrom" TEXT;

CREATE TABLE "FoodImportConflict" (
    "id" UUID NOT NULL,
    "importedFrom" TEXT NOT NULL,
    "foodSource" TEXT NOT NULL,
    "sourceFoodCode" TEXT NOT NULL,
    "incomingFoodName" TEXT NOT NULL,
    "existingFoodId" UUID,
    "conflictType" TEXT NOT NULL,
    "details" TEXT,
    "fingerprint" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodImportConflict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodImportConflict_fingerprint_key"
ON "FoodImportConflict"("fingerprint");
CREATE INDEX "FoodImportConflict_importedFrom_idx"
ON "FoodImportConflict"("importedFrom");
CREATE INDEX "FoodImportConflict_foodSource_sourceFoodCode_idx"
ON "FoodImportConflict"("foodSource", "sourceFoodCode");
CREATE INDEX "FoodImportConflict_existingFoodId_idx"
ON "FoodImportConflict"("existingFoodId");
CREATE INDEX "FoodHouseholdMeasureReference_foodSource_sourceFoodCode_idx"
ON "FoodHouseholdMeasureReference"("foodSource", "sourceFoodCode");
CREATE INDEX "FoodHouseholdMeasureReference_normalizedMeasureName_idx"
ON "FoodHouseholdMeasureReference"("normalizedMeasureName");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Food_normalizedName_trgm_idx"
ON "Food" USING GIN ("normalizedName" gin_trgm_ops);

ALTER TABLE "FoodImportConflict"
ADD CONSTRAINT "FoodImportConflict_existingFoodId_fkey"
FOREIGN KEY ("existingFoodId") REFERENCES "Food"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
