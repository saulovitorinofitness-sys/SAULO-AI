import type {
  IssuedServiceReceiptReference,
  ServiceReceiptCancellationCommand,
  ServiceReceiptCorrectionLink,
  ServiceReceiptRefundCommand,
} from "./contracts";
import {
  canCancelServiceReceipt,
  canRegisterServiceReceiptRefund,
  isValidReceiptStatusTransition,
  serviceReceiptMoneyToCents,
} from "./domain-rules";

export const SERVICE_RECEIPT_HISTORY_POLICY = Object.freeze({
  issuedReceiptCanBeEdited: false,
  historyCanBeDeleted: false,
  receiptNumberCanBeReused: false,
  correctionRequiresReplacementReceipt: true,
  refundRequiresSeparateRecord: true,
});

export type ServiceReceiptLifecycleErrorCode =
  | "CANCELLATION_NOT_ALLOWED"
  | "CANCELLATION_REASON_REQUIRED"
  | "INVALID_CORRECTION_LINK"
  | "REFUND_NOT_ALLOWED"
  | "ORIGINAL_PAYMENT_REQUIRED"
  | "INVALID_REFUND_AMOUNT"
  | "REFUND_REASON_REQUIRED";

export class ServiceReceiptLifecycleError extends Error {
  constructor(readonly code: ServiceReceiptLifecycleErrorCode) {
    super(code);
  }
}

export function validateServiceReceiptCancellation(
  command: ServiceReceiptCancellationCommand,
): void {
  if (!canCancelServiceReceipt(command.receipt, command.actorUserId)) {
    throw new ServiceReceiptLifecycleError("CANCELLATION_NOT_ALLOWED");
  }
  if (!command.reason.trim()) {
    throw new ServiceReceiptLifecycleError("CANCELLATION_REASON_REQUIRED");
  }
  if (!isValidReceiptStatusTransition(command.receipt.status, "CANCELLED")) {
    throw new ServiceReceiptLifecycleError("CANCELLATION_NOT_ALLOWED");
  }
}

export function validateServiceReceiptCorrection(
  cancelledReceipt: IssuedServiceReceiptReference,
  replacementReceipt: IssuedServiceReceiptReference,
  link: ServiceReceiptCorrectionLink,
): void {
  if (
    cancelledReceipt.status !== "CANCELLED"
    || replacementReceipt.status !== "ISSUED"
    || cancelledReceipt.id === replacementReceipt.id
    || cancelledReceipt.legalProviderKey !== replacementReceipt.legalProviderKey
    || link.cancelledReceiptId !== cancelledReceipt.id
    || link.replacementReceiptId !== replacementReceipt.id
  ) {
    throw new ServiceReceiptLifecycleError("INVALID_CORRECTION_LINK");
  }
}

export function validateServiceReceiptRefund(
  command: ServiceReceiptRefundCommand,
): void {
  if (!canRegisterServiceReceiptRefund(command.actorUserId)) {
    throw new ServiceReceiptLifecycleError("REFUND_NOT_ALLOWED");
  }
  if (!command.originalPaymentReferenceId.trim()) {
    throw new ServiceReceiptLifecycleError("ORIGINAL_PAYMENT_REQUIRED");
  }
  try {
    if (serviceReceiptMoneyToCents(command.amount) === BigInt(0)) {
      throw new Error("ZERO_REFUND");
    }
  } catch {
    throw new ServiceReceiptLifecycleError("INVALID_REFUND_AMOUNT");
  }
  if (!command.reason.trim()) {
    throw new ServiceReceiptLifecycleError("REFUND_REASON_REQUIRED");
  }
}
