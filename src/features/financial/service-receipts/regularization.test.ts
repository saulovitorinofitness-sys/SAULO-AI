import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { regularizationIssues } from "./regularization";

const serviceSource = readFileSync(new URL("./regularization.ts", import.meta.url), "utf8");
const workspaceSource = readFileSync(
  new URL("../../../components/financial/professional-service-receipts-workspace.tsx", import.meta.url),
  "utf8",
);
const regularizationUiSource = readFileSync(
  new URL("../../../components/financial/professional-receipt-regularization.tsx", import.meta.url),
  "utf8",
);

test("expõe separadamente CPF e série ausentes, sem inventar valores", () => {
  const issues = regularizationIssues({
    validCustomerCpf: false,
    hasSeries: false,
    issuerComplete: true,
    hasPayment: true,
  });
  assert.deepEqual(issues.map((issue) => issue.code), [
    "CUSTOMER_CPF_REQUIRED_OR_INVALID",
    "RECEIPT_SERIES_REQUIRED",
  ]);
  assert.doesNotMatch(serviceSource, /defaultSeries|generatedCpf|fakeCpf/iu);
});

test("a listagem oferece link acessível para a cobrança existente", () => {
  assert.match(workspaceSource, /pendencias\/\$\{receipt\.id\}/u);
  assert.match(workspaceSource, /aria-label=\{`Abrir detalhes e pendências do recebimento/u);
  assert.match(workspaceSource, /"Com pendências"/u);
});

test("a regularização nunca chama criação de cobrança ou pagamento", () => {
  assert.doesNotMatch(regularizationUiSource, /\/charges[`"']/u);
  assert.doesNotMatch(regularizationUiSource, /\/payments/u);
  assert.doesNotMatch(serviceSource, /registerCharge|recordPayment/u);
});

test("a reemissão usa chave estável do pagamento e retorna recibo existente", () => {
  assert.match(serviceSource, /regularize-receipt-\$\{payment\.id\}/u);
  assert.match(serviceSource, /if \(overview\.receiptId\) return \{ receiptId: overview\.receiptId, replayed: true \}/u);
  assert.match(serviceSource, /activePayment\(context\)/u);
});

test("salvar CPF ou série não dispara emissão", () => {
  const correctionBody = regularizationUiSource.slice(
    regularizationUiSource.indexOf("async function correct"),
    regularizationUiSource.indexOf("async function retry"),
  );
  assert.match(correctionBody, /method: "PATCH"/u);
  assert.doesNotMatch(correctionBody, /method: "POST"|retryIssuance|window\.location/u);
});

test("detalhe cancelado exibe dados financeiros preservados e auditoria real", () => {
  const cancelledDetails = regularizationUiSource.slice(
    regularizationUiSource.indexOf("function CancelledReceiptDetails"),
    regularizationUiSource.indexOf("async function payload"),
  );
  for (const label of [
    "Cliente",
    "Prestador / emissor",
    "Valor original",
    "Valor anteriormente recebido",
    "Forma e data do pagamento",
    "Motivo",
    "Data e horário",
    "Usuário responsável",
    "Cobrança",
    "Pagamento",
    "Lançamento financeiro",
    "Histórico preservado",
  ]) assert.match(cancelledDetails, new RegExp(label, "u"));
  assert.match(cancelledDetails, /Não persistido/u);
  assert.match(cancelledDetails, /não compõem mais os valores recebidos/u);
});

test("abrir o detalhe cancelado permanece somente leitura", () => {
  const overviewBody = serviceSource.slice(
    serviceSource.indexOf("async overview"),
    serviceSource.indexOf("async updateCustomerCpf"),
  );
  const cancelledDetails = regularizationUiSource.slice(
    regularizationUiSource.indexOf("function CancelledReceiptDetails"),
    regularizationUiSource.indexOf("async function payload"),
  );
  assert.match(overviewBody, /auditEvent\.findFirst/u);
  assert.doesNotMatch(overviewBody, /\.create\(|\.update\(|\.delete\(|issueReceipt|recordPayment/u);
  assert.doesNotMatch(cancelledDetails, /fetch\(|method:|<form|<Button|ProfessionalReceiptManagementAction/u);
  assert.match(regularizationUiSource, /fetch\(endpoint, \{ cache: "no-store"/u);
});
