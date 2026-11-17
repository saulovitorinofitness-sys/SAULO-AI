-- Persist the validated NextFit DRE as a versioned management snapshot.
ALTER TABLE "FinancialImportBatch"
ADD COLUMN "snapshot" JSONB;
