import type { PayrollProofMime } from "./salary-payment-file";

export function createPrivatePayrollProofResponse(
  proof: { readonly mimeType: PayrollProofMime; readonly byteLength: number },
  readChunk: (offset: number, length: number) => Promise<Uint8Array>,
): Response {
  const filename = proof.mimeType === "application/pdf" ? "comprovante.pdf"
    : proof.mimeType === "image/png" ? "comprovante.png" : "comprovante.jpg";
  let offset = 1;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset > proof.byteLength) { controller.close(); return; }
      try {
        const chunk = await readChunk(offset, Math.min(65536, proof.byteLength - offset + 1));
        if (!chunk.byteLength || chunk.byteLength > proof.byteLength - offset + 1) {
          controller.error(new Error("Comprovante indisponivel."));
          return;
        }
        controller.enqueue(chunk);
        offset += chunk.byteLength;
      } catch { controller.error(new Error("Comprovante indisponivel.")); }
    },
  });
  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": proof.mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(proof.byteLength),
    },
  });
}
