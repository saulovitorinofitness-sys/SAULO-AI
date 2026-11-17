import type { NextFitDreLine, NextFitDreSnapshot } from "../nextfit-dre";
import type {
  AvailableFinancialManagementView,
  FinancialManagementAmount,
  FinancialManagementLineSource,
  FinancialManagementVariation,
  FinancialManagementView,
} from "./contracts";
import {
  academyManagementRepository,
  type AcademyDreSnapshotBatchRecord,
  type AcademyManagementRepository,
} from "./repository";
import { validatePersistedNextFitDreSnapshot } from "./snapshot-validation";

interface ValidCandidate {
  readonly batch: AcademyDreSnapshotBatchRecord;
  readonly snapshot: NextFitDreSnapshot;
}

type SemanticKey =
  | "grossRevenue"
  | "deductions"
  | "netRevenue"
  | "costs"
  | "expenses"
  | "operatingResult"
  | "finalResult";

interface SemanticLineDefinition {
  readonly description: string;
  readonly kind: "GROUP" | "RESULT";
  readonly context: string;
}

const SEMANTIC_LINES: Readonly<Record<SemanticKey, SemanticLineDefinition>> = {
  grossRevenue: {
    description: "(=) Receita bruta de vendas",
    kind: "RESULT",
    context: "Receitas operacionais",
  },
  deductions: {
    description: "Deduções da receita bruta",
    kind: "GROUP",
    context: "Deduções da receita bruta",
  },
  netRevenue: {
    description: "(=) Receita líquida de vendas",
    kind: "RESULT",
    context: "Deduções da receita bruta",
  },
  costs: {
    description: "Custos operacionais",
    kind: "GROUP",
    context: "Custos operacionais",
  },
  expenses: {
    description: "Despesas operacionais",
    kind: "GROUP",
    context: "Despesas operacionais",
  },
  operatingResult: {
    description: "(=) Lucro/Prejuízo operacional",
    kind: "RESULT",
    context: "Despesas operacionais",
  },
  finalResult: {
    description: "(=) Lucro/Prejuízo Final",
    kind: "RESULT",
    context: "Despesas com investimentos e empréstimos",
  },
};

