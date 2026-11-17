-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobRoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'AUTONOMOUS');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "CompensationUnit" AS ENUM ('MONTHLY', 'HOURLY', 'PER_SERVICE');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'CALCULATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayrollStatementStatus" AS ENUM ('DRAFT', 'CALCULATED', 'CLOSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PayrollLineItemType" AS ENUM ('EARNING', 'BENEFIT', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayrollLineItemOrigin" AS ENUM ('CALCULATED', 'MANUAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ServiceProviderType" AS ENUM ('AUTONOMOUS', 'COMPANY');

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "fullName" TEXT NOT NULL,
    "taxIdentifierHash" VARCHAR(64),
    "taxIdentifierEncrypted" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRole" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "JobRoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employment" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "jobRoleId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "EmploymentType" NOT NULL,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATE NOT NULL,
    "endedAt" DATE,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentCompensation" (
    "id" UUID NOT NULL,
    "employmentId" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "unit" "CompensationUnit" NOT NULL DEFAULT 'MONTHLY',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "changeReason" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "competence" DATE NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "calculatedAt" TIMESTAMP(3),
    "calculatedByUserId" UUID,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" UUID,
    "closeReason" TEXT,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollStatement" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "payrollPeriodId" UUID NOT NULL,
    "employmentId" UUID NOT NULL,
    "compensationId" UUID,
    "financialEntryId" UUID,
    "status" "PayrollStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "grossAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "benefitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "calculatedAt" TIMESTAMP(3),
    "calculatedByUserId" UUID,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" UUID,
    "closeReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" UUID,
    "voidReason" TEXT,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLineItem" (
    "id" UUID NOT NULL,
    "payrollStatementId" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "type" "PayrollLineItemType" NOT NULL,
    "origin" "PayrollLineItemOrigin" NOT NULL DEFAULT 'CALCULATED',
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4),
    "unitAmount" DECIMAL(14,4),
    "amount" DECIMAL(14,2) NOT NULL,
    "affectsNet" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "sourcePayrollStatementId" UUID NOT NULL,
    "appliedPayrollStatementId" UUID,
    "type" "PayrollAdjustmentType" NOT NULL,
    "status" "PayrollAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "appliedByUserId" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" UUID,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollReceipt" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "payrollStatementId" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "documentHash" VARCHAR(64),
    "storageKey" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedByUserId" UUID,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" UUID,
    "voidReason" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReceipt" (
    "id" UUID NOT NULL,
    "businessUnitId" UUID NOT NULL,
    "providerEmploymentId" UUID,
    "financialEntryId" UUID,
    "providerType" "ServiceProviderType" NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "competence" DATE NOT NULL,
    "serviceDate" DATE NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientTaxIdentifierHash" VARCHAR(64),
    "recipientTaxIdentifierEncrypted" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "documentHash" VARCHAR(64),
    "storageKey" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedByUserId" UUID,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" UUID,
    "voidReason" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_taxIdentifierHash_key" ON "Employee"("taxIdentifierHash");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE INDEX "Employee_status_deletedAt_idx" ON "Employee"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "JobRole_businessUnitId_status_idx" ON "JobRole"("businessUnitId", "status");

-- CreateIndex
CREATE INDEX "JobRole_businessUnitId_name_idx" ON "JobRole"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_businessUnitId_code_key" ON "JobRole"("businessUnitId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_id_businessUnitId_key" ON "JobRole"("id", "businessUnitId");

-- CreateIndex
CREATE INDEX "Employment_employeeId_status_idx" ON "Employment"("employeeId", "status");

-- CreateIndex
CREATE INDEX "Employment_businessUnitId_status_idx" ON "Employment"("businessUnitId", "status");

-- CreateIndex
CREATE INDEX "Employment_jobRoleId_businessUnitId_idx" ON "Employment"("jobRoleId", "businessUnitId");

