CREATE TYPE "ExerciseCategory" AS ENUM (
  'STRENGTH',
  'RUNNING',
  'CYCLING',
  'MOBILITY',
  'STRETCHING',
  'CORRECTIVE',
  'OTHER'
);

ALTER TABLE "ExerciseLibraryItem"
ADD COLUMN "category" "ExerciseCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "professionalNotes" TEXT;

DROP INDEX "ExerciseLibraryItem_normalizedName_key";

CREATE UNIQUE INDEX "ExerciseLibraryItem_createdByUserId_normalizedName_key"
ON "ExerciseLibraryItem"("createdByUserId", "normalizedName");

CREATE INDEX "ExerciseLibraryItem_createdByUserId_active_category_idx"
ON "ExerciseLibraryItem"("createdByUserId", "active", "category");
