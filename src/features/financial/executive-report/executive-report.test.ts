import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  FinancialEntryView,
  FinancialSummary,
} from "../contracts";
import {
  buildFinancialExecutiveReport,
  resolveFinancialExecutivePeriod,
} from "./service";

function summary(overrides: Partial<FinancialSummary> = {}): FinancialSummary {
  return {
    totalReceivable: "0.00",
    totalReceived: "0.00",
    totalPayable: "0.00",
    totalPaid: "0.00",
    ownerWithdrawal: "0.00",
    ownerWithdrawalPaid: "0.00",
    ownerWithdrawalOpen: "0.00",
    accrualRevenue: "0.00",
    accrualExpense: "0.00",
    overdueReceivable: "0.00",
    overduePayable: "0.00",
    overdueTotal: "0.00",
    openReceivable: "0.00",
    openPayable: "0.00",
    openBalance: "0.00",
    realizedBalance: "0.00",
    accrualResult: "0.00",
    accountBalances: [],
    totalAvailable: "0.00",
    byBusinessUnit: [],
    ...overrides,
  };
}

function entry(input: {
  readonly id: string;
  readonly unit: "ACADEMIA" | "CLINICA" | "PERSONAL";
  readonly type: "REVENUE" | "EXPENSE";
  readonly dueDate: string;
  readonly remainingAmount: string;
  readonly sourceSystem?: "NEXTFIT" | "CLINICA_SV" | "GESTAO_SV";
  readonly status?: FinancialEntryView["status"];
}): FinancialEntryView {
  const names = {
    ACADEMIA: "Academia Saulo Fitness",
    CLINICA: "Clínica SV",
    PERSONAL: "Personal",
  };
  return {
    id: input.id,
    type: input.type,
    competence: "2026-08-01",
    dueDate: input.dueDate,
    amount: input.remainingAmount,
    settledAmount: "0.00",
    remainingAmount: input.remainingAmount,
    description: `Lançamento ${input.id}`,
    status: input.status ?? "PENDING",
    origin: input.sourceSystem === "NEXTFIT" ? "EXTERNAL_IMPORT" : "MANUAL",
    sourceSystem: input.sourceSystem ?? (input.unit === "CLINICA" ? "CLINICA_SV" : "GESTAO_SV"),
    managementNature: "REALIZED",
    businessUnit: { id: `unit-${input.unit}`, code: input.unit, name: names[input.unit] },
    financialCategory: {
      id: `category-${input.id}`,
      code: input.type === "REVENUE" ? `${input.unit}_RECEITA` : "ACADEMIA_ESTRUTURA_OPERACAO",
      name: input.type === "REVENUE" ? "Receitas" : "Estrutura",
    },
    settlements: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function reportInput(overrides: Partial<Parameters<typeof buildFinancialExecutiveReport>[0]> = {}) {
  return {
    unit: { code: "ALL" as const, name: "Consolidado" },
    period: resolveFinancialExecutivePeriod({ today: "2026-08-14" }),
    issuedAt: "2026-08-14T10:00:00",
    currentDate: "2026-08-14",
    summary: summary(),
    previousSummary: summary(),
    payablesEntries: [] as FinancialEntryView[],
    receivablesEntries: [] as FinancialEntryView[],
    evolution: [],
    ...overrides,
  };
}

test("resolve mês atual, mês anterior e intervalo personalizado", () => {
  assert.deepEqual(
    resolveFinancialExecutivePeriod({ today: "2026-08-14" }),
    { start: "2026-08-01", end: "2026-08-31", label: "agosto de 2026", preset: "CURRENT_MONTH" },
  );
  assert.deepEqual(
    resolveFinancialExecutivePeriod({ today: "2026-08-14", preset: "PREVIOUS_MONTH" }),
    { start: "2026-07-01", end: "2026-07-31", label: "julho de 2026", preset: "PREVIOUS_MONTH" },
  );
  const custom = resolveFinancialExecutivePeriod({ today: "2026-08-14", preset: "CUSTOM", from: "2026-07-10", to: "2026-08-05" });
  assert.equal(custom.start, "2026-07-10");
  assert.equal(custom.end, "2026-08-05");
});

for (const [code, name] of [
  ["ALL", "Consolidado"],
  ["ACADEMIA", "Academia Saulo Fitness"],
  ["CLINICA", "Clínica SV"],
  ["PERSONAL", "Personal"],
] as const) {
  test(`monta relatório ${name} sem criar um segundo motor financeiro`, () => {
    const view = buildFinancialExecutiveReport(reportInput({ unit: { code, name } }));
    assert.equal(view.unit.code, code);
    assert.equal(view.summary.totalReceived, "0.00");
    assert.equal(view.presentation.pptxAvailable, true);
    assert.equal(view.presentation.preparedForFutureExport, false);
  });
}

test("período sem dados é identificado sem valores fictícios", () => {
  const view = buildFinancialExecutiveReport(reportInput());
  assert.equal(view.hasData, false);
  assert.equal(view.priorityPayables.length, 0);
  assert.equal(view.priorityReceivables.length, 0);
});

test("reutiliza saldos, contas e leitura dos números financeiros recebidos", () => {
  const view = buildFinancialExecutiveReport(reportInput({
    summary: summary({
      totalReceived: "500.00",
      totalPaid: "200.00",
      realizedBalance: "300.00",
      openReceivable: "150.00",
      totalAvailable: "300.00",
      accountBalances: [{
        financialAccount: { id: "nubank", code: "NUBANK", name: "Nubank" },
        totalReceived: "500.00",
        totalPaid: "200.00",
        realizedBalance: "300.00",
      }],
    }),
  }));
  assert.equal(view.hasData, true);
  assert.equal(view.summary.accountBalances[0]?.financialAccount.code, "NUBANK");
  assert.match(view.reading.join(" "), /resultado realizado do período foi positivo/i);
  assert.match(view.reading.join(" "), /Nubank/);
});

test("síntese descreve a menor posição negativa quando todas as contas estão negativas", () => {
  const view = buildFinancialExecutiveReport(reportInput({
    summary: summary({
      totalPaid: "30.00",
      realizedBalance: "-30.00",
      accountBalances: [
        {
          financialAccount: { id: "cash", code: "CAIXA_FISICO", name: "Caixa físico Academia" },
          totalReceived: "0.00",
          totalPaid: "10.00",
          realizedBalance: "-10.00",
        },
        {
          financialAccount: { id: "nubank", code: "NUBANK", name: "Nubank" },
          totalReceived: "0.00",
          totalPaid: "20.00",
          realizedBalance: "-20.00",
        },
      ],
    }),
  }));
  const reading = view.reading.join(" ");
  assert.match(reading, /Todas as contas apresentam saldo realizado negativo/);
  assert.match(reading, /menor posição negativa é Caixa físico Academia/);
  assert.doesNotMatch(reading, /conta com maior saldo realizado/);
});

test("Contas a Pagar e Receber usam as regras compartilhadas e excluem NextFit liquidado", () => {
  const view = buildFinancialExecutiveReport(reportInput({
    payablesEntries: [
      entry({ id: "pay-overdue", unit: "ACADEMIA", type: "EXPENSE", dueDate: "2026-08-10", remainingAmount: "80.00" }),
    ],
    receivablesEntries: [
      entry({ id: "clinic", unit: "CLINICA", type: "REVENUE", dueDate: "2026-08-14", remainingAmount: "100.00" }),
      entry({ id: "personal", unit: "PERSONAL", type: "REVENUE", dueDate: "2026-08-13", remainingAmount: "50.00" }),
      entry({ id: "nextfit", unit: "ACADEMIA", type: "REVENUE", dueDate: "2026-08-13", remainingAmount: "0.00", sourceSystem: "NEXTFIT", status: "SETTLED" }),
    ],
  }));
  assert.equal(view.payables.totals.overdue, "80.00");
  assert.deepEqual(view.receivables.pending.map((item) => item.id), ["personal", "clinic"]);
  assert.deepEqual(view.priorityPayables.map((item) => item.id), ["pay-overdue"]);
});

test("componente mantém DRE e Caixa em blocos separados", () => {
  const source = readFileSync(
    new URL("../../../components/financial/financial-executive-report.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Movimentação realizada — Caixa/);
  assert.match(source, /Dados gerenciais — DRE/);
  assert.match(source, /view\.dre\?\.availability === "AVAILABLE"/);
  assert.match(source, /Sem DRE válida aplicável ao período selecionado/);
});

test("relatório financeiro segue a identidade institucional dos entregáveis profissionais", () => {
  const source = readFileSync(
    new URL("../../../components/financial/financial-executive-report.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Símbolo do Sistema Integrado SV/);
  assert.match(source, /Centro de Gestão SV/);
  assert.match(source, /Sistema Integrado SV/);
  assert.match(source, /Entregável profissional/);
  assert.match(source, /border-b-2 border-\[#17644c\]/);
  assert.match(source, /Centro de Gestão SV · Sistema Integrado SV/);
});

test("impressão usa window.print, esconde navegação e não persiste dados", () => {
  const component = readFileSync(
    new URL("../../../components/financial/financial-executive-report.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8");
  const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
  assert.match(component, /window\.print\(\)/);
  assert.match(component, /print:hidden/);
  assert.match(css, /@media print/);
  assert.match(css, /financial-executive-report/);
  assert.match(css, /-webkit-print-color-adjust:\s*exact/);
  assert.match(css, /print-color-adjust:\s*exact/);
  assert.match(css, /border-bottom:\s*2px solid #17644c/);
  assert.match(css, /text-shadow:\s*none/);
  assert.match(css, /aside/);
  assert.doesNotMatch(server, /\.create\(|\.settle\(|\.update\(|\.cancel\(/);
  assert.match(server, /financialService\.summarize/);
  assert.match(server, /financialService\.list/);
});

test("apresentação usa o mesmo modelo do relatório e mantém o botão habilitado", () => {
  const component = readFileSync(
    new URL("../../../components/financial/financial-executive-report.tsx", import.meta.url),
    "utf8",
  );
  const presentation = readFileSync(new URL("./presentation.ts", import.meta.url), "utf8");
  assert.match(component, /downloadFinancialExecutivePresentation/);
  assert.match(component, /Gerar apresentação/);
  assert.doesNotMatch(component, /Exportação PPTX será disponibilizada em etapa futura/);
  assert.match(presentation, /FinancialExecutiveReportView/);
  assert.doesNotMatch(presentation, /financialService|repository|prisma/);
});
