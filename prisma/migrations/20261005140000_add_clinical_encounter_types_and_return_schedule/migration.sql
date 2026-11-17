-- CreateEnum
CREATE TYPE "ClinicalAttendanceType" AS ENUM (
  'FIRST_CONSULTATION',
  'RETURN',
  'REASSESSMENT',
  'FOLLOW_UP',
  'SINGLE_CONSULTATION'
);

-- CreateEnum
CREATE TYPE "AppointmentOrigin" AS ENUM ('MANUAL', 'CLINICAL_RETURN');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';

-- AlterTable
ALTER TABLE "Appointment"
  ADD COLUMN "patientId" UUID,
  ADD COLUMN "sourceAttendanceId" UUID,
  ADD COLUMN "clinicalType" "ClinicalAttendanceType",
  ADD COLUMN "origin" "AppointmentOrigin" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "estimatedDurationMinutes" INTEGER,
  ADD COLUMN "deduplicationKey" TEXT;

-- AlterTable
ALTER TABLE "Attendance"
  ADD COLUMN "previousAttendanceId" UUID,
  ADD COLUMN "clinicalType" "ClinicalAttendanceType",
  ADD COLUMN "clinicalCycleId" UUID,
  ADD COLUMN "clinicalCycleSequence" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_sourceAttendanceId_key" ON "Appointment"("sourceAttendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_deduplicationKey_key" ON "Appointment"("deduplicationKey");

-- CreateIndex
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_clinicalType_startsAt_idx" ON "Appointment"("clinicalType", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_origin_idx" ON "Appointment"("origin");

-- CreateIndex
CREATE INDEX "Attendance_previousAttendanceId_idx" ON "Attendance"("previousAttendanceId");

-- CreateIndex
CREATE INDEX "Attendance_clinicalCycleId_clinicalCycleSequence_idx" ON "Attendance"("clinicalCycleId", "clinicalCycleSequence");

-- AddForeignKey
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_sourceAttendanceId_fkey"
  FOREIGN KEY ("sourceAttendanceId") REFERENCES "Attendance"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_previousAttendanceId_fkey"
  FOREIGN KEY ("previousAttendanceId") REFERENCES "Attendance"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
