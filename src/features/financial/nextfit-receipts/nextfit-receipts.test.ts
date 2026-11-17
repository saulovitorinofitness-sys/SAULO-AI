import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "@e965/xlsx";

import type { FinancialEntryView } from "../contracts";
import { buildFinancialSummary } from "../repository";
import { getNextFitReceiptDestination, normalizeNextFitReceiptMethod } from "./mapping";
import { parseNextFitReceiptsMatrix } from "./parser";
import type { NextFitReceiptsRepository } from "./repository";
import { createNextFitReceiptsService } from "./service";
import { validateNextFitReceiptRows } from "./validation";

const HEADER = [
  "Caixa",
  "Data de abertura",
  "Data de fechamento",
  "Data",
  "Origem",
  "Método",
  "Tipo",
  "Valor",
];

function workbookBytes(rows: readonly (readonly unknown[])[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows.map((row) => [...row])),
    "Recebimentos",
  );
  return new Uint8Array(XLSX.write(workbook, { bookType: "xlsx", type: "array" }));
}

function memoryRepository() {
  const state = {
    batches: new Map<string, { id: string; fileName: string; importedAt: string }>(),
    fingerprints: new Set<string>(),
    entries: [] as Array<{ fingerprint: string; amount: string }>,
    settlements: [] as Array<{ idempotencyKey: string; amount: string; accountCode: string; paymentMethodCode: string }>,
    confirmCalls: 0,
  };
  const repository: NextFitReceiptsRepository = {
    async findByHash(fileHash) {
      const batch = state.batches.get(fileHash);
      return batch ? { ...batch, status: "IMPORTED", kind: "NEXTFIT_RECEIPTS" } : null;
    },
    async findExistingFingerprints(_businessUnitId, fingerprints) {
      return fingerprints.filter((fingerprint) => state.fingerprints.has(fingerprint));
    },
    async getReferences() {
      return {
        businessUnit: { id: "academy", code: "ACADEMIA", status: "ACTIVE" },
        category: { id: "revenue", code: "ACADEMIA_MENSALIDADES", type: "REVENUE", businessUnitId: "academy", status: "ACTIVE" },
        accounts: [
          { id: "nubank", code: "NUBANK", businessUnitId: "academy", status: "ACTIVE" },
          { id: "sumup", code: "SUMUP", businessUnitId: "academy", status: "ACTIVE" },
          { id: "cash", code: "CAIXA_FISICO", businessUnitId: "academy", status: "ACTIVE" },
        ],
        paymentMethods: [
          { id: "pix", code: "PIX", status: "ACTIVE" },
          { id: "credit", code: "CREDITO", status: "ACTIVE" },
          { id: "debit", code: "DEBITO", status: "ACTIVE" },
          { id: "money", code: "DINHEIRO", status: "ACTIVE" },
        ],
      };
    },
    async confirm(input) {
      state.confirmCalls += 1;
      const existing = state.batches.get(input.fileHash);
      if (existing) {
        return {
          id: existing.id,
          fileName: input.fileName,
          fileHash: input.fileHash,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          importedAt: existing.importedAt,
          status: "IMPORTED",
          operation: "REPLAYED",
          importedCount: 0,
          duplicateCount: input.rows.length,
          totalAmount: "0.00",
        };
      }
      const imported = input.rows.filter((row) => !state.fingerprints.has(row.fingerprint));
      for (const row of imported) {
        state.fingerprints.add(row.fingerprint);
        state.entries.push({ fingerprint: row.fingerprint, amount: row.amount });
        state.settlements.push({
          idempotencyKey: `nextfit-receipt:${row.fingerprint}`,
          amount: row.amount,
          accountCode: row.destinationAccountCode,
          paymentMethodCode: row.paymentMethodCode,
        });
      }
      input.buildManifest({
        importedAt: "2026-08-14T12:00:00.000Z",
        importedRows: imported,
        duplicateCount: input.rows.length - imported.length,
      });
      state.batches.set(input.fileHash, {
        id: "batch-1",
        fileName: input.fileName,
        importedAt: "2026-08-14T12:00:00.000Z",
      });
      return {
        id: "batch-1",
        fileName: input.fileName,
        fileHash: input.fileHash,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        importedAt: "2026-08-14T12:00:00.000Z",
        status: "IMPORTED",
        operation: "CREATED",
        importedCount: imported.length,
        duplicateCount: input.rows.length - imported.length,
        totalAmount: imported.reduce((sum, row) => sum + Number(row.amount), 0).toFixed(2),
      };
    },
  };
  return { repository, state };
}

