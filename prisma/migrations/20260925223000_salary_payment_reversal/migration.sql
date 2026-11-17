-- Estorno salarial auditável: preserva confirmação, liquidação e snapshot originais.
DROP INDEX "SalaryPayment_statement_key";
DROP INDEX "SalaryPayment_statement_unit_key";
CREATE INDEX "SalaryPayment_statement_unit_idx"
  ON "PayrollSalaryPaymentConfirmation"("payrollStatementId", "businessUnitId");

CREATE TABLE "PayrollSalaryPaymentReversal" (
  "id" UUID NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestSha256" VARCHAR(64) NOT NULL,
  "businessUnitId" UUID NOT NULL,
  "payrollStatementId" UUID NOT NULL,
  "paymentConfirmationId" UUID NOT NULL,
  "receiptId" UUID NOT NULL,
  "originalFinancialEntryId" UUID NOT NULL,
  "originalSettlementId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedByUserId" UUID NOT NULL,
  CONSTRAINT "PayrollSalaryPaymentReversal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalaryReversal_reason" CHECK (CHAR_LENGTH(BTRIM("reason")) BETWEEN 10 AND 500),
  CONSTRAINT "SalaryReversal_request_hash" CHECK ("requestSha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "PayrollSalaryPaymentReversal_idempotencyKey_key" ON "PayrollSalaryPaymentReversal"("idempotencyKey");
CREATE UNIQUE INDEX "PayrollSalaryPaymentReversal_paymentConfirmationId_key" ON "PayrollSalaryPaymentReversal"("paymentConfirmationId");
CREATE UNIQUE INDEX "PayrollSalaryPaymentReversal_receiptId_key" ON "PayrollSalaryPaymentReversal"("receiptId");
CREATE INDEX "PayrollSalaryPaymentReversal_businessUnitId_reversedAt_idx" ON "PayrollSalaryPaymentReversal"("businessUnitId", "reversedAt");
CREATE INDEX "PayrollSalaryPaymentReversal_payrollStatementId_reversedAt_idx" ON "PayrollSalaryPaymentReversal"("payrollStatementId", "reversedAt");

ALTER TABLE "PayrollSalaryPaymentReversal" ADD CONSTRAINT "SalaryReversal_unit_fkey"
  FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentReversal" ADD CONSTRAINT "SalaryReversal_statement_fkey"
  FOREIGN KEY ("payrollStatementId", "businessUnitId") REFERENCES "PayrollStatement"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentReversal" ADD CONSTRAINT "SalaryReversal_confirmation_fkey"
  FOREIGN KEY ("paymentConfirmationId") REFERENCES "PayrollSalaryPaymentConfirmation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentReversal" ADD CONSTRAINT "SalaryReversal_receipt_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "PayrollReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentReversal" ADD CONSTRAINT "SalaryReversal_entry_fkey"
  FOREIGN KEY ("originalFinancialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentReversal" ADD CONSTRAINT "SalaryReversal_settlement_fkey"
  FOREIGN KEY ("originalSettlementId") REFERENCES "FinancialSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentReversal" ADD CONSTRAINT "SalaryReversal_user_fkey"
  FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "SalaryPaymentReversal_immutable"
  BEFORE UPDATE OR DELETE ON "PayrollSalaryPaymentReversal"
  FOR EACH ROW EXECUTE FUNCTION "salary_receipt_immutable_row"();
