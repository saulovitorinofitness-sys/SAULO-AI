ALTER TABLE "AttendancePendingCheckItem"
ADD COLUMN "status" "ContinuityStepStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "skippedByUserId" UUID,
ADD COLUMN "skippedAt" TIMESTAMP(3),
ADD COLUMN "skipReason" TEXT;
