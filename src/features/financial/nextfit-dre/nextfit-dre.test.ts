import "dotenv/config";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as XLSX from "@e965/xlsx";

import { NextFitDreError } from "./contracts";
import {
  parseFinancialCell,
  parseNextFitDreMatrix,
  readNextFitDreWorkbook,
} from "./parser";
import type { NextFitDreBatchRepository } from "./repository";
import { createNextFitDreService } from "./service";
import {
  buildExerciseProgress,
  lineAmountByMonth,
  NEXTFIT_DRE_MONTHS,
} from "./preview-model";

function workbookBytes(
  matrix: readonly (readonly unknown[])[],
  bookType: "xls" | "xlsx" = "xlsx",
  sheetName = "DRE Gerencial",
) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(matrix.map((row) => [...row])),
    sheetName,
  );
  return new Uint8Array(XLSX.write(workbook, { bookType, type: "array" }));
}

const HORIZONTAL_HEADER = [
  "Categoria", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro", "Total",
] as const;

const REAL_NEXTFIT_DESCRIPTIONS = [
  "Receitas operacionais",
  "Receita de vendas",
  "Outras receitas",
  "(=) Receita bruta de vendas",
  "Deduções da receita bruta",
  "Descontos incondicionais",
  "Impostos sobre vendas",
  "Comissões sobre vendas",
  "Devoluções de vendas",
  "Contestações de recebimentos",
  "(=) Receita líquida de vendas",
  "Custos operacionais",
  "Custo dos produtos vendidos",
  "Custo das vendas de produtos",
  "Custo dos serviços prestados",
  "(=) Lucro bruto",
  "Despesas operacionais",
  "Despesas comerciais",
  "Despesas administrativas",
  "Despesas operacionais",
  "(=) Lucro/Prejuízo operacional",
  "Receitas e despesas financeiras",
  "Receita e rendimentos financeiros",
  "Despesas financeiras",
  "Outras receitas e despesas não operacionais",
  "Outras receitas não operacionais",
  "Outras despesas não operacionais",
  "(=) Lucro/Prejuízo líquido",
  "Despesas com investimentos e empréstimos",
  "Investimentos em imobilizado",
  "Empréstimos e dívidas",
  "(=) Lucro/Prejuízo Final",
] as const;

function horizontalMatrix(options: { mismatch?: boolean } = {}) {
  return [
    [...HORIZONTAL_HEADER],
    ...REAL_NEXTFIT_DESCRIPTIONS.map((description, index) => {
      const months: Array<string | number | null> = Array(12).fill(0);
      if (index === 1) {
        months[0] = "1.234,56";
        months[1] = 100.25;
        months[2] = null;
      }
      if (index === 23) months[0] = "-50,75";
      const sum = months.reduce<number>((total, value) =>
        total + (parseFinancialCell(value) ?? 0), 0);
      return [description, ...months, options.mismatch && index === 1 ? sum + 1 : sum];
    }),
  ];
}

function repository(
  duplicate = false,
): NextFitDreBatchRepository {
  return {
    async findByHash() {
      return duplicate
        ? {
            id: "batch-existing",
            fileName: "dre-agosto.xlsx",
            competence: "2026-08-01",
            importedAt: "2026-08-11T12:00:00.000Z",
            status: "VALIDATED",
            hasSnapshot: true,
          }
        : null;
    },
    async createValidated(input) {
      return {
        id: "batch-new",
        fileName: input.fileName,
        fileHash: input.fileHash,
        competence: input.competence,
        status: "VALIDATED",
        importedAt: "2026-08-11T13:00:00.000Z",
        operation: "CREATED",
      };
    },
    async attachSnapshot(input) {
      return {
        id: input.batchId,
        fileName: "dre-agosto.xlsx",
        fileHash: input.fileHash,
        competence: input.competence,
        status: "VALIDATED",
        importedAt: "2026-08-11T12:00:00.000Z",
        operation: "SNAPSHOT_ATTACHED",
      };
    },
  };
}

