import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";

import { academyManagementRepository } from "./repository";
import {
  academyManagementService,
  createAcademyManagementService,
  selectLatestValidSnapshot,
} from "./service";
import { validatePersistedNextFitDreSnapshot } from "./snapshot-validation";

test("valida e calcula a visão gerencial usando o snapshot real de 2026", async () => {
  const view = await academyManagementService.getView(2026);
  assert.equal(view.availability, "AVAILABLE");
  if (view.availability !== "AVAILABLE") return;

  assert.equal(view.source.sourceSystem, "NEXTFIT");
  assert.equal(view.source.fileName, "DRE_Gerencial_2026 (1).xlsx");
  assert.equal(view.source.snapshotVersion, "nextfit-dre-snapshot@1");
  assert.equal(view.source.parserVersion, "nextfit-dre-horizontal@1");
  assert.equal(view.exercise.year, 2026);
  assert.equal(view.exercise.competenceCount, 12);
  assert.equal(view.exercise.closedCount, 7);
  assert.equal(view.exercise.pendingCount, 5);
  assert.equal(view.exercise.firstClosedCompetence, "2026-01-01");
  assert.equal(view.exercise.lastClosedCompetence, "2026-07-01");
  assert.equal(view.exercise.percentage, 58.3);
  assert.equal(view.exercise.complete, false);
  assert.deepEqual(view.exercise.pendingCompetences, [
    "2026-08-01",
    "2026-09-01",
    "2026-10-01",
    "2026-11-01",
    "2026-12-01",
  ]);

  assert.equal(view.indicators.grossRevenue.amount, "64685.00");
  assert.equal(view.indicators.deductions.amount, "-5217.00");
  assert.equal(view.indicators.netRevenue.amount, "59468.00");
  assert.equal(view.indicators.costs.amount, "0.00");
  assert.equal(view.indicators.expenses.amount, "-5092.00");
  assert.equal(view.indicators.operatingResult.amount, "54376.00");
  assert.equal(view.indicators.finalResult.amount, "45666.94");
  assert.equal(view.indicators.margin.percentage, 76.8);
  assert.equal(view.indicators.averageMonthlyNetRevenue, "8495.43");
  assert.equal(view.indicators.averageMonthlyExpenses, "-727.43");
  assert.equal(view.indicators.averageMonthlyResult, "6523.85");
  assert.deepEqual(view.indicators.bestMonth, {
    competence: "2026-01-01",
    amount: "9333.17",
  });
  assert.deepEqual(view.indicators.worstMonth, {
    competence: "2026-02-01",
    amount: "4395.00",
  });
  assert.deepEqual(view.indicators.latestVariation, {
    basis: "NET_REVENUE",
    currentCompetence: "2026-07-01",
    previousCompetence: "2026-06-01",
    currentAmount: "8855.00",
    previousAmount: "8345.00",
    absoluteChange: "510.00",
    percentageChange: 6.1,
    direction: "GROWTH",
  });
});

