ALTER TABLE "ProductNutritionLabel"
ADD COLUMN "regulatoryInput" JSONB,
ADD COLUMN "calculationResult" JSONB,
ADD COLUMN "calculationPendings" JSONB,
ADD COLUMN "rulesSnapshot" JSONB,
ADD COLUMN "productInputSnapshot" JSONB;