test("mapeia PIX, crédito, débito e dinheiro para conta e forma aprovadas", () => {
  const cases = [
    ["Pix/Depósito", "PIX_DEPOSIT", "NUBANK", "PIX"],
    ["Cartão de crédito", "CREDIT_CARD", "SUMUP", "CREDITO"],
    ["Cartão de débito", "DEBIT_CARD", "SUMUP", "DEBITO"],
    ["Dinheiro", "CASH", "CAIXA_FISICO", "DINHEIRO"],
  ] as const;

  for (const [raw, normalized, account, paymentMethod] of cases) {
    const method = normalizeNextFitReceiptMethod(raw);
    assert.equal(method, normalized);
    assert.deepEqual(getNextFitReceiptDestination(method!), {
      accountCode: account,
      paymentMethodCode: paymentMethod,
    });
  }
});

test("interpreta o relatório tabular sem usar Caixa como conta financeira", () => {
  const parsed = parseNextFitReceiptsMatrix([
    ["Relatório de recebimentos NextFit"],
    HEADER,
    ["Operador Maria", "14/08/2026", "14/08/2026", "14/08/2026", "Mensalidade", "Pix/Depósito", "Entrada", "1.234,56"],
  ], "PIX");
  const validation = validateNextFitReceiptRows(parsed.rows);

  assert.equal(validation.validRows.length, 1);
  assert.equal(validation.validRows[0].amount, "1234.56");
  assert.equal(validation.validRows[0].cashRegister, "Operador Maria");
  assert.equal(validation.validRows[0].destinationAccountCode, "NUBANK");
});

test("rejeita saídas, estornos, valores negativos e métodos desconhecidos", () => {
  const parsed = parseNextFitReceiptsMatrix([
    HEADER,
    ["A", "14/08/2026", "14/08/2026", "14/08/2026", "X", "Pix", "Saída", "70,00"],
    ["A", "14/08/2026", "14/08/2026", "14/08/2026", "X", "Boleto", "Entrada", "70,00"],
    ["A", "14/08/2026", "14/08/2026", "14/08/2026", "X", "Dinheiro", "Entrada", "-10,00"],
  ]);
  const validation = validateNextFitReceiptRows(parsed.rows);

  assert.equal(validation.validRows.length, 0);
  assert.equal(validation.invalidRows.length, 3);
  assert.ok(validation.issues.some((issue) => issue.code === "INVALID_ROW_TYPE"));
  assert.ok(validation.issues.some((issue) => issue.code === "UNRECOGNIZED_METHOD"));
  assert.ok(validation.issues.some((issue) => issue.code === "INVALID_AMOUNT"));
});

test("fingerprint é estável e diferencia ocorrências idênticas no mesmo arquivo", () => {
  const row = ["Operador", "14/08/2026", "14/08/2026", "14/08/2026", "Mensalidade", "Pix", "Entrada", "70,00"];
  const once = validateNextFitReceiptRows(parseNextFitReceiptsMatrix([HEADER, row]).rows);
  const twice = validateNextFitReceiptRows(parseNextFitReceiptsMatrix([HEADER, row, row]).rows);

  assert.equal(once.validRows[0].fingerprint, twice.validRows[0].fingerprint);
  assert.notEqual(twice.validRows[0].fingerprint, twice.validRows[1].fingerprint);
  assert.equal(twice.validRows[1].occurrence, 2);
});

test("preview não persiste e apresenta válidos, inválidos, período, total e destino", async () => {
  const memory = memoryRepository();
  const preview = await createNextFitReceiptsService(memory.repository).inspect(
    "recebimentos.xlsx",
    workbookBytes([
      HEADER,
      ["Operador", "14/08/2026", "14/08/2026", "14/08/2026", "Mensalidade", "Pix/Depósito", "Entrada", "70,00"],
      ["Operador", "14/08/2026", "14/08/2026", "14/08/2026", "Estorno", "Pix/Depósito", "Saída", "-10,00"],
    ]),
  );

  assert.equal(preview.validCount, 1);
  assert.equal(preview.invalidCount, 1);
  assert.equal(preview.validAmount, "70.00");
  assert.deepEqual(preview.destinationAccounts, ["NUBANK"]);
  assert.equal(memory.state.entries.length, 0);
  assert.equal(memory.state.settlements.length, 0);
  assert.equal(memory.state.confirmCalls, 0);
});

