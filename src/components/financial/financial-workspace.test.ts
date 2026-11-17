import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  FinancialCatalogItem,
  FinancialEntryView,
  FinancialSummary,
} from "@/features/financial/contracts";
import type { NextFitReceiptPreview } from "@/features/financial/nextfit-receipts";
import {
  buildAccountsPayableAgenda,
  buildAccountsReceivableAgenda,
} from "@/features/financial/agenda";

import {
  academyReceiptAccountCode,
  academyAccountBalanceCards,
  currencyDigitsToCanonical,
  formatCurrencyInput,
  inheritedSettlementValues,
  isFinancialAccountAvailable,
  isEntryCategoryAvailable,
  paymentFieldVisibility,
  parseCurrencyInput,
  sortEntryCategories,
} from "./financial-workspace";
import { buildNextFitReceiptDestinationSummary } from "./nextfit-receipts-import-dialog";

const ACADEMY_ID = "10000000-0000-4000-8000-000000000001";
const CLINIC_ID = "10000000-0000-4000-8000-000000000002";
const PERSONAL_ID = "10000000-0000-4000-8000-000000000003";

const academyCategoryNames = [
  "Pessoal",
  "Estrutura e operação",
  "Compras e investimentos",
  "Administrativo",
  "Marketing e vendas",
  "Tributos e encargos",
  "Outros",
] as const;

function category(
  code: string,
  name: string,
  businessUnitId?: string,
): FinancialCatalogItem {
  return {
    id: `category-${code}`,
    code,
    name,
    status: "ACTIVE",
    businessUnitId,
    entryType: "EXPENSE",
  };
}

test("Despesa da Academia apresenta as sete categorias institucionais", () => {
  const categories = [
    category("ACADEMIA_OUTROS", "Outros", ACADEMY_ID),
    category("ACADEMIA_ADMINISTRATIVO", "Administrativo", ACADEMY_ID),
    category("ACADEMIA_PESSOAL", "Pessoal", ACADEMY_ID),
    category(
      "ACADEMIA_TRIBUTOS_ENCARGOS",
      "Tributos e encargos",
      ACADEMY_ID,
    ),
    category(
      "ACADEMIA_COMPRAS_INVESTIMENTOS",
      "Compras e investimentos",
      ACADEMY_ID,
    ),
    category(
      "ACADEMIA_MARKETING_VENDAS",
      "Marketing e vendas",
      ACADEMY_ID,
    ),
    category(
      "ACADEMIA_ESTRUTURA_OPERACAO",
      "Estrutura e operação",
      ACADEMY_ID,
    ),
  ];

  const visible = sortEntryCategories(
    categories.filter((item) =>
      isEntryCategoryAvailable(item, {
        businessUnitId: ACADEMY_ID,
        entryType: "EXPENSE",
        isAcademy: true,
      }),
    ),
    true,
  );

  assert.deepEqual(
    visible.map((item) => item.name),
    academyCategoryNames,
  );
});

test("Academia exclui categorias genéricas e mantém retirada fora das despesas", () => {
  const categories = [
    category("DESPESA_OPERACIONAL", "Despesas Operacionais"),
    category("DESPESA_ADMINISTRATIVA", "Despesas Administrativas"),
    category(
      "ACADEMIA_RETIRADA_PROPRIETARIO",
      "Retirada do proprietário",
      ACADEMY_ID,
    ),
  ];

  assert.deepEqual(
    categories.filter((item) =>
      isEntryCategoryAvailable(item, {
        businessUnitId: ACADEMY_ID,
        entryType: "EXPENSE",
        isAcademy: true,
      }),
    ),
    [],
  );
});

test("nova categoria cadastrada para a Academia aparece automaticamente", () => {
  const custom = category(
    "ACADEMIA_PROJETOS_ESPECIAIS",
    "Projetos especiais",
    ACADEMY_ID,
  );

  assert.equal(
    isEntryCategoryAvailable(custom, {
      businessUnitId: ACADEMY_ID,
      entryType: "EXPENSE",
      isAcademy: true,
    }),
    true,
  );
});

