CREATE TYPE "FinancialSourceSystem" AS ENUM ('NEXTFIT', 'CLINICA_SV', 'GESTAO_SV');

CREATE TYPE "FinancialManagementNature" AS ENUM ('PLANNED', 'FORECAST', 'REALIZED');

CREATE TYPE "FinancialImportBatchStatus" AS ENUM ('PENDING', 'VALIDATED', 'IMPORTED', 'FAILED', 'CANCELLED');

CREATE TABLE "FinancialImportBatch" (
    "id" UUID NOT NULL,
    "sourceSystem" "FinancialSourceSystem" NOT NULL,
    "competence" DATE NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByUserId" UUID NOT NULL,
    "status" "FinancialImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialImportBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinancialEntry"
    ADD COLUMN "sourceSystem" "FinancialSourceSystem" NOT NULL DEFAULT 'GESTAO_SV',
    ADD COLUMN "managementNature" "FinancialManagementNature" NOT NULL DEFAULT 'FORECAST',
    ADD COLUMN "importBatchId" UUID;

CREATE UNIQUE INDEX "FinancialImportBatch_sourceSystem_fileHash_key"
    ON "FinancialImportBatch"("sourceSystem", "fileHash");

CREATE UNIQUE INDEX "FinancialImportBatch_sourceSystem_externalId_key"
    ON "FinancialImportBatch"("sourceSystem", "externalId");

CREATE INDEX "FinancialImportBatch_competence_sourceSystem_status_idx"
    ON "FinancialImportBatch"("competence", "sourceSystem", "status");

CREATE INDEX "FinancialImportBatch_importedByUserId_importedAt_idx"
    ON "FinancialImportBatch"("importedByUserId", "importedAt");

CREATE INDEX "FinancialEntry_importBatchId_idx"
    ON "FinancialEntry"("importBatchId");

CREATE INDEX "FinancialEntry_businessUnitId_managementNature_competence_idx"
    ON "FinancialEntry"("businessUnitId", "managementNature", "competence");

CREATE INDEX "FinancialEntry_sourceSystem_managementNature_idx"
    ON "FinancialEntry"("sourceSystem", "managementNature");

ALTER TABLE "FinancialImportBatch"
    ADD CONSTRAINT "FinancialImportBatch_importedByUserId_fkey"
    FOREIGN KEY ("importedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialEntry"
    ADD CONSTRAINT "FinancialEntry_importBatchId_fkey"
    FOREIGN KEY ("importBatchId") REFERENCES "FinancialImportBatch"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
