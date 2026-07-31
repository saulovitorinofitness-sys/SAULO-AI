CREATE TABLE "ExerciseLibraryItem" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "muscleGroup" TEXT,
    "equipment" TEXT,
    "description" TEXT,
    "mediaUrl" TEXT,
    "valences" JSONB,
    "executionInstructions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExerciseLibraryItem_normalizedName_key"
ON "ExerciseLibraryItem"("normalizedName");

CREATE INDEX "ExerciseLibraryItem_name_idx"
ON "ExerciseLibraryItem"("name");

CREATE INDEX "ExerciseLibraryItem_moduleId_active_idx"
ON "ExerciseLibraryItem"("moduleId", "active");

CREATE INDEX "ExerciseLibraryItem_createdByUserId_idx"
ON "ExerciseLibraryItem"("createdByUserId");

CREATE INDEX "ExerciseLibraryItem_updatedByUserId_idx"
ON "ExerciseLibraryItem"("updatedByUserId");

ALTER TABLE "ExerciseLibraryItem"
ADD CONSTRAINT "ExerciseLibraryItem_moduleId_fkey"
FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExerciseLibraryItem"
ADD CONSTRAINT "ExerciseLibraryItem_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExerciseLibraryItem"
ADD CONSTRAINT "ExerciseLibraryItem_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
