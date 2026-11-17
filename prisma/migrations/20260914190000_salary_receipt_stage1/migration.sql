-- ETAPA 1: estrutura apenas. Nenhum pagamento, assinatura, comprovante ou snapshot e inferido.
-- O DEFAULT classifica todos os PayrollReceipt existentes como demonstrativos legados.
-- Antes de emitir recibos novos, a administracao deve preencher a identificacao legal
-- das unidades e confirmar o pagamento com a evidencia exigida pela ETAPA 2.
-- Reversao estrutural so e segura antes de existirem novos recibos salariais; preservar
-- backup e nunca descartar snapshots ou evidencias para executar um rollback.
-- O backup do PostgreSQL deve incluir PayrollPaymentEvidenceBlob e ser testado
-- em restauracao; comprovantes nao podem ser reconstruidos a partir de metadados.

CREATE TYPE "EmployerTaxIdType" AS ENUM ('CNPJ', 'CPF');
CREATE TYPE "PayrollDocumentKind" AS ENUM ('LEGACY_DEMONSTRATIVE', 'SALARY_RECEIPT');
CREATE TYPE "PayrollSalaryPaymentMethod" AS ENUM ('CASH', 'PIX', 'BANK_TRANSFER', 'BANK_DEPOSIT');
CREATE TYPE "PayrollReceiptEvidenceKind" AS ENUM ('BANK_PROOF', 'SIGNED_COPY');
ALTER TYPE "PaymentMethodType" ADD VALUE 'BANK_DEPOSIT';

ALTER TABLE "BusinessUnit"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "tradeName" TEXT,
  ADD COLUMN "legalTaxIdType" "EmployerTaxIdType",
  ADD COLUMN "legalTaxIdEncrypted" TEXT,
  ADD COLUMN "addressStreet" TEXT,
  ADD COLUMN "addressNumber" TEXT,
  ADD COLUMN "addressComplement" TEXT,
  ADD COLUMN "addressNeighborhood" TEXT,
  ADD COLUMN "addressPostalCode" VARCHAR(8),
  ADD COLUMN "addressCity" TEXT,
  ADD COLUMN "addressState" CHAR(2);

ALTER TABLE "PayrollReceipt"
  ADD COLUMN "kind" "PayrollDocumentKind" NOT NULL DEFAULT 'LEGACY_DEMONSTRATIVE',
  ADD COLUMN "paymentConfirmationId" UUID;

CREATE TABLE "PayrollSalaryPaymentConfirmation" (
  "id" UUID NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestSha256" VARCHAR(64) NOT NULL,
  "businessUnitId" UUID NOT NULL,
  "payrollStatementId" UUID NOT NULL,
  "financialEntryId" UUID NOT NULL,
  "financialSettlementId" UUID NOT NULL,
  "paidAt" DATE NOT NULL,
  "method" "PayrollSalaryPaymentMethod" NOT NULL,
  "paidAmount" DECIMAL(14,2) NOT NULL,
  "bankReference" VARCHAR(180),
  "confirmedByUserId" UUID NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollSalaryPaymentConfirmation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalaryPayment_positive_amount" CHECK ("paidAmount" > 0),
  CONSTRAINT "SalaryPayment_request_hash_format" CHECK ("requestSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "SalaryPayment_bank_reference" CHECK (
    "method" = 'CASH' OR ("bankReference" IS NOT NULL AND BTRIM("bankReference") <> '')
  )
);

CREATE TABLE "PayrollReceiptSnapshot" (
  "receiptId" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "payloadCiphertext" BYTEA NOT NULL,
  "encryptionVersion" INTEGER NOT NULL,
  "payloadSha256" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollReceiptSnapshot_pkey" PRIMARY KEY ("receiptId"),
  CONSTRAINT "SalarySnapshot_versions_positive" CHECK ("schemaVersion" > 0 AND "encryptionVersion" > 0),
  CONSTRAINT "SalarySnapshot_hash_format" CHECK ("payloadSha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "PayrollReceiptEvidence" (
  "id" UUID NOT NULL,
  "receiptId" UUID NOT NULL,
  "businessUnitId" UUID NOT NULL,
  "payrollStatementId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "kind" "PayrollReceiptEvidenceKind" NOT NULL,
  "storageKey" VARCHAR(500) NOT NULL,
  "originalFileName" VARCHAR(255),
  "mimeType" VARCHAR(80),
  "byteLength" INTEGER,
  "sha256" VARCHAR(64) NOT NULL,
  "signedAt" DATE,
  "recordedByUserId" UUID NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollReceiptEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalaryEvidence_hash_format" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "SalaryEvidence_bank_metadata" CHECK ("kind" <> 'BANK_PROOF' OR (
    "originalFileName" IS NOT NULL AND BTRIM("originalFileName") <> '' AND
    "mimeType" IS NOT NULL AND "mimeType" IN ('application/pdf', 'image/jpeg', 'image/png') AND
    "byteLength" IS NOT NULL AND "byteLength" BETWEEN 1 AND 10485760
  )),
  CONSTRAINT "SalaryEvidence_signed_copy_date" CHECK ("kind" <> 'SIGNED_COPY' OR "signedAt" IS NOT NULL)
);

