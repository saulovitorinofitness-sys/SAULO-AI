import assert from "node:assert/strict";
import test from "node:test";

import { BUILT_IN_IDS } from "@/modules/permissions";

import type { IssuedServiceReceiptReference } from "./contracts";
import {
  ServiceReceiptLifecycleError,
  validateServiceReceiptCancellation,
  validateServiceReceiptCorrection,
  validateServiceReceiptRefund,
} from "./lifecycle";

function receipt(
  overrides: Partial<IssuedServiceReceiptReference> = {},
): IssuedServiceReceiptReference {
  return {
    id: "test-receipt-reference",
    legalProviderKey: "ACADEMIA_SAULO_FITNESS",
    status: "ISSUED",
    series: "TEST_ONLY_SERIES",
    sequence: 1,
    ...overrides,
  };
}

test("somente Saulo cancela recibo emitido com motivo", () => {
  assert.doesNotThrow(() => validateServiceReceiptCancellation({
    receipt: receipt(),
    actorUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
    reason: "Motivo registrado exclusivamente no teste",
  }));

  assert.throws(() => validateServiceReceiptCancellation({
    receipt: receipt(),
    actorUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
    reason: "Motivo registrado exclusivamente no teste",
  }), (error) => error instanceof ServiceReceiptLifecycleError
    && error.code === "CANCELLATION_NOT_ALLOWED");
});

test("correção exige original cancelado e novo recibo do mesmo prestador", () => {
  const cancelled = receipt({ status: "CANCELLED" });
  const replacement = receipt({ id: "replacement-test-receipt-reference", sequence: 2 });

  assert.doesNotThrow(() => validateServiceReceiptCorrection(
    cancelled,
    replacement,
    {
      cancelledReceiptId: cancelled.id,
      replacementReceiptId: replacement.id,
    },
  ));

  assert.throws(() => validateServiceReceiptCorrection(
    cancelled,
    { ...replacement, legalProviderKey: "SAULO_XAVIER_VITORINO" },
    {
      cancelledReceiptId: cancelled.id,
      replacementReceiptId: replacement.id,
    },
  ), (error) => error instanceof ServiceReceiptLifecycleError
    && error.code === "INVALID_CORRECTION_LINK");
});

test("estorno por Saulo é separado e vinculado ao pagamento original", () => {
  assert.doesNotThrow(() => validateServiceReceiptRefund({
    originalPaymentReferenceId: "test-original-payment-reference",
    actorUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
    amount: "25.00",
    reason: "Motivo registrado exclusivamente no teste",
  }));

  assert.throws(() => validateServiceReceiptRefund({
    originalPaymentReferenceId: "",
    actorUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
    amount: "25.00",
    reason: "Motivo registrado exclusivamente no teste",
  }), (error) => error instanceof ServiceReceiptLifecycleError
    && error.code === "ORIGINAL_PAYMENT_REQUIRED");

  assert.throws(() => validateServiceReceiptRefund({
    originalPaymentReferenceId: "test-original-payment-reference",
    actorUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
    amount: "25.00",
    reason: "Motivo registrado exclusivamente no teste",
  }), (error) => error instanceof ServiceReceiptLifecycleError
    && error.code === "REFUND_NOT_ALLOWED");
});
