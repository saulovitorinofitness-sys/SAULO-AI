"use client";

import { useMemo } from "react";

import { perimetryGroups } from "@/features/clinical-collection";
import type {
  FollowUpRecordStatus,
  NutritionFollowUpEvaluation,
  NutritionFollowUpView,
  PerimetryMetricKey,
} from "@/features/nutrition-follow-up/service";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "UTC",
});
const graphDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});
const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});
const whoSourceUrl = "https://www.who.int/publications/i/item/9789241501491";

type PerimetryRegion = (typeof perimetryGroups)[number];

export interface PerimetrySelection {
  readonly regionKey: string;
  readonly metricKeys: readonly PerimetryMetricKey[];
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatGraphDate(value: string) {
  return graphDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function evaluationLabel(
  view: NutritionFollowUpView,
  evaluation: NutritionFollowUpEvaluation,
) {
  const date = formatDate(evaluation.date);
  if (view.evaluations.filter((item) => item.date === evaluation.date).length < 2) {
    return date;
  }
  const type = evaluation.sources.map((source) => source.modality).join(" · ");
  return `${date} · ${timeFormatter.format(new Date(evaluation.occurredAt))}${type ? ` · ${type}` : ""}`;
}

function statusLabel(status: FollowUpRecordStatus) {
  return status === "FINALIZED" ? "Finalizado" : "Rascunho";
}

function metricHistory(
  view: NutritionFollowUpView,
  key: PerimetryMetricKey,
) {
  return view.evaluations.flatMap((evaluation) => {
    const value = evaluation.perimetryMeasurements[key];
    return value === undefined
      ? []
      : [{
          id: evaluation.id,
          date: evaluation.date,
          occurredAt: evaluation.occurredAt,
          label: evaluationLabel(view, evaluation),
          status: evaluation.perimetryStatus ?? evaluation.status,
          value,
        }];
  });
}

function metricPresentation(key: PerimetryMetricKey) {
  if (key === "waistCm") return { color: "#7c3aed", side: "Medida central" };
  if (key === "abdomenCm") return { color: "#ea580c", side: "Medida central" };
  if (key === "hipCm") return { color: "#0f766e", side: "Medida central" };
  if (String(key).startsWith("right")) {
    return { color: "#2563eb", side: "Lado direito" };
  }
  if (String(key).startsWith("left")) {
    return { color: "#ea580c", side: "Lado esquerdo" };
  }
  return { color: "#7c3aed", side: "Medida central" };
}

function MetricChart({
  label,
  history,
  color,
}: {
  label: string;
  history: ReturnType<typeof metricHistory>;
  color: string;
}) {
  const width = 540;
  const height = 232;
  const plot = { left: 66, right: 48, top: 42, bottom: 50 };
  const values = history.map((item) => item.value);
  const rawMinimum = Math.min(...values);
  const rawMaximum = Math.max(...values);
  const padding = rawMinimum === rawMaximum
    ? Math.max(rawMinimum * 0.05, 1)
    : (rawMaximum - rawMinimum) * 0.15;
  const minimum = Math.max(0, rawMinimum - padding);
  const maximum = rawMaximum + padding;
  const timestamps = history.map((item) => new Date(item.occurredAt).getTime());
  const firstTimestamp = Math.min(...timestamps);
  const lastTimestamp = Math.max(...timestamps);
  const x = (item: (typeof history)[number]) => {
    const timestamp = new Date(item.occurredAt).getTime();
    return lastTimestamp === firstTimestamp
      ? (plot.left + width - plot.right) / 2
      : plot.left + ((timestamp - firstTimestamp) * (width - plot.left - plot.right)) / (lastTimestamp - firstTimestamp);
  };
  const y = (value: number) =>
    plot.top +
    ((maximum - value) * (height - plot.top - plot.bottom)) /
      Math.max(maximum - minimum, 1);
  const points = history.map((item) => `${x(item)},${y(item.value)}`).join(" ");

  return (
    <div className="evaluation-trend-chart mt-4 overflow-x-auto">
      <svg
        aria-label={`Evolução de ${label} em centímetros.`}
        className="evaluation-trend-chart-svg min-w-[30rem]"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = minimum + ((maximum - minimum) * tick) / 4;
          const tickY = y(value);
          return (
            <g key={tick}>
              <line stroke="#e2e8f0" x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} />
              <text fill="#64748b" fontSize="11" textAnchor="end" x={plot.left - 8} y={tickY + 4}>
                {numberFormatter.format(value)}
              </text>
            </g>
          );
        })}
        {history.length > 1 ? (
          <>
            <polygon
              fill={color}
              fillOpacity="0.08"
              points={`${x(history[0])},${height - plot.bottom} ${points} ${x(history.at(-1)!)},${height - plot.bottom}`}
            />
            <polyline fill="none" points={points} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          </>
        ) : null}
        {history.map((item) => (
          <g key={item.id}>
            <circle
              cx={x(item)}
              cy={y(item.value)}
              fill={item.status === "FINALIZED" ? "white" : "#fef3c7"}
              r="6"
              stroke={item.status === "FINALIZED" ? color : "#d97706"}
              strokeWidth="3"
            >
              <title>{`${label}: ${numberFormatter.format(item.value)} cm em ${item.label} - ${statusLabel(item.status)}`}</title>
            </circle>
            <text fill={color} fontSize="10" fontWeight="700" textAnchor="middle" x={x(item)} y={Math.max(y(item.value) - 10, 12)}>
              {numberFormatter.format(item.value)} cm
            </text>
            <text fill="#64748b" fontSize="10" textAnchor="middle" x={x(item)} y={height - 16}>
              {history.filter((candidate) => candidate.date === item.date).length > 1
                ? timeFormatter.format(new Date(item.occurredAt))
                : formatGraphDate(item.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function MetricHistoryCard({
  field,
  view,
}: {
  field: PerimetryRegion["fields"][number];
  view: NutritionFollowUpView;
}) {
  const key = field.key as PerimetryMetricKey;
  const history = metricHistory(view, key);
  const first = history[0];
  const latest = history.at(-1);
  const difference = history.length > 1 && first && latest
    ? latest.value - first.value
    : undefined;
  const presentation = metricPresentation(key);
  const missingCount = view.evaluations.length - history.length;

  if (history.length === 1 && first) {
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-perimetry-metric={key}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: presentation.color }} />
              <h4 className="text-sm font-black text-slate-950">{field.label}</h4>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">{presentation.side}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${first.status === "FINALIZED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{statusLabel(first.status)}</span>
        </div>
        <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">{numberFormatter.format(first.value)} <span className="text-sm text-slate-600">cm</span></p>
        <p className="mt-1 text-xs font-semibold text-slate-600">{first.label}</p>
        <p className="mt-3 text-xs font-black text-sky-800">Uma medição disponível nesta seleção</p>
        {missingCount ? <p className="mt-1 text-xs leading-5 text-slate-500">Sem valor em {missingCount} {missingCount === 1 ? "avaliação selecionada" : "avaliações selecionadas"}; nenhuma avaliação desmarcada foi usada.</p> : null}
      </article>
    );
  }

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm" data-perimetry-metric={key}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: presentation.color }} />
            <h4 className="text-base font-black text-slate-950">{field.label}</h4>
          </div>
          <p className="mt-1 text-xs text-slate-500">{presentation.side} · definição preservada como registrada.</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          {difference === undefined
            ? "Diferença: dados insuficientes"
            : `Diferença: ${difference > 0 ? "+" : ""}${numberFormatter.format(difference)} cm · ${first!.label} → ${latest!.label}`}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-white/80 p-3 text-xs shadow-sm">
        <div><dt className="text-slate-500">Inicial</dt><dd className="mt-1 font-black text-slate-950">{numberFormatter.format(first!.value)} cm</dd><dd className="mt-0.5 text-[10px] text-slate-500">{first!.label}</dd></div>
        <div className="rounded-lg px-2 py-1 text-center" style={{ backgroundColor: `${presentation.color}0d` }}><dt className="text-slate-500">Mais recente</dt><dd className="mt-1 text-base font-black text-slate-950">{numberFormatter.format(latest!.value)} cm</dd><dd className="mt-0.5 text-[10px] text-slate-500">{latest!.label}</dd></div>
        <div className="text-right"><dt className="text-slate-500">Diferença</dt><dd className="mt-1 font-black text-slate-950">{difference === undefined ? "Não calculável" : `${difference > 0 ? "+" : ""}${numberFormatter.format(difference)} cm`}</dd></div>
      </dl>
      {missingCount ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">A medida está ausente em {missingCount} {missingCount === 1 ? "avaliação selecionada" : "avaliações selecionadas"}. Nenhuma avaliação desmarcada foi usada.</p>
      ) : null}
      {history.length === 2 ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Comparação com base zero</p>
          {history.map((item) => {
            const maximum = Math.max(...history.map((candidate) => candidate.value), 1);
            return (
              <div key={`${key}-bar-${item.id}`}>
                <div className="mb-1 flex items-end justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-600">{item.label} · {statusLabel(item.status)}</span>
                  <strong className="shrink-0 tabular-nums text-slate-950">{numberFormatter.format(item.value)} cm</strong>
                </div>
                <div aria-label={`${field.label}: ${numberFormatter.format(item.value)} cm, escala iniciada em zero`} className="h-3 overflow-hidden rounded-full bg-slate-200" role="img">
                  <div className="h-full rounded-full" style={{ backgroundColor: presentation.color, width: `${Math.max((item.value / maximum) * 100, 1)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : history.length >= 3 ? (
        <MetricChart color={presentation.color} history={history} label={field.label} />
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-600" aria-label="Status das medições">
        {history.map((item) => (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1" key={`${key}-${item.id}`}>{item.label}: {statusLabel(item.status)}</span>
        ))}
      </div>
    </article>
  );
}

function ageAtDate(birthDate: string, evaluationDate: string) {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const evaluation = new Date(`${evaluationDate}T00:00:00.000Z`);
  let age = evaluation.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    evaluation.getUTCMonth() < birth.getUTCMonth() ||
    (evaluation.getUTCMonth() === birth.getUTCMonth() &&
      evaluation.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function referenceScope(view: NutritionFollowUpView, evaluation: NutritionFollowUpEvaluation) {
  if (ageAtDate(view.patient.birthDate, evaluation.date) < 18) {
    return "Classificação não aplicada: avaliação fora do escopo adulto da referência.";
  }
  if (view.patient.sex !== "FEMALE" && view.patient.sex !== "MALE") {
    return "Classificação não aplicada: sexo feminino ou masculino não registrado; nenhuma categoria foi deduzida.";
  }
  return undefined;
}

function waistClassification(view: NutritionFollowUpView, evaluation: NutritionFollowUpEvaluation) {
  const unavailable = referenceScope(view, evaluation);
  if (unavailable) return unavailable;
  const waist = evaluation.perimetryMeasurements.waistCm;
  if (waist === undefined) return "Classificação não aplicada: cintura não registrada.";
  if (view.patient.sex === "FEMALE") {
    if (waist > 88) return "Risco de complicações metabólicas substancialmente aumentado (>88 cm).";
    if (waist > 80) return "Risco de complicações metabólicas aumentado (>80 cm).";
    return "Abaixo do limiar >80 cm desta referência.";
  }
  if (waist > 102) return "Risco de complicações metabólicas substancialmente aumentado (>102 cm).";
  if (waist > 94) return "Risco de complicações metabólicas aumentado (>94 cm).";
  return "Abaixo do limiar >94 cm desta referência.";
}

function ratioClassification(view: NutritionFollowUpView, evaluation: NutritionFollowUpEvaluation) {
  const unavailable = referenceScope(view, evaluation);
  if (unavailable) return unavailable;
  const waist = evaluation.perimetryMeasurements.waistCm;
  const hip = evaluation.perimetryMeasurements.hipCm;
  if (waist === undefined || hip === undefined || hip <= 0) {
    return "Classificação não aplicada: cintura e quadril válidos da mesma avaliação são necessários.";
  }
  const ratio = waist / hip;
  const threshold = view.patient.sex === "FEMALE" ? 0.85 : 0.9;
  const thresholdLabel = view.patient.sex === "FEMALE" ? "0,85" : "0,90";
  return ratio >= threshold
    ? `Risco de complicações metabólicas substancialmente aumentado (≥${thresholdLabel}).`
    : `Abaixo do limiar ≥${thresholdLabel} desta referência.`;
}

function WaistHipRatioSection({ view }: { view: NutritionFollowUpView }) {
  const evaluations = view.evaluations.filter(
    (evaluation) => evaluation.perimetryStatus !== undefined,
  );

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 sm:p-5" aria-labelledby="waist-hip-ratio-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Referência antropométrica</p>
          <h3 className="mt-1 text-xl font-black text-slate-950" id="waist-hip-ratio-title">Cintura, quadril e RCQ</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
            RCQ = cintura ÷ quadril, calculada somente quando as duas medidas válidas pertencem à mesma avaliação. Estes indicadores não constituem diagnóstico nem cálculo completo de risco cardiovascular.
          </p>
        </div>
        <a className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-sky-300 bg-white px-4 text-sm font-black text-sky-900 hover:bg-sky-100" href={whoSourceUrl} rel="noreferrer" target="_blank">
          Fonte: OMS, relatório de 2008
        </a>
      </div>
      <div className="mt-4 rounded-xl border border-sky-200 bg-white p-3 text-xs leading-5 text-slate-700">
        <p><strong>Mulheres adultas:</strong> cintura &gt;80 cm (risco aumentado), &gt;88 cm (substancialmente aumentado); RCQ ≥0,85 (substancialmente aumentado).</p>
        <p className="mt-1"><strong>Homens adultos:</strong> cintura &gt;94 cm (risco aumentado), &gt;102 cm (substancialmente aumentado); RCQ ≥0,90 (substancialmente aumentado).</p>
        <p className="mt-1 text-slate-600">Referência inicial do Anexo A, Tabela A1. O relatório ressalta variações por população, etnia, idade e protocolo; os pontos de cintura foram apresentados como exemplo baseado em adultos caucasianos, não como classificação universal.</p>
      </div>
      {evaluations.length ? (
        <div className="mt-4 space-y-3">
          {evaluations.map((evaluation) => {
            const waist = evaluation.perimetryMeasurements.waistCm;
            const hip = evaluation.perimetryMeasurements.hipCm;
            const ratio = waist !== undefined && hip !== undefined && hip > 0
              ? waist / hip
              : undefined;
            const status = evaluation.perimetryStatus ?? evaluation.status;
            return (
              <article className="rounded-xl border border-slate-200 bg-white p-4" key={`rcq-${evaluation.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-black text-slate-950">{evaluationLabel(view, evaluation)}</h4>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${status === "FINALIZED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{statusLabel(status)}</span>
                </div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div><dt className="text-xs text-slate-500">Cintura</dt><dd className="font-black text-slate-900">{waist === undefined ? "Não registrada" : `${numberFormatter.format(waist)} cm`}</dd></div>
                  <div><dt className="text-xs text-slate-500">Quadril</dt><dd className="font-black text-slate-900">{hip === undefined ? "Não registrado" : `${numberFormatter.format(hip)} cm`}</dd></div>
                  <div><dt className="text-xs text-slate-500">RCQ</dt><dd className="font-black text-slate-900">{ratio === undefined ? "Não calculável" : numberFormatter.format(ratio)}</dd></div>
                </dl>
                <p className="mt-3 text-xs font-semibold leading-5 text-slate-700"><strong>Cintura:</strong> {waistClassification(view, evaluation)}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-700"><strong>RCQ:</strong> {ratioClassification(view, evaluation)}</p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Cintura e quadril não foram registrados. A RCQ não foi calculada e nenhuma classificação foi aplicada.</p>
      )}
    </section>
  );
}

export function resolvePerimetrySelection(
  view: NutritionFollowUpView,
  requestedRegionKey?: string,
  requestedMetricKeys?: readonly string[],
): PerimetrySelection {
  const regionsWithData = perimetryGroups.filter((group) =>
    group.fields.some((field) =>
      metricHistory(view, field.key as PerimetryMetricKey).length > 0,
    ),
  );
  const region = regionsWithData.find((candidate) => candidate.key === requestedRegionKey)
    ?? regionsWithData.find((candidate) => candidate.key === "trunk")
    ?? regionsWithData[0];
  if (!region) return { regionKey: "", metricKeys: [] };
  const availableKeys = region.fields
    .filter((field) => metricHistory(view, field.key as PerimetryMetricKey).length > 0)
    .map((field) => field.key as PerimetryMetricKey);
  const requested = requestedMetricKeys === undefined
    ? availableKeys
    : availableKeys.filter((key) => requestedMetricKeys.includes(key));
  return { regionKey: region.key, metricKeys: requested };
}

export function PerimetryEvolutionPanel({
  view,
  presentationMode = false,
  selection,
  onSelectionChange,
}: {
  view: NutritionFollowUpView;
  presentationMode?: boolean;
  selection: PerimetrySelection;
  onSelectionChange?: (selection: PerimetrySelection) => void;
}) {
  const regionsWithData = useMemo(
    () => perimetryGroups.filter((group) =>
      group.fields.some((field) => metricHistory(view, field.key as PerimetryMetricKey).length > 0),
    ),
    [view],
  );
  const selectedRegion = regionsWithData.find((region) => region.key === selection.regionKey);
  const availableKeys = useMemo(
    () => selectedRegion?.fields
      .filter((field) => metricHistory(view, field.key as PerimetryMetricKey).length > 0)
      .map((field) => field.key as PerimetryMetricKey) ?? [],
    [selectedRegion, view],
  );
  const selectedKeys = selection.metricKeys.filter((key) => availableKeys.includes(key));
  const renderedRegions = selectedRegion ? [selectedRegion] : [];

  return (
    <div className="space-y-6">
      <WaistHipRatioSection view={view} />
      <section aria-labelledby="regional-perimetry-title" className="space-y-4">
        <div className="evaluation-section-heading">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Perimetria por região</p>
          <h3 className="mt-1 text-xl font-black text-slate-950" id="regional-perimetry-title">Evolução das circunferências</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Cada série mantém a definição e o lado registrados. Ausências não são convertidas em zero.</p>
          <div aria-label="Legenda de lateralidade" className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-600" />Lado direito</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-orange-600" />Lado esquerdo</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-violet-600" />Medida central</span>
          </div>
        </div>
        {!regionsWithData.length ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Não há medidas de Perimetria salvas para demonstrar evolução.</p>
        ) : null}
        {!presentationMode && regionsWithData.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <fieldset>
              <legend className="text-sm font-black text-slate-900">Selecionar região</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {regionsWithData.map((region) => (
                  <button className={`min-h-10 rounded-full border px-4 text-xs font-black ${selectedRegion?.key === region.key ? "border-sky-700 bg-sky-700 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300"}`} key={region.key} onClick={() => {
                    onSelectionChange?.(resolvePerimetrySelection(view, region.key));
                  }} type="button">{region.title}</button>
                ))}
              </div>
            </fieldset>
            {selectedRegion ? (
              <fieldset className="mt-4 border-t border-slate-100 pt-4">
                <legend className="text-sm font-black text-slate-900">Selecionar medidas</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {selectedRegion.fields.filter((field) => availableKeys.includes(field.key as PerimetryMetricKey)).map((field) => {
                    const key = field.key as PerimetryMetricKey;
                    return (
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700" key={key}>
                        <input checked={selectedKeys.includes(key)} className="size-4 accent-sky-700" onChange={(event) => {
                          const next = new Set(selectedKeys);
                          if (event.target.checked) next.add(key);
                          else next.delete(key);
                          onSelectionChange?.({
                            regionKey: selectedRegion.key,
                            metricKeys: availableKeys.filter((availableKey) => next.has(availableKey)),
                          });
                        }} type="checkbox" />
                        {field.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
          </div>
        ) : null}
        {renderedRegions.map((region) => {
          const fields = region.fields.filter((field) =>
            metricHistory(view, field.key as PerimetryMetricKey).length > 0 &&
            selectedKeys.includes(field.key as PerimetryMetricKey),
          );
          return (
            <section className="evaluation-perimetry-region space-y-3" data-perimetry-region={region.key} key={region.key} aria-labelledby={`perimetry-region-${region.key}`}>
              <h4 className="text-lg font-black text-slate-900" id={`perimetry-region-${region.key}`}>{region.title}</h4>
              {fields.length ? <div className="grid gap-3 xl:grid-cols-2 print:grid-cols-2">{fields.map((field) => <MetricHistoryCard field={field} key={String(field.key)} view={view} />)}</div> : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Selecione ao menos uma medida desta região.</p>
              )}
            </section>
          );
        })}
      </section>
    </div>
  );
}
