import type { FinancialEntryView } from "./contracts";
import { ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE } from "./contracts";

type FinancialAgendaBucket = "OVERDUE" | "TODAY" | "NEXT_7_DAYS" | "NEXT_30_DAYS";

export function addFinancialDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function moneyToCents(value: string) {
  return Math.round(Number(value) * 100);
}

function centsToMoney(value: number) {
  return (value / 100).toFixed(2);
}

export function buildAccountsPayableAgenda(
  entries: readonly FinancialEntryView[],
  currentDate: string,
) {
  const next7Days = addFinancialDays(currentDate, 7);
  const next30Days = addFinancialDays(currentDate, 30);
  const pending = entries
    .filter((entry) =>
      entry.businessUnit.code === "ACADEMIA" &&
      entry.type === "EXPENSE" &&
      entry.managementNature === "REALIZED" &&
      entry.financialCategory.code !== ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE &&
      entry.status !== "CANCELLED" &&
      entry.status !== "SETTLED" &&
      moneyToCents(entry.remainingAmount) > 0,
    )
    .sort((left, right) =>
      left.dueDate.localeCompare(right.dueDate) ||
      left.createdAt.localeCompare(right.createdAt),
    );
  const totals: Record<FinancialAgendaBucket, number> = {
    OVERDUE: 0,
    TODAY: 0,
    NEXT_7_DAYS: 0,
    NEXT_30_DAYS: 0,
  };

  for (const entry of pending) {
    let bucket: FinancialAgendaBucket | undefined;
    if (entry.dueDate < currentDate) bucket = "OVERDUE";
    else if (entry.dueDate === currentDate) bucket = "TODAY";
    else if (entry.dueDate <= next7Days) bucket = "NEXT_7_DAYS";
    else if (entry.dueDate <= next30Days) bucket = "NEXT_30_DAYS";
    if (bucket) totals[bucket] += moneyToCents(entry.remainingAmount);
  }

  return {
    pending,
    totals: {
      overdue: centsToMoney(totals.OVERDUE),
      today: centsToMoney(totals.TODAY),
      next7Days: centsToMoney(totals.NEXT_7_DAYS),
      next30Days: centsToMoney(totals.NEXT_30_DAYS),
    },
  };
}

export function accountsPayableStatus(entry: FinancialEntryView, currentDate: string) {
  if (entry.dueDate < currentDate) return { label: "Vencida", tone: "danger" as const };
  if (entry.dueDate === currentDate) return { label: "Vence hoje", tone: "warning" as const };
  if (entry.status === "PARTIALLY_SETTLED") return { label: "Parcial", tone: "info" as const };
  return { label: "Em aberto", tone: "neutral" as const };
}

export function buildAccountsReceivableAgenda(
  entries: readonly FinancialEntryView[],
  currentDate: string,
) {
  const next7Days = addFinancialDays(currentDate, 7);
  const next30Days = addFinancialDays(currentDate, 30);
  const pending = entries
    .filter((entry) =>
      ((entry.businessUnit.code === "CLINICA" &&
        entry.sourceSystem === "CLINICA_SV") ||
        (entry.businessUnit.code === "PERSONAL" &&
          entry.sourceSystem === "GESTAO_SV" &&
          entry.origin === "MANUAL")) &&
      entry.type === "REVENUE" &&
      entry.managementNature === "REALIZED" &&
      entry.status !== "CANCELLED" &&
      entry.status !== "SETTLED" &&
      moneyToCents(entry.remainingAmount) > 0,
    )
    .sort((left, right) =>
      left.dueDate.localeCompare(right.dueDate) ||
      left.createdAt.localeCompare(right.createdAt),
    );
  const totals: Record<FinancialAgendaBucket, number> = {
    OVERDUE: 0,
    TODAY: 0,
    NEXT_7_DAYS: 0,
    NEXT_30_DAYS: 0,
  };
  const counts: Record<FinancialAgendaBucket, number> = {
    OVERDUE: 0,
    TODAY: 0,
    NEXT_7_DAYS: 0,
    NEXT_30_DAYS: 0,
  };

  for (const entry of pending) {
    let bucket: FinancialAgendaBucket | undefined;
    if (entry.dueDate < currentDate) bucket = "OVERDUE";
    else if (entry.dueDate === currentDate) bucket = "TODAY";
    else if (entry.dueDate <= next7Days) bucket = "NEXT_7_DAYS";
    else if (entry.dueDate <= next30Days) bucket = "NEXT_30_DAYS";
    if (bucket) {
      totals[bucket] += moneyToCents(entry.remainingAmount);
      counts[bucket] += 1;
    }
  }

  return {
    pending,
    buckets: {
      overdue: { count: counts.OVERDUE, amount: centsToMoney(totals.OVERDUE) },
      today: { count: counts.TODAY, amount: centsToMoney(totals.TODAY) },
      next7Days: { count: counts.NEXT_7_DAYS, amount: centsToMoney(totals.NEXT_7_DAYS) },
      next30Days: { count: counts.NEXT_30_DAYS, amount: centsToMoney(totals.NEXT_30_DAYS) },
    },
  };
}

export function accountsReceivableStatus(entry: FinancialEntryView, currentDate: string) {
  return accountsPayableStatus(entry, currentDate);
}
