"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { InstitutionalDocumentIdentity } from "@/components/documents/institutional-document-identity";
import type {
  FollowUpMetricKey,
  NutritionFollowUpEvaluation,
  NutritionFollowUpView,
} from "@/features/nutrition-follow-up/service";
import {
  PerimetryEvolutionPanel,
  resolvePerimetrySelection,
  type PerimetrySelection,
} from "./perimetry-evolution-panel";
import { BodyCompositionComparisonPanel } from "./body-composition-comparison-panel";
import { PerformanceComparisonPanel } from "./performance-comparison-panel";
import {
  PerformanceComparisonSelector,
  initialPerformanceSelection,
  performanceSelectionRecords,
} from "./performance-comparison-selector";
import {
  EvaluationComparisonSelector,
  initialEvaluationSelection,
  selectedEvaluations,
} from "./evaluation-comparison-selector";

export type EvaluationComparisonTab =
  | "measures"
  | "composition"
  | "performance";

const tabDefinitions: ReadonlyArray<{
  id: EvaluationComparisonTab;
  label: string;
}> = [
  { id: "measures", label: "Medidas corporais" },
  { id: "composition", label: "Composição corporal" },
  { id: "performance", label: "Performance" },
];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const metricDefinitions: ReadonlyArray<{
  key: FollowUpMetricKey;
  label: string;
  unit: "kg" | "cm";
  color: string;
}> = [
  { key: "weightKg", label: "Peso", unit: "kg", color: "#0369a1" },
  { key: "waistCm", label: "Cintura", unit: "cm", color: "#7c3aed" },
  { key: "abdomenCm", label: "Abdômen", unit: "cm", color: "#ea580c" },
  { key: "hipCm", label: "Quadril", unit: "cm", color: "#0f766e" },
];

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatEvaluationLabel(
  evaluation: NutritionFollowUpEvaluation,
  evaluations: readonly NutritionFollowUpEvaluation[],
) {
  const date = formatDate(evaluation.date);
  if (evaluations.filter((item) => item.date === evaluation.date).length < 2) {
    return date;
  }
  const type = evaluation.sources.map((source) => source.modality).join(" · ");
  return `${date} · ${timeFormatter.format(new Date(evaluation.occurredAt))}${type ? ` · ${type}` : ""}`;
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
}

function Value({ value, unit }: { value?: number; unit: string }) {
  return value === undefined ? (
    <span className="font-semibold text-slate-500">Não registrado</span>
  ) : (
    <span className="font-black tabular-nums text-slate-950">
      {formatNumber(value)} {unit}
    </span>
  );
}

function ComparisonCard({
  definition,
  first,
  latest,
  firstLabel,
  latestLabel,
  evaluations,
}: {
  definition: (typeof metricDefinitions)[number];
  first: NutritionFollowUpEvaluation;
  latest: NutritionFollowUpEvaluation;
  firstLabel: string;
  latestLabel: string;
  evaluations: readonly NutritionFollowUpEvaluation[];
}) {
  const firstValue = first[definition.key];
  const latestValue = latest[definition.key];
  const hasDistinctEvaluations = first.id !== latest.id;
  const difference =
    hasDistinctEvaluations && firstValue !== undefined && latestValue !== undefined
      ? latestValue - firstValue
      : undefined;
  const missingLabels = evaluations
    .filter((evaluation) => evaluation[definition.key] === undefined)
    .map((evaluation) => formatEvaluationLabel(evaluation, evaluations));

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-3 rounded-full"
          style={{ backgroundColor: definition.color }}
        />
        <h3 className="text-sm font-black text-slate-950">{definition.label}</h3>
      </div>
      <dl className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Primeira · {firstLabel}</dt>
          <dd className="mt-1"><Value unit={definition.unit} value={firstValue} /></dd>
          <dd className="mt-2 text-[10px] font-bold text-slate-500">
            {first.status === "FINALIZED" ? "Finalizada" : "Rascunho"}
            {first.measurementMethods[definition.key]
              ? ` · ${first.measurementMethods[definition.key]}`
              : " · método não registrado"}
          </dd>
        </div>
        <span aria-hidden="true" className="text-slate-400">→</span>
        <div className="rounded-xl p-2 text-right" style={{ backgroundColor: `${definition.color}0d` }}>
          <dt className="text-slate-500">Última · {latestLabel}</dt>
          <dd className="mt-1"><Value unit={definition.unit} value={latestValue} /></dd>
          <dd className="mt-2 text-[10px] font-bold text-slate-500">
            {latest.status === "FINALIZED" ? "Finalizada" : "Rascunho"}
            {latest.measurementMethods[definition.key]
              ? ` · ${latest.measurementMethods[definition.key]}`
              : " · método não registrado"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-bold text-slate-600">
        Diferença: {difference === undefined
          ? "dados insuficientes"
          : `${difference > 0 ? "+" : ""}${formatNumber(difference)} ${definition.unit}`}
      </p>
      {missingLabels.length ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Medida ausente em {missingLabels.join(" e ")}. Somente as avaliações selecionadas foram consideradas.
        </p>
      ) : null}
    </article>
  );
}

