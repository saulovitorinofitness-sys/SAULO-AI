import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("./professional-service-receipts-workspace.tsx", import.meta.url), "utf8");
const viewer = readFileSync(new URL("./professional-service-receipt-viewer.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../auth/authenticated-shell.tsx", import.meta.url), "utf8");
const financial = readFileSync(new URL("./financial-workspace.tsx", import.meta.url), "utf8");

test("expõe Recibos de Serviços dentro de Gestão e Financeiro", () => {
  assert.match(navigation, /href: "\/gestao\/financeiro\/recibos-servicos"/u);
  assert.match(navigation, /label: "Recibos de Serviços"/u);
  assert.match(financial, /href="\/gestao\/financeiro\/recibos-servicos"/u);
});

test("painel traz ação, busca, filtros, indicadores e estado vazio real", () => {
  for (const label of ["Novo recebimento", "Buscar cliente", "Prestador", "Situação", "Recebidos", "Pendentes", "Parciais", "Cancelados", "Estornados", "Nenhum recibo encontrado"]) {
    assert.match(workspace, new RegExp(label, "u"));
  }
  assert.doesNotMatch(workspace, /mock|fictíci/iu);
});

test("fluxo visual contempla cliente existente, serviço, responsabilidades e pagamento parcial", () => {
  assert.match(workspace, /\/api\/patients\?/u);
  assert.match(workspace, /Cliente cadastrado/u);
  assert.match(workspace, /Quem recebeu o pagamento\?/u);
  assert.match(workspace, /Será o emissor identificado no recibo\./u);
  assert.match(workspace, /Quem realizou o serviço\?/u);
  assert.match(workspace, /Profissional que executou o atendimento\./u);
  assert.match(workspace, /Valor pago agora/u);
  assert.match(workspace, /Falta pagar/u);
  assert.match(workspace, /Pendências para emissão/u);
  assert.match(workspace, /Confirme antes de emitir/u);
});

test("detalhes adicionais são opcionais e não substituem o serviço principal", () => {
  assert.match(workspace, /label="Detalhes adicionais"/u);
  assert.match(workspace, /placeholder="Ex\.: acompanhamento referente a setembro de 2026"/u);
  assert.match(workspace, /autoComplete="off"/u);
  assert.match(workspace, /spellCheck=\{false\}/u);
  assert.doesNotMatch(workspace, /if \(!form\.description\.trim\(\)\) issues\.push/u);
  assert.match(workspace, /const primaryDescription = serviceLabel\(form\.serviceKind\)/u);
});

test("valores usam máscara BRL, resumo imediato e bloqueio de pagamento excedente", () => {
  assert.match(workspace, /function moneyInput/u);
  assert.match(workspace, /Valor total cobrado/u);
  assert.match(workspace, /Total final/u);
  assert.match(workspace, /Pago agora/u);
  assert.match(workspace, /Pagamento parcial/u);
  assert.match(workspace, /Pagamento integral/u);
  assert.match(workspace, /cents\(form\.grossAmount\) - cents\(form\.discount\) \+ cents\(form\.surcharge\)/u);
  assert.match(workspace, /O valor recebido não pode superar o total\./u);
  assert.match(workspace, /Salvar como pendente/u);
  assert.match(workspace, /receivedCents === 0/u);
});

test("recebedor pessoa física preenche o executor e Academia exige escolha", () => {
  assert.match(workspace, /providerKey === "ACADEMIA_SAULO_FITNESS"[\s\S]*\? ""/u);
  assert.match(workspace, /BUILT_IN_IDS\.users\.sauloXavierVitorino/u);
  assert.match(workspace, /BUILT_IN_IDS\.users\.mariaDeLourdesGomes/u);
  assert.match(workspace, /if \(!form\.executorUserId\) issues\.push/u);
});

test("operações de recibo usam somente a nova raiz de endpoints", () => {
  assert.match(workspace, /const API_ROOT = "\/api\/financial\/professional-service-receipts"/u);
  assert.match(workspace, /`\$\{API_ROOT\}\/charges`/u);
  assert.match(workspace, /issuance-candidate/u);
  assert.match(workspace, /`\$\{API_ROOT\}\/receipts`/u);
  assert.doesNotMatch(workspace, /folha-pagamento|recibos-salariais|academy-receipts/iu);
});

test("painel carrega listagem persistente com filtros, indicadores e paginação", () => {
  assert.match(workspace, /fetch\(`\$\{API_ROOT\}\/receipts\?\$\{params\}`/u);
  assert.match(workspace, /params\.set\("query"/u);
  assert.match(workspace, /params\.set\("from"/u);
  assert.match(workspace, /params\.set\("provider"/u);
  assert.match(workspace, /params\.set\("status"/u);
  assert.match(workspace, /setIndicators\(payload\.indicators\)/u);
  assert.match(workspace, /Página \{page\} de \{totalPages\}/u);
  assert.match(workspace, /receipt\.receiptId/u);
});

test("visualização consulta o recibo novo e oferece impressão e PDF", () => {
  assert.match(viewer, /\/api\/financial\/professional-service-receipts\/receipts/u);
  assert.match(viewer, /Imprimir/u);
  assert.match(viewer, /Salvar em PDF/u);
  assert.match(viewer, /window\.print\(\)/u);
  assert.match(workspace, /financialSettlementId: financialSettlementId \|\| undefined/u);
  assert.doesNotMatch(workspace, /if \(!financialSettlementId\)/u);
  assert.match(workspace, /idempotencyKey: `ui-payment-\$\{chargePayload\.charge\.id\}`/u);
  assert.match(viewer, /Histórico do documento/u);
});
