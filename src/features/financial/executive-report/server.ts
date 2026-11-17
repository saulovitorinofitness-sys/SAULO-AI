import { academyManagementService } from "../academy-management/server";
import type { FinancialEntryFilters } from "../contracts";
import { financialService } from "../service";
import type {
  FinancialExecutiveReportPeriod,
  FinancialExecutiveReportUnit,
} from "./contracts";
import {
  buildFinancialExecutiveReport,
  financialEvolutionPeriods,
  previousFinancialPeriod,
} from "./service";

const UNIT_NAMES: Record<FinancialExecutiveReportUnit, string> = {
  ALL: "Consolidado",
  ACADEMIA: "Academia Saulo Fitness",
  CLINICA: "Clínica SV",
  PERSONAL: "Personal",
};

function localDateTime() {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date()).replace(" ", "T");
}

export async function getFinancialExecutiveReport(input: {
  readonly unit: FinancialExecutiveReportUnit;
  readonly period: FinancialExecutiveReportPeriod;
  readonly currentDate: string;
}) {
  const catalog = await financialService.catalog();
  const businessUnit = input.unit === "ALL"
    ? undefined
    : catalog.businessUnits.find(
        (unit) => unit.code === input.unit && unit.status === "ACTIVE",
      );
  const businessUnitId = businessUnit?.id;
  const periodFilters: FinancialEntryFilters = {
    periodStart: input.period.start,
    periodEnd: input.period.end,
    ...(businessUnitId ? { businessUnitId } : {}),
  };
  const previous = previousFinancialPeriod(input.period);
  const evolutionPeriods = financialEvolutionPeriods(input.period.end);
  const shouldLoadPayables = input.unit === "ALL" || input.unit === "ACADEMIA";
  const shouldLoadReceivables = input.unit !== "ACADEMIA";

  const [
    summary,
    previousSummary,
    payablesEntries,
    receivablesEntries,
    evolution,
    managementView,
  ] = await Promise.all([
    financialService.summarize(periodFilters, input.period.end),
    financialService.summarize({
      periodStart: previous.start,
      periodEnd: previous.end,
      ...(businessUnitId ? { businessUnitId } : {}),
    }, previous.end),
    shouldLoadPayables
      ? financialService.list({
          ...(businessUnitId ? { businessUnitId } : {}),
          type: "EXPENSE",
          managementNature: "REALIZED",
        })
      : Promise.resolve([]),
    shouldLoadReceivables
      ? financialService.list({
          ...(businessUnitId ? { businessUnitId } : {}),
          type: "REVENUE",
          managementNature: "REALIZED",
        })
      : Promise.resolve([]),
    Promise.all(evolutionPeriods.map(async (period) => {
      const month = await financialService.summarize({
        periodStart: period.start,
        periodEnd: period.end,
        ...(businessUnitId ? { businessUnitId } : {}),
      }, period.end);
      return {
        competence: period.competence,
        totalReceived: month.totalReceived,
        totalPaid: month.totalPaid,
        realizedBalance: month.realizedBalance,
      };
    })),
    input.unit === "ACADEMIA"
      ? academyManagementService.getView(Number(input.period.end.slice(0, 4)))
      : Promise.resolve(undefined),
  ]);

  const dre = managementView?.availability === "AVAILABLE" &&
    managementView.exercise.closedCompetences.some(
      (competence) => competence >= input.period.start.slice(0, 7) &&
        competence <= input.period.end.slice(0, 7),
    )
    ? managementView
    : undefined;

  return buildFinancialExecutiveReport({
    unit: {
      code: input.unit,
      name: businessUnit?.name ?? UNIT_NAMES[input.unit],
      ...(businessUnitId ? { businessUnitId } : {}),
    },
    period: input.period,
    issuedAt: localDateTime(),
    currentDate: input.currentDate,
    summary,
    previousSummary,
    payablesEntries,
    receivablesEntries,
    evolution,
    dre,
  });
}