CREATE TABLE "PayrollPaymentEvidenceBlob" (
  "evidenceId" UUID NOT NULL,
  "content" BYTEA NOT NULL,
  CONSTRAINT "PayrollPaymentEvidenceBlob_pkey" PRIMARY KEY ("evidenceId"),
  CONSTRAINT "SalaryEvidenceBlob_size" CHECK (OCTET_LENGTH("content") BETWEEN 1 AND 10485760)
);

CREATE UNIQUE INDEX "SalaryPayment_statement_key" ON "PayrollSalaryPaymentConfirmation"("payrollStatementId");
CREATE UNIQUE INDEX "SalaryPayment_idempotency_key" ON "PayrollSalaryPaymentConfirmation"("idempotencyKey");
CREATE UNIQUE INDEX "SalaryPayment_statement_unit_key" ON "PayrollSalaryPaymentConfirmation"("payrollStatementId", "businessUnitId");
CREATE UNIQUE INDEX "SalaryPayment_entry_key" ON "PayrollSalaryPaymentConfirmation"("financialEntryId");
CREATE UNIQUE INDEX "SalaryPayment_settlement_key" ON "PayrollSalaryPaymentConfirmation"("financialSettlementId");
CREATE INDEX "SalaryPayment_unit_paid_idx" ON "PayrollSalaryPaymentConfirmation"("businessUnitId", "paidAt");
CREATE INDEX "PayrollReceipt_kind_unit_issued_idx" ON "PayrollReceipt"("kind", "businessUnitId", "issuedAt");
CREATE INDEX "PayrollReceipt_confirmation_idx" ON "PayrollReceipt"("paymentConfirmationId");
CREATE UNIQUE INDEX "PayrollReceipt_one_active_salary_receipt" ON "PayrollReceipt"("paymentConfirmationId")
  WHERE "kind" = 'SALARY_RECEIPT' AND "status" = 'ISSUED';
CREATE UNIQUE INDEX "SalaryEvidence_receipt_kind_hash_key" ON "PayrollReceiptEvidence"("receiptId", "kind", "sha256");
CREATE UNIQUE INDEX "SalaryEvidence_hash_key" ON "PayrollReceiptEvidence"("sha256");
CREATE UNIQUE INDEX "SalaryEvidence_storage_key" ON "PayrollReceiptEvidence"("storageKey");
CREATE INDEX "SalaryEvidence_receipt_kind_date_idx" ON "PayrollReceiptEvidence"("receiptId", "kind", "recordedAt");