test("Clínica preserva categorias próprias e compartilhadas", () => {
  const shared = category("DESPESA_OPERACIONAL", "Despesas Operacionais");
  const clinic = category("CLINICA_DESPESA", "Despesa Clínica", CLINIC_ID);

  for (const item of [shared, clinic]) {
    assert.equal(
      isEntryCategoryAvailable(item, {
        businessUnitId: CLINIC_ID,
        entryType: "EXPENSE",
        isAcademy: false,
      }),
      true,
    );
  }
});

test("seletores da Academia oferecem somente as três contas reais ativas", () => {
  const accounts: FinancialCatalogItem[] = [
    { id: "nubank", code: "NUBANK", name: "Nubank", status: "ACTIVE", businessUnitId: ACADEMY_ID, accountType: "BANK" },
    { id: "sumup", code: "SUMUP", name: "SumUp", status: "ACTIVE", businessUnitId: ACADEMY_ID, accountType: "BANK" },
    { id: "cash", code: "CAIXA_FISICO", name: "Caixa físico Academia", status: "ACTIVE", businessUnitId: ACADEMY_ID, accountType: "CASH" },
    { id: "legacy", code: "CAIXA", name: "Caixa Academia", status: "INACTIVE", businessUnitId: ACADEMY_ID, accountType: "CASH" },
    { id: "clinic", code: "CAIXA", name: "Caixa Clínica", status: "ACTIVE", businessUnitId: CLINIC_ID, accountType: "CASH" },
  ];

  assert.deepEqual(
    accounts
      .filter((account) => isFinancialAccountAvailable(account, ACADEMY_ID))
      .map((account) => account.name),
    ["Nubank", "SumUp", "Caixa físico Academia"],
  );
});

test("Personal pode selecionar uma conta financeira real sem virar Academia", () => {
  const nubank: FinancialCatalogItem = {
    id: "nubank",
    code: "NUBANK",
    name: "Nubank",
    status: "ACTIVE",
    businessUnitId: ACADEMY_ID,
    accountType: "BANK",
  };

  assert.equal(
    isFinancialAccountAvailable(nubank, PERSONAL_ID, "PERSONAL"),
    true,
  );
  assert.equal(
    isFinancialAccountAvailable(nubank, CLINIC_ID, "CLINICA"),
    false,
  );
});

test("campos monetários exibem pt-BR e preservam decimal canônico", () => {
  const cases = [
    ["0.01", "0,01"],
    ["5.00", "5,00"],
    ["20.00", "20,00"],
    ["250.00", "250,00"],
    ["1234.56", "1.234,56"],
    ["10000.00", "10.000,00"],
  ] as const;

  for (const [canonical, visible] of cases) {
    assert.equal(formatCurrencyInput(canonical), visible);
    assert.equal(parseCurrencyInput(visible), canonical);
  }
});

test("máscara durante digitação converte centavos sem enviar texto formatado", () => {
  assert.equal(currencyDigitsToCanonical("001"), "0.01");
  assert.equal(currencyDigitsToCanonical("500"), "5.00");
  assert.equal(currencyDigitsToCanonical("2000"), "20.00");
  assert.equal(currencyDigitsToCanonical("25000"), "250.00");
  assert.equal(currencyDigitsToCanonical("123456"), "1234.56");
  assert.equal(currencyDigitsToCanonical("1000000"), "10000.00");
});

test("formulário distingue conta prevista da conta utilizada no pagamento", () => {
  const source = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Conta financeira prevista/);
  assert.match(source, /Conta utilizada no pagamento/);
});

test("novo lançamento oferece salvar em aberto ou pagar no mesmo modal", () => {
  const source = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Salvar em aberto/);
  assert.match(source, /Salvar e pagar agora/);
  assert.match(source, /Data do pagamento/);
  assert.match(source, /Valor pago/);
  assert.match(source, /Conta utilizada no pagamento/);
  assert.match(source, /Forma de pagamento/);
  assert.match(source, /Observação do pagamento/);
  assert.match(source, /Alterar dados do pagamento/);
});

test("pagamento total herda valor, conta, forma e data sem repetir campos", () => {
  assert.deepEqual(
    inheritedSettlementValues(
      {
        amount: "20.00",
        financialAccountId: "nubank",
        paymentMethodId: "pix",
      },
      "2026-08-14",
    ),
    {
      settlementDate: "2026-08-14",
      amount: "20.00",
      financialAccountId: "nubank",
      paymentMethodId: "pix",
      observation: "",
    },
  );
  assert.deepEqual(
    paymentFieldVisibility(
      { financialAccountId: "nubank", paymentMethodId: "pix" },
      false,
    ),
    {
      settlementDate: false,
      amount: false,
      financialAccount: false,
      paymentMethod: false,
      observation: false,
    },
  );
});

