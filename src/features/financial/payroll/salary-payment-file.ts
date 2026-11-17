import { createHash } from "node:crypto";

export const MAX_PAYROLL_PROOF_BYTES = 10 * 1024 * 1024;

export type PayrollProofMime = "application/pdf" | "image/jpeg" | "image/png";

export class PayrollProofError extends Error {
  constructor(readonly code: "INVALID_FILE" | "FILE_TOO_LARGE") {
    super(code === "FILE_TOO_LARGE" ? "O comprovante excede 10 MB." : "Comprovante invalido.");
  }
}

export interface ValidatedPayrollProof {
  readonly originalFileName: string;
  readonly mimeType: PayrollProofMime;
  readonly byteLength: number;
  readonly sha256: string;
  readonly bytes: Uint8Array;
}

function fileKind(bytes: Uint8Array): PayrollProofMime | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf";
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  return null;
}

export function validatePayrollProof(input: {
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}): ValidatedPayrollProof {
  if (input.bytes.byteLength > MAX_PAYROLL_PROOF_BYTES) throw new PayrollProofError("FILE_TOO_LARGE");
  if (input.bytes.byteLength === 0) throw new PayrollProofError("INVALID_FILE");
  const name = input.name.replace(/.*[\\/]/u, "").replace(/[\u0000-\u001f\u007f]/gu, "").trim();
  const extension = name.split(".").at(-1)?.toLowerCase();
  const expected: Record<string, PayrollProofMime> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
  const mimeType = extension ? expected[extension] : undefined;
  if (!name || name.length > 255 || !mimeType || input.mimeType !== mimeType || fileKind(input.bytes) !== mimeType) {
    throw new PayrollProofError("INVALID_FILE");
  }
  const bytes = Uint8Array.from(input.bytes);
  return Object.freeze({
    originalFileName: name,
    mimeType,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes,
  });
}
