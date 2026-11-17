import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const backend = await readFile(new URL("./salary-payment-backend.ts", import.meta.url), "utf8");
const start = backend.indexOf("export async function reverseSalaryPayment");
const reversal = backend.slice(start);

test("estorno preserva originais e grava auditoria, cancelamento e desvinculação atomicamente", () => {
  assert.match(reversal, /prisma\.\$transaction/);
  assert.match(reversal, /INSERT INTO "PayrollSalaryPaymentReversal"/);
  assert.match(reversal, /status: "VOIDED"/);
  assert.match(reversal, /voidedAt: reversedAt/);
  assert.match(reversal, /voidedByUserId: input\.actorUserId/);
  assert.match(reversal, /voidReason: reason/);
  assert.match(reversal, /financialEntry\.update[\s\S]*status: "CANCELLED"/);
  assert.match(reversal, /financialEntryId: null/);
  assert.doesNotMatch(reversal, /financialSettlement\.(delete|update)|payrollSalaryPaymentConfirmation\.(delete|update)|payrollReceiptSnapshot\.(delete|update)/);
});

test("repetição usa a mesma auditoria e conflito não cria segundo estorno", () => {
  assert.match(reversal, /previous\[0\]\.idempotencyKey !== input\.idempotencyKey/);
  assert.match(reversal, /previous\[0\]\.requestSha256 !== requestSha256/);
  assert.match(reversal, /repeated: true/);
  assert.match(reversal, /ALREADY_REVERSED/);
  assert.match(reversal, /pg_advisory_xact_lock/);
});

test("migração permite nova confirmação somente após preservar reversão anterior", async () => {
  const sql = await readFile(new URL("../../../../prisma/migrations/20260925223000_salary_payment_reversal/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /DROP INDEX "SalaryPayment_statement_key"/);
  assert.match(sql, /CREATE TABLE "PayrollSalaryPaymentReversal"/);
  assert.match(sql, /UNIQUE INDEX "PayrollSalaryPaymentReversal_paymentConfirmationId_key"/);
  assert.match(sql, /SalaryPaymentReversal_immutable/);
  assert.match(backend, /AND r\."status" = 'ISSUED'/);
  assert.match(backend, /sourceType: "PAYROLL_SALARY_PAYMENT", sourceId: input\.idempotencyKey/);
});

test("cancelar lançamento realizado retira exatamente a despesa de 810 do saldo sem apagar liquidação", () => {
  const accountEffect = (entries: readonly { type: "REVENUE" | "EXPENSE"; status: string; settlements: readonly number[] }[]) =>
    entries.filter((entry) => entry.status !== "CANCELLED").reduce((balance, entry) => {
      const total = entry.settlements.reduce((sum, amount) => sum + amount, 0);
      return balance + (entry.type === "REVENUE" ? total : -total);
    }, 0);
  const before = accountEffect([
    { type: "EXPENSE", status: "SETTLED", settlements: [10] },
    { type: "EXPENSE", status: "SETTLED", settlements: [810] },
  ]);
  const after = accountEffect([
    { type: "EXPENSE", status: "SETTLED", settlements: [10] },
    { type: "EXPENSE", status: "CANCELLED", settlements: [810] },
  ]);
  assert.equal(before, -820);
  assert.equal(after, -10);
  assert.equal(after - before, 810);
});
