import type {
  ServiceReceiptChargeStatus,
  ServiceReceiptEventType,
} from "./contracts";
import { serviceReceiptMoneyToCents } from "./domain-rules";

export interface PaymentAllocationState {
  readonly receivedAmount: string;
  readonly allocations: readonly string[];
}

export function validatePaymentAllocations(
  state: PaymentAllocationState,
): void {
  const received = serviceReceiptMoneyToCents(state.receivedAmount);
  const allocated = state.allocations.reduce(
    (total, amount) => total + serviceReceiptMoneyToCents(amount),
    BigInt(0),
  );
  if (allocated !== received) throw new Error("PAYMENT_ALLOCATION_MISMATCH");
}

export function deriveChargeStatus(
  amountDue: string,
  receivedAmounts: readonly string[],
  refundedAmounts: readonly string[] = [],
): ServiceReceiptChargeStatus {
  const due = serviceReceiptMoneyToCents(amountDue);
  const paid = receivedAmounts.reduce(
    (total, amount) => total + serviceReceiptMoneyToCents(amount),
    BigInt(0),
  );
  const refunded = refundedAmounts.reduce(
    (total, amount) => total + serviceReceiptMoneyToCents(amount),
    BigInt(0),
  );
  const net = paid - refunded;
  if (net < BigInt(0) || net > due) throw new Error("INVALID_CHARGE_BALANCE");
  if (net === BigInt(0)) return "OPEN";
  return net === due ? "PAID" : "PARTIALLY_PAID";
}

export function assertAtomicRefund(
  refundPersisted: boolean,
  receiptStatus: "ISSUED" | "REFUNDED",
): void {
  if (refundPersisted !== (receiptStatus === "REFUNDED")) {
    throw new Error("REFUND_STATUS_MISMATCH");
  }
}

export function assertNoLegacyReceiptCollision(
  legacyFinancialEntryIds: ReadonlySet<string>,
  professionalFinancialEntryId: string | null,
): void {
  if (
    professionalFinancialEntryId
    && legacyFinancialEntryIds.has(professionalFinancialEntryId)
  ) throw new Error("LEGACY_RECEIPT_COLLISION");
}

export interface ReceiptReservationAttempt {
  readonly seriesId: string;
  readonly expectedSequence: number;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
}

export function resolveReceiptReservation(
  attempts: readonly ReceiptReservationAttempt[],
): readonly ReceiptReservationAttempt[] {
  const sequences = new Set<string>();
  const requests = new Map<string, string>();
  for (const attempt of attempts) {
    const sequenceKey = `${attempt.seriesId}:${attempt.expectedSequence}`;
    if (sequences.has(sequenceKey)) throw new Error("SEQUENCE_CONFLICT");
    sequences.add(sequenceKey);
    const priorHash = requests.get(attempt.idempotencyKey);
    if (priorHash && priorHash !== attempt.requestSha256) {
      throw new Error("IDEMPOTENCY_PAYLOAD_CONFLICT");
    }
    requests.set(attempt.idempotencyKey, attempt.requestSha256);
  }
  return attempts;
}

export function assertSnapshotLifecycle(
  status: "DRAFT" | "ISSUED" | "CANCELLED" | "REFUNDED",
  receiptSnapshotSha256: string | null,
  snapshotPayloadSha256: string | null,
): void {
  if (status === "DRAFT" && snapshotPayloadSha256 !== null) {
    throw new Error("DRAFT_SNAPSHOT_NOT_ALLOWED");
  }
  if (
    status !== "DRAFT"
    && (
      receiptSnapshotSha256 === null
      || snapshotPayloadSha256 === null
      || receiptSnapshotSha256 !== snapshotPayloadSha256
    )
  ) throw new Error("SNAPSHOT_MISMATCH");
}

const ALLOWED_EVENTS = new Set<ServiceReceiptEventType>([
  "DRAFT_CREATED",
  "ISSUED",
  "CORRECTION_ISSUED",
  "CANCELLED",
  "REFUNDED",
]);

export function assertAllowedReceiptEvent(event: string): asserts event is ServiceReceiptEventType {
  if (!ALLOWED_EVENTS.has(event as ServiceReceiptEventType)) {
    throw new Error("INVALID_RECEIPT_EVENT");
  }
}
