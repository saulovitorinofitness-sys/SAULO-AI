import assert from "node:assert/strict";
import test from "node:test";

import type { FinancialExecutiveReportView } from "./contracts";
import {
  createFinancialExecutivePresentation,
  financialExecutivePresentationFileName,
} from "./presentation";

function presentationView() {
  return {
    unit: { code: "PERSONAL", name: "Personal" },
    period: {
      start: "2026-08-01",
      end: "2026-08-31",
      label: "agosto de 2026",
      preset: "CURRENT_MONTH",
    },
    issuedAt: "2026-08-14T10:30:00",
    summary: {
      totalReceived: "1234.56",
      totalPaid: "250.00",
      realizedBalance: "984.56",
      openReceivable: "300.00",
      openPayable: "100.00",
      overdueTotal: "50.00",
      ownerWithdrawalPaid: "0.00",
      totalAvailable: "984.56",
      accountBalances: [
        {
          financialAccount: { id: "account", code: "NUBANK", name: "Nubank" },
          totalReceived: "1234.56",
          totalPaid: "250.00",
          realizedBalance: "984.56",
        },
      ],
    },
    payables: {
      totals: {
        overdue: "50.00",
        today: "0.00",
        next7Days: "25.00",
        next30Days: "25.00",
      },
    },
    receivables: {
      buckets: {
        overdue: { count: 1, amount: "100.00" },
        today: { count: 0, amount: "0.00" },
        next7Days: { count: 1, amount: "100.00" },
        next30Days: { count: 1, amount: "100.00" },
      },
    },
    priorityPayables: [],
    priorityReceivables: [],
    evolution: [
      {
        competence: "2026-08",
        totalReceived: "1234.56",
        totalPaid: "250.00",
        realizedBalance: "984.56",
      },
    ],
    reading: ["O resultado realizado do período foi positivo em R$ 984,56."],
    presentation: { pptxAvailable: true, preparedForFutureExport: false },
  } as unknown as FinancialExecutiveReportView;
}

test("gera PPTX válido a partir do mesmo DTO do relatório", async () => {
  const view = presentationView();
  const presentation = createFinancialExecutivePresentation(view);
  const slides = (presentation as unknown as { _slides: readonly unknown[] })._slides;
  assert.equal(slides.length, 6);

  const output = await presentation.write({
    outputType: "uint8array",
    compression: true,
  });
  assert.ok(output instanceof Uint8Array);
  assert.ok(output.byteLength > 10_000);
  assert.deepEqual(Array.from(output.slice(0, 2)), [0x50, 0x4b]);
});

test("nome do arquivo identifica unidade e período sem caracteres inseguros", () => {
  const name = financialExecutivePresentationFileName(presentationView());
  assert.equal(
    name,
    "Relatorio-Executivo-Financeiro-PERSONAL-2026-08-01-a-2026-08-31.pptx",
  );
});
