import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./salary-payment-backend.ts", import.meta.url), "utf8");
const transaction = source.slice(source.indexOf("const operation = () => prisma.$transaction"), source.indexOf("for (let attempt = 0"));

test("lançamento, vínculo, liquidação, confirmação e recibo ficam na mesma transação serializável", () => {
  assert.match(transaction, /tx\.financialEntry\.create/);
  assert.match(transaction, /tx\.payrollStatement\.update/);
  assert.match(transaction, /tx\.financialSettlement\.create/);
  assert.match(transaction, /INSERT INTO "PayrollSalaryPaymentConfirmation"/);
  assert.match(transaction, /INSERT INTO "PayrollReceipt"/);
  assert.match(transaction, /INSERT INTO "PayrollReceiptSnapshot"/);
  assert.match(transaction, /TransactionIsolationLevel\.Serializable/);
  assert.doesNotMatch(transaction, /prisma\.financialEntry\.create|prisma\.financialSettlement\.create/);
});

test("bloqueio, chave de origem e idempotência impedem duplicidade por demonstrativo", () => {
  assert.match(transaction, /pg_advisory_xact_lock/);
  assert.match(transaction, /sourceType: "PAYROLL_SALARY_PAYMENT", sourceId: input\.idempotencyKey/);
  assert.match(transaction, /salarySettlementIdempotencyKey\(statement\.id, input\.idempotencyKey\)/);
  assert.match(transaction, /decideSalaryPaymentReplay/);
});