test("sem conta prevista solicita somente a conta real", () => {
  assert.deepEqual(
    paymentFieldVisibility(
      { financialAccountId: "", paymentMethodId: "pix" },
      false,
    ),
    {
      settlementDate: false,
      amount: false,
      financialAccount: true,
      paymentMethod: false,
      observation: false,
    },
  );
});

test("sem forma prevista solicita somente a forma real", () => {
  assert.deepEqual(
    paymentFieldVisibility(
      { financialAccountId: "nubank", paymentMethodId: "" },
      false,
    ),
    {
      settlementDate: false,
      amount: false,
      financialAccount: false,
      paymentMethod: true,
      observation: false,
    },
  );
});

test("alterar dados do pagamento libera todos os campos", () => {
  assert.deepEqual(
    paymentFieldVisibility(
      { financialAccountId: "nubank", paymentMethodId: "pix" },
      true,
    ),
    {
      settlementDate: true,
      amount: true,
      financialAccount: true,
      paymentMethod: true,
      observation: true,
    },
  );
});

test("pagamento rápido usa uma única requisição de criação idempotente", () => {
  const source = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /entrySettlementIdempotencyKey/);
  assert.match(source, /savingEntryRef\.current/);
  assert.match(source, /settlement: \{/);
  assert.equal(source.match(/"\/api\/financial\/entries"/g)?.length, 1);
});

test("recebimentos da Academia mapeiam forma para a conta real aprovada", () => {
  const method = (
    paymentMethodType: NonNullable<FinancialCatalogItem["paymentMethodType"]>,
  ): FinancialCatalogItem => ({
    id: paymentMethodType,
    code: paymentMethodType,
    name: paymentMethodType,
    status: "ACTIVE",
    paymentMethodType,
  });

  assert.equal(academyReceiptAccountCode(method("PIX")), "NUBANK");
  assert.equal(academyReceiptAccountCode(method("BANK_TRANSFER")), "NUBANK");
  assert.equal(academyReceiptAccountCode(method("DEBIT_CARD")), "SUMUP");
  assert.equal(academyReceiptAccountCode(method("CREDIT_CARD")), "SUMUP");
  assert.equal(academyReceiptAccountCode(method("CASH")), "CAIXA_FISICO");
});

test("Academia oferece fluxo dedicado de entrada sem reabrir Receita no lançamento comum", () => {
  const source = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Registrar entrada real/);
  assert.match(source, /financeiro operacional/);
  assert.match(source, /A DRE NextFit permanece inalterada/);
});

test("Importar NextFit oferece DRE gerencial e recebimentos sem encher o cabeçalho", () => {
  const workspaceSource = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );
  const pageHeadingStart = workspaceSource.indexOf("<PageHeading");
  const pageHeadingEnd = workspaceSource.indexOf("description=", pageHeadingStart);
  const headingActions = workspaceSource.slice(pageHeadingStart, pageHeadingEnd);
  const academyOnlyAction = headingActions.match(
    /\{filters\.unit === "ACADEMIA" \? \([\s\S]*?\) : null\}/,
  )?.[0] ?? "";

  assert.match(headingActions, /Importar NextFit/);
  assert.doesNotMatch(academyOnlyAction, /Importar NextFit/);
  assert.match(academyOnlyAction, /Registrar entrada real/);
  assert.match(workspaceSource, />DRE Gerencial</);
  assert.match(workspaceSource, />Recebimentos</);
  assert.match(workspaceSource, /setDreImportOpen\(true\)/);
  assert.match(workspaceSource, /setReceiptsImportOpen\(true\)/);
  assert.match(workspaceSource, /NextFitDreImportDialog/);
  assert.match(workspaceSource, /NextFitReceiptsImportDialog/);
  assert.match(workspaceSource, /Salvar e pagar agora/);
});

