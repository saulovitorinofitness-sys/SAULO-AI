CREATE TYPE "FoodMeasureMatchStatus" AS ENUM ('CONFIRMED', 'PROBABLE', 'UNMATCHED');

CREATE TABLE "FoodHouseholdMeasureReference" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "foodId" UUID,
    "sourceFoodCode" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "normalizedFoodName" TEXT NOT NULL,
    "preparationCode" TEXT NOT NULL,
    "preparationName" TEXT NOT NULL,
    "measureCode" TEXT NOT NULL,
    "measureName" TEXT NOT NULL,
    "standardMeasureCode" TEXT NOT NULL,
    "standardMeasureName" TEXT NOT NULL,
    "quantityValue" DECIMAL(12,3),
    "quantityUnit" TEXT,
    "referenceCode" TEXT,
    "referenceDescription" TEXT,
    "sourceVersion" TEXT NOT NULL,
    "matchStatus" "FoodMeasureMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchReason" TEXT,
    "sourcePage" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodHouseholdMeasureReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodMeasureImportRejection" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourcePage" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodMeasureImportRejection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodHouseholdMeasureReference_sourceId_sourceFoodCode_preparationCode_measureCode_key" ON "FoodHouseholdMeasureReference"("sourceId", "sourceFoodCode", "preparationCode", "measureCode");
CREATE INDEX "FoodHouseholdMeasureReference_foodId_preparationCode_idx" ON "FoodHouseholdMeasureReference"("foodId", "preparationCode");
CREATE INDEX "FoodHouseholdMeasureReference_normalizedFoodName_idx" ON "FoodHouseholdMeasureReference"("normalizedFoodName");
CREATE INDEX "FoodHouseholdMeasureReference_matchStatus_idx" ON "FoodHouseholdMeasureReference"("matchStatus");
CREATE INDEX "FoodHouseholdMeasureReference_sourceFoodCode_idx" ON "FoodHouseholdMeasureReference"("sourceFoodCode");
CREATE UNIQUE INDEX "FoodMeasureImportRejection_sourceId_fingerprint_key" ON "FoodMeasureImportRejection"("sourceId", "fingerprint");
CREATE INDEX "FoodMeasureImportRejection_sourceId_sourcePage_idx" ON "FoodMeasureImportRejection"("sourceId", "sourcePage");

ALTER TABLE "FoodHouseholdMeasureReference" ADD CONSTRAINT "FoodHouseholdMeasureReference_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FoodHouseholdMeasureReference" ADD CONSTRAINT "FoodHouseholdMeasureReference_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FoodMeasureImportRejection" ADD CONSTRAINT "FoodMeasureImportRejection_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
