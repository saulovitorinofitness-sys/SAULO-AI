import type { Metadata } from "next";

import { FinancialExecutiveReport } from "@/components/financial/financial-executive-report";
import { Button, Input, Select } from "@/components/ui";
import type { FinancialExecutiveReportUnit } from "@/features/financial/executive-report";
import { resolveFinancialExecutivePeriod } from "@/features/financial/executive-report";
import { getFinancialExecutiveReport } from "@/features/financial/executive-report/server";

export const metadata: Metadata = {
  title: "Relatório Executivo Financeiro | Centro de Gestão SV",
};

function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function reportUnit(value: string | undefined): FinancialExecutiveReportUnit {
  return value === "ACADEMIA" || value === "CLINICA" || value === "PERSONAL"
    ? value
    : "ALL";
}

export default async function FinancialExecutiveReportPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    unit?: string;
    preset?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const query = await searchParams;
  const currentDate = localToday();
  const unit = reportUnit(query.unit);
  const period = resolveFinancialExecutivePeriod({
    preset: query.preset,
    from: query.from,
    to: query.to,
    today: currentDate,
  });
  const view = await getFinancialExecutiveReport({ unit, period, currentDate });

  return (
    <div className="space-y-5">
      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]" method="get">
        <label className="text-xs font-black text-slate-700">
          Unidade
          <Select className="mt-1.5" defaultValue={unit} name="unit">
            <option value="ALL">Consolidado</option>
            <option value="ACADEMIA">Academia Saulo Fitness</option>
            <option value="CLINICA">Clínica SV</option>
            <option value="PERSONAL">Personal</option>
          </Select>
        </label>
        <label className="text-xs font-black text-slate-700">
          Período
          <Select className="mt-1.5" defaultValue={period.preset} name="preset">
            <option value="CURRENT_MONTH">Mês atual</option>
            <option value="PREVIOUS_MONTH">Mês anterior</option>
            <option value="CUSTOM">Intervalo personalizado</option>
          </Select>
        </label>
        <label className="text-xs font-black text-slate-700">
          Data inicial
          <Input className="mt-1.5" defaultValue={period.start} name="from" type="date" />
        </label>
        <label className="text-xs font-black text-slate-700">
          Data final
          <Input className="mt-1.5" defaultValue={period.end} name="to" type="date" />
        </label>
        <Button className="self-end" type="submit" variant="outline">Atualizar relatório</Button>
      </form>
      <FinancialExecutiveReport view={view} />
    </div>
  );
}