test("modal de recebimentos usa preview e confirm aprovados sem persistência direta", () => {
  const dialogSource = readFileSync(
    new URL("./nextfit-receipts-import-dialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dialogSource, /accept="\.xls,\.xlsx/);
  assert.match(dialogSource, /nextfit-receipts\/preview/);
  assert.match(dialogSource, /nextfit-receipts\/confirm/);
  assert.doesNotMatch(dialogSource, /api\/financial\/entries/);
  assert.match(dialogSource, /Período identificado/);
  assert.match(dialogSource, /Total de registros/);
  assert.match(dialogSource, /Recebimentos válidos/);
  assert.match(dialogSource, /Valor total válido/);
  assert.match(dialogSource, /registro\(s\) não serão importados/);
  assert.match(dialogSource, /Este arquivo já foi importado anteriormente/);
});

test("preview resume somente destinos e métodos válidos encontrados", () => {
  const preview = {
    fileName: "recebimentos.xlsx",
    fileHash: "hash",
    source: "NEXTFIT",
    reportFamily: "MIXED",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-14",
    rowCount: 4,
    validCount: 3,
    duplicateCount: 1,
    invalidCount: 0,
    validAmount: "150.00",
    methods: ["PIX_DEPOSIT", "CREDIT_CARD"],
    destinationAccounts: ["NUBANK", "SUMUP"],
    issues: [],
    canConfirm: true,
    rows: [
      { sheetName: "PIX", rowNumber: 2, method: "PIX_DEPOSIT", amount: "70.00", destinationAccountCode: "NUBANK", status: "VALID", issues: [] },
      { sheetName: "PIX", rowNumber: 3, method: "PIX_DEPOSIT", amount: "30.00", destinationAccountCode: "NUBANK", status: "VALID", issues: [] },
      { sheetName: "Cartões", rowNumber: 2, method: "CREDIT_CARD", amount: "50.00", destinationAccountCode: "SUMUP", status: "VALID", issues: [] },
      { sheetName: "Cartões", rowNumber: 3, method: "DEBIT_CARD", amount: "20.00", destinationAccountCode: "SUMUP", status: "DUPLICATE", issues: [] },
    ],
  } satisfies NextFitReceiptPreview;

  assert.deepEqual(buildNextFitReceiptDestinationSummary(preview), [
    { account: "Nubank", method: "PIX/Depósito", amount: 100, count: 2 },
    { account: "SumUp", method: "Crédito", amount: 50, count: 1 },
  ]);
});

test("sucesso fecha o modal, atualiza o Financeiro e mostra feedback curto", () => {
  const workspaceSource = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );
  const dialogSource = readFileSync(
    new URL("./nextfit-receipts-import-dialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dialogSource, /onConfirmed\(\)/);
  assert.match(workspaceSource, /setReceiptsImportOpen\(false\)/);
  assert.match(workspaceSource, /Recebimentos importados com sucesso\./);
  assert.match(workspaceSource, /router\.refresh\(\)/);
});

test("Academia exibe saldos realizados das três contas e total disponível", () => {
  const summary = {
    accountBalances: [
      { financialAccount: { id: "nubank", code: "NUBANK", name: "Nubank" }, totalReceived: "200.00", totalPaid: "30.00", realizedBalance: "170.00" },
      { financialAccount: { id: "sumup", code: "SUMUP", name: "SumUp" }, totalReceived: "100.00", totalPaid: "35.00", realizedBalance: "65.00" },
    ],
    totalAvailable: "235.00",
  } as FinancialSummary;
  const source = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.deepEqual(academyAccountBalanceCards(summary), [
    { code: "NUBANK", label: "Nubank", balance: "170.00" },
    { code: "SUMUP", label: "SumUp", balance: "65.00" },
    { code: "CAIXA_FISICO", label: "Caixa físico", balance: "0.00" },
  ]);
  assert.match(source, /Saldos por conta/);
  assert.match(source, /Saldo realizado no SAULO-AI/);
  assert.match(source, /Total disponível/);
  assert.match(source, /não representa conciliação/);
  assert.match(source, /filters\.unit === "ACADEMIA"/);
});

function payableEntry(
  id: string,
  dueDate: string,
  remainingAmount: string,
  overrides: Partial<FinancialEntryView> = {},
): FinancialEntryView {
  const amount = overrides.amount ?? remainingAmount;
  return {
    id,
    type: "EXPENSE",
    competence: "2026-08-01",
    dueDate,
    amount,
    settledAmount: overrides.settledAmount ?? "0.00",
    remainingAmount,
    description: `Conta ${id}`,
    status: "PENDING",
    origin: "MANUAL",
    sourceSystem: "GESTAO_SV",
    managementNature: "REALIZED",
    businessUnit: { id: ACADEMY_ID, code: "ACADEMIA", name: "Academia" },
    financialCategory: { id: "expense", code: "ACADEMIA_ESTRUTURA_OPERACAO", name: "Estrutura" },
    settlements: [],
    createdAt: `2026-08-01T00:00:0${id.length}.000Z`,
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("Contas a Pagar classifica saldos sem duplicar e exclui itens não operacionais", () => {
  const agenda = buildAccountsPayableAgenda([
    payableEntry("overdue", "2026-08-13", "100.00"),
    payableEntry("today", "2026-08-14", "50.00"),
    payableEntry("next7", "2026-08-20", "40.00"),
    payableEntry("partial", "2026-08-16", "75.00", { amount: "100.00", settledAmount: "25.00", status: "PARTIALLY_SETTLED" }),
    payableEntry("next30", "2026-08-25", "30.00"),
    payableEntry("later", "2026-10-01", "25.00"),
    payableEntry("paid", "2026-08-10", "0.00", { status: "SETTLED", settledAmount: "100.00", amount: "100.00" }),
    payableEntry("withdrawal", "2026-08-12", "80.00", { financialCategory: { id: "owner", code: "ACADEMIA_RETIRADA_PROPRIETARIO", name: "Retirada" } }),
    payableEntry("revenue", "2026-08-12", "90.00", { type: "REVENUE" }),
    payableEntry("forecast", "2026-08-12", "60.00", { managementNature: "FORECAST" }),
  ], "2026-08-14");

  assert.deepEqual(agenda.totals, {
    overdue: "100.00",
    today: "50.00",
    next7Days: "115.00",
    next30Days: "30.00",
  });
  assert.deepEqual(
    agenda.pending.map((entry) => entry.id),
    ["overdue", "today", "partial", "next7", "next30", "later"],
  );
  assert.equal(
    Object.values(agenda.totals).reduce((sum, value) => sum + Number(value), 0),
    295,
  );
});

test("agenda reutiliza o modal de pagamento existente e não cria liquidação ao visualizar", () => {
  const workspaceSource = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../../app/(authenticated)/gestao/financeiro/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(workspaceSource, /Contas a Pagar/);
  assert.match(workspaceSource, /setSettlementEntry\(entry\)/);
  assert.equal(workspaceSource.match(/title=\{settlementEntry\.type === "REVENUE" \? "Registrar recebimento" : "Registrar pagamento"\}/g)?.length, 1);
  assert.doesNotMatch(workspaceSource, /accounts-payable.*financialSettlement\.create/is);
  assert.match(pageSource, /payablesEntries/);
  assert.match(pageSource, /managementNature: "REALIZED"/);
});

function receivableEntry(
  id: string,
  dueDate: string,
  remainingAmount: string,
  overrides: Partial<FinancialEntryView> = {},
): FinancialEntryView {
  const amount = overrides.amount ?? remainingAmount;
  return {
    id,
    type: "REVENUE",
    competence: "2026-08-01",
    dueDate,
    amount,
    settledAmount: overrides.settledAmount ?? "0.00",
    remainingAmount,
    description: `Receita ${id}`,
    status: "PENDING",
    origin: "MANUAL",
    sourceSystem: "CLINICA_SV",
    managementNature: "REALIZED",
    businessUnit: { id: CLINIC_ID, code: "CLINICA", name: "Clínica SV" },
    financialCategory: { id: "revenue", code: "CLINIC_REVENUE", name: "Atendimentos" },
    settlements: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("Contas a Receber classifica receitas pendentes sem duplicar valores", () => {
  const agenda = buildAccountsReceivableAgenda([
    receivableEntry("overdue", "2026-08-13", "100.00"),
    receivableEntry("personal-overdue", "2026-08-12", "35.00", {
      businessUnit: { id: PERSONAL_ID, code: "PERSONAL", name: "Personal" },
      sourceSystem: "GESTAO_SV",
      financialCategory: { id: "personal", code: "PERSONAL_SERVICOS", name: "Serviços de Personal" },
    }),
    receivableEntry("today", "2026-08-14", "50.00"),
    receivableEntry("next7", "2026-08-20", "40.00"),
    receivableEntry("partial", "2026-08-16", "75.00", { amount: "100.00", settledAmount: "25.00", status: "PARTIALLY_SETTLED" }),
    receivableEntry("next30", "2026-08-25", "30.00"),
    receivableEntry("later", "2026-10-01", "25.00"),
    receivableEntry("received", "2026-08-10", "0.00", { amount: "100.00", settledAmount: "100.00", status: "SETTLED" }),
    receivableEntry("expense", "2026-08-12", "60.00", { type: "EXPENSE" }),
    receivableEntry("withdrawal", "2026-08-12", "80.00", { type: "EXPENSE", businessUnit: { id: ACADEMY_ID, code: "ACADEMIA", name: "Academia" }, sourceSystem: "GESTAO_SV", financialCategory: { id: "owner", code: "ACADEMIA_RETIRADA_PROPRIETARIO", name: "Retirada" } }),
    receivableEntry("dre", "2026-08-12", "90.00", { businessUnit: { id: ACADEMY_ID, code: "ACADEMIA", name: "Academia" }, sourceSystem: "NEXTFIT", origin: "EXTERNAL_IMPORT", sourceType: "NEXTFIT_DRE" }),
    receivableEntry("nextfit-receipt", "2026-08-12", "0.00", { amount: "90.00", settledAmount: "90.00", status: "SETTLED", businessUnit: { id: ACADEMY_ID, code: "ACADEMIA", name: "Academia" }, sourceSystem: "NEXTFIT", origin: "EXTERNAL_IMPORT", sourceType: "NEXTFIT_RECEBIMENTO" }),
    receivableEntry("personal-nextfit", "2026-08-12", "45.00", { businessUnit: { id: PERSONAL_ID, code: "PERSONAL", name: "Personal" }, sourceSystem: "NEXTFIT", origin: "EXTERNAL_IMPORT", sourceType: "NEXTFIT_RECEBIMENTO" }),
  ], "2026-08-14");

  assert.deepEqual(agenda.buckets, {
    overdue: { count: 2, amount: "135.00" },
    today: { count: 1, amount: "50.00" },
    next7Days: { count: 2, amount: "115.00" },
    next30Days: { count: 1, amount: "30.00" },
  });
  assert.deepEqual(
    agenda.pending.map((entry) => entry.id),
    ["personal-overdue", "overdue", "today", "partial", "next7", "next30", "later"],
  );
  assert.equal(
    Object.values(agenda.buckets).reduce((sum, bucket) => sum + Number(bucket.amount), 0),
    330,
  );
});

test("Contas a Receber reutiliza FinancialSettlement e preserva Contas a Pagar", () => {
  const workspaceSource = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../../app/(authenticated)/gestao/financeiro/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(workspaceSource, /Contas a Receber/);
  assert.match(workspaceSource, /\sReceber\s/);
  assert.match(workspaceSource, /setSettlementEntry\(entry\)/);
  assert.match(workspaceSource, /Contas a Pagar/);
  assert.match(workspaceSource, /\["PERSONAL", "Personal"\]/);
  assert.match(workspaceSource, /entry\.businessUnit\.code === "PERSONAL"/);
  assert.match(pageSource, /receivablesEntries/);
  assert.match(pageSource, /query\.unit === "PERSONAL"/);
  assert.doesNotMatch(pageSource, /receivablesEntries[\s\S]*sourceSystem: "CLINICA_SV"/);
  assert.doesNotMatch(workspaceSource, /accounts-receivable.*financialSettlement\.create/is);
});

test("Financeiro expõe o Relatório Executivo sem remover ações existentes", () => {
  const source = readFileSync(
    new URL("./financial-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Relatório Executivo/);
  assert.match(source, /\/gestao\/financeiro\/relatorio\?unit=/);
  assert.match(source, /Importar NextFit/);
  assert.match(source, /Cadastros/);
  assert.match(source, /Novo lançamento/);
});
