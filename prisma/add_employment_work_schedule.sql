DO $$
BEGIN
  CREATE TYPE "EmploymentWorkSchedule" AS ENUM (
    'FULL_TIME',
    'PART_TIME',
    'HOURLY',
    'CUSTOM'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Employment"
  ADD COLUMN IF NOT EXISTS "workSchedule" "EmploymentWorkSchedule" NOT NULL DEFAULT 'FULL_TIME',
  ADD COLUMN IF NOT EXISTS "weeklyWorkingHours" DECIMAL(5, 2);
