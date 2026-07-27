CREATE TABLE "PosturalEvolutionComparison" (
    "id" UUID NOT NULL,
    "previousEntryId" UUID NOT NULL,
    "currentEntryId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "classifications" JSONB NOT NULL,
    "generatedSummary" TEXT,
    "editedSummary" TEXT,
    "evaluatorConclusion" TEXT,
    "generatedAt" TIMESTAMP(3),
    "comparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PosturalEvolutionComparison_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosturalEvolutionComparison_previousEntryId_currentEntryId_key"
ON "PosturalEvolutionComparison"("previousEntryId", "currentEntryId");

CREATE INDEX "PosturalEvolutionComparison_currentEntryId_comparedAt_idx"
ON "PosturalEvolutionComparison"("currentEntryId", "comparedAt");

CREATE INDEX "PosturalEvolutionComparison_professionalUserId_comparedAt_idx"
ON "PosturalEvolutionComparison"("professionalUserId", "comparedAt");

ALTER TABLE "PosturalEvolutionComparison"
ADD CONSTRAINT "PosturalEvolutionComparison_previousEntryId_fkey"
FOREIGN KEY ("previousEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PosturalEvolutionComparison"
ADD CONSTRAINT "PosturalEvolutionComparison_currentEntryId_fkey"
FOREIGN KEY ("currentEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PosturalEvolutionComparison"
ADD CONSTRAINT "PosturalEvolutionComparison_professionalUserId_fkey"
FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PosturalEvolutionComparison"
ADD CONSTRAINT "PosturalEvolutionComparison_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
