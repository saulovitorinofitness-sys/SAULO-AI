import assert from "node:assert/strict";
import test from "node:test";

import {
  accountSupportsSalaryPayment,
  salaryPaymentDescription,
  salarySettlementIdempotencyKey,
} from "./salary-payment-preparation";

test("conta deve ser compatível com a forma selecionada", () => {
  assert.equal(accountSupportsSalaryPayment("CASH", "CASH"), true);
  assert.equal(accountSupportsSalaryPayment("CASH", "BANK"), false);
  assert.equal(accountSupportsSalaryPayment("PIX", "BANK"), true);
  assert.equal(accountSupportsSalaryPayment("PIX", "DIGITAL_WALLET"), true);
  assert.equal(accountSupportsSalaryPayment("BANK_DEPOSIT", "DIGITAL_WALLET"), false);
});

test("descrição e idempotência permanecem individualizadas por demonstrativo", () => {
  assert.equal(salaryPaymentDescription("Aniethy Ribeiro Oliveira", "2026-09-01"), "Pagamento salarial — Aniethy Ribeiro Oliveira — 2026-09");
  assert.equal(salaryPaymentDescription("Maria de Lourdes Gomes", "2026-09-01"), "Pagamento salarial — Maria de Lourdes Gomes — 2026-09");
  assert.notEqual(salarySettlementIdempotencyKey("statement-aniethy", "request-a"), salarySettlementIdempotencyKey("statement-maria", "request-b"));
  assert.notEqual(salarySettlementIdempotencyKey("statement-aniethy", "request-a"), salarySettlementIdempotencyKey("statement-aniethy", "request-b"));
});
