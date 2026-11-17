-- Professionalization of the food database.
--
-- This migration is intentionally additive. The legacy PHILIPS enum value is
-- retained so existing rows remain readable; PHILIPPI is the preferred value
-- for new records. No automatic conversion between the two spellings occurs.
--
-- Logical rollback strategy (documentation only): stop writers, export any data
-- stored in the new structures, detach the new foreign keys and indexes, and
-- only then retire the added columns/tables/types in reverse dependency order.
-- PHILIPPI must only be retired after proving it is unused; PHILIPS must remain
-- available for legacy compatibility. No destructive rollback SQL is included.

BEGIN;

-- Keep enum ordering aligned with the Prisma schema while preserving PHILIPS.
ALTER TYPE "NutritionSourceKind"
ADD VALUE IF NOT EXISTS 'PHILIPPI' BEFORE 'PHILIPS';

CREATE TYPE "FoodNutrientValueStatus" AS ENUM (
    'NUMERIC',
    'TRACE',
    'NOT_ANALYZED',
    'NOT_APPLICABLE',
    'MISSING'
);

CREATE TYPE "FoodReviewStatus" AS ENUM (
    'PENDING',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED'
);

CREATE TYPE "FoodImportBatchStatus" AS ENUM (
    'DRAFT',
    'VALIDATED',
    'IMPORTED',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE "FoodImportItemAction" AS ENUM (
    'CREATED',
    'UPDATED',
    'UNCHANGED',
    'CONFLICT',
    'REJECTED'
);

CREATE TYPE "FoodAssetOrigin" AS ENUM (
    'SOURCE_IMPORT',
    'PROFESSIONAL',
    'LEGACY'
);

ALTER TABLE "NutritionSource"
ADD COLUMN "seriesKey" TEXT,
ADD COLUMN "licenseName" TEXT,
ADD COLUMN "licenseUrl" TEXT,
ADD COLUMN "licenseText" TEXT,
ADD COLUMN "supersedesSourceId" UUID;

-- reviewStatus is staged as nullable, backfilled deterministically, validated,
-- and only then made mandatory. PENDING remains the schema's permanent default.
ALTER TABLE "Food"
ADD COLUMN "sourceOriginalName" TEXT,
ADD COLUMN "professionalName" TEXT,
ADD COLUMN "preparationMethod" TEXT,
ADD COLUMN "foodState" TEXT,
ADD COLUMN "reviewStatus" "FoodReviewStatus",
ADD COLUMN "reviewedBy" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewNotes" TEXT,
ADD COLUMN "importBatchId" UUID;

UPDATE "Food"
SET "reviewStatus" = 'PENDING'
WHERE "reviewStatus" IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Food"
        WHERE "reviewStatus" IS NULL
    ) THEN
        RAISE EXCEPTION 'Food.reviewStatus backfill left NULL values';
    END IF;
END
$$;

ALTER TABLE "Food"
ALTER COLUMN "reviewStatus" SET DEFAULT 'PENDING',
ALTER COLUMN "reviewStatus" SET NOT NULL;

ALTER TABLE "FoodHouseholdMeasure"
ADD COLUMN "importBatchId" UUID,
ADD COLUMN "dataOrigin" "FoodAssetOrigin",
ADD COLUMN "sourceRecordKey" TEXT;

-- updatedAt has no database default in the final Prisma schema. Existing rows
-- are backfilled from the non-null createdAt timestamp before NOT NULL is set.
ALTER TABLE "FoodSynonym"
ADD COLUMN "sourceId" UUID,
ADD COLUMN "importBatchId" UUID,
ADD COLUMN "dataOrigin" "FoodAssetOrigin",
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "FoodSynonym"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "FoodSynonym"
        WHERE "updatedAt" IS NULL
    ) THEN
        RAISE EXCEPTION 'FoodSynonym.updatedAt backfill left NULL values';
    END IF;
END
$$;

