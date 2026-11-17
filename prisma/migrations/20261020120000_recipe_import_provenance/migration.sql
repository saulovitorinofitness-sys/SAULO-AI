BEGIN;

-- Batch metadata is separate from Recipe so a single source file can be
-- traced without making imported provenance mandatory for manual recipes.
CREATE TABLE "RecipeImportBatch" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceVersion" TEXT,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'SHA-256',
    "parserVersion" TEXT NOT NULL,
    "status" "FoodImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeImportBatch_pkey" PRIMARY KEY ("id")
);

-- All provenance columns are nullable so existing and manually-created
-- recipes remain valid. No source value or weight is backfilled or inferred.
ALTER TABLE "Recipe"
ADD COLUMN "importBatchId" UUID,
ADD COLUMN "importSourceId" UUID,
ADD COLUMN "sourceRecordCode" TEXT,
ADD COLUMN "sourceContentHash" TEXT,
ADD COLUMN "importedStateHash" TEXT,
ADD COLUMN "sourceLocation" JSONB,
ADD COLUMN "sourceOriginalData" JSONB,
ADD COLUMN "sourcePendings" JSONB,
ADD COLUMN "importedAt" TIMESTAMP(3);

-- Imported identity is source-based. PostgreSQL permits multiple rows with
-- NULL provenance, so this does not constrain manually-created recipes.
DROP INDEX "Recipe_ownerUserId_normalizedTitle_key";

CREATE UNIQUE INDEX "RecipeImportBatch_sourceId_fileHash_parserVersion_key"
ON "RecipeImportBatch"("sourceId", "fileHash", "parserVersion");

CREATE INDEX "RecipeImportBatch_sourceId_sourceVersion_idx"
ON "RecipeImportBatch"("sourceId", "sourceVersion");

CREATE INDEX "RecipeImportBatch_status_idx"
ON "RecipeImportBatch"("status");

CREATE UNIQUE INDEX "Recipe_origin_identity_key"
ON "Recipe"("businessUnitId", "ownerUserId", "importSourceId", "sourceRecordCode");

CREATE INDEX "Recipe_ownerUserId_normalizedTitle_idx"
ON "Recipe"("ownerUserId", "normalizedTitle");

CREATE INDEX "Recipe_importBatchId_idx"
ON "Recipe"("importBatchId");

CREATE INDEX "Recipe_importSourceId_sourceRecordCode_idx"
ON "Recipe"("importSourceId", "sourceRecordCode");

ALTER TABLE "RecipeImportBatch"
ADD CONSTRAINT "RecipeImportBatch_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Recipe"
ADD CONSTRAINT "Recipe_importBatchId_fkey"
FOREIGN KEY ("importBatchId") REFERENCES "RecipeImportBatch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Recipe"
ADD CONSTRAINT "Recipe_importSourceId_fkey"
FOREIGN KEY ("importSourceId") REFERENCES "NutritionSource"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
