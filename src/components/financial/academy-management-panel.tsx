"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  ChartNoAxesCombined,
  CircleDollarSign,
  Landmark,
  Minus,
  ReceiptText,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  PageState,
  Progress,
  SectionHeader,
} from "@/components/ui";
import type {
  AvailableFinancialManagementView,
  FinancialManagementView,
} from "@/features/financial/academy-management";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;
const shortMonths = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

function formatMoney(value: string) {
  return money.format(Number(value));
}

function monthLabel(competence: string) {
  const month = Number(competence.slice(5, 7));
  return monthNames[month - 1] ?? competence;
}

function IndicatorCards({ view }: { readonly view: AvailableFinancialManagementView }) {
  const cards = [
    {
      label: "Receita Bruta",
      value: view.indicators.grossRevenue.amount,
      icon: CircleDollarSign,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Receita Líquida",
      value: view.indicators.netRevenue.amount,
      icon: Landmark,
      tone: "bg-teal-50 text-teal-700",
    },
    {
      label: "Despesas",
      value: view.indicators.expenses.amount,
      icon: ReceiptText,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      label: "Lucro/Prejuízo Final",
      value: view.indicators.finalResult.amount,
      icon: Target,
      tone: "bg-sky-50 text-sky-700",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card className="p-4" key={card.label}>
            <span className={`grid size-9 place-items-center rounded-xl ${card.tone}`}>
              <Icon aria-hidden="true" className="size-[18px]" />
            </span>
            <p className="mt-4 text-xs font-bold text-slate-500">{card.label}</p>
            <p className="mt-1 whitespace-nowrap text-xl font-black tracking-tight text-slate-950">
              {formatMoney(card.value)}
            </p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              DRE NextFit
            </p>
          </Card>
        );
      })}
      <Card className="p-4">
        <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700">
          <ChartNoAxesCombined aria-hidden="true" className="size-[18px]" />
        </span>
        <p className="mt-4 text-xs font-bold text-slate-500">Margem</p>
        <p className="mt-1 text-xl font-black tracking-tight text-slate-950">
          {view.indicators.margin.percentage === undefined
            ? "Indisponível"
            : `${percent.format(view.indicators.margin.percentage)}%`}
        </p>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          DRE NextFit
        </p>
      </Card>
    </div>
  );
}

function MonthlyEvolution({ view }: { readonly view: AvailableFinancialManagementView }) {
  const maximum = Math.max(
    1,
    ...view.months.flatMap((month) => [
      Math.abs(Number(month.netRevenue)),
      Math.abs(Number(month.expenses)),
      Math.abs(Number(month.finalResult)),
    ]),
  );
  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader
        description="Somente competências apuradas. Despesas preservam o sinal original da DRE."
        eyebrow="Evolução mensal"
        title="Receita líquida, despesas e resultado"
      />
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
        <span><i aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-full bg-emerald-600" />Receita líquida</span>
        <span><i aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-full bg-rose-500" />Despesas</span>
        <span><i aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-full bg-sky-600" />Resultado</span>
      </div>
      <div
        aria-label="Comparação mensal da DRE NextFit entre receita líquida, despesas e resultado"
        className="mt-5 overflow-x-auto pb-2"
        role="img"
      >
        <div className="grid min-w-[640px] gap-3 border-b border-slate-200 pb-3" style={{ gridTemplateColumns: `repeat(${view.months.length}, minmax(72px, 1fr))` }}>
          {view.months.map((month) => (
            <div className="flex min-w-0 flex-col items-center" key={month.competence}>
              <div className="flex h-44 w-full items-end justify-center gap-1.5">
                {([
                  [month.netRevenue, "bg-emerald-600"],
                  [month.expenses, "bg-rose-500"],
                  [month.finalResult, "bg-sky-600"],
                ] as const).map(([value, color]) => (
                  <span
                    aria-hidden="true"
                    className={`w-1/4 max-w-7 rounded-t ${color}`}
                    key={color}
                    style={{ height: `${Math.max(3, (Math.abs(Number(value)) / maximum) * 100)}%` }}
                    title={formatMoney(value)}
                  />
                ))}
              </div>
              <span className="mt-2 text-xs font-black text-slate-700">{shortMonths[month.month - 1]}</span>
            </div>
          ))}
        </div>
        <p className="sr-only">
          {view.months.map((month) =>
            `${monthLabel(month.competence)}: receita líquida ${formatMoney(month.netRevenue)}, despesas ${formatMoney(month.expenses)} e resultado ${formatMoney(month.finalResult)}.`).join(" ")}
        </p>
      </div>
    </Card>
  );
}

