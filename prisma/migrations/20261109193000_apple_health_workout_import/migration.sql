ALTER TABLE "WorkoutExecution"
ADD COLUMN "importProvider" TEXT,
ADD COLUMN "importExternalIdentifier" TEXT,
ADD COLUMN "distanceMeters" DOUBLE PRECISION;

CREATE UNIQUE INDEX "WorkoutExecution_import_identity_key"
ON "WorkoutExecution"("masterRecordId", "importProvider", "importExternalIdentifier");

ALTER TABLE "WorkoutExecution"
ADD CONSTRAINT "WorkoutExecution_masterRecordId_fkey"
FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