test("lê uma planilha DRE NextFit válida", async () => {
  const parsed = await readNextFitDreWorkbook(
    workbookBytes([
      ["DRE Gerencial NextFit"],
      ["Descrição", "Agosto/2026"],
      ["RECEITAS"],
      ["Receita Bruta", "12.500,00"],
      ["Despesas Operacionais", "3.200,00"],
      ["Resultado do Período", "9.300,00"],
    ]),
  );
  assert.deepEqual(parsed.competences, ["2026-08-01"]);
  assert.equal(parsed.lines.filter((line) => line.values.length).length, 3);
  assert.equal(parsed.keyFigures.at(-1)?.values[0]?.amount, "9300.00");
});

test("lê a exportação legada em formato XLS", async () => {
  const preview = await createNextFitDreService(repository()).inspect(
    "dre-nextfit.xls",
    workbookBytes([
      ["DRE Gerencial", "Ano: 2026"],
      ["Descrição", "Jan"],
      ["Receitas Operacionais", "1.234,56"],
      ["Lucro/Prejuízo Final", "1.234,56"],
    ], "xls"),
    undefined,
    1,
  );
  assert.equal(preview.competences[0], "2026-01-01");
  assert.equal(preview.canConfirm, true);
});

test("rejeita arquivo inválido", async () => {
  const service = createNextFitDreService(repository());
  await assert.rejects(
    service.inspect("dre-nextfit.txt", new Uint8Array([1, 2, 3])),
    (error: unknown) =>
      error instanceof NextFitDreError && error.code === "INVALID_FILE_FORMAT",
  );
  await assert.rejects(
    service.inspect("dre-nextfit.xlsx", new Uint8Array([1, 2, 3])),
    (error: unknown) => error instanceof NextFitDreError,
  );
});

test("rejeita estrutura inesperada", () => {
  assert.throws(
    () => parseNextFitDreMatrix([["Nome", "Telefone"], ["Cliente", "9999-9999"]]),
    (error: unknown) =>
      error instanceof NextFitDreError && error.code === "UNEXPECTED_STRUCTURE",
  );
});

test("identifica múltiplas competências", async () => {
  const parsed = parseNextFitDreMatrix([
    ["Descrição", "Julho/2026", "Agosto/2026"],
    ["Receita Líquida", 100, 120],
  ]);
  assert.deepEqual(parsed.competences, ["2026-07-01", "2026-08-01"]);
  assert.equal(parsed.warnings.some((warning) => warning.code === "MULTIPLE_COMPETENCES"), true);
  const preview = await createNextFitDreService(repository()).inspect(
    "dre-bimestral.xlsx",
    workbookBytes([
      ["Descrição", "Julho/2026", "Agosto/2026"],
      ["Receita Líquida", 100, 120],
    ]),
    undefined,
    8,
  );
  assert.equal(preview.canConfirm, true);
});

test("interpreta a disposição anual do NextFit com meses no cabeçalho", () => {
  const parsed = parseNextFitDreMatrix([
    ["DRE Gerencial", "Ano: 2026"],
    ["Descrição", "Jan", "Fev", "Março"],
    ["Receitas Operacionais", 100, 120, 130],
    ["Investimentos em imobilizado", 0, -50, 0],
    ["Lucro/Prejuízo Final", 100, 70, 130],
  ]);
  assert.deepEqual(parsed.competences, ["2026-01-01", "2026-02-01", "2026-03-01"]);
  assert.equal(parsed.groups.includes("Investimentos em imobilizado"), true);
});

test("preserva valores negativos", () => {
  const parsed = parseNextFitDreMatrix([
    ["Descrição", "Agosto/2026"],
    ["Despesas Financeiras", "(1.234,56)"],
    ["Prejuízo", "500,00-"],
  ]);
  assert.equal(parsed.lines[0].values[0].amount, "-1234.56");
  assert.equal(parsed.lines[1].values[0].amount, "-500.00");
});

test("sinaliza células vazias sem descartar a linha", () => {
  const parsed = parseNextFitDreMatrix([
    ["Descrição", "Julho/2026", "Agosto/2026"],
    ["Receita Bruta", "1.000,00", null],
  ]);
  assert.equal(parsed.lines[0].values.length, 1);
  assert.equal(parsed.warnings.some((warning) => warning.code === "EMPTY_CELL"), true);
});

