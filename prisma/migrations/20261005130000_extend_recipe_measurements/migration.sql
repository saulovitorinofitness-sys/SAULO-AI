CREATE TYPE "RecipeMeasurementUnit" AS ENUM ('GRAM', 'MILLILITER', 'UNIT');

CREATE TYPE "RecipeIngredientQuantityUnit" AS ENUM ('GRAM', 'MILLILITER');

ALTER TABLE "Recipe" ADD COLUMN "notes" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "finalYieldAmount" DECIMAL(12,3);
ALTER TABLE "Recipe" ADD COLUMN "finalYieldUnit" "RecipeMeasurementUnit";
ALTER TABLE "Recipe" ADD COLUMN "yieldAmount" DECIMAL(12,3);
ALTER TABLE "Recipe" ADD COLUMN "yieldUnit" "RecipeMeasurementUnit";
ALTER TABLE "Recipe" ADD COLUMN "servingSize" DECIMAL(12,3);
ALTER TABLE "Recipe" ADD COLUMN "servingSizeUnit" "RecipeMeasurementUnit";
ALTER TABLE "Recipe" ADD COLUMN "servingHouseholdMeasure" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "physicalType" "CommercialFoodProductPhysicalType";

ALTER TABLE "RecipeIngredient" ADD COLUMN "grossQuantity" DECIMAL(12,3);
ALTER TABLE "RecipeIngredient" ADD COLUMN "netQuantity" DECIMAL(12,3);
ALTER TABLE "RecipeIngredient" ADD COLUMN "quantityUnit" "RecipeIngredientQuantityUnit";
ALTER TABLE "RecipeIngredient" ADD COLUMN "householdMeasureDescription" TEXT;