function Performance({ view }: { readonly view: AvailableFinancialManagementView }) {
  const variation = view.indicators.latestVariation;
  const VariationIcon = variation.direction === "GROWTH"
    ? ArrowUpRight
    : variation.direction === "RETRACTION"
      ? ArrowDownRight
      : variation.direction === "STABLE"
        ? Minus
        : ArrowRight;
  const metrics = [
    { label: "Melhor mês · Lucro/Prejuízo Final", value: `${monthLabel(view.indicators.bestMonth.competence)} · ${formatMoney(view.indicators.bestMonth.amount)}`, icon: TrendingUp },
    { label: "Pior mês · Lucro/Prejuízo Final", value: `${monthLabel(view.indicators.worstMonth.competence)} · ${formatMoney(view.indicators.worstMonth.amount)}`, icon: TrendingDown },
    { label: "Receita média mensal", value: formatMoney(view.indicators.averageMonthlyNetRevenue), icon: CircleDollarSign },
    { label: "Despesa média mensal", value: formatMoney(view.indicators.averageMonthlyExpenses), icon: ReceiptText },
    { label: "Lucro/Prejuízo Final médio mensal", value: formatMoney(view.indicators.averageMonthlyResult), icon: Target },
  ];
  return (
    <Card className="h-full p-5 sm:p-6">
      <SectionHeader
        description={`Médias e extremos calculados sobre ${view.exercise.closedCount} competências apuradas.`}
        eyebrow="Desempenho"
        title="Leitura rápida do exercício"
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={metric.label}>
              <Icon aria-hidden="true" className="size-4 text-emerald-700" />
              <p className="mt-2 text-[11px] font-bold leading-4 text-slate-500">{metric.label}</p>
              <p className="mt-1 whitespace-nowrap text-xs font-black text-slate-950">{metric.value}</p>
            </div>
          );
        })}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <VariationIcon aria-hidden="true" className="size-4 text-emerald-700" />
          <p className="mt-2 text-[11px] font-bold leading-4 text-emerald-700">Último mês vs. anterior</p>
          <p className="mt-1 whitespace-nowrap text-xs font-black text-emerald-950">
            {variation.percentageChange === undefined
              ? "Comparação indisponível"
              : `${variation.percentageChange > 0 ? "+" : ""}${percent.format(variation.percentageChange)}%`}
          </p>
          {variation.absoluteChange ? (
            <p className="mt-1 whitespace-nowrap text-[11px] font-semibold text-emerald-800">
              Receita líquida · {formatMoney(variation.absoluteChange)}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function DreSummary({
  view,
  onViewFullDre,
}: {
  readonly view: AvailableFinancialManagementView;
  readonly onViewFullDre: () => void;
}) {
  const rows = [
    ["Receita Bruta", view.indicators.grossRevenue.amount],
    ["Deduções", view.indicators.deductions.amount],
    ["Receita Líquida", view.indicators.netRevenue.amount],
    ["Custos", view.indicators.costs.amount],
    ["Despesas", view.indicators.expenses.amount],
    ["Resultado Operacional", view.indicators.operatingResult.amount],
    ["Lucro/Prejuízo Final", view.indicators.finalResult.amount],
  ] as const;
  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader
        action={<Button onClick={onViewFullDre} type="button" variant="outline">Ver DRE completa</Button>}
        description={`Acumulado de janeiro a ${monthLabel(view.exercise.lastClosedCompetence)}. A coluna Total anual não integra estes valores.`}
        eyebrow="DRE resumida"
        title="Principais linhas"
      />
      <dl className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 px-4">
        {rows.map(([label, value], index) => (
          <div className={`flex items-center justify-between gap-4 py-3 ${index === rows.length - 1 ? "font-black text-emerald-950" : "text-slate-700"}`} key={label}>
            <dt>{label}</dt>
            <dd className="whitespace-nowrap text-right font-bold tabular-nums">{formatMoney(value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function AcademyManagementPanel({
  view,
  onViewFullDre,
}: {
  readonly view: FinancialManagementView;
  readonly onViewFullDre: () => void;
}) {
  if (view.availability === "UNAVAILABLE") {
    return (
      <section aria-labelledby="academy-management-title">
        <SectionHeader eyebrow="Academia Saulo Fitness" title="Painel Gerencial" />
        <div className="mt-3">
          <PageState description={view.message} title="DRE gerencial indisponível" />
        </div>
      </section>
    );
  }

  const lastClosedMonth = Number(view.exercise.lastClosedCompetence.slice(5, 7));
  return (
    <section aria-labelledby="academy-management-title" className="space-y-5">
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Academia Saulo Fitness</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950" id="academy-management-title">Painel Gerencial</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="success">Exercício {view.exercise.year}</Badge>
              <Badge tone="info">Última competência: {monthLabel(view.exercise.lastClosedCompetence)}</Badge>
              <Badge tone="neutral">Origem: DRE NextFit</Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Fotografia gerencial da DRE. Estes indicadores não representam fluxo de caixa nem lançamentos financeiros do SAULO AI.
            </p>
          </div>
          <div className="min-w-64 rounded-2xl border border-emerald-200 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Situação do exercício</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{view.exercise.closedCount} de {view.exercise.competenceCount}</p>
                <p className="text-xs font-semibold text-slate-500">competências apuradas</p>
              </div>
              <CalendarRange aria-hidden="true" className="size-5 text-emerald-700" />
            </div>
            <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-700">
              <span>{percent.format(view.exercise.percentage)}%</span>
              <span>{view.exercise.pendingCount} pendentes</span>
            </div>
            <Progress className="mt-2" label={`${percent.format(view.exercise.percentage)}% do exercício apurado`} value={view.exercise.percentage} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {shortMonths.map((month, index) => {
            const closed = index < lastClosedMonth;
            return (
              <span
                className={`rounded-lg px-2 py-2 text-center text-xs font-black ${closed ? "bg-emerald-600 text-white" : "border border-dashed border-slate-300 bg-white/70 text-slate-400"}`}
                key={month}
                title={closed ? "Competência apurada" : "Competência pendente"}
              >
                {month}
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:flex-row sm:justify-between">
          <span>Janeiro → {monthNames[lastClosedMonth - 1]}: apurados</span>
          {view.exercise.pendingCount ? <span>{monthNames[lastClosedMonth]} → Dezembro: pendentes</span> : <span>Exercício completo</span>}
        </div>
      </Card>

      <IndicatorCards view={view} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,.65fr)]">
        <MonthlyEvolution view={view} />
        <Performance view={view} />
      </div>
      <DreSummary onViewFullDre={onViewFullDre} view={view} />
    </section>
  );
}