test("impede duplicidade pelo hash antes da confirmação", async () => {
  const service = createNextFitDreService(repository(true));
  const bytes = workbookBytes([
    ["Descrição", "Agosto/2026"],
    ["Receita Líquida", 100],
  ]);
  const preview = await service.inspect("dre-agosto.xlsx", bytes, undefined, 8);
  assert.equal(preview.canConfirm, false);
  assert.equal(preview.duplicateBatch?.id, "batch-existing");
  await assert.rejects(
    service.confirm({
      fileName: "dre-agosto.xlsx",
      bytes,
      expectedHash: preview.fileHash,
      importedByUserId: "user-saulo",
      lastClosedMonth: 8,
    }),
    (error: unknown) =>
      error instanceof NextFitDreError && error.code === "SNAPSHOT_ALREADY_EXISTS",
  );
});

test("persiste fotografia versionada suficiente para reconstruir a DRE", async () => {
  let capturedSnapshot: Parameters<NextFitDreBatchRepository["createValidated"]>[0]["snapshot"] | undefined;
  const baseRepository = repository(false);
  const service = createNextFitDreService({
    ...baseRepository,
    async createValidated(input) {
      capturedSnapshot = input.snapshot;
      return baseRepository.createValidated(input);
    },
  });
  const bytes = workbookBytes(horizontalMatrix({ mismatch: true }), "xlsx", "Sheet1");
  const preview = await service.inspect("dre-julho.xlsx", bytes, 2026, 7);
  await service.confirm({
    fileName: "dre-julho.xlsx",
    bytes,
    expectedHash: preview.fileHash,
    importedByUserId: "user-saulo",
    baseYear: 2026,
    lastClosedMonth: 7,
  });
  assert.equal(capturedSnapshot?.snapshotVersion, "nextfit-dre-snapshot@1");
  assert.equal(capturedSnapshot?.parserVersion, "nextfit-dre-horizontal@1");
  assert.equal(capturedSnapshot?.year, 2026);
  assert.equal(capturedSnapshot?.exercise.lastClosedMonth, 7);
  assert.equal(capturedSnapshot?.exercise.closedCount, 7);
  assert.equal(capturedSnapshot?.lines.length, REAL_NEXTFIT_DESCRIPTIONS.length);
  assert.equal(capturedSnapshot?.lines[1].description, REAL_NEXTFIT_DESCRIPTIONS[1]);
  assert.equal(capturedSnapshot?.lines[1].rowNumber, 3);
  assert.equal(capturedSnapshot?.lines[1].values[0].originalValue, "1.234,56");
  assert.equal(capturedSnapshot?.totalCheck.mismatching, 1);
  assert.equal(capturedSnapshot?.warnings.some((warning) => warning.code === "TOTAL_MISMATCH"), true);
});

test("completa lote legado do mesmo hash sem criar um segundo lote", async () => {
  let creates = 0;
  let attaches = 0;
  const legacyRepository: NextFitDreBatchRepository = {
    async findByHash() {
      return {
        id: "batch-legado",
        fileName: "dre-julho.xlsx",
        competence: "2026-07-01",
        importedAt: "2026-07-31T12:00:00.000Z",
        status: "VALIDATED",
        hasSnapshot: false,
      };
    },
    async createValidated() {
      creates += 1;
      throw new Error("não deveria criar lote");
    },
    async attachSnapshot(input) {
      attaches += 1;
      assert.equal(input.batchId, "batch-legado");
      assert.equal(input.competence, "2026-07-01");
      assert.equal(input.snapshot.exercise.lastClosedMonth, 7);
      return {
        id: input.batchId,
        fileName: "dre-julho.xlsx",
        fileHash: input.fileHash,
        competence: input.competence,
        status: "VALIDATED",
        importedAt: "2026-07-31T12:00:00.000Z",
        operation: "SNAPSHOT_ATTACHED",
      };
    },
  };
  const service = createNextFitDreService(legacyRepository);
  const bytes = workbookBytes(horizontalMatrix(), "xlsx", "Sheet1");
  const preview = await service.inspect("dre-julho.xlsx", bytes, 2026, 7);
  assert.equal(preview.canConfirm, true);
  assert.equal(preview.warnings[0]?.code, "SNAPSHOT_MISSING");
  const batch = await service.confirm({
    fileName: "dre-julho.xlsx",
    bytes,
    expectedHash: preview.fileHash,
    importedByUserId: "user-saulo",
    baseYear: 2026,
    lastClosedMonth: 7,
  });
  assert.equal(batch.operation, "SNAPSHOT_ATTACHED");
  assert.equal(creates, 0);
  assert.equal(attaches, 1);
});

