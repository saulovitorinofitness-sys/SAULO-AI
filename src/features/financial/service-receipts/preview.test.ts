import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadProfessionalReceiptPreview, printProfessionalReceiptPreview } from "./preview-client";
import { brlAmountInWords, presentationTitleCase, professionalRegistrationLabel } from "./preview-presentation";
import { createProfessionalReceiptPreviewService, type ProfessionalReceiptPreviewSource } from "./preview";

const source: ProfessionalReceiptPreviewSource = {
  chargeId: "00000000-0000-4000-8000-000000000701",
  status: "PAID",
  existingReceiptId: null,
  customer: { fullName: "Marcelo da Silva", clinicalCode: "SV000001", cpf: null },
  issuer: {
    key: "SAULO_XAVIER_VITORINO",
    name: "Saulo Xavier Vitorino",
    documentLabel: "CPF",
    document: "***.111.222-**",
    address: "Rua existente, 10 · Centro · Recife/PE · CEP 50000000",
    registrations: [{ council: "CREF", number: "019480", category: "G", state: "CE" }],
  },
  services: [{ description: "Personal training", serviceDate: "2026-09-20T00:00:00.000Z", executorName: "Saulo Xavier Vitorino", performedActivity: "Personal training" }],
  payment: { receivedAmount: "250.00", method: "PIX", recordedAt: "2026-09-20T14:00:00.000Z", transactionReference: null },
};

test("abrir a prévia executa somente autorização e leitura, sem modificar registros", async () => {
  const before = structuredClone(source);
  let reads = 0;
  let authorizations = 0;
  const service = createProfessionalReceiptPreviewService(
    { async findPreviewSource(chargeId) { reads++; assert.equal(chargeId, source.chargeId); return source; } },
    async () => { authorizations++; },
  );

  const preview = await service.getPreview(source.chargeId, "user-saulo");

  assert.equal(reads, 1);
  assert.equal(authorizations, 1);
  assert.deepEqual(source, before);
  assert.equal(preview.documentNumber, "Não emitido");
  assert.equal(preview.customer.fullName, "Marcelo da Silva");
  assert.deepEqual(preview.missingData, ["CPF do cliente"]);
});

test("carregar e imprimir a prévia usa GET e não dispara escrita nem nova requisição", async () => {
  const requests: { input: string; method?: string }[] = [];
  let prints = 0;
  const preview = await loadProfessionalReceiptPreview(source.chargeId, async (input, init) => {
    requests.push({ input, method: init.method });
    return { ok: true, async json() { return { preview: { ...source, documentNumber: "Não emitido", amount: "250.00", payment: source.payment!, missingData: [] } }; } };
  }, {});

  printProfessionalReceiptPreview(() => { prints++; });

  assert.equal(preview.documentNumber, "Não emitido");
  assert.deepEqual(requests, [{ input: `/api/financial/professional-service-receipts/charges/${source.chargeId}/preview`, method: "GET" }]);
  assert.equal(prints, 1);
});

test("valor da cobrança é apresentado por extenso sem arredondamento indevido", () => {
  assert.equal(brlAmountInWords("250.00"), "duzentos e cinquenta reais");
  assert.equal(brlAmountInWords("1.01"), "um real e um centavo");
});

test("capitaliza nomes e endereços apenas para apresentação e preserva siglas", () => {
  assert.equal(presentationTitleCase("marcelo da silva"), "Marcelo da Silva");
  assert.equal(presentationTitleCase("juazeiro do norte"), "Juazeiro do Norte");
  assert.equal(
    presentationTitleCase("rua padre cícero, 10 · AEROPORTO · juazeiro do norte/CE · CEP 63000000"),
    "Rua Padre Cícero, 10 · Aeroporto · Juazeiro do Norte/CE · CEP 63000000",
  );
  assert.equal(presentationTitleCase("chácara aeroporto · pagamento via PIX"), "Chácara Aeroporto · Pagamento via PIX");
});

test("registro profissional usa número, categoria e UF reais ou informa incompletude", () => {
  assert.equal(professionalRegistrationLabel({ council: "CREF", number: "019480", category: "G", state: "CE" }), "CREF 019480-G/CE");
  assert.equal(professionalRegistrationLabel({ council: "CREF", number: "019480", category: null, state: "CE" }), "CREF incompleto");
  assert.equal(professionalRegistrationLabel({ council: "CRN", number: null, category: null, state: null }), "CRN incompleto");
});

test("layout mantém uma marca d'água, rodapé sem quebra e uma página A4", () => {
  const component = readFileSync(new URL("../../../components/financial/professional-service-receipt-preview.tsx", import.meta.url), "utf8");
  const watermark = component.match(/aria-hidden="true" className="pointer-events-none[\s\S]*?<span[^>]*>PRÉVIA — NÃO EMITIDO<\/span>/gu) ?? [];
  assert.equal(watermark.length, 1);
  assert.match(component, /text-rose-700\/\[0\.07\]/u);
  assert.match(component, /whitespace-nowrap[\s\S]*PRÉVIA — NÃO EMITIDO • SEM VALIDADE • NUMERAÇÃO NÃO CONSUMIDA/u);
  assert.match(component, /print:min-h-\[273mm\]/u);
  assert.match(component, /print:break-inside-avoid/u);
});