ALTER TABLE "PayrollSalaryPaymentConfirmation" ADD CONSTRAINT "SalaryPayment_unit_fkey"
  FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentConfirmation" ADD CONSTRAINT "SalaryPayment_statement_fkey"
  FOREIGN KEY ("payrollStatementId", "businessUnitId") REFERENCES "PayrollStatement"("id", "businessUnitId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentConfirmation" ADD CONSTRAINT "SalaryPayment_entry_fkey"
  FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentConfirmation" ADD CONSTRAINT "SalaryPayment_settlement_fkey"
  FOREIGN KEY ("financialSettlementId") REFERENCES "FinancialSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryPaymentConfirmation" ADD CONSTRAINT "SalaryPayment_confirmer_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_paymentConfirmationId_fkey"
  FOREIGN KEY ("paymentConfirmationId") REFERENCES "PayrollSalaryPaymentConfirmation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollReceiptSnapshot" ADD CONSTRAINT "SalarySnapshot_receipt_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "PayrollReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollReceiptEvidence" ADD CONSTRAINT "SalaryEvidence_receipt_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "PayrollReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollReceiptEvidence" ADD CONSTRAINT "SalaryEvidence_recorder_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentEvidenceBlob" ADD CONSTRAINT "SalaryEvidenceBlob_evidence_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "PayrollReceiptEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_salary_requires_confirmation"
  CHECK ("kind" <> 'SALARY_RECEIPT' OR
    ("paymentConfirmationId" IS NOT NULL AND "status" IN ('ISSUED', 'VOIDED')));

CREATE FUNCTION "salary_receipt_immutable_row"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Historico de recibo salarial e imutavel';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SalarySnapshot_immutable" BEFORE UPDATE OR DELETE ON "PayrollReceiptSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "salary_receipt_immutable_row"();
CREATE TRIGGER "SalaryPayment_immutable" BEFORE UPDATE OR DELETE ON "PayrollSalaryPaymentConfirmation"
  FOR EACH ROW EXECUTE FUNCTION "salary_receipt_immutable_row"();
CREATE TRIGGER "SalaryEvidence_immutable" BEFORE UPDATE OR DELETE ON "PayrollReceiptEvidence"
  FOR EACH ROW EXECUTE FUNCTION "salary_receipt_immutable_row"();
CREATE TRIGGER "SalaryEvidenceBlob_immutable" BEFORE UPDATE OR DELETE ON "PayrollPaymentEvidenceBlob"
  FOR EACH ROW EXECUTE FUNCTION "salary_receipt_immutable_row"();

CREATE FUNCTION "salary_receipt_guard_identity"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."kind" = 'SALARY_RECEIPT' THEN
      RAISE EXCEPTION 'Recibo salarial emitido nao pode ser excluido';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."kind" IS DISTINCT FROM NEW."kind" OR
     (OLD."kind" = 'SALARY_RECEIPT' AND (
       OLD."businessUnitId" IS DISTINCT FROM NEW."businessUnitId" OR
       OLD."payrollStatementId" IS DISTINCT FROM NEW."payrollStatementId" OR
       OLD."paymentConfirmationId" IS DISTINCT FROM NEW."paymentConfirmationId" OR
       OLD."receiptNumber" IS DISTINCT FROM NEW."receiptNumber" OR
       OLD."version" IS DISTINCT FROM NEW."version" OR
       OLD."documentHash" IS DISTINCT FROM NEW."documentHash" OR
       OLD."storageKey" IS DISTINCT FROM NEW."storageKey" OR
       OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt" OR
       OLD."issuedByUserId" IS DISTINCT FROM NEW."issuedByUserId" OR
       (OLD."status" = 'VOIDED' AND NEW."status" <> 'VOIDED')
     )) THEN
    RAISE EXCEPTION 'Identidade ou classificacao do recibo nao pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SalaryReceipt_identity_guard" BEFORE UPDATE OR DELETE ON "PayrollReceipt"
  FOR EACH ROW EXECUTE FUNCTION "salary_receipt_guard_identity"();

-- Restricao diferida: a ETAPA 2 deve inserir confirmacao, recibo, snapshot e,
-- para meios bancarios, comprovante privado na mesma transacao.
CREATE FUNCTION "salary_receipt_require_complete"() RETURNS trigger AS $$
DECLARE payment_method "PayrollSalaryPaymentMethod";
BEGIN
  IF NEW."kind" <> 'SALARY_RECEIPT' THEN RETURN NEW; END IF;
  SELECT "method" INTO payment_method FROM "PayrollSalaryPaymentConfirmation"
    WHERE "id" = NEW."paymentConfirmationId"
      AND "businessUnitId" = NEW."businessUnitId"
      AND "payrollStatementId" = NEW."payrollStatementId";
  IF payment_method IS NULL OR NOT EXISTS (
    SELECT 1 FROM "PayrollReceiptSnapshot" WHERE "receiptId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Recibo salarial exige pagamento confirmado e snapshot';
  END IF;
  IF payment_method <> 'CASH' AND NOT EXISTS (
    SELECT 1 FROM "PayrollReceiptEvidence"
      JOIN "PayrollPaymentEvidenceBlob" ON "PayrollPaymentEvidenceBlob"."evidenceId" = "PayrollReceiptEvidence"."id"
      JOIN "PayrollStatement" ON "PayrollStatement"."id" = NEW."payrollStatementId"
      JOIN "Employment" ON "Employment"."id" = "PayrollStatement"."employmentId"
      WHERE "PayrollReceiptEvidence"."receiptId" = NEW."id"
        AND "PayrollReceiptEvidence"."kind" = 'BANK_PROOF'
        AND "PayrollReceiptEvidence"."businessUnitId" = NEW."businessUnitId"
        AND "PayrollReceiptEvidence"."payrollStatementId" = NEW."payrollStatementId"
        AND "PayrollReceiptEvidence"."employeeId" = "Employment"."employeeId"
        AND "PayrollReceiptEvidence"."byteLength" = OCTET_LENGTH("PayrollPaymentEvidenceBlob"."content")
  ) THEN
    RAISE EXCEPTION 'Recibo bancario exige comprovante armazenado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "SalaryReceipt_complete_at_commit"
  AFTER INSERT OR UPDATE ON "PayrollReceipt"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "salary_receipt_require_complete"();