function normalized(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function semanticLines(snapshot: NextFitDreSnapshot) {
  const mapped = {} as Record<SemanticKey, NextFitDreLine>;
  for (const [key, definition] of Object.entries(SEMANTIC_LINES) as Array<
    [SemanticKey, SemanticLineDefinition]
  >) {
    const matches = snapshot.lines.filter((line) =>
      line.kind === definition.kind
      && normalized(line.description) === normalized(definition.description)
      && normalized(line.context) === normalized(definition.context));
    if (matches.length !== 1) return null;
    mapped[key] = matches[0];
  }
  return mapped;
}

function cents(value: string) {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new Error(`Valor monetário inválido: ${value}`);
  const absolute = Number(match[2]) * 100 + Number(match[3]);
  if (!Number.isSafeInteger(absolute)) {
    throw new Error(`Valor monetário excede o limite seguro: ${value}`);
  }
  return match[1] ? -absolute : absolute;
}

function money(value: number) {
  const negative = value < 0;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function roundedDivision(value: number, divisor: number) {
  const negative = value < 0;
  const absolute = negative ? -value : value;
  const rounded = Math.round(absolute / divisor);
  return negative ? -rounded : rounded;
}

function percentage(numerator: number, denominator: number) {
  if (denominator === 0) return undefined;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function source(line: NextFitDreLine): FinancialManagementLineSource {
  return {
    rowNumber: line.rowNumber,
    description: line.description,
    kind: line.kind === "GROUP" ? "GROUP" : "RESULT",
    context: line.context,
  };
}

function valueAt(line: NextFitDreLine, competence: string) {
  const value = line.values.find((entry) => entry.competence === competence);
  if (!value) throw new Error(`Competência ${competence} ausente em ${line.description}.`);
  return cents(value.amount);
}

function accumulated(line: NextFitDreLine, competences: readonly string[]) {
  return competences.reduce((total, competence) => total + valueAt(line, competence), 0);
}

function amount(line: NextFitDreLine, competences: readonly string[]): FinancialManagementAmount {
  return { amount: money(accumulated(line, competences)), source: source(line) };
}

function latestVariation(
  netRevenue: NextFitDreLine,
  closedCompetences: readonly string[],
): FinancialManagementVariation {
  const currentCompetence = closedCompetences.at(-1)!;
  const current = valueAt(netRevenue, currentCompetence);
  const previousCompetence = closedCompetences.at(-2);
  if (!previousCompetence) {
    return {
      basis: "NET_REVENUE",
      currentCompetence,
      currentAmount: money(current),
      direction: "UNAVAILABLE",
    };
  }
  const previous = valueAt(netRevenue, previousCompetence);
  const change = current - previous;
  return {
    basis: "NET_REVENUE",
    currentCompetence,
    previousCompetence,
    currentAmount: money(current),
    previousAmount: money(previous),
    absoluteChange: money(change),
    percentageChange: percentage(change, previous < 0 ? -previous : previous),
    direction: change > 0 ? "GROWTH" : change < 0 ? "RETRACTION" : "STABLE",
  };
}

export function selectLatestValidSnapshot(
  records: readonly AcademyDreSnapshotBatchRecord[],
  year: number,
): { readonly selected?: ValidCandidate; readonly invalidCount: number } {
  const latestByClosedMonth = new Map<number, ValidCandidate>();
  let invalidCount = 0;
  for (const batch of records) {
    const validation = validatePersistedNextFitDreSnapshot(batch.snapshot);
    if (
      !validation.valid
      || validation.snapshot.year !== year
      || validation.snapshot.exercise.lastClosedCompetence !== batch.competence
    ) {
      invalidCount += 1;
      continue;
    }
    const candidate = { batch, snapshot: validation.snapshot };
    const month = validation.snapshot.exercise.lastClosedMonth;
    const current = latestByClosedMonth.get(month);
    if (!current || candidate.batch.importedAt > current.batch.importedAt) {
      latestByClosedMonth.set(month, candidate);
    }
  }
  const selected = [...latestByClosedMonth.values()].sort((left, right) =>
    right.snapshot.exercise.lastClosedMonth - left.snapshot.exercise.lastClosedMonth
    || right.batch.importedAt.localeCompare(left.batch.importedAt))[0];
  return { selected, invalidCount };
}

function buildAvailableView(candidate: ValidCandidate): AvailableFinancialManagementView | null {
  const { batch, snapshot } = candidate;
  const lines = semanticLines(snapshot);
  if (!lines) return null;
  const closed = snapshot.exercise.closedCompetences;
  const monthly = closed.map((competence, index) => ({
    competence,
    month: index + 1,
    netRevenue: money(valueAt(lines.netRevenue, competence)),
    costs: money(valueAt(lines.costs, competence)),
    expenses: money(valueAt(lines.expenses, competence)),
    finalResult: money(valueAt(lines.finalResult, competence)),
  }));
  const ranked = monthly.map((entry) => ({ ...entry, resultCents: cents(entry.finalResult) }));
  const best = ranked.reduce((current, entry) =>
    entry.resultCents > current.resultCents ? entry : current);
  const worst = ranked.reduce((current, entry) =>
    entry.resultCents < current.resultCents ? entry : current);
  const netRevenue = accumulated(lines.netRevenue, closed);
  const expenses = accumulated(lines.expenses, closed);
  const finalResult = accumulated(lines.finalResult, closed);

  return {
    availability: "AVAILABLE",
    source: {
      batchId: batch.id,
      sourceSystem: "NEXTFIT",
      fileName: batch.fileName,
      fileHash: batch.fileHash,
      status: batch.status,
      importedAt: batch.importedAt,
      competence: batch.competence,
      snapshotVersion: snapshot.snapshotVersion,
      parserVersion: snapshot.parserVersion,
    },
    exercise: {
      year: snapshot.year,
      competenceCount: snapshot.competenceCount,
      closedCount: snapshot.exercise.closedCount,
      pendingCount: snapshot.exercise.pendingCount,
      firstClosedCompetence: closed[0],
      lastClosedCompetence: snapshot.exercise.lastClosedCompetence,
      closedCompetences: closed,
      pendingCompetences: snapshot.exercise.pendingCompetences,
      percentage: snapshot.exercise.percentage,
      complete: snapshot.exercise.complete,
    },
    indicators: {
      grossRevenue: amount(lines.grossRevenue, closed),
      deductions: amount(lines.deductions, closed),
      netRevenue: amount(lines.netRevenue, closed),
      costs: amount(lines.costs, closed),
      expenses: amount(lines.expenses, closed),
      operatingResult: amount(lines.operatingResult, closed),
      finalResult: amount(lines.finalResult, closed),
      margin: {
        percentage: percentage(finalResult, netRevenue),
        numerator: source(lines.finalResult),
        denominator: source(lines.netRevenue),
      },
      averageMonthlyNetRevenue: money(roundedDivision(netRevenue, closed.length)),
      averageMonthlyExpenses: money(roundedDivision(expenses, closed.length)),
      averageMonthlyResult: money(roundedDivision(finalResult, closed.length)),
      bestMonth: { competence: best.competence, amount: best.finalResult },
      worstMonth: { competence: worst.competence, amount: worst.finalResult },
      latestVariation: latestVariation(lines.netRevenue, closed),
    },
    months: monthly,
    dre: {
      groups: snapshot.groups,
      lines: snapshot.lines,
      summaryLines: Object.values(lines),
      totalCheck: snapshot.totalCheck,
      warnings: snapshot.warnings,
    },
  };
}

export function createAcademyManagementService(
  repository: AcademyManagementRepository = academyManagementRepository,
) {
  return {
    async getView(year: number): Promise<FinancialManagementView> {
      const records = await repository.listDreSnapshots(year);
      if (records.length === 0) {
        return {
          availability: "UNAVAILABLE",
          year,
          reason: "SNAPSHOT_NOT_FOUND",
          message: `Nenhuma fotografia DRE NextFit validada foi encontrada para ${year}.`,
        };
      }
      const selection = selectLatestValidSnapshot(records, year);
      if (!selection.selected) {
        return {
          availability: "UNAVAILABLE",
          year,
          reason: "SNAPSHOT_INVALID",
          message: "As fotografias encontradas não passaram pela validação de estrutura e versão.",
        };
      }
      const view = buildAvailableView(selection.selected);
      if (!view) {
        return {
          availability: "UNAVAILABLE",
          year,
          reason: "SEMANTIC_LINE_MISSING",
          message: "A DRE não contém exatamente uma ocorrência de cada linha gerencial obrigatória.",
        };
      }
      return view;
    },
  };
}

export const academyManagementService = createAcademyManagementService();
