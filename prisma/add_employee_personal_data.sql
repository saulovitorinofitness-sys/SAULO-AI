ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "birthDate" DATE,
  ADD COLUMN IF NOT EXISTS "identityDocumentEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "identityIssuer" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "identityState" CHAR(2),
  ADD COLUMN IF NOT EXISTS "socialSecurityHash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "socialSecurityEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "email" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "postalCode" VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "addressStreet" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "addressNumber" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "addressComplement" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "addressNeighborhood" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "addressCity" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "addressState" CHAR(2),
  ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "paymentDetailsEncrypted" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_socialSecurityHash_key"
  ON "Employee"("socialSecurityHash");

CREATE INDEX IF NOT EXISTS "Employee_birthDate_idx"
  ON "Employee"("birthDate");