function TrendChart({
  title,
  description,
  evaluations,
  metrics,
}: {
  title: string;
  description: string;
  evaluations: readonly NutritionFollowUpEvaluation[];
  metrics: readonly (typeof metricDefinitions)[number][];
}) {
  const histories = metrics.map((metric) => ({
    metric,
    points: evaluations.flatMap((evaluation, index) => {
      const value = evaluation[metric.key];
      return value === undefined ? [] : [{ evaluation, index, value }];
    }),
  }));
  const usableMetrics = histories.filter((history) => history.points.length >= 2).map((history) => history.metric);
  const comparisonHistories = histories.filter((history) => history.points.length === 2);
  const timelineMetrics = histories.filter((history) => history.points.length >= 3).map((history) => history.metric);
  const compactHistories = histories.filter((history) => history.points.length < 2);

  const values = timelineMetrics.flatMap((metric) =>
    evaluations.flatMap((evaluation) => {
      const value = evaluation[metric.key];
      return value === undefined ? [] : [value];
    }),
  );
  const methods = new Set(
    usableMetrics.flatMap((metric) =>
      evaluations.flatMap((evaluation) => {
        const method = evaluation.measurementMethods[metric.key];
        return evaluation[metric.key] !== undefined && method ? [method] : [];
      }),
    ),
  );

  const width = 620;
  const height = 232;
  const plot = { left: 54, right: 28, top: 30, bottom: 42 };
  const rawMinimum = values.length ? Math.min(...values) : 0;
  const rawMaximum = values.length ? Math.max(...values) : 1;
  const padding = Math.max((rawMaximum - rawMinimum) * 0.12, 1);
  const minimum = rawMinimum - padding;
  const maximum = rawMaximum + padding;
  const timestamps = evaluations.map((evaluation) => new Date(evaluation.occurredAt).getTime());
  const firstTimestamp = Math.min(...timestamps);
  const lastTimestamp = Math.max(...timestamps);
  const x = (evaluation: NutritionFollowUpEvaluation) => {
    const timestamp = new Date(evaluation.occurredAt).getTime();
    return lastTimestamp === firstTimestamp
      ? (plot.left + width - plot.right) / 2
      : plot.left + ((timestamp - firstTimestamp) * (width - plot.left - plot.right)) / (lastTimestamp - firstTimestamp);
  };
  const y = (value: number) =>
    plot.top +
    ((maximum - value) * (height - plot.top - plot.bottom)) / (maximum - minimum);

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm sm:p-5" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
        <div aria-label="Legenda" className="flex flex-wrap gap-3 text-xs font-bold text-slate-700">
          {usableMetrics.map((metric) => (
            <span className="inline-flex items-center gap-1.5" key={metric.key}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
              {metric.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-slate-500 bg-white" /> Finalizado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-amber-600 bg-amber-100" /> Rascunho
          </span>
        </div>
      </div>
      {compactHistories.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {compactHistories.map(({ metric, points }) => {
            const point = points[0];
            const missingCount = evaluations.length - points.length;
            return (
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={metric.key}>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                  <h3 className="text-sm font-black text-slate-950">{metric.label}</h3>
                </div>
                {point ? (
                  <>
                    <p className="mt-2 text-lg font-black tabular-nums text-slate-950">{formatNumber(point.value)} <span className="text-xs text-slate-600">{metric.unit}</span></p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{formatEvaluationLabel(point.evaluation, evaluations)} · {point.evaluation.status === "FINALIZED" ? "Finalizada" : "Rascunho"}</p>
                    <p className="mt-2 text-xs font-black text-sky-800">Uma medição disponível nesta seleção</p>
                    {missingCount ? <p className="mt-1 text-xs text-slate-500">Sem valor em {missingCount} {missingCount === 1 ? "avaliação selecionada" : "avaliações selecionadas"}; nenhuma avaliação desmarcada foi usada.</p> : null}
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-600">Medida ausente nas avaliações selecionadas. Nenhum valor foi preenchido a partir de avaliações desmarcadas.</p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
      {comparisonHistories.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {comparisonHistories.map(({ metric, points }) => {
            const maximumValue = Math.max(...points.map((point) => point.value), 1);
            return (
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={`${metric.key}-comparison`}>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                  <h3 className="text-sm font-black text-slate-950">{metric.label}</h3>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-slate-500">Comparação com base zero</span>
                </div>
                <div className="mt-3 space-y-3">
                  {points.map((point) => (
                    <div key={point.evaluation.id}>
                      <div className="mb-1 flex items-end justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-600">{formatEvaluationLabel(point.evaluation, evaluations)} · {point.evaluation.status === "FINALIZED" ? "Finalizada" : "Rascunho"}</span>
                        <strong className="shrink-0 tabular-nums text-slate-950">{formatNumber(point.value)} {metric.unit}</strong>
                      </div>
                      <div aria-label={`${metric.label}: ${formatNumber(point.value)} ${metric.unit}, escala iniciada em zero`} className="h-3 overflow-hidden rounded-full bg-slate-200" role="img">
                        <div className="h-full rounded-full" style={{ backgroundColor: metric.color, width: `${Math.max((point.value / maximumValue) * 100, 1)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      {methods.size > 1 ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          Há métodos de medição diferentes nesta série. Os pontos são identificados individualmente e não são ligados quando o método muda.
        </p>
      ) : null}
      {timelineMetrics.length ? <div className="evaluation-trend-chart mt-5 overflow-x-auto">
        <svg
          aria-label={`${title}. ${timelineMetrics.map((metric) => metric.label).join(", ")}.`}
          className="evaluation-trend-chart-svg min-w-[26rem]"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = minimum + ((maximum - minimum) * tick) / 4;
            const tickY = y(value);
            return (
              <g key={tick}>
                <line stroke="#e2e8f0" x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} />
                <text fill="#64748b" fontSize="11" textAnchor="end" x={plot.left - 9} y={tickY + 4}>
                  {formatNumber(value)}
                </text>
              </g>
            );
          })}
          {evaluations.map((evaluation) => (
            <text fill="#64748b" fontSize="10" key={evaluation.id} textAnchor="middle" x={x(evaluation)} y={height - 18}>
              {evaluations.filter((item) => item.date === evaluation.date).length > 1
                ? timeFormatter.format(new Date(evaluation.occurredAt))
                : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${evaluation.date}T00:00:00.000Z`))}
            </text>
          ))}
          {timelineMetrics.map((metric) => {
            const points = evaluations.flatMap((evaluation, index) => {
              const value = evaluation[metric.key];
              return value === undefined ? [] : [{
                index,
                value,
                method: evaluation.measurementMethods[metric.key],
                status: evaluation.status,
              }];
            });
            const hasSingleMethod = new Set(points.map((point) => point.method ?? "")).size === 1;
            return (
              <g key={metric.key}>
                {hasSingleMethod && points.length >= 3 ? (
                  <polygon
                    fill={metric.color}
                    fillOpacity="0.08"
                    points={`${x(evaluations[points[0].index])},${height - plot.bottom} ${points.map((point) => `${x(evaluations[point.index])},${y(point.value)}`).join(" ")} ${x(evaluations[points.at(-1)!.index])},${height - plot.bottom}`}
                  />
                ) : null}
                {points.slice(1).map((point, pointIndex) => {
                  const previous = points[pointIndex];
                  return previous.method === point.method ? (
                    <line
                      key={`${metric.key}-line-${point.index}`}
                      stroke={metric.color}
                      strokeLinecap="round"
                      strokeWidth="3"
                      x1={x(evaluations[previous.index])}
                      x2={x(evaluations[point.index])}
                      y1={y(previous.value)}
                      y2={y(point.value)}
                    />
                  ) : null;
                })}
                {points.map((point) => (
                  <g key={`${metric.key}-${point.index}`}>
                    <circle
                      cx={x(evaluations[point.index])}
                      cy={y(point.value)}
                      fill={point.status === "FINALIZED" ? "white" : "#fef3c7"}
                      r="5"
                      stroke={point.status === "FINALIZED" ? metric.color : "#d97706"}
                      strokeWidth="3"
                    />
                    <text fill={metric.color} fontSize="10" fontWeight="700" textAnchor="middle" x={x(evaluations[point.index])} y={Math.max(y(point.value) - 10, 12)}>
                      {formatNumber(point.value)} {metric.unit}
                    </text>
                    <title>{`${metric.label}: ${formatNumber(point.value)} ${metric.unit} em ${formatEvaluationLabel(evaluations[point.index], evaluations)} · ${point.status === "FINALIZED" ? "finalizada" : "rascunho"} · ${point.method ?? "método não registrado"}`}</title>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div> : null}
    </section>
  );
}

export function NutritionFollowUpDashboard({
  view,
  presentationMode = false,
  embedded = false,
  initialSelectedEvaluationIds,
  initialSelectedPerformanceIds,
  initialPerimetryRegionKey,
  initialSelectedPerimetryKeys,
  selectedEvaluationIds,
  onSelectedEvaluationIdsChange,
  showEvaluationSelector = true,
  initialTab = "measures",
  availableTabs = ["measures", "composition", "performance"],
}: {
  view: NutritionFollowUpView;
  presentationMode?: boolean;
  embedded?: boolean;
  initialSelectedEvaluationIds?: readonly string[];
  initialSelectedPerformanceIds?: readonly string[];
  initialPerimetryRegionKey?: string;
  initialSelectedPerimetryKeys?: readonly string[];
  selectedEvaluationIds?: readonly string[];
  onSelectedEvaluationIdsChange?: (ids: readonly string[]) => void;
  showEvaluationSelector?: boolean;
  initialTab?: EvaluationComparisonTab;
  availableTabs?: readonly EvaluationComparisonTab[];
}) {
  const allowedTabs = tabDefinitions.filter((tab) =>
    availableTabs.includes(tab.id),
  );
  const [activeTab, setActiveTab] = useState<EvaluationComparisonTab>(() =>
    availableTabs.includes(initialTab)
      ? initialTab
      : allowedTabs[0]?.id ?? "measures",
  );
  const [internalSelectedIds, setInternalSelectedIds] = useState<readonly string[]>(
    () => initialSelectedEvaluationIds !== undefined
      ? initialSelectedEvaluationIds
      : initialEvaluationSelection(view.evaluations),
  );
  const activeSelectedIds = selectedEvaluationIds ?? internalSelectedIds;
  const performanceRecords = useMemo(
    () => performanceSelectionRecords(view.performance),
    [view.performance],
  );
  const [selectedPerformanceIds, setSelectedPerformanceIds] = useState<readonly string[]>(
    () => initialSelectedPerformanceIds ?? initialPerformanceSelection(performanceRecords),
  );
  const [requestedPerimetrySelection, setRequestedPerimetrySelection] = useState<{
    readonly regionKey?: string;
    readonly metricKeys?: readonly string[];
  }>(() => ({
    regionKey: initialPerimetryRegionKey,
    metricKeys: initialSelectedPerimetryKeys,
  }));
  const selectedPerformanceRecords = useMemo(() => {
    const ids = new Set(selectedPerformanceIds);
    return performanceRecords.filter((record) => ids.has(record.selectionId));
  }, [performanceRecords, selectedPerformanceIds]);
  const selected = useMemo(
    () => selectedEvaluations(view.evaluations, activeSelectedIds),
    [activeSelectedIds, view.evaluations],
  );
  const selectedView = useMemo(
    () => ({ ...view, evaluations: selected }),
    [selected, view],
  );
  const perimetrySelection = useMemo(
    () => resolvePerimetrySelection(
      selectedView,
      requestedPerimetrySelection.regionKey,
      requestedPerimetrySelection.metricKeys,
    ),
    [requestedPerimetrySelection, selectedView],
  );
  const first = selected[0];
  const latest = selected.at(-1);
  const firstLabel = first ? formatEvaluationLabel(first, selected) : "";
  const latestLabel = latest ? formatEvaluationLabel(latest, selected) : "";
  const selectionParameter = encodeURIComponent(
    selected.map((evaluation) => evaluation.id).join(","),
  );
  const performanceSelectionParameter = encodeURIComponent(
    selectedPerformanceRecords.map((record) => record.selectionId).join(","),
  );
  const perimetryRegionParameter = encodeURIComponent(perimetrySelection.regionKey);
  const perimetryMetricsParameter = encodeURIComponent(perimetrySelection.metricKeys.join(","));
  const filteredPerformance = useMemo(() => {
    const selectedByKind = {
      prescription: new Set(selectedPerformanceRecords.filter((record) => record.kind === "prescription").map((record) => record.recordId)),
      scheduled: new Set(selectedPerformanceRecords.filter((record) => record.kind === "scheduled").map((record) => record.recordId)),
      execution: new Set(selectedPerformanceRecords.filter((record) => record.kind === "execution").map((record) => record.recordId)),
    };
    return {
      prescriptions: view.performance.prescriptions.filter((item) =>
        selectedByKind.prescription.has(item.id),
      ),
      scheduledSessions: view.performance.scheduledSessions.filter((item) =>
        selectedByKind.scheduled.has(item.id),
      ),
      executions: view.performance.executions.filter((item) =>
        selectedByKind.execution.has(item.id),
      ),
    };
  }, [selectedPerformanceRecords, view.performance]);

  function changeSelection(ids: readonly string[]) {
    if (selectedEvaluationIds === undefined) setInternalSelectedIds(ids);
    onSelectedEvaluationIdsChange?.(ids);
  }

  function changeTab(tab: EvaluationComparisonTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", tab);
    window.history.replaceState(null, "", url);
  }

  return (
    <div
      className={`evaluation-evolution-report space-y-6 ${embedded ? "rounded-2xl bg-slate-50/70 p-3 sm:p-4" : ""}`}
      data-comparison-theme={activeTab === "performance" ? "performance" : "assessments"}
      id={embedded ? undefined : "evaluation-evolution-report"}
    >
      {embedded ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-5 text-slate-600">
            Esta visão usa somente avaliações já salvas no prontuário.
          </p>
          <Link
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-800 hover:bg-emerald-50"
            href={`/pacientes/${view.patient.id}/evolucao-avaliacoes`}
          >
            Abrir evolução completa
          </Link>
        </div>
      ) : !presentationMode ? (
        <div className="evaluation-evolution-actions flex flex-wrap justify-end gap-2 print:hidden">
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-800 hover:bg-emerald-50"
            href={`/pacientes/${view.patient.id}/evolucao-avaliacoes/compartilhar?aba=${activeTab}&avaliacoes=${selectionParameter}&performance=${performanceSelectionParameter}&regiao=${perimetryRegionParameter}&medidas=${perimetryMetricsParameter}`}
          >
            Visualização para compartilhar
          </Link>
          <button className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-800 hover:bg-emerald-50" onClick={() => window.print()} type="button">Imprimir</button>
          <button className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800" onClick={() => window.print()} type="button">Salvar em PDF</button>
        </div>
      ) : null}
      {!embedded && presentationMode ? <header className="evaluation-document-header rounded-2xl border border-[var(--line)] bg-white p-5">
        <InstitutionalDocumentIdentity compact />
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Evolução e comparativos</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--text-primary)]">{view.patient.name}</h1>
          <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">{view.patient.clinicalCode}</p>
        </div>
      </header> : null}

      {allowedTabs.length > 1 && !presentationMode ? (
        <nav aria-label="Áreas da evolução e comparativos" className="print:hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex min-w-max gap-2">
            {allowedTabs.map((tab) => (
              <button
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`min-h-11 rounded-xl border px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 ${activeTab === tab.id ? (tab.id === "performance" ? "border-emerald-700 bg-emerald-700 text-white focus-visible:ring-emerald-600" : "border-sky-700 bg-sky-700 text-white focus-visible:ring-sky-600") : (tab.id === "performance" ? "border-transparent bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 focus-visible:ring-emerald-600" : "border-transparent bg-slate-50 text-slate-700 hover:bg-sky-50 hover:text-sky-900 focus-visible:ring-sky-600")}`}
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      ) : presentationMode ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800">
          {tabDefinitions.find((tab) => tab.id === activeTab)?.label}
        </p>
      ) : null}

      {showEvaluationSelector && !presentationMode && activeTab !== "performance" ? (
        <EvaluationComparisonSelector
          evaluations={view.evaluations}
          onChange={changeSelection}
          selectedIds={activeSelectedIds}
        />
      ) : null}

      {!presentationMode && activeTab === "performance" ? (
        <PerformanceComparisonSelector
          onChange={setSelectedPerformanceIds}
          records={performanceRecords}
          selectedIds={selectedPerformanceIds}
        />
      ) : null}

      {activeTab !== "performance" && selected.length ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">
          <strong>Datas incluídas:</strong>{" "}
          {selected.map((evaluation) => formatEvaluationLabel(evaluation, selected)).join(" | ")}
        </section>
      ) : null}

      {activeTab !== "performance" && view.evaluations.length > 0 && selected.length < 2 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950" role="status">
          {selected.length === 1
            ? "A avaliação selecionada continua disponível abaixo, mas falta outra avaliação para comparar diferenças e tendências."
            : "Nenhuma avaliação está selecionada. Selecione ao menos duas para comparar diferenças e tendências."}
        </p>
      ) : null}

      {activeTab === "performance" && selectedPerformanceRecords.length ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-xs font-semibold text-slate-700">
          <strong>Registros de Performance incluídos:</strong>{" "}
          {selectedPerformanceRecords.map((record) => `${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(record.occurredAt))} · ${record.label}`).join(" | ")}
        </section>
      ) : null}

      {activeTab === "performance" && performanceRecords.length > 0 && selectedPerformanceRecords.length < 2 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950" role="status">
          {selectedPerformanceRecords.length === 1 ? "O registro selecionado continua disponível abaixo, mas falta outro registro de Performance para comparar." : "Nenhum registro de Performance está selecionado. Selecione ao menos dois para comparar."}
        </p>
      ) : null}

      {activeTab === "measures" && !view.evaluations.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-black text-slate-950">Nenhuma avaliação disponível</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">O prontuário não possui antropometria, perimetria ou bioimpedância registradas. Nenhuma consulta ou resultado foi criado para preencher a ausência.</p>
        </section>
      ) : activeTab === "measures" && first && latest ? (
        <>
          <section aria-labelledby="first-latest-title">
            <div className="evaluation-section-heading flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Comparação objetiva</p>
                <h2 className="mt-1 text-xl font-black text-slate-950" id="first-latest-title">Primeira × última selecionada</h2>
              </div>
              <p className="text-xs font-semibold text-slate-500">{firstLabel} → {latestLabel}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricDefinitions.map((definition) => (
                <ComparisonCard definition={definition} evaluations={selected} first={first} firstLabel={firstLabel} key={definition.key} latest={latest} latestLabel={latestLabel} />
              ))}
            </div>
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-2 print:grid-cols-2">
            <TrendChart
              description="Cada ponto representa um peso realmente registrado. Datas sem peso permanecem sem ponto."
              evaluations={selected}
              metrics={[metricDefinitions[0]]}
              title="Evolução do peso"
            />
            <TrendChart
              description="Cintura, abdômen e quadril usam cores diferentes e somente valores disponíveis."
              evaluations={selected}
              metrics={metricDefinitions.slice(1)}
              title="Evolução das medidas corporais"
            />
          </div>

          <PerimetryEvolutionPanel
            key={selectionParameter}
            onSelectionChange={(next: PerimetrySelection) => setRequestedPerimetrySelection({
              regionKey: next.regionKey,
              metricKeys: next.metricKeys,
            })}
            presentationMode={presentationMode}
            selection={perimetrySelection}
            view={selectedView}
          />

          {!embedded ? <section aria-labelledby="evaluation-history-title" className="space-y-4">
            <div className="evaluation-section-heading">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Rastreabilidade</p>
              <h2 className="mt-1 text-xl font-black text-slate-950" id="evaluation-history-title">Avaliações por data</h2>
              <p className="mt-1 text-sm text-slate-600">Abra uma avaliação para conferir os valores e os registros de origem.</p>
            </div>
            <ol className="space-y-3">
              {selected.map((evaluation, index) => (
                <li key={evaluation.id}>
                  <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" open={index === selected.length - 1}>
                    <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-black text-slate-950">{formatEvaluationLabel(evaluation, selected)}</p>
                        <p className="mt-1 text-xs text-slate-500">{evaluation.sources.map((source) => source.modality).join(" · ")}</p>
                        {evaluation.dataLabel ? <p className="mt-2 inline-flex rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black text-sky-900">{evaluation.dataLabel}</p> : null}
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${evaluation.status === "FINALIZED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                        {evaluation.status === "FINALIZED" ? "Registro finalizado" : "Rascunho registrado"}
                      </span>
                    </summary>
                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {metricDefinitions.map((metric) => (
                          <div className="rounded-xl bg-slate-50 p-3" key={metric.key}>
                            <dt className="text-xs text-slate-500">{metric.label}</dt>
                            <dd className="mt-1 text-sm"><Value unit={metric.unit} value={evaluation[metric.key]} /></dd>
                            <dd className="mt-1 text-[10px] font-semibold text-slate-500">{evaluation.measurementMethods[metric.key] ?? "Método não registrado"}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-4 rounded-xl border border-slate-200 p-4">
                        <h3 className="text-sm font-black text-slate-950">Dados de origem</h3>
                        <ul className="mt-3 space-y-3">
                          {evaluation.sources.map((source) => (
                            <li className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between" key={`${source.entryId}-${source.modality}`}>
                              <div>
                                <p className="font-black text-slate-800">{source.modality}</p>
                                <p className="mt-0.5 text-slate-500">{formatEvaluationLabel(evaluation, selected)} · {evaluation.status === "FINALIZED" ? "Finalizada" : "Rascunho"}</p>
                                {source.notes ? <p className="mt-1 text-slate-600">Observação registrada: {source.notes}</p> : null}
                                {!presentationMode ? <details className="mt-2 print:hidden"><summary className="cursor-pointer font-bold text-slate-500">Detalhes técnicos</summary><code className="mt-1 block break-all text-[10px] text-slate-500">{source.entryId}</code></details> : null}
                              </div>
                              {!presentationMode && source.href ? (
                                <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-sky-300 px-3 font-black text-sky-800 hover:bg-sky-50" href={source.href}>Ver avaliação</Link>
                              ) : !presentationMode ? (
                                <span className="font-semibold text-slate-500">Registro histórico sem atendimento vinculado</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section> : null}
        </>
      ) : null}

      {activeTab === "composition" ? (
        <BodyCompositionComparisonPanel evaluations={selected} />
      ) : null}

      {activeTab === "performance" ? (
        <PerformanceComparisonPanel performance={filteredPerformance} />
      ) : null}
    </div>
  );
}
