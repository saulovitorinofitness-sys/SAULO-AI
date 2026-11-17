-- Referência e comprovante são metadados opcionais. A confirmação, a liquidação
-- integral e o snapshot imutável continuam obrigatórios para o recibo salarial.
ALTER TABLE "PayrollSalaryPaymentConfirmation"
  DROP CONSTRAINT "SalaryPayment_bank_reference";

ALTER TABLE "PayrollSalaryPaymentConfirmation"
  ADD CONSTRAINT "SalaryPayment_bank_reference" CHECK (
    "bankReference" IS NULL OR BTRIM("bankReference") <> ''
  );

CREATE OR REPLACE FUNCTION "salary_receipt_require_complete"() RETURNS trigger AS $$
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
