import type { FinancialManagementView } from "../academy-management";
import {
  buildAccountsPayableAgenda,
  buildAccountsReceivableAgenda,
} from "../agenda";
import type { FinancialEntryView, FinancialSummary } from "../contracts";
import type {
  FinancialExecutiveEvolutionMonth,
  FinancialExecutiveReportPeriod,
  FinancialExecutiveReportPreset,
  FinancialExecutiveReportUnit,
  FinancialExecutiveReportView,
} from "./contracts";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const monthLabel = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

function monthBounds(reference: string, offset: number) {
  const date = new Date(`${reference.slice(0, 7)}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const start = date.toISOString().slice(0, 10);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return { start, end: date.toISOString().slice(0, 10) };
}

function periodLabel(start: string, end: string) {
  if (start.slice(0, 7) === end.slice(0, 7) && start.endsWith("-01")) {
    return monthLabel.format(new Date(`${start}T00:00:00.000Z`));
  }
  return `${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${start}T00:00:00.000Z`),
  )} a ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${end}T00:00:00.000Z`),
  )}`;
}

export function resolveFinancialExecutivePeriod(input: {
  readonly preset?: string;
  readonly from?: string;
  readonly to?: string;
  readonly today: string;
}): FinancialExecutiveReportPeriod {
  const preset: FinancialExecutiveReportPreset =
    input.preset === "PREVIOUS_MONTH"
      ? "PREVIOUS_MONTH"
      : input.preset === "CUSTOM"
        ? "CUSTOM"
        : "CURRENT_MONTH";
  const bounds = monthBounds(input.today, preset === "PREVIOUS_MONTH" ? -1 : 0);
  const customStart = validDate(input.from);
  const customEnd = validDate(input.to);
  const start = preset === "CUSTOM" && customStart ? customStart : bounds.start;
  const candidateEnd = preset === "CUSTOM" && customEnd ? customEnd : bounds.end;
  const end = candidateEnd < start ? start : candidateEnd;
  return { start, end, label: periodLabel(start, end), preset };
}

export function previousFinancialPeriod(period: FinancialExecutiveReportPeriod) {
  const start = new Date(`${period.start}T00:00:00.000Z`);
  const end = new Date(`${period.end}T00:00:00.000Z`);
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  end.setUTCDate(start.getUTCDate() - 1);
  start.setUTCDate(start.getUTCDate() - durationDays);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function financialEvolutionPeriods(periodEnd: string, count = 6) {
  return Array.from({ length: count }, (_, index) => {
    const bounds = monthBounds(periodEnd, index - count + 1);
    return { ...bounds, competence: bounds.start.slice(0, 7) };
  });
}

function amount(value: string) {
  return Number(value);
}

function money(value: number) {
  return value.toFixed(2);
}

function prioritize(entries: readonly FinancialEntryView[], currentDate: string) {
  return [...entries]
    .sort((left, right) => {
      const leftOverdue = left.dueDate < currentDate ? 0 : 1;
      const rightOverdue = right.dueDate < currentDate ? 0 : 1;
      return leftOverdue - rightOverdue ||
        amount(right.remainingAmount) - amount(left.remainingAmount) ||
        left.dueDate.localeCompare(right.dueDate);
    })
    .slice(0, 6);
}

function comparison(current: string, previous: string) {
  const absolute = amount(current) - amount(previous);
  return {
    realizedBalance: previous,
    absoluteChange: money(absolute),
    percentageChange: amount(previous) === 0
      ? undefined
      : Math.round((absolute / Math.abs(amount(previous))) * 10_000) / 100,
  };
}

function executiveReading(input: {
  readonly summary: FinancialSummary;
  readonly payables: ReturnType<typeof buildAccountsPayableAgenda>;
  readonly receivables: ReturnType<typeof buildAccountsReceivableAgenda>;
  readonly previousSummary: FinancialSummary;
}) {
  const messages: string[] = [];
  const result = amount(input.summary.realizedBalance);
  messages.push(
    `O resultado realizado do período foi ${result >= 0 ? "positivo" : "negativo"} em ${currency.format(Math.abs(result))}.`,
  );
  if (amount(input.payables.totals.overdue) > 0) {
    messages.push(`Existem ${currency.format(amount(input.payables.totals.overdue))} em obrigações vencidas.`);
  }
  if (amount(input.payables.totals.next7Days) > 0) {
    messages.push(`Os próximos 7 dias concentram ${currency.format(amount(input.payables.totals.next7Days))} a pagar.`);
  }
  if (amount(input.summary.openReceivable) > 0) {
    messages.push(`O saldo total a receber é de ${currency.format(amount(input.summary.openReceivable))}.`);
  }
  const highestAccount = [...input.summary.accountBalances]
    .sort((left, right) => amount(right.realizedBalance) - amount(left.realizedBalance))[0];
  if (highestAccount) {
    const allAccountsAreNegative = input.summary.accountBalances.every(
      (account) => amount(account.realizedBalance) < 0,
    );
    messages.push(
      allAccountsAreNegative
        ? `Todas as contas apresentam saldo realizado negativo. A menor posição negativa é ${highestAccount.financialAccount.name}, com ${currency.format(amount(highestAccount.realizedBalance))}.`
        : `A conta com maior saldo realizado é ${highestAccount.financialAccount.name}, com ${currency.format(amount(highestAccount.realizedBalance))}.`,
    );
  }
  const change = amount(input.summary.realizedBalance) - amount(input.previousSummary.realizedBalance);
  if (change !== 0) {
    messages.push(`Em relação ao período anterior equivalente, o resultado realizado variou ${currency.format(change)}.`);
  }
  return messages;
}

export function buildFinancialExecutiveReport(input: {
  readonly unit: {
    readonly code: FinancialExecutiveReportUnit;
    readonly name: string;
    readonly businessUnitId?: string;
  };
  readonly period: FinancialExecutiveReportPeriod;
  readonly issuedAt: string;
  readonly currentDate: string;
  readonly summary: FinancialSummary;
  readonly previousSummary: FinancialSummary;
  readonly payablesEntries: readonly FinancialEntryView[];
  readonly receivablesEntries: readonly FinancialEntryView[];
  readonly evolution: readonly FinancialExecutiveEvolutionMonth[];
  readonly dre?: FinancialManagementView;
}): FinancialExecutiveReportView {
  const payables = buildAccountsPayableAgenda(input.payablesEntries, input.currentDate);
  const receivables = buildAccountsReceivableAgenda(input.receivablesEntries, input.currentDate);
  const hasSummaryValue = [
    input.summary.totalReceived,
    input.summary.totalPaid,
    input.summary.openReceivable,
    input.summary.openPayable,
    input.summary.ownerWithdrawalPaid,
  ].some((value) => amount(value) !== 0);
  return {
    unit: input.unit,
    period: input.period,
    issuedAt: input.issuedAt,
    summary: input.summary,
    previousPeriod: comparison(
      input.summary.realizedBalance,
      input.previousSummary.realizedBalance,
    ),
    payables,
    receivables,
    priorityPayables: prioritize(payables.pending, input.currentDate),
    priorityReceivables: prioritize(receivables.pending, input.currentDate),
    evolution: input.evolution,
    dre: input.dre,
    reading: executiveReading({
      summary: input.summary,
      payables,
      receivables,
      previousSummary: input.previousSummary,
    }),
    hasData: hasSummaryValue || payables.pending.length > 0 || receivables.pending.length > 0,
    presentation: {
      pptxAvailable: true,
      preparedForFutureExport: false,
    },
  };
}
