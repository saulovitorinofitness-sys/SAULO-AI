import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { decideSalaryPaymentReplay, type ExistingSalaryReceipt } from "./salary-payment-replay";

function existing(): ExistingSalaryReceipt {
  return { receiptId: randomUUID(), evidenceId: null, method: "CASH", status: "ISSUED",
    idempotencyKey: randomUUID(), requestSha256: "a".repeat(64) };
}

test("primeira confirmacao segue e repeticao identica devolve o mesmo recibo", () => {
  const current = existing();
  assert.deepEqual(decideSalaryPaymentReplay(null, current.idempotencyKey, current.requestSha256), { kind: "NEW" });
  assert.deepEqual(decideSalaryPaymentReplay(current, current.idempotencyKey, current.requestSha256), {
    kind: "REPLAY", receiptId: current.receiptId, evidenceId: null, state: "CASH_AWAITING_SIGNATURE",
  });
});

test("chave distinta, pedido alterado ou recibo anulado nao criam segunda quitacao", () => {
  const current = existing();
  assert.deepEqual(decideSalaryPaymentReplay(current, randomUUID(), current.requestSha256), { kind: "REJECT", code: "DUPLICATE" });
  assert.deepEqual(decideSalaryPaymentReplay(current, current.idempotencyKey, "b".repeat(64)), { kind: "REJECT", code: "IDEMPOTENCY_CONFLICT" });
  assert.deepEqual(decideSalaryPaymentReplay({ ...current, status: "VOIDED" }, current.idempotencyKey, current.requestSha256), { kind: "REJECT", code: "DUPLICATE" });
});

test("repeticao de PIX sem comprovante conserva confirmacao sem inventar evidencia", () => {
  const current = { ...existing(), method: "PIX" as const };
  assert.deepEqual(decideSalaryPaymentReplay(current, current.idempotencyKey, current.requestSha256), {
    kind: "REPLAY", receiptId: current.receiptId, evidenceId: null, state: "PAYMENT_CONFIRMED",
  });
});
