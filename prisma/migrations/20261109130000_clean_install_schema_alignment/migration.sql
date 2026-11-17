-- Forward-only alignment for fields already present in the Prisma schema but
-- absent from the historical migration chain. All additions are idempotent so
-- an installation with recorded history can receive this migration safely.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmploymentWorkSchedule') THEN
    CREATE TYPE "EmploymentWorkSchedule" AS ENUM ('FULL_TIME', 'PART_TIME', 'HOURLY', 'CUSTOM');
  END IF;
END
$$;

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "contactName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ALTER COLUMN "masterRecordId" DROP NOT NULL;

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "addressCity" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "addressComplement" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "addressNeighborhood" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "addressNumber" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "addressState" CHAR(2),
  ADD COLUMN IF NOT EXISTS "addressStreet" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "birthDate" DATE,
  ADD COLUMN IF NOT EXISTS "email" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "identityDocumentEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "identityIssuer" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "identityState" CHAR(2),
  ADD COLUMN IF NOT EXISTS "paymentDetailsEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "phone" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "postalCode" VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "socialSecurityEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "socialSecurityHash" VARCHAR(64);

ALTER TABLE "Employment"
  ADD COLUMN IF NOT EXISTS "weeklyWorkingHours" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "workSchedule" "EmploymentWorkSchedule" NOT NULL DEFAULT 'FULL_TIME';

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_socialSecurityHash_key"
  ON "Employee"("socialSecurityHash");
CREATE INDEX IF NOT EXISTS "Employee_birthDate_idx"
  ON "Employee"("birthDate");
