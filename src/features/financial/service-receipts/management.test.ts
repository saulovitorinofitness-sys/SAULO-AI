import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
const action = readFileSync(
  new URL("../../../components/financial/professional-receipt-management-action.tsx", import.meta.url),
  "utf8",
);
const viewer = readFileSync(
  new URL("../../../components/financial/professional-service-receipt-viewer.tsx", import.meta.url),
  "utf8",
);

test("rascunho só é excluído sem pagamento ou recibo e após confirmação", () => {
  assert.match(repository, /charge\.status !== "OPEN" \|\| charge\.payments\.length > 0/u);
  assert.match(action, /EXCLUIR_RASCUNHO/u);
  assert.match(action, /Excluir este rascunho\?/u);
  assert.doesNotMatch(action, /method: "DELETE"[\s\S]*window\.confirm/u);
});

test("cancelamento do recebimento preserva cadeia e registra auditoria na mesma transação", () => {
  const cancellation = repository.slice(repository.indexOf("async cancelPaidCharge"));
  assert.match(cancellation, /prisma\.\$transaction/u);
  assert.match(cancellation, /pg_advisory_xact_lock/u);
  assert.match(cancellation, /professionalServiceCharge\.update/u);
  assert.match(cancellation, /financialEntry\.update/u);
  assert.match(cancellation, /auditEvent\.create/u);
  assert.match(cancellation, /payments\.\$\{payment\.id\}\.status/u);
  assert.match(cancellation, /settlements\.\$\{payment\.financialSettlement\.id\}\.status/u);
  assert.match(cancellation, /allocations\.\$\{allocation\.id\}\.status/u);
  assert.doesNotMatch(cancellation, /professionalServicePayment\.delete|financialSettlement\.delete|professionalServicePaymentAllocation\.delete/u);
});

test("cobrança cancelada deixa de compor indicador recebido", () => {
  assert.match(repository, /charge\."status" = 'CANCELLED'[\s\S]*THEN 0 ELSE payment_totals\."receivedAmount"/u);
});

test("recibo emitido oferece somente cancelamento e mantém snapshot", () => {
  assert.match(service, /item\.receiptId && item\.status === "ISSUED" \? "CANCEL_RECEIPT"/u);
  assert.match(viewer, /ProfessionalReceiptManagementAction/u);
  const receiptCancellation = repository.slice(
    repository.indexOf("async cancelReceipt"),
    repository.indexOf("async refundReceipt"),
  );
  assert.match(receiptCancellation, /status: "CANCELLED"/u);
  assert.doesNotMatch(receiptCancellation, /delete|snapshot.*update/iu);
});

test("diálogo exige motivo, explica impacto e não altera CPF nem emite recibo", () => {
  assert.match(action, /Motivo obrigatório/u);
  assert.match(action, /Impacto financeiro/u);
  assert.match(action, /não emite recibo e não altera CPF/u);
  assert.doesNotMatch(action, /issuance-candidate|\/receipts"/u);
});
