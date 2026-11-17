CREATE TYPE "RecipeNutritionBasisUnit" AS ENUM ('GRAM', 'MILLILITER');

ALTER TABLE "RecipeNutritionSnapshot"
ADD COLUMN "totalIngredientMassGrams" DECIMAL(12,3),
ADD COLUMN "totalIngredientVolumeMilliliters" DECIMAL(12,3),
ADD COLUMN "finalYieldAmount" DECIMAL(12,3),
ADD COLUMN "finalYieldUnit" "RecipeNutritionBasisUnit",
ADD COLUMN "servingSize" DECIMAL(12,3),
ADD COLUMN "servingSizeUnit" "RecipeNutritionBasisUnit",
ADD COLUMN "calculationBasisAmount" DECIMAL(12,3),
ADD COLUMN "calculationBasisUnit" "RecipeNutritionBasisUnit";

UPDATE "RecipeNutritionSnapshot"
SET
    "totalIngredientMassGrams" = "totalIngredientWeightGrams",
    "finalYieldAmount" = "finalWeightGrams",
    "finalYieldUnit" = 'GRAM',
    "servingSize" = "servingWeightGrams",
    "servingSizeUnit" = 'GRAM',
    "calculationBasisAmount" = 100,
    "calculationBasisUnit" = 'GRAM'
WHERE "totalIngredientWeightGrams" IS NOT NULL
  AND "finalWeightGrams" IS NOT NULL
  AND "servingWeightGrams" IS NOT NULL;

ALTER TABLE "RecipeNutritionSnapshot"
ALTER COLUMN "finalYieldUnit" SET DEFAULT 'GRAM',
ALTER COLUMN "finalYieldUnit" SET NOT NULL,
ALTER COLUMN "servingSizeUnit" SET DEFAULT 'GRAM',
ALTER COLUMN "servingSizeUnit" SET NOT NULL,
ALTER COLUMN "calculationBasisAmount" SET DEFAULT 100,
ALTER COLUMN "calculationBasisAmount" SET NOT NULL,
ALTER COLUMN "calculationBasisUnit" SET DEFAULT 'GRAM',
ALTER COLUMN "calculationBasisUnit" SET NOT NULL,
ALTER COLUMN "totalIngredientWeightGrams" DROP NOT NULL,
ALTER COLUMN "finalWeightGrams" DROP NOT NULL,
ALTER COLUMN "servingWeightGrams" DROP NOT NULL;
