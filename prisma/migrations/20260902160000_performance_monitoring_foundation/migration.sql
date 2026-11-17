-- CreateEnum
CREATE TYPE "PerformanceModality" AS ENUM ('STRENGTH', 'RUNNING', 'CYCLING', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkoutScheduleStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkoutExecutionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "WorkoutExecutionSource" AS ENUM ('MANUAL', 'FILE_IMPORT', 'DEVICE');

-- CreateTable
CREATE TABLE "WorkoutScheduledSession" (
    "id" UUID NOT NULL,
    "workoutPlanEntryId" UUID NOT NULL,
    "workoutPlanVersionId" UUID NOT NULL,
    "sessionId" UUID,
    "masterRecordId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "modality" "PerformanceModality" NOT NULL,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "plannedDurationSeconds" INTEGER,
    "timeZone" TEXT NOT NULL,
    "status" "WorkoutScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "responsibleUserId" UUID,
    "notes" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutScheduledSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExecution" (
    "id" UUID NOT NULL,
    "scheduledSessionId" UUID,
    "masterRecordId" UUID NOT NULL,
    "workoutPlanEntryId" UUID,
    "workoutPlanVersionId" UUID,
    "sessionId" UUID,
    "modality" "PerformanceModality" NOT NULL,
    "source" "WorkoutExecutionSource" NOT NULL,
    "actualStartAt" TIMESTAMP(3) NOT NULL,
    "actualEndAt" TIMESTAMP(3),
    "executedDurationSeconds" INTEGER,
    "status" "WorkoutExecutionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "executedRpe" DECIMAL(3,1),
    "notes" TEXT,
    "executorUserId" UUID,
    "importArtifactId" UUID,
    "deviceConnectionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutScheduledSession_masterRecordId_scheduledStartAt_idx" ON "WorkoutScheduledSession"("masterRecordId", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "WorkoutScheduledSession_workoutPlanEntryId_workoutPlanVersi_idx" ON "WorkoutScheduledSession"("workoutPlanEntryId", "workoutPlanVersionId");

-- CreateIndex
CREATE INDEX "WorkoutScheduledSession_workoutPlanVersionId_idx" ON "WorkoutScheduledSession"("workoutPlanVersionId");

-- CreateIndex
CREATE INDEX "WorkoutScheduledSession_sessionId_idx" ON "WorkoutScheduledSession"("sessionId");

-- CreateIndex
CREATE INDEX "WorkoutScheduledSession_responsibleUserId_scheduledStartAt_idx" ON "WorkoutScheduledSession"("responsibleUserId", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "WorkoutScheduledSession_status_scheduledStartAt_idx" ON "WorkoutScheduledSession"("status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "WorkoutExecution_scheduledSessionId_idx" ON "WorkoutExecution"("scheduledSessionId");

-- CreateIndex
CREATE INDEX "WorkoutExecution_masterRecordId_actualStartAt_idx" ON "WorkoutExecution"("masterRecordId", "actualStartAt");

-- CreateIndex
CREATE INDEX "WorkoutExecution_workoutPlanEntryId_workoutPlanVersionId_idx" ON "WorkoutExecution"("workoutPlanEntryId", "workoutPlanVersionId");

-- CreateIndex
CREATE INDEX "WorkoutExecution_workoutPlanVersionId_idx" ON "WorkoutExecution"("workoutPlanVersionId");

-- CreateIndex
CREATE INDEX "WorkoutExecution_sessionId_idx" ON "WorkoutExecution"("sessionId");

-- CreateIndex
CREATE INDEX "WorkoutExecution_executorUserId_actualStartAt_idx" ON "WorkoutExecution"("executorUserId", "actualStartAt");

-- CreateIndex
CREATE INDEX "WorkoutExecution_importArtifactId_idx" ON "WorkoutExecution"("importArtifactId");

-- CreateIndex
CREATE INDEX "WorkoutExecution_deviceConnectionId_idx" ON "WorkoutExecution"("deviceConnectionId");

-- CreateIndex
CREATE INDEX "WorkoutExecution_source_actualStartAt_idx" ON "WorkoutExecution"("source", "actualStartAt");

-- CreateIndex
CREATE INDEX "WorkoutExecution_status_actualStartAt_idx" ON "WorkoutExecution"("status", "actualStartAt");

-- AddForeignKey
ALTER TABLE "WorkoutScheduledSession" ADD CONSTRAINT "WorkoutScheduledSession_workoutPlanEntryId_fkey" FOREIGN KEY ("workoutPlanEntryId") REFERENCES "WorkoutPlanRecord"("entryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExecution" ADD CONSTRAINT "WorkoutExecution_scheduledSessionId_fkey" FOREIGN KEY ("scheduledSessionId") REFERENCES "WorkoutScheduledSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExecution" ADD CONSTRAINT "WorkoutExecution_workoutPlanEntryId_fkey" FOREIGN KEY ("workoutPlanEntryId") REFERENCES "WorkoutPlanRecord"("entryId") ON DELETE RESTRICT ON UPDATE CASCADE;