test("bloqueia preenchimento do lote legado quando a competência diverge", async () => {
  const conflictingRepository: NextFitDreBatchRepository = {
    ...repository(false),
    async findByHash() {
      return {
        id: "batch-legado",
        fileName: "dre-junho.xlsx",
        competence: "2026-06-01",
        importedAt: "2026-06-30T12:00:00.000Z",
        status: "VALIDATED",
        hasSnapshot: false,
      };
    },
  };
  const service = createNextFitDreService(conflictingRepository);
  const bytes = workbookBytes(horizontalMatrix(), "xlsx", "Sheet1");
  const preview = await service.inspect("dre-julho.xlsx", bytes, 2026, 7);
  assert.equal(preview.canConfirm, false);
  assert.equal(preview.warnings[0]?.code, "SNAPSHOT_CONFLICT");
  await assert.rejects(
    service.confirm({
      fileName: "dre-julho.xlsx",
      bytes,
      expectedHash: preview.fileHash,
      importedByUserId: "user-saulo",
      baseYear: 2026,
      lastClosedMonth: 7,
    }),
    (error: unknown) =>
      error instanceof NextFitDreError && error.code === "SNAPSHOT_CONFLICT",
  );
});

test("preserva a descrição original para rastreabilidade", () => {
  const parsed = parseNextFitDreMatrix([
    ["Descrição", "Agosto/2026"],
    ["Receita de Mensalidades — Plano Família", "2.345,67"],
  ]);
  assert.equal(parsed.lines[0].description, "Receita de Mensalidades — Plano Família");
});

test("interpreta ponto isolado como separador de milhar brasileiro", () => {
  assert.equal(parseFinancialCell("1.234"), 1234);
  assert.equal(parseFinancialCell("12.345.678"), 12_345_678);
  assert.equal(parseFinancialCell("1234.56"), 1234.56);
});

test("preserva a descrição de linha com valor inconsistente", () => {
  const parsed = parseNextFitDreMatrix([
    ["Descrição", "Agosto/2026"],
    ["Taxas diversas conforme relatório", "valor indisponível"],
    ["Receita Líquida", "1.000,00"],
  ]);
  assert.equal(parsed.lines[0].description, "Taxas diversas conforme relatório");
  assert.equal(parsed.lines[0].values.length, 0);
  assert.equal(parsed.warnings[0]?.code, "MISSING_VALUE");
});

test("destaca os grupos oficiais da DRE NextFit sem criar categorias", () => {
  const parsed = parseNextFitDreMatrix([
    ["DRE Gerencial", "Ano: 2026"],
    ["Descrição", "Jan"],
    ["Receitas Operacionais", 1000],
    ["Lucro Bruto", 800],
    ["Receitas e Despesas Financeiras", -50],
    ["Lucro/Prejuízo Final", 750],
  ]);
  assert.deepEqual(
    parsed.keyFigures.map((figure) => figure.description),
    [
      "Receitas Operacionais",
      "Lucro Bruto",
      "Receitas e Despesas Financeiras",
      "Lucro/Prejuízo Final",
    ],
  );
});

test("reconhece a estrutura horizontal real da aba Sheet1", async () => {
  const parsed = await readNextFitDreWorkbook(
    workbookBytes(horizontalMatrix(), "xlsx", "Sheet1"),
    { baseYear: 2026 },
  );
  assert.equal(parsed.sheetNames[0], "Sheet1");
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.lines.length, 32);
  assert.equal(parsed.lines[0].description, "Receitas operacionais");
});

