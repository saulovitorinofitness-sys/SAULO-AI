import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { MAX_PAYROLL_PROOF_BYTES, PayrollProofError, validatePayrollProof } from "./salary-payment-file";
import { canonicalSalaryJson, canonicalSnapshotSha256 } from "./salary-payment-canonical";

const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0xff, 0xd9]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("aceita PDF, JPEG e PNG com extensao, MIME e assinatura compativeis", () => {
  for (const [name, mimeType, bytes] of [
    ["prova.pdf", "application/pdf", pdf],
    ["prova.jpeg", "image/jpeg", jpeg],
    ["prova.png", "image/png", png],
  ] as const) {
    const result = validatePayrollProof({ name, mimeType, bytes });
    assert.equal(result.mimeType, mimeType);
    assert.equal(result.byteLength, bytes.length);
    assert.equal(result.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal("url" in result, false);
    assert.equal("storageKey" in result, false);
  }
});

test("rejeita tamanho acima de 10 MB e arquivo vazio", () => {
  assert.equal(MAX_PAYROLL_PROOF_BYTES, 10 * 1024 * 1024);
  assert.throws(() => validatePayrollProof({ name: "prova.pdf", mimeType: "application/pdf", bytes: new Uint8Array(MAX_PAYROLL_PROOF_BYTES + 1) }),
    (error) => error instanceof PayrollProofError && error.code === "FILE_TOO_LARGE");
  assert.throws(() => validatePayrollProof({ name: "prova.pdf", mimeType: "application/pdf", bytes: new Uint8Array() }), PayrollProofError);
});

test("rejeita extensao, MIME e magic bytes incompatíveis independentemente", () => {
  assert.throws(() => validatePayrollProof({ name: "prova.txt", mimeType: "application/pdf", bytes: pdf }), PayrollProofError);
  assert.throws(() => validatePayrollProof({ name: "prova.pdf", mimeType: "image/png", bytes: pdf }), PayrollProofError);
  assert.throws(() => validatePayrollProof({ name: "prova.pdf", mimeType: "application/pdf", bytes: png }), PayrollProofError);
  assert.throws(() => validatePayrollProof({ name: "prova.jpg", mimeType: "image/jpeg", bytes: pdf }), PayrollProofError);
});

test("calcula hash canonico independentemente da ordem das chaves", () => {
  const left = { b: 2, a: { y: [3, 4], x: "teste" } };
  const right = { a: { x: "teste", y: [3, 4] }, b: 2 };
  assert.equal(canonicalSalaryJson(left), canonicalSalaryJson(right));
  assert.equal(canonicalSnapshotSha256(left), canonicalSnapshotSha256(right));
  assert.notEqual(canonicalSnapshotSha256(left), canonicalSnapshotSha256({ ...right, b: 3 }));
});
