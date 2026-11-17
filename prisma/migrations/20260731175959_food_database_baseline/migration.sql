-- Historical baseline for the original food database.
-- This migration intentionally represents the schema immediately before
-- 20260731180000_food_source_code_uniqueness.

CREATE TYPE "NutritionSourceKind" AS ENUM (
    'TACO',
    'TBCA',
    'IBGE',
    'PHILIPS',
    'USDA',
    'CLINIC_SV'
);

CREATE TYPE "FoodDataOrigin" AS ENUM (
    'OFFICIAL',
    'PROFESSIONAL',
    'DEMONSTRATIVE'
);

CREATE TYPE "FoodStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);

CREATE TABLE "FoodCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NutritionSource" (
    "id" UUID NOT NULL,
    "kind" "NutritionSourceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "reference" TEXT,
    "origin" "FoodDataOrigin" NOT NULL,
    "editable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Food" (
    "id" UUID NOT NULL,
    "officialName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID NOT NULL,
    "foodGroup" TEXT NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceCode" TEXT,
    "preparationState" TEXT,
    "presentation" TEXT,
    "referenceServingGrams" DECIMAL(10,3) NOT NULL DEFAULT 100,
    "status" "FoodStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodNutrients" (
    "foodId" UUID NOT NULL,
    "energyKcal" DECIMAL(12,6),
    "proteinGrams" DECIMAL(12,6),
    "carbohydratesGrams" DECIMAL(12,6),
    "fatsGrams" DECIMAL(12,6),
    "fiberGrams" DECIMAL(12,6),
    "sugarsGrams" DECIMAL(12,6),
    "cholesterolMg" DECIMAL(12,6),
    "saturatedFatsGrams" DECIMAL(12,6),
    "monounsaturatedFatsGrams" DECIMAL(12,6),
    "polyunsaturatedFatsGrams" DECIMAL(12,6),
    "sodiumMg" DECIMAL(12,6),
    "calciumMg" DECIMAL(12,6),
    "ironMg" DECIMAL(12,6),
    "magnesiumMg" DECIMAL(12,6),
    "phosphorusMg" DECIMAL(12,6),
    "potassiumMg" DECIMAL(12,6),
    "zincMg" DECIMAL(12,6),
    "copperMg" DECIMAL(12,6),
    "manganeseMg" DECIMAL(12,6),
    "seleniumMcg" DECIMAL(12,6),
    "vitaminAMcg" DECIMAL(12,6),
    "vitaminCMg" DECIMAL(12,6),
    "vitaminDMcg" DECIMAL(12,6),
    "vitaminEMg" DECIMAL(12,6),
    "vitaminKMcg" DECIMAL(12,6),
    "thiamineMg" DECIMAL(12,6),
    "riboflavinMg" DECIMAL(12,6),
    "niacinMg" DECIMAL(12,6),
    "vitaminB6Mg" DECIMAL(12,6),
    "folateMcg" DECIMAL(12,6),
    "vitaminB12Mcg" DECIMAL(12,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodNutrients_pkey" PRIMARY KEY ("foodId")
);

CREATE TABLE "FoodHouseholdMeasure" (
    "id" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "variation" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "grams" DECIMAL(10,3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodHouseholdMeasure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodSynonym" (
    "id" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodSynonym_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodCategory_normalizedName_key"
ON "FoodCategory"("normalizedName");

CREATE INDEX "FoodCategory_name_idx"
ON "FoodCategory"("name");

CREATE UNIQUE INDEX "NutritionSource_kind_name_version_key"
ON "NutritionSource"("kind", "name", "version");

CREATE INDEX "NutritionSource_kind_idx"
ON "NutritionSource"("kind");

CREATE INDEX "NutritionSource_name_idx"
ON "NutritionSource"("name");

CREATE INDEX "Food_normalizedName_idx"
ON "Food"("normalizedName");

CREATE INDEX "Food_categoryId_idx"
ON "Food"("categoryId");

CREATE INDEX "Food_sourceId_idx"
ON "Food"("sourceId");

CREATE INDEX "Food_sourceCode_idx"
ON "Food"("sourceCode");

CREATE INDEX "Food_normalizedName_preparationState_sourceId_sourceCode_idx"
ON "Food"("normalizedName", "preparationState", "sourceId", "sourceCode");

CREATE UNIQUE INDEX "FoodHouseholdMeasure_foodId_normalizedName_variation_quanti_key"
ON "FoodHouseholdMeasure"(
    "foodId",
    "normalizedName",
    "variation",
    "quantity",
    "grams"
);

CREATE INDEX "FoodHouseholdMeasure_foodId_idx"
ON "FoodHouseholdMeasure"("foodId");

CREATE INDEX "FoodHouseholdMeasure_sourceId_idx"
ON "FoodHouseholdMeasure"("sourceId");

CREATE INDEX "FoodHouseholdMeasure_normalizedName_idx"
ON "FoodHouseholdMeasure"("normalizedName");

CREATE UNIQUE INDEX "FoodSynonym_foodId_normalizedName_key"
ON "FoodSynonym"("foodId", "normalizedName");

CREATE INDEX "FoodSynonym_normalizedName_idx"
ON "FoodSynonym"("normalizedName");

ALTER TABLE "Food"
ADD CONSTRAINT "Food_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Food"
ADD CONSTRAINT "Food_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FoodNutrients"
ADD CONSTRAINT "FoodNutrients_foodId_fkey"
FOREIGN KEY ("foodId") REFERENCES "Food"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodHouseholdMeasure"
ADD CONSTRAINT "FoodHouseholdMeasure_foodId_fkey"
FOREIGN KEY ("foodId") REFERENCES "Food"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodHouseholdMeasure"
ADD CONSTRAINT "FoodHouseholdMeasure_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FoodSynonym"
ADD CONSTRAINT "FoodSynonym_foodId_fkey"
FOREIGN KEY ("foodId") REFERENCES "Food"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
