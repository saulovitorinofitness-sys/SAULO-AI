import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SERVICE_RECEIPT_PROOF_BYTES,
  ServiceReceiptProofError,
  validateStoredServiceReceiptProofSize,
  validateServiceReceiptProof,
} from "./proof-file";

const TEST_ONLY_PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
]);

test("comprovante válido permanece privado e fora do documento do cliente", () => {
  const proof = validateServiceReceiptProof("PIX", {
    name: "comprovante-teste.pdf",
    mimeType: "application/pdf",
    bytes: TEST_ONLY_PDF_BYTES,
  });

  assert.equal(proof.accessScope, "AUTHORIZED_USERS_ONLY");
  assert.equal(proof.includedInCustomerDocument, false);
  assert.equal(proof.mimeType, "application/pdf");
  assert.match(proof.sha256, /^[0-9a-f]{64}$/);
});

test("nome, extensão, MIME e conteúdo devem ser coerentes", () => {
  assert.throws(
    () => validateServiceReceiptProof("BANK_TRANSFER", {
      name: "comprovante-teste.png",
      mimeType: "image/png",
      bytes: TEST_ONLY_PDF_BYTES,
    }),
    (error) => error instanceof ServiceReceiptProofError
      && error.code === "INVALID_FILE",
  );
});

test("comprovante vazio ou acima do limite é rejeitado", () => {
  assert.throws(
    () => validateServiceReceiptProof("CARD", {
      name: "comprovante-teste.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array(),
    }),
    (error) => error instanceof ServiceReceiptProofError
      && error.code === "INVALID_FILE",
  );

  assert.throws(
    () => validateServiceReceiptProof("PIX", {
      name: "comprovante-teste.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array(MAX_SERVICE_RECEIPT_PROOF_BYTES + 1),
    }),
    (error) => error instanceof ServiceReceiptProofError
      && error.code === "FILE_TOO_LARGE",
  );
});

test("dinheiro não aceita comprovante bancário", () => {
  assert.throws(
    () => validateServiceReceiptProof("CASH", {
      name: "comprovante-teste.pdf",
      mimeType: "application/pdf",
      bytes: TEST_ONLY_PDF_BYTES,
    }),
    (error) => error instanceof ServiceReceiptProofError
      && error.code === "PAYMENT_METHOD_WITHOUT_PROOF",
  );
});

test("tamanho declarado deve corresponder aos bytes realmente armazenados", () => {
  assert.doesNotThrow(() => validateStoredServiceReceiptProofSize(
    TEST_ONLY_PDF_BYTES.byteLength,
    TEST_ONLY_PDF_BYTES,
  ));
  assert.throws(
    () => validateStoredServiceReceiptProofSize(
      TEST_ONLY_PDF_BYTES.byteLength + 1,
      TEST_ONLY_PDF_BYTES,
    ),
    (error) => error instanceof ServiceReceiptProofError
      && error.code === "INVALID_FILE",
  );
});