test("exclui competências pendentes e não usa a coluna Total nos realizados", async () => {
  const view = await academyManagementService.getView(2026);
  assert.equal(view.availability, "AVAILABLE");
  if (view.availability !== "AVAILABLE") return;

  assert.equal(view.months.length, 7);
  assert.deepEqual(view.months.map((month) => month.month), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(view.months.some((month) => month.competence >= "2026-08-01"), false);

  const grossRevenueLine = view.dre.lines.find((line) => line.rowNumber === 5);
  const netRevenueLine = view.dre.lines.find((line) => line.rowNumber === 12);
  const finalResultLine = view.dre.lines.find((line) => line.rowNumber === 33);
  assert.equal(grossRevenueLine?.total?.amount, "67925.00");
  assert.equal(netRevenueLine?.total?.amount, "62248.00");
  assert.equal(finalResultLine?.total?.amount, "48445.44");
  assert.notEqual(view.indicators.grossRevenue.amount, grossRevenueLine?.total?.amount);
  assert.notEqual(view.indicators.netRevenue.amount, netRevenueLine?.total?.amount);
  assert.notEqual(view.indicators.finalResult.amount, finalResultLine?.total?.amount);
  assert.equal(view.dre.totalCheck.checked, 32);
  assert.equal(view.dre.totalCheck.matching, 32);
  assert.equal(view.dre.totalCheck.mismatching, 0);
});

test("mapeia linhas semânticas sem somar grupos, detalhes e resultados sobrepostos", async () => {
  const view = await academyManagementService.getView(2026);
  assert.equal(view.availability, "AVAILABLE");
  if (view.availability !== "AVAILABLE") return;

  assert.deepEqual(
    {
      grossRevenue: view.indicators.grossRevenue.source.rowNumber,
      deductions: view.indicators.deductions.source.rowNumber,
      netRevenue: view.indicators.netRevenue.source.rowNumber,
      costs: view.indicators.costs.source.rowNumber,
      expenses: view.indicators.expenses.source.rowNumber,
      operatingResult: view.indicators.operatingResult.source.rowNumber,
      finalResult: view.indicators.finalResult.source.rowNumber,
    },
    {
      grossRevenue: 5,
      deductions: 6,
      netRevenue: 12,
      costs: 13,
      expenses: 18,
      operatingResult: 22,
      finalResult: 33,
    },
  );
  assert.equal(view.indicators.expenses.source.kind, "GROUP");
  assert.equal(view.dre.lines.length, 32);
  assert.equal(view.dre.groups.length, 7);
});

test("valida em runtime a fotografia real antes da seleção", async () => {
  const records = await academyManagementRepository.listDreSnapshots(2026);
  assert.equal(records.length > 0, true);
  const validation = validatePersistedNextFitDreSnapshot(records[0].snapshot);
  assert.equal(validation.valid, true);
  if (!validation.valid) return;
  assert.equal(validation.snapshot.year, 2026);
  assert.equal(validation.snapshot.lines.length, 32);
  assert.equal(validation.snapshot.groups.length, 7);
});

test("seleciona a fotografia mais avançada e a mais recente em caso de empate", async () => {
  const records = await academyManagementRepository.listDreSnapshots(2026);
  const current = records[0];
  assert.ok(current);
  const validation = validatePersistedNextFitDreSnapshot(current.snapshot);
  assert.equal(validation.valid, true);
  if (!validation.valid) return;

  const sameCompetenceNewer = {
    ...current,
    id: "same-competence-newer",
    importedAt: "2026-08-13T12:00:00.000Z",
  };
  assert.equal(
    selectLatestValidSnapshot([current, sameCompetenceNewer], 2026).selected?.batch.id,
    "same-competence-newer",
  );

  const augustSnapshot = {
    ...structuredClone(validation.snapshot),
    exercise: {
      ...validation.snapshot.exercise,
      lastClosedMonth: 8,
      lastClosedCompetence: "2026-08-01",
      closedCompetences: validation.snapshot.exercise.closedCompetences.concat("2026-08-01"),
      pendingCompetences: validation.snapshot.exercise.pendingCompetences.slice(1),
      closedCount: 8,
      pendingCount: 4,
      percentage: 66.7,
      complete: false,
    },
  };
  const moreAdvanced = {
    ...current,
    id: "august-more-advanced",
    competence: "2026-08-01",
    importedAt: "2026-08-01T12:00:00.000Z",
    snapshot: augustSnapshot,
  };
  assert.equal(
    selectLatestValidSnapshot([sameCompetenceNewer, moreAdvanced], 2026).selected?.batch.id,
    "august-more-advanced",
  );
});

test("rejeita versão de snapshot desconhecida", async () => {
  const records = await academyManagementRepository.listDreSnapshots(2026);
  const current = records[0];
  assert.ok(current);
  const invalid = validatePersistedNextFitDreSnapshot({
    ...(current.snapshot as Record<string, unknown>),
    snapshotVersion: "nextfit-dre-snapshot@999",
  });
  assert.equal(invalid.valid, false);
});

test("retorna estado indisponível sem inventar números quando não há snapshot", async () => {
  const service = createAcademyManagementService({
    async listDreSnapshots() {
      return [];
    },
  });
  assert.deepEqual(await service.getView(2030), {
    availability: "UNAVAILABLE",
    year: 2030,
    reason: "SNAPSHOT_NOT_FOUND",
    message: "Nenhuma fotografia DRE NextFit validada foi encontrada para 2030.",
  });
});
