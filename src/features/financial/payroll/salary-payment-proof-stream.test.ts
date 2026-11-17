import assert from "node:assert/strict";
import test from "node:test";

import { createPrivatePayrollProofResponse } from "./salary-payment-proof-stream";

test("leitura privada entrega bytes em blocos com cabeçalhos seguros e sem escrita", async () => {
  const source = Uint8Array.from({ length: 100_000 }, (_, index) => index % 251);
  const reads: { offset: number; length: number }[] = [];
  const response = createPrivatePayrollProofResponse({ mimeType: "application/pdf", byteLength: source.length },
    async (offset, length) => {
      reads.push({ offset, length });
      return source.slice(offset - 1, offset - 1 + length);
    });
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="comprovante.pdf"');
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Content-Length"), String(source.length));
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), source);
  assert.deepEqual(reads, [{ offset: 1, length: 65536 }, { offset: 65537, length: source.length - 65536 }]);
});
