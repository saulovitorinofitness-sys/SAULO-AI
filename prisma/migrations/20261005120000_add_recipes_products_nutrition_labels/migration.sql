CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'CALCULATED', 'FINALIZED', 'ARCHIVED');

CREATE TYPE "CommercialFoodProductPhysicalType" AS ENUM ('SOLID', 'SEMISOLID', 'LIQUID');

CREATE TYPE "CommercialFoodProductContentUnit" AS ENUM ('GRAM', 'MILLILITER');

CREATE TYPE "CommercialFoodProductStatus" AS ENUM ('DRAFT', 'CALCULATED', 'READY_FOR_LABEL', 'ACTIVE', 'ARCHIVED');

CREATE TYPE "ProductNutritionLabelStatus" AS ENUM ('DRAFT', 'VALIDATED', 'SUPERSEDED', 'ARCHIVED');

CREATE TABLE "Recipe" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "preparationMethod" TEXT,
    "preparationTimeMinutes" INTEGER,
    "yieldDescription" TEXT,
    "finalWeightGrams" DECIMAL(12,3),
    "servings" INTEGER,
    "servingWeightGrams" DECIMAL(12,3),
    "status" "RecipeStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "offlineAvailable" BOOLEAN NOT NULL DEFAULT true,
    "offlinePublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeIngredient" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "householdMeasureId" UUID,
    "position" INTEGER NOT NULL,
    "quantityGrams" DECIMAL(12,3) NOT NULL,
    "householdMeasureQuantity" DECIMAL(12,3),
    "correctionFactor" DECIMAL(12,6),
    "cookingYieldFactor" DECIMAL(12,6),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipePreparationStep" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecipePreparationStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeNutritionSnapshot" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "ingredientCount" INTEGER NOT NULL,
    "totalIngredientWeightGrams" DECIMAL(12,3) NOT NULL,
    "finalWeightGrams" DECIMAL(12,3) NOT NULL,
    "servings" INTEGER NOT NULL,
    "servingWeightGrams" DECIMAL(12,3) NOT NULL,
    "energyKcal" DECIMAL(18,6),
    "proteinGrams" DECIMAL(18,6),
    "carbohydratesGrams" DECIMAL(18,6),
    "fatsGrams" DECIMAL(18,6),
    "fiberGrams" DECIMAL(18,6),
    "sugarsGrams" DECIMAL(18,6),
    "addedSugarsGrams" DECIMAL(18,6),
    "cholesterolMg" DECIMAL(18,6),
    "saturatedFatsGrams" DECIMAL(18,6),
    "transFatsGrams" DECIMAL(18,6),
    "monounsaturatedFatsGrams" DECIMAL(18,6),
    "polyunsaturatedFatsGrams" DECIMAL(18,6),
    "sodiumMg" DECIMAL(18,6),
    "calciumMg" DECIMAL(18,6),
    "ironMg" DECIMAL(18,6),
    "magnesiumMg" DECIMAL(18,6),
    "phosphorusMg" DECIMAL(18,6),
    "potassiumMg" DECIMAL(18,6),
    "zincMg" DECIMAL(18,6),
    "copperMg" DECIMAL(18,6),
    "manganeseMg" DECIMAL(18,6),
    "seleniumMcg" DECIMAL(18,6),
    "vitaminAMcg" DECIMAL(18,6),
    "vitaminCMg" DECIMAL(18,6),
    "vitaminDMcg" DECIMAL(18,6),
    "vitaminEMg" DECIMAL(18,6),
    "vitaminKMcg" DECIMAL(18,6),
    "thiamineMg" DECIMAL(18,6),
    "riboflavinMg" DECIMAL(18,6),
    "niacinMg" DECIMAL(18,6),
    "vitaminB6Mg" DECIMAL(18,6),
    "folateMcg" DECIMAL(18,6),
    "vitaminB12Mcg" DECIMAL(18,6),
    "additionalNutrients" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeNutritionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialFoodProduct" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "recipeNutritionSnapshotId" UUID NOT NULL,
    "commercialName" TEXT NOT NULL,
    "normalizedCommercialName" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "category" TEXT,
    "physicalType" "CommercialFoodProductPhysicalType" NOT NULL,
    "netContent" DECIMAL(12,3) NOT NULL,
    "netContentUnit" "CommercialFoodProductContentUnit" NOT NULL,
    "servingsPerPackage" DECIMAL(12,3) NOT NULL,
    "servingSize" DECIMAL(12,3) NOT NULL,
    "servingSizeUnit" "CommercialFoodProductContentUnit" NOT NULL,
    "servingHouseholdMeasure" TEXT,
    "status" "CommercialFoodProductStatus" NOT NULL DEFAULT 'DRAFT',
    "sku" TEXT,
    "shelfLifeDays" INTEGER,
    "storageInstructions" TEXT,
    "preparationOrConsumptionInstructions" TEXT,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "offlineAvailable" BOOLEAN NOT NULL DEFAULT true,
    "offlinePublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommercialFoodProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductNutritionLabel" (
    "id" UUID NOT NULL,
    "commercialFoodProductId" UUID NOT NULL,
    "recipeNutritionSnapshotId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ProductNutritionLabelStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legislationReference" TEXT,
    "servingsPerPackage" DECIMAL(12,3) NOT NULL,
    "servingSize" DECIMAL(12,3) NOT NULL,
    "servingSizeUnit" "CommercialFoodProductContentUnit" NOT NULL,
    "servingHouseholdMeasure" TEXT,
    "energyKcalPerServing" DECIMAL(18,6),
    "carbohydratesGramsPerServing" DECIMAL(18,6),
    "totalSugarsGramsPerServing" DECIMAL(18,6),
    "addedSugarsGramsPerServing" DECIMAL(18,6),
    "proteinGramsPerServing" DECIMAL(18,6),
    "totalFatsGramsPerServing" DECIMAL(18,6),
    "saturatedFatsGramsPerServing" DECIMAL(18,6),
    "transFatsGramsPerServing" DECIMAL(18,6),
    "fiberGramsPerServing" DECIMAL(18,6),
    "sodiumMgPerServing" DECIMAL(18,6),
    "energyKcalPer100" DECIMAL(18,6),
    "carbohydratesGramsPer100" DECIMAL(18,6),
    "totalSugarsGramsPer100" DECIMAL(18,6),
    "addedSugarsGramsPer100" DECIMAL(18,6),
    "proteinGramsPer100" DECIMAL(18,6),
    "totalFatsGramsPer100" DECIMAL(18,6),
    "saturatedFatsGramsPer100" DECIMAL(18,6),
    "transFatsGramsPer100" DECIMAL(18,6),
    "fiberGramsPer100" DECIMAL(18,6),
    "sodiumMgPer100" DECIMAL(18,6),
    "energyDailyValuePercent" DECIMAL(9,3),
    "carbohydratesDailyValuePercent" DECIMAL(9,3),
    "addedSugarsDailyValuePercent" DECIMAL(9,3),
    "proteinDailyValuePercent" DECIMAL(9,3),
    "totalFatsDailyValuePercent" DECIMAL(9,3),
    "saturatedFatsDailyValuePercent" DECIMAL(9,3),
    "fiberDailyValuePercent" DECIMAL(9,3),
    "sodiumDailyValuePercent" DECIMAL(9,3),
    "highAddedSugars" BOOLEAN,
    "highSaturatedFats" BOOLEAN,
    "highSodium" BOOLEAN,
    "validatedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "validatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductNutritionLabel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Recipe_businessUnitId_status_idx" ON "Recipe"("businessUnitId", "status");
CREATE INDEX "Recipe_ownerUserId_status_idx" ON "Recipe"("ownerUserId", "status");
CREATE INDEX "Recipe_createdByUserId_idx" ON "Recipe"("createdByUserId");
CREATE INDEX "Recipe_updatedByUserId_idx" ON "Recipe"("updatedByUserId");
CREATE INDEX "Recipe_normalizedTitle_idx" ON "Recipe"("normalizedTitle");
CREATE INDEX "Recipe_offlineAvailable_updatedAt_idx" ON "Recipe"("offlineAvailable", "updatedAt");
CREATE UNIQUE INDEX "Recipe_ownerUserId_normalizedTitle_key" ON "Recipe"("ownerUserId", "normalizedTitle");

CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");
CREATE INDEX "RecipeIngredient_foodId_idx" ON "RecipeIngredient"("foodId");
CREATE INDEX "RecipeIngredient_householdMeasureId_idx" ON "RecipeIngredient"("householdMeasureId");
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_position_key" ON "RecipeIngredient"("recipeId", "position");

CREATE INDEX "RecipePreparationStep_recipeId_idx" ON "RecipePreparationStep"("recipeId");
CREATE UNIQUE INDEX "RecipePreparationStep_recipeId_position_key" ON "RecipePreparationStep"("recipeId", "position");

CREATE INDEX "RecipeNutritionSnapshot_recipeId_finalizedAt_idx" ON "RecipeNutritionSnapshot"("recipeId", "finalizedAt");
CREATE INDEX "RecipeNutritionSnapshot_createdByUserId_idx" ON "RecipeNutritionSnapshot"("createdByUserId");
CREATE UNIQUE INDEX "RecipeNutritionSnapshot_recipeId_version_key" ON "RecipeNutritionSnapshot"("recipeId", "version");

CREATE INDEX "CommercialFoodProduct_businessUnitId_status_idx" ON "CommercialFoodProduct"("businessUnitId", "status");
CREATE INDEX "CommercialFoodProduct_ownerUserId_status_idx" ON "CommercialFoodProduct"("ownerUserId", "status");
CREATE INDEX "CommercialFoodProduct_recipeId_idx" ON "CommercialFoodProduct"("recipeId");
CREATE INDEX "CommercialFoodProduct_recipeNutritionSnapshotId_idx" ON "CommercialFoodProduct"("recipeNutritionSnapshotId");
CREATE INDEX "CommercialFoodProduct_normalizedCommercialName_idx" ON "CommercialFoodProduct"("normalizedCommercialName");
CREATE INDEX "CommercialFoodProduct_createdByUserId_idx" ON "CommercialFoodProduct"("createdByUserId");
CREATE INDEX "CommercialFoodProduct_updatedByUserId_idx" ON "CommercialFoodProduct"("updatedByUserId");
CREATE INDEX "CommercialFoodProduct_offlineAvailable_updatedAt_idx" ON "CommercialFoodProduct"("offlineAvailable", "updatedAt");
CREATE UNIQUE INDEX "CommercialFoodProduct_businessUnitId_sku_key" ON "CommercialFoodProduct"("businessUnitId", "sku");

CREATE INDEX "ProductNutritionLabel_commercialFoodProductId_status_idx" ON "ProductNutritionLabel"("commercialFoodProductId", "status");
CREATE INDEX "ProductNutritionLabel_recipeNutritionSnapshotId_idx" ON "ProductNutritionLabel"("recipeNutritionSnapshotId");
CREATE INDEX "ProductNutritionLabel_createdByUserId_idx" ON "ProductNutritionLabel"("createdByUserId");
CREATE INDEX "ProductNutritionLabel_validatedByUserId_idx" ON "ProductNutritionLabel"("validatedByUserId");
CREATE UNIQUE INDEX "ProductNutritionLabel_commercialFoodProductId_version_key" ON "ProductNutritionLabel"("commercialFoodProductId", "version");

ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_householdMeasureId_fkey" FOREIGN KEY ("householdMeasureId") REFERENCES "FoodHouseholdMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecipePreparationStep" ADD CONSTRAINT "RecipePreparationStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeNutritionSnapshot" ADD CONSTRAINT "RecipeNutritionSnapshot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialFoodProduct" ADD CONSTRAINT "CommercialFoodProduct_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialFoodProduct" ADD CONSTRAINT "CommercialFoodProduct_recipeNutritionSnapshotId_fkey" FOREIGN KEY ("recipeNutritionSnapshotId") REFERENCES "RecipeNutritionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductNutritionLabel" ADD CONSTRAINT "ProductNutritionLabel_commercialFoodProductId_fkey" FOREIGN KEY ("commercialFoodProductId") REFERENCES "CommercialFoodProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductNutritionLabel" ADD CONSTRAINT "ProductNutritionLabel_recipeNutritionSnapshotId_fkey" FOREIGN KEY ("recipeNutritionSnapshotId") REFERENCES "RecipeNutritionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
