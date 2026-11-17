CREATE TABLE "FinancialSettlement" (
    "id" UUID NOT NULL,
    "financialEntryId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "settlementDate" DATE NOT NULL,
    "financialAccountId" UUID NOT NULL,
    "paymentMethodId" UUID NOT NULL,
    "observation" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialSettlement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FinancialSettlement_amount_positive_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "FinancialSettlement_idempotencyKey_key" ON "FinancialSettlement"("idempotencyKey");
CREATE INDEX "FinancialSettlement_financialEntryId_settlementDate_idx" ON "FinancialSettlement"("financialEntryId", "settlementDate");
CREATE INDEX "FinancialSettlement_financialAccountId_settlementDate_idx" ON "FinancialSettlement"("financialAccountId", "settlementDate");
CREATE INDEX "FinancialSettlement_paymentMethodId_settlementDate_idx" ON "FinancialSettlement"("paymentMethodId", "settlementDate");

ALTER TABLE "FinancialSettlement" ADD CONSTRAINT "FinancialSettlement_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialSettlement" ADD CONSTRAINT "FinancialSettlement_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialSettlement" ADD CONSTRAINT "FinancialSettlement_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
