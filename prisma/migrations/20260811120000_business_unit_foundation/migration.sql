CREATE TYPE "BusinessUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "BusinessUnit" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BusinessUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessUnit_code_key" ON "BusinessUnit"("code");

CREATE INDEX "BusinessUnit_status_idx" ON "BusinessUnit"("status");
