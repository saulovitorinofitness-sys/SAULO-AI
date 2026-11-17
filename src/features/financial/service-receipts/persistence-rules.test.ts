import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAllowedReceiptEvent,
  assertAtomicRefund,
  assertNoLegacyReceiptCollision,
  assertSnapshotLifecycle,
  deriveChargeStatus,
  resolveReceiptReservation,
  validatePaymentAllocations,
} from "./persistence-rules";

test("alocacao inserida, alterada ou removida deve continuar fechando o pagamento", () => {
  assert.doesNotThrow(() => validatePaymentAllocations({
    receivedAmount: "100.00",
    allocations: ["60.00", "40.00"],
  }));
  assert.throws(() => validatePaymentAllocations({
    receivedAmount: "100.00",
    allocations: ["60.00", "50.00"],
  }), /PAYMENT_ALLOCATION_MISMATCH/);
  assert.throws(() => validatePaymentAllocations({
    receivedAmount: "100.00",
    allocations: ["60.00"],
  }), /PAYMENT_ALLOCATION_MISMATCH/);
});

test("pagamentos parciais sucessivos derivam sempre o estado da cobranca", () => {
  assert.equal(deriveChargeStatus("100.00", []), "OPEN");
  assert.equal(deriveChargeStatus("100.00", ["25.00"]), "PARTIALLY_PAID");
  assert.equal(deriveChargeStatus("100.00", ["25.00", "75.00"]), "PAID");
  assert.equal(deriveChargeStatus("100.00", ["25.00", "75.00"], ["75.00"]), "PARTIALLY_PAID");
});

test("estorno e estado REFUNDED formam uma unica operacao logica", () => {
  assert.doesNotThrow(() => assertAtomicRefund(true, "REFUNDED"));
  assert.throws(() => assertAtomicRefund(true, "ISSUED"), /REFUND_STATUS_MISMATCH/);
  assert.throws(() => assertAtomicRefund(false, "REFUNDED"), /REFUND_STATUS_MISMATCH/);
});

test("numeracao e idempotencia rejeitam concorrencia logica conflitante", () => {
  assert.throws(() => resolveReceiptReservation([
    { seriesId: "series", expectedSequence: 1, idempotencyKey: "first", requestSha256: "a" },
    { seriesId: "series", expectedSequence: 1, idempotencyKey: "second", requestSha256: "b" },
  ]), /SEQUENCE_CONFLICT/);
  assert.throws(() => resolveReceiptReservation([
    { seriesId: "series", expectedSequence: 1, idempotencyKey: "same", requestSha256: "a" },
    { seriesId: "series", expectedSequence: 2, idempotencyKey: "same", requestSha256: "b" },
  ]), /IDEMPOTENCY_PAYLOAD_CONFLICT/);
});

test("um lancamento nao pode existir no recibo legado e no novo", () => {
  assert.throws(
    () => assertNoLegacyReceiptCollision(new Set(["entry"]), "entry"),
    /LEGACY_RECEIPT_COLLISION/,
  );
  assert.doesNotThrow(
    () => assertNoLegacyReceiptCollision(new Set(["legacy"]), "new"),
  );
});

test("snapshot definitivo existe somente na emissao e deve corresponder ao recibo", () => {
  assert.doesNotThrow(() => assertSnapshotLifecycle("DRAFT", null, null));
  assert.throws(
    () => assertSnapshotLifecycle("DRAFT", null, "hash"),
    /DRAFT_SNAPSHOT_NOT_ALLOWED/,
  );
  assert.doesNotThrow(() => assertSnapshotLifecycle("ISSUED", "hash", "hash"));
  assert.throws(
    () => assertSnapshotLifecycle("ISSUED", "hash-a", "hash-b"),
    /SNAPSHOT_MISMATCH/,
  );
});

test("somente eventos documentais previstos sao aceitos", () => {
  assert.doesNotThrow(() => assertAllowedReceiptEvent("CORRECTION_ISSUED"));
  assert.throws(() => assertAllowedReceiptEvent("ARBITRARY"), /INVALID_RECEIPT_EVENT/);
});