ALTER TABLE "FoodSynonym"
ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE TABLE "NutritionSourceReference" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "publicationYear" INTEGER,
    "citation" TEXT,
    "url" TEXT,
    "doi" TEXT,
    "isbn" TEXT,
    "licenseName" TEXT,
    "licenseUrl" TEXT,
    "licenseText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionSourceReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodImportBatch" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceVersion" TEXT,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'SHA-256',
    "parserVersion" TEXT NOT NULL,
    "status" "FoodImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewStatus" "FoodReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "offlineAvailable" BOOLEAN NOT NULL DEFAULT false,
    "offlinePublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodNutrientObservation" (
    "id" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "importBatchId" UUID,
    "nutrientKey" TEXT NOT NULL,
    "sourceNutrientName" TEXT,
    "numericValue" DECIMAL(18,8),
    "valueStatus" "FoodNutrientValueStatus" NOT NULL DEFAULT 'MISSING',
    "rawValue" TEXT,
    "unit" TEXT,
    "analyticalMethod" TEXT,
    "dataOrigin" TEXT,
    "sourceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodNutrientObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodImportBatchItem" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "foodId" UUID,
    "sourceCode" TEXT,
    "sourceOriginalName" TEXT NOT NULL,
    "sourceRow" INTEGER,
    "action" "FoodImportItemAction" NOT NULL,
    "contentHash" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodImportBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NutritionSource_seriesKey_version_idx"
ON "NutritionSource"("seriesKey", "version");

CREATE INDEX "NutritionSource_supersedesSourceId_idx"
ON "NutritionSource"("supersedesSourceId");

CREATE INDEX "NutritionSourceReference_sourceId_idx"
ON "NutritionSourceReference"("sourceId");

CREATE INDEX "NutritionSourceReference_publicationYear_idx"
ON "NutritionSourceReference"("publicationYear");

CREATE UNIQUE INDEX "FoodImportBatch_sourceId_fileHash_parserVersion_key"
ON "FoodImportBatch"("sourceId", "fileHash", "parserVersion");

CREATE INDEX "FoodImportBatch_sourceId_sourceVersion_idx"
ON "FoodImportBatch"("sourceId", "sourceVersion");

CREATE INDEX "FoodImportBatch_status_reviewStatus_idx"
ON "FoodImportBatch"("status", "reviewStatus");

CREATE INDEX "FoodImportBatch_reviewStatus_offlineAvailable_idx"
ON "FoodImportBatch"("reviewStatus", "offlineAvailable");

CREATE INDEX "Food_importBatchId_idx"
ON "Food"("importBatchId");

CREATE INDEX "Food_reviewStatus_idx"
ON "Food"("reviewStatus");

CREATE UNIQUE INDEX "FoodNutrientObservation_foodId_nutrientKey_importBatchId_key"
ON "FoodNutrientObservation"("foodId", "nutrientKey", "importBatchId");

CREATE INDEX "FoodNutrientObservation_foodId_nutrientKey_idx"
ON "FoodNutrientObservation"("foodId", "nutrientKey");

CREATE INDEX "FoodNutrientObservation_importBatchId_idx"
ON "FoodNutrientObservation"("importBatchId");

CREATE INDEX "FoodNutrientObservation_valueStatus_idx"
ON "FoodNutrientObservation"("valueStatus");

CREATE UNIQUE INDEX "FoodImportBatchItem_batchId_sourceCode_key"
ON "FoodImportBatchItem"("batchId", "sourceCode");

CREATE INDEX "FoodImportBatchItem_batchId_action_idx"
ON "FoodImportBatchItem"("batchId", "action");

CREATE INDEX "FoodImportBatchItem_foodId_idx"
ON "FoodImportBatchItem"("foodId");

CREATE INDEX "FoodHouseholdMeasure_importBatchId_idx"
ON "FoodHouseholdMeasure"("importBatchId");

CREATE INDEX "FoodSynonym_sourceId_idx"
ON "FoodSynonym"("sourceId");

CREATE INDEX "FoodSynonym_importBatchId_idx"
ON "FoodSynonym"("importBatchId");

ALTER TABLE "NutritionSource"
ADD CONSTRAINT "NutritionSource_supersedesSourceId_fkey"
FOREIGN KEY ("supersedesSourceId") REFERENCES "NutritionSource"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NutritionSourceReference"
ADD CONSTRAINT "NutritionSourceReference_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodImportBatch"
ADD CONSTRAINT "FoodImportBatch_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Food"
ADD CONSTRAINT "Food_importBatchId_fkey"
FOREIGN KEY ("importBatchId") REFERENCES "FoodImportBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FoodNutrientObservation"
ADD CONSTRAINT "FoodNutrientObservation_foodId_fkey"
FOREIGN KEY ("foodId") REFERENCES "Food"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodNutrientObservation"
ADD CONSTRAINT "FoodNutrientObservation_importBatchId_fkey"
FOREIGN KEY ("importBatchId") REFERENCES "FoodImportBatch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FoodImportBatchItem"
ADD CONSTRAINT "FoodImportBatchItem_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "FoodImportBatch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodImportBatchItem"
ADD CONSTRAINT "FoodImportBatchItem_foodId_fkey"
FOREIGN KEY ("foodId") REFERENCES "Food"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FoodHouseholdMeasure"
ADD CONSTRAINT "FoodHouseholdMeasure_importBatchId_fkey"
FOREIGN KEY ("importBatchId") REFERENCES "FoodImportBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FoodSynonym"
ADD CONSTRAINT "FoodSynonym_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FoodSynonym"
ADD CONSTRAINT "FoodSynonym_importBatchId_fkey"
FOREIGN KEY ("importBatchId") REFERENCES "FoodImportBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