test("confirmação cria exatamente um Entry e um Settlement e retry do arquivo não duplica", async () => {
  const memory = memoryRepository();
  const service = createNextFitReceiptsService(memory.repository);
  const bytes = workbookBytes([
    HEADER,
    ["Operador NextFit", "14/08/2026", "14/08/2026", "14/08/2026", "Mensalidade", "Pix/Depósito", "Entrada", "70,00"],
  ]);
  const preview = await service.inspect("recebimentos.xlsx", bytes);
  const created = await service.confirm({
    fileName: "recebimentos.xlsx",
    bytes,
    expectedHash: preview.fileHash,
    importedByUserId: "user-1",
  });
  const replayed = await service.confirm({
    fileName: "recebimentos.xlsx",
    bytes,
    expectedHash: preview.fileHash,
    importedByUserId: "user-1",
  });

  assert.equal(created.importedCount, 1);
  assert.equal(replayed.operation, "REPLAYED");
  assert.equal(memory.state.entries.length, 1);
  assert.equal(memory.state.settlements.length, 1);
  assert.deepEqual(memory.state.settlements[0], {
    idempotencyKey: `nextfit-receipt:${memory.state.entries[0].fingerprint}`,
    amount: "70.00",
    accountCode: "NUBANK",
    paymentMethodCode: "PIX",
  });
});

test("confirmação de arquivo misto persiste somente a linha válida", async () => {
  const memory = memoryRepository();
  const service = createNextFitReceiptsService(memory.repository);
  const bytes = workbookBytes([
    HEADER,
    ["Operador", "14/08/2026", "14/08/2026", "14/08/2026", "Mensalidade", "Dinheiro", "Entrada", "25,00"],
    ["Operador", "14/08/2026", "14/08/2026", "14/08/2026", "Cancelamento", "Dinheiro", "Cancelamento", "25,00"],
  ]);
  const preview = await service.inspect("misto.xlsx", bytes);
  await service.confirm({
    fileName: "misto.xlsx",
    bytes,
    expectedHash: preview.fileHash,
    importedByUserId: "user-1",
  });

  assert.equal(memory.state.entries.length, 1);
  assert.equal(memory.state.settlements.length, 1);
  assert.equal(memory.state.settlements[0].accountCode, "CAIXA_FISICO");
  assert.equal(memory.state.settlements[0].paymentMethodCode, "DINHEIRO");
});

test("mesma linha em outro arquivo é detectada pelo fingerprint e não é importada", async () => {
  const memory = memoryRepository();
  const service = createNextFitReceiptsService(memory.repository);
  const row = ["Operador", "14/08/2026", "14/08/2026", "14/08/2026", "Mensalidade", "Cartão de crédito", "Entrada", "90,00"];
  const firstBytes = workbookBytes([HEADER, row]);
  const secondBytes = workbookBytes([["Exportação gerada novamente"], HEADER, row]);
  const firstPreview = await service.inspect("cartoes-1.xlsx", firstBytes);
  await service.confirm({
    fileName: "cartoes-1.xlsx",
    bytes: firstBytes,
    expectedHash: firstPreview.fileHash,
    importedByUserId: "user-1",
  });
  const secondPreview = await service.inspect("cartoes-2.xlsx", secondBytes);

  assert.notEqual(firstPreview.fileHash, secondPreview.fileHash);
  assert.equal(secondPreview.validCount, 0);
  assert.equal(secondPreview.duplicateCount, 1);
  assert.equal(secondPreview.canConfirm, false);
  assert.equal(memory.state.entries.length, 1);
  assert.equal(memory.state.settlements.length, 1);
});

test("receita importada realizada aumenta Entradas realizadas e saldo sem afetar despesas", () => {
  const importedEntry = {
    id: "entry",
    type: "REVENUE",
    competence: "2026-08-14",
    dueDate: "2026-08-14",
    amount: "70.00",
    settledAmount: "70.00",
    remainingAmount: "0.00",
    description: "Recebimento NextFit",
    status: "SETTLED",
    origin: "EXTERNAL_IMPORT",
    sourceSystem: "NEXTFIT",
    managementNature: "REALIZED",
    sourceType: "NEXTFIT_RECEBIMENTO",
    sourceId: "fingerprint",
    businessUnit: { id: "academy", code: "ACADEMIA", name: "Academia" },
    financialCategory: { id: "revenue", code: "ACADEMIA_MENSALIDADES", name: "Mensalidades" },
    settlements: [{
      id: "settlement",
      amount: "70.00",
      settlementDate: "2026-08-14",
      financialAccount: { id: "nubank", code: "NUBANK", name: "Nubank" },
      paymentMethod: { id: "pix", code: "PIX", name: "PIX" },
      idempotencyKey: "nextfit-receipt:fingerprint",
      createdAt: "2026-08-14T12:00:00.000Z",
    }],
    createdAt: "2026-08-14T12:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
  } satisfies FinancialEntryView;

  const summary = buildFinancialSummary([importedEntry], new Date("2026-08-14T12:00:00.000Z"));
  assert.equal(summary.totalReceived, "70.00");
  assert.equal(summary.realizedBalance, "70.00");
  assert.equal(summary.totalPaid, "0.00");
  assert.equal(summary.accountBalances[0]?.financialAccount.code, "NUBANK");
  assert.equal(summary.accountBalances[0]?.realizedBalance, "70.00");
  assert.equal(summary.totalAvailable, "70.00");
});
