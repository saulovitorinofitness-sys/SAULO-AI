import type { SalaryPaymentMethod } from "./salary-receipt-contracts";

export interface ExistingSalaryReceipt {
  readonly receiptId: string;
  readonly requestSha256: string;
  readonly method: SalaryPaymentMethod;
  readonly evidenceId: string | null;
  readonly status: string;
  readonly idempotencyKey: string;
}

export type SalaryReplayDecision =
  | { readonly kind: "NEW" }
  | { readonly kind: "REPLAY"; readonly receiptId: string; readonly evidenceId: string | null; readonly state: "PAYMENT_CONFIRMED" | "CASH_AWAITING_SIGNATURE" | "BANK_PROVEN" }
  | { readonly kind: "REJECT"; readonly code: "DUPLICATE" | "IDEMPOTENCY_CONFLICT" };

export function decideSalaryPaymentReplay(
  existing: ExistingSalaryReceipt | null,
  idempotencyKey: string,
  requestSha256: string,
): SalaryReplayDecision {
  if (!existing) return { kind: "NEW" };
  if (existing.status !== "ISSUED" || existing.idempotencyKey !== idempotencyKey) {
    return { kind: "REJECT", code: "DUPLICATE" };
  }
  if (existing.requestSha256 !== requestSha256) {
    return { kind: "REJECT", code: "IDEMPOTENCY_CONFLICT" };
  }
  return {
    kind: "REPLAY", receiptId: existing.receiptId, evidenceId: existing.evidenceId,
    state: existing.method === "CASH" ? "CASH_AWAITING_SIGNATURE" : existing.evidenceId ? "BANK_PROVEN" : "PAYMENT_CONFIRMED",
  };
}