test("transforma Janeiro a Dezembro em competências e ignora Total", () => {
  const parsed = parseNextFitDreMatrix(horizontalMatrix(), "Sheet1", { baseYear: 2026 });
  assert.equal(parsed.competences.length, 12);
  assert.equal(parsed.competences[0], "2026-01-01");
  assert.equal(parsed.competences[11], "2026-12-01");
  assert.equal(parsed.competences.some((value) => value.includes("13")), false);
  assert.equal(parsed.lines[1].total?.amount, "1334.81");
  assert.equal(
    parsed.warnings.some((warning) => warning.code === "MULTIPLE_COMPETENCES"),
    false,
  );
});

test("preserva negativos, decimais, zeros, vazios e valores originais", () => {
  const parsed = parseNextFitDreMatrix(horizontalMatrix(), "Sheet1", { baseYear: 2026 });
  const sales = parsed.lines[1];
  assert.equal(sales.values[0].amount, "1234.56");
  assert.equal(sales.values[0].originalValue, "1.234,56");
  assert.equal(sales.values[1].amount, "100.25");
  assert.equal(sales.values.some((value) => value.competence === "2026-03-01"), false);
  assert.equal(sales.values.find((value) => value.competence === "2026-04-01")?.amount, "0.00");
  assert.equal(parsed.lines[23].values[0].amount, "-50.75");
  assert.equal(parsed.lines[23].values[0].originalValue, "-50,75");
});

test("mantém categorias repetidas por posição e contexto", () => {
  const parsed = parseNextFitDreMatrix(horizontalMatrix(), "Sheet1", { baseYear: 2026 });
  const repeated = parsed.lines.filter((line) => line.description === "Despesas operacionais");
  assert.equal(repeated.length, 2);
  assert.notEqual(repeated[0].rowNumber, repeated[1].rowNumber);
  assert.equal(repeated[0].isGroup, true);
  assert.equal(repeated[1].isGroup, false);
  assert.equal(repeated[1].context, "Despesas operacionais");
});

test("confere soma mensal contra Total e avisa divergência", async () => {
  const matching = parseNextFitDreMatrix(horizontalMatrix(), "Sheet1", { baseYear: 2026 });
  assert.equal(matching.lines[1].total?.matches, true);
  assert.equal(matching.warnings.some((warning) => warning.code === "TOTAL_MISMATCH"), false);

  const preview = await createNextFitDreService(repository()).inspect(
    "dre-real-nextfit.xlsx",
    workbookBytes(horizontalMatrix({ mismatch: true }), "xlsx", "Sheet1"),
    2026,
    8,
  );
  assert.equal(preview.totalCheckCount, 32);
  assert.equal(preview.totalMismatchCount, 1);
  assert.equal(preview.warnings.some((warning) => warning.code === "TOTAL_MISMATCH"), true);
});

test("solicita ano quando a DRE horizontal não o informa", () => {
  assert.throws(
    () => parseNextFitDreMatrix(horizontalMatrix(), "Sheet1"),
    (error: unknown) =>
      error instanceof NextFitDreError && error.code === "YEAR_REQUIRED",
  );
});

test("não reconhece cabeçalho horizontal sem linhas características de DRE", () => {
  assert.throws(
    () => parseNextFitDreMatrix([
      [...HORIZONTAL_HEADER],
      ["Aluno", ...Array(13).fill(0)],
      ["Contrato", ...Array(13).fill(0)],
    ], "Sheet1", { baseYear: 2026 }),
    (error: unknown) =>
      error instanceof NextFitDreError && error.code === "UNEXPECTED_STRUCTURE",
  );
});

test("preserva literalmente as descrições horizontais originais", () => {
  const parsed = parseNextFitDreMatrix(horizontalMatrix(), "Sheet1", { baseYear: 2026 });
  assert.deepEqual(
    parsed.lines.map((line) => line.description),
    [...REAL_NEXTFIT_DESCRIPTIONS],
  );
});

