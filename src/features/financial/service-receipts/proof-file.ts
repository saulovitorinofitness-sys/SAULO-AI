import { createHash } from "node:crypto";

import type {
  ServiceReceiptPaymentMethod,
  ServiceReceiptProofCandidate,
} from "./contracts";

export const MAX_SERVICE_RECEIPT_PROOF_BYTES = 10 * 1024 * 1024;

export type ServiceReceiptProofMime =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

export type ServiceReceiptProofErrorCode =
  | "PAYMENT_METHOD_WITHOUT_PROOF"
  | "INVALID_FILE"
  | "FILE_TOO_LARGE";

export class ServiceReceiptProofError extends Error {
  constructor(readonly code: ServiceReceiptProofErrorCode) {
    super(code);
  }
}

export function validateStoredServiceReceiptProofSize(
  declaredByteLength: number,
  storedBytes: Uint8Array,
): void {
  if (
    declaredByteLength < 1
    || declaredByteLength > MAX_SERVICE_RECEIPT_PROOF_BYTES
    || storedBytes.byteLength !== declaredByteLength
  ) throw new ServiceReceiptProofError("INVALID_FILE");
}

export interface ValidatedServiceReceiptProof {
  readonly originalFileName: string;
  readonly mimeType: ServiceReceiptProofMime;
  readonly byteLength: number;
  readonly sha256: string;
  readonly bytes: Uint8Array;
  readonly accessScope: "AUTHORIZED_USERS_ONLY";
  readonly includedInCustomerDocument: false;
}

function detectedMime(bytes: Uint8Array): ServiceReceiptProofMime | null {
  if (
    bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d
  ) return "application/pdf";

  if (
    bytes.length >= 4
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
    && bytes.at(-2) === 0xff
    && bytes.at(-1) === 0xd9
  ) return "image/jpeg";

  if (
    bytes.length >= 8
    && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value)
  ) return "image/png";

  return null;
}

export function validateServiceReceiptProof(
  paymentMethod: ServiceReceiptPaymentMethod,
  input: ServiceReceiptProofCandidate,
): ValidatedServiceReceiptProof {
  if (paymentMethod === "CASH") {
    throw new ServiceReceiptProofError("PAYMENT_METHOD_WITHOUT_PROOF");
  }
  if (input.bytes.byteLength > MAX_SERVICE_RECEIPT_PROOF_BYTES) {
    throw new ServiceReceiptProofError("FILE_TOO_LARGE");
  }
  if (input.bytes.byteLength === 0) {
    throw new ServiceReceiptProofError("INVALID_FILE");
  }

  const name = input.name
    .replace(/.*[\\/]/u, "")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim();
  const extension = name.split(".").at(-1)?.toLowerCase();
  const expectedByExtension: Readonly<Record<string, ServiceReceiptProofMime>> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  const expectedMime = extension ? expectedByExtension[extension] : undefined;
  const contentMime = detectedMime(input.bytes);

  if (
    !name
    || name.length > 255
    || !expectedMime
    || input.mimeType !== expectedMime
    || contentMime !== expectedMime
  ) {
    throw new ServiceReceiptProofError("INVALID_FILE");
  }

  const bytes = Uint8Array.from(input.bytes);
  validateStoredServiceReceiptProofSize(bytes.byteLength, bytes);
  return Object.freeze({
    originalFileName: name,
    mimeType: expectedMime,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes,
    accessScope: "AUTHORIZED_USERS_ONLY",
    includedInCustomerDocument: false,
  });
}
