import type { Metadata } from "next";

import {
  FinancialWorkspace,
  type FinancialWorkspaceFilters,
} from "@/components/financial/financial-workspace";
import type {
  FinancialEntryFilters,
  FinancialEntryStatus,
  FinancialEntryType,
} from "@/features/financial";
import { financialService } from "@/features/financial";
import { academyManagementService } from "@/features/financial/academy-management/server";

export const metadata: Metadata = {
  title: "Financeiro | Centro de Gestão SV",
};

const ENTRY_TYPES = new Set(["REVENUE", "EXPENSE"]);
const ENTRY_STATUSES = new Set([
  "PENDING",
  "PARTIALLY_SETTLED",
  "SETTLED",
  "CANCELLED",
]);

function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function monthPeriod() {
  const current = localToday();
  const [year, month] = current.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  return { start: `${current.slice(0, 7)}-01`, end: lastDay };
}

function validDate(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : fallback;
}

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{
    unit?: string;
    from?: string;
    to?: string;
    type?: string;
    status?: string;
    category?: string;
    year?: string;
  }>;
}) {
  const [query, catalog] = await Promise.all([
    searchParams,
    financialService.catalog(),
  ]);
  const defaults = monthPeriod();
  const unit: FinancialWorkspaceFilters["unit"] =
    query.unit === "ACADEMIA" ||
    query.unit === "CLINICA" ||
    query.unit === "PERSONAL"
      ? query.unit
      : "ALL";
  const periodStart = validDate(query.from, defaults.start);
  const periodEndCandidate = validDate(query.to, defaults.end);
  const periodEnd = periodEndCandidate < periodStart ? periodStart : periodEndCandidate;
  const type = ENTRY_TYPES.has(query.type ?? "")
    ? (query.type as FinancialEntryType)
    : undefined;
  const status = ENTRY_STATUSES.has(query.status ?? "")
    ? (query.status as FinancialEntryStatus)
    : undefined;
  const categoryId = catalog.categories.some((category) => category.id === query.category)
    ? query.category
    : undefined;
  const businessUnitId =
    unit === "ALL"
      ? undefined
      : catalog.businessUnits.find((entry) => entry.code === unit)?.id;
  const currentDate = localToday();
  const currentYear = Number(currentDate.slice(0, 4));
  const requestedYear = Number(query.year);
  const managementYear = Number.isInteger(requestedYear)
    && requestedYear >= 2000
    && requestedYear <= 2100
    ? requestedYear
    : currentYear;

  const serviceFilters: FinancialEntryFilters = {
    periodStart,
    periodEnd,
    businessUnitId,
    type,
    status,
    financialCategoryId: categoryId,
  };
  const [entries, summary, managementView, payablesEntries, receivablesEntries] = await Promise.all([
    financialService.list(serviceFilters),
    financialService.summarize(serviceFilters, periodEnd),
    unit === "ACADEMIA"
      ? academyManagementService.getView(managementYear)
      : Promise.resolve(undefined),
    unit === "ACADEMIA" && businessUnitId
      ? financialService.list({
          businessUnitId,
          type: "EXPENSE",
          managementNature: "REALIZED",
        })
      : Promise.resolve([]),
    unit === "ACADEMIA"
      ? Promise.resolve([])
      : financialService.list({
          ...(businessUnitId ? { businessUnitId } : {}),
          type: "REVENUE",
          managementNature: "REALIZED",
        }),
  ]);

  return (
    <FinancialWorkspace
      catalog={catalog}
      currentDate={currentDate}
      entries={entries}
      managementView={managementView}
      payablesEntries={payablesEntries}
      receivablesEntries={receivablesEntries}
      filters={{
        unit,
        periodStart,
        periodEnd,
        type,
        status,
        categoryId,
      }}
      summary={summary}
    />
  );
}