test("calcula competências apuradas e pendentes pela seleção explícita", () => {
  const july = buildExerciseProgress(2026, 7);
  assert.equal(july.closedCount, 7);
  assert.equal(july.pendingCount, 5);
  assert.equal(july.percentage, 58.3);
  assert.equal(july.closedCompetences.at(-1), "2026-07-01");
  assert.equal(july.pendingCompetences[0], "2026-08-01");

  const august = buildExerciseProgress(2026, 8);
  assert.equal(august.closedCount, 8);
  assert.equal(august.pendingCount, 4);
  assert.equal(august.lastClosedCompetence, "2026-08-01");
  assert.deepEqual(august.pendingCompetences, [
    "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01",
  ]);
  assert.equal(august.percentage, 66.7);
  assert.equal(august.complete, false);
  assert.equal(buildExerciseProgress(2026, 12).complete, true);
});

test("mantém zero visível na matriz mensal", () => {
  const parsed = parseNextFitDreMatrix(horizontalMatrix(), "Sheet1", { baseYear: 2026 });
  assert.equal(lineAmountByMonth(parsed.lines[0], 1)?.amount, "0.00");
});

test("registra fotografias posteriores pelo corte sem duplicar linhas financeiras", async () => {
  const recordedCompetences: string[] = [];
  const snapshotRepository: NextFitDreBatchRepository = {
    async findByHash() { return null; },
    async createValidated(input) {
      recordedCompetences.push(input.competence);
      return {
        id: `batch-${recordedCompetences.length}`,
        fileName: input.fileName,
        fileHash: input.fileHash,
        competence: input.competence,
        status: "VALIDATED",
        importedAt: "2026-09-01T12:00:00.000Z",
        operation: "CREATED",
      };
    },
    async attachSnapshot() {
      throw new Error("não deveria anexar snapshot");
    },
  };
  const service = createNextFitDreService(snapshotRepository);
  const augustBytes = workbookBytes(horizontalMatrix(), "xlsx", "Sheet1");
  const septemberRows = horizontalMatrix().map((row) => [...row]);
  septemberRows[1][9] = 1;
  const septemberBytes = workbookBytes(septemberRows, "xlsx", "Sheet1");
  const august = await service.inspect("dre-agosto.xlsx", augustBytes, 2026, 8);
  await service.confirm({ fileName: "dre-agosto.xlsx", bytes: augustBytes, expectedHash: august.fileHash, importedByUserId: "user-saulo", baseYear: 2026, lastClosedMonth: 8 });
  const september = await service.inspect("dre-setembro.xlsx", septemberBytes, 2026, 9);
  await service.confirm({ fileName: "dre-setembro.xlsx", bytes: septemberBytes, expectedHash: september.fileHash, importedByUserId: "user-saulo", baseYear: 2026, lastClosedMonth: 9 });
  assert.deepEqual(recordedCompetences, ["2026-08-01", "2026-09-01"]);
  assert.equal(august.exercise.exerciseKey, september.exercise.exerciseKey);
});

test("estrutura a prévia como tabela Jan-Dez com descrição e cabeçalho fixos", () => {
  assert.deepEqual(NEXTFIT_DRE_MONTHS, [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ]);
  const component = readFileSync(
    new URL("../../../components/financial/nextfit-dre-import-dialog.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /<table className="min-w-\[1500px\]/);
  assert.match(component, /<thead className="sticky top-0/);
  assert.match(component, /sticky left-0 z-30/);
  assert.match(component, /sticky right-0 z-30[^>]*>Total<\/th>/);
  assert.match(component, /sticky right-0 z-10/);
  assert.match(component, /Existentes:<\/span> \{preview\.competenceCount\}/);
  assert.match(component, /Apuradas:<\/span> \{preview\.exercise\.closedCount\}/);
  assert.match(component, /Pendentes:<\/span> \{preview\.exercise\.pendingCount\}/);
});

test("classifica grupos e resultados para apresentação financeira", () => {
  const parsed = parseNextFitDreMatrix(horizontalMatrix(), "Sheet1", { baseYear: 2026 });
  assert.equal(parsed.lines[0].kind, "GROUP");
  assert.equal(parsed.lines[1].kind, "DETAIL");
  assert.equal(parsed.lines[3].kind, "RESULT");
  assert.equal(parsed.lines.at(-1)?.kind, "RESULT");
});