-- CreateIndex
CREATE INDEX "Employment_startedAt_endedAt_idx" ON "Employment"("startedAt", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employment_businessUnitId_code_key" ON "Employment"("businessUnitId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Employment_id_businessUnitId_key" ON "Employment"("id", "businessUnitId");

-- CreateIndex
CREATE INDEX "EmploymentCompensation_businessUnitId_effectiveFrom_idx" ON "EmploymentCompensation"("businessUnitId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmploymentCompensation_employmentId_effectiveFrom_effective_idx" ON "EmploymentCompensation"("employmentId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentCompensation_employmentId_effectiveFrom_key" ON "EmploymentCompensation"("employmentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PayrollPeriod_businessUnitId_status_competence_idx" ON "PayrollPeriod"("businessUnitId", "status", "competence");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_businessUnitId_competence_key" ON "PayrollPeriod"("businessUnitId", "competence");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_id_businessUnitId_key" ON "PayrollPeriod"("id", "businessUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStatement_financialEntryId_key" ON "PayrollStatement"("financialEntryId");

-- CreateIndex
CREATE INDEX "PayrollStatement_businessUnitId_status_idx" ON "PayrollStatement"("businessUnitId", "status");

-- CreateIndex
CREATE INDEX "PayrollStatement_employmentId_status_idx" ON "PayrollStatement"("employmentId", "status");

-- CreateIndex
CREATE INDEX "PayrollStatement_compensationId_idx" ON "PayrollStatement"("compensationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStatement_payrollPeriodId_employmentId_key" ON "PayrollStatement"("payrollPeriodId", "employmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStatement_id_businessUnitId_key" ON "PayrollStatement"("id", "businessUnitId");

-- CreateIndex
CREATE INDEX "PayrollLineItem_businessUnitId_type_idx" ON "PayrollLineItem"("businessUnitId", "type");

-- CreateIndex
CREATE INDEX "PayrollLineItem_payrollStatementId_type_idx" ON "PayrollLineItem"("payrollStatementId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLineItem_payrollStatementId_code_key" ON "PayrollLineItem"("payrollStatementId", "code");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_businessUnitId_status_idx" ON "PayrollAdjustment"("businessUnitId", "status");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_sourcePayrollStatementId_status_idx" ON "PayrollAdjustment"("sourcePayrollStatementId", "status");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_appliedPayrollStatementId_idx" ON "PayrollAdjustment"("appliedPayrollStatementId");

-- CreateIndex
CREATE INDEX "PayrollReceipt_businessUnitId_status_issuedAt_idx" ON "PayrollReceipt"("businessUnitId", "status", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollReceipt_businessUnitId_receiptNumber_key" ON "PayrollReceipt"("businessUnitId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollReceipt_payrollStatementId_version_key" ON "PayrollReceipt"("payrollStatementId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReceipt_financialEntryId_key" ON "ServiceReceipt"("financialEntryId");

-- CreateIndex
CREATE INDEX "ServiceReceipt_businessUnitId_competence_status_idx" ON "ServiceReceipt"("businessUnitId", "competence", "status");

-- CreateIndex
CREATE INDEX "ServiceReceipt_providerEmploymentId_competence_idx" ON "ServiceReceipt"("providerEmploymentId", "competence");

-- CreateIndex
CREATE INDEX "ServiceReceipt_recipientTaxIdentifierHash_idx" ON "ServiceReceipt"("recipientTaxIdentifierHash");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReceipt_businessUnitId_receiptNumber_key" ON "ServiceReceipt"("businessUnitId", "receiptNumber");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_jobRoleId_businessUnitId_fkey" FOREIGN KEY ("jobRoleId", "businessUnitId") REFERENCES "JobRole"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentCompensation" ADD CONSTRAINT "EmploymentCompensation_employmentId_businessUnitId_fkey" FOREIGN KEY ("employmentId", "businessUnitId") REFERENCES "Employment"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentCompensation" ADD CONSTRAINT "EmploymentCompensation_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentCompensation" ADD CONSTRAINT "EmploymentCompensation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentCompensation" ADD CONSTRAINT "EmploymentCompensation_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_calculatedByUserId_fkey" FOREIGN KEY ("calculatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_payrollPeriodId_businessUnitId_fkey" FOREIGN KEY ("payrollPeriodId", "businessUnitId") REFERENCES "PayrollPeriod"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_employmentId_businessUnitId_fkey" FOREIGN KEY ("employmentId", "businessUnitId") REFERENCES "Employment"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_compensationId_fkey" FOREIGN KEY ("compensationId") REFERENCES "EmploymentCompensation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_calculatedByUserId_fkey" FOREIGN KEY ("calculatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatement" ADD CONSTRAINT "PayrollStatement_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_payrollStatementId_businessUnitId_fkey" FOREIGN KEY ("payrollStatementId", "businessUnitId") REFERENCES "PayrollStatement"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_sourcePayrollStatementId_businessUnitId_fkey" FOREIGN KEY ("sourcePayrollStatementId", "businessUnitId") REFERENCES "PayrollStatement"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_appliedPayrollStatementId_businessUnitId_fkey" FOREIGN KEY ("appliedPayrollStatementId", "businessUnitId") REFERENCES "PayrollStatement"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_payrollStatementId_businessUnitId_fkey" FOREIGN KEY ("payrollStatementId", "businessUnitId") REFERENCES "PayrollStatement"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_providerEmploymentId_businessUnitId_fkey" FOREIGN KEY ("providerEmploymentId", "businessUnitId") REFERENCES "Employment"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
