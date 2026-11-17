CREATE TYPE "FinancialEntryType" AS ENUM ('REVENUE', 'EXPENSE');

CREATE TYPE "FinancialReferenceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK', 'DIGITAL_WALLET', 'OTHER');

CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'BOLETO', 'OTHER');

CREATE TYPE "FinancialEntryStatus" AS ENUM ('PENDING', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED');

CREATE TYPE "FinancialEntryOrigin" AS ENUM ('MANUAL', 'EXTERNAL_IMPORT', 'INTERNAL_INTEGRATION');

CREATE TABLE "FinancialCategory" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialEntryType" NOT NULL,
    "businessUnitId" UUID,
    "status" "FinancialReferenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CostCenter" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "status" "FinancialReferenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAccount" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "status" "FinancialReferenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "status" "FinancialReferenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialEntry" (
    "id" UUID NOT NULL,
    "type" "FinancialEntryType" NOT NULL,
    "competence" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "FinancialEntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "businessUnitId" UUID NOT NULL,
    "financialCategoryId" UUID NOT NULL,
    "costCenterId" UUID,
    "financialAccountId" UUID,
    "paymentMethodId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialCategory_code_key" ON "FinancialCategory"("code");
CREATE INDEX "FinancialCategory_businessUnitId_type_status_idx" ON "FinancialCategory"("businessUnitId", "type", "status");
CREATE INDEX "FinancialCategory_type_status_idx" ON "FinancialCategory"("type", "status");

CREATE INDEX "CostCenter_businessUnitId_status_idx" ON "CostCenter"("businessUnitId", "status");
CREATE UNIQUE INDEX "CostCenter_businessUnitId_code_key" ON "CostCenter"("businessUnitId", "code");

CREATE INDEX "FinancialAccount_businessUnitId_status_idx" ON "FinancialAccount"("businessUnitId", "status");
CREATE INDEX "FinancialAccount_type_status_idx" ON "FinancialAccount"("type", "status");
CREATE UNIQUE INDEX "FinancialAccount_businessUnitId_code_key" ON "FinancialAccount"("businessUnitId", "code");

CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");
CREATE INDEX "PaymentMethod_type_status_idx" ON "PaymentMethod"("type", "status");

CREATE INDEX "FinancialEntry_businessUnitId_competence_idx" ON "FinancialEntry"("businessUnitId", "competence");
CREATE INDEX "FinancialEntry_businessUnitId_dueDate_status_idx" ON "FinancialEntry"("businessUnitId", "dueDate", "status");
CREATE INDEX "FinancialEntry_financialCategoryId_idx" ON "FinancialEntry"("financialCategoryId");
CREATE INDEX "FinancialEntry_costCenterId_idx" ON "FinancialEntry"("costCenterId");
CREATE INDEX "FinancialEntry_financialAccountId_idx" ON "FinancialEntry"("financialAccountId");
CREATE INDEX "FinancialEntry_paymentMethodId_idx" ON "FinancialEntry"("paymentMethodId");
CREATE INDEX "FinancialEntry_type_status_idx" ON "FinancialEntry"("type", "status");
CREATE UNIQUE INDEX "FinancialEntry_businessUnitId_sourceType_sourceId_key" ON "FinancialEntry"("businessUnitId", "sourceType", "sourceId");

ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_financialCategoryId_fkey" FOREIGN KEY ("financialCategoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
