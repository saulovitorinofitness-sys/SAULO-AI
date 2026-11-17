import type { NutritionFollowUpEvaluation } from "@/features/nutrition-follow-up/service";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});
const graphDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const metrics = [
  ["bodyFatPercent", "Gordura corporal", "%", "#7c3aed"],
  ["fatMassKg", "Massa de gordura", "kg", "#ea580c"],
  ["fatFreeMassKg", "Massa livre de gordura", "kg", "#0f766e"],
  ["skeletalMuscleMassKg", "Massa muscular esquelética", "kg", "#0369a1"],
  ["totalBodyWaterL", "Água corporal total", "L", "#2563eb"],
  ["visceralFatLevel", "Gordura visceral", "nível", "#d97706"],
] as const;

type CompositionMetricKey = (typeof metrics)[number][0];

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatGraphDate(value: string) {
  return graphDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatMetricValue(key: CompositionMetricKey, value: number, unit: string) {
  return key === "visceralFatLevel"
    ? `Nível ${numberFormatter.format(value)}`
    : `${numberFormatter.format(value)} ${unit}`;
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${numberFormatter.format(Math.abs(value))}`;
}

function formatMetricDifference(key: CompositionMetricKey, value: number, unit: string) {
  if (key === "bodyFatPercent") return `${formatSigned(value)} p.p.`;
  if (key === "visceralFatLevel") {
    return `${formatSigned(value)} ${Math.abs(value) === 1 ? "nível" : "níveis"}`;
  }
  return `${formatSigned(value)} ${unit}`;
}

function evaluationLabel(
  evaluation: NutritionFollowUpEvaluation,
  evaluations: readonly NutritionFollowUpEvaluation[],
) {
  const date = formatDate(evaluation.date);
  return evaluations.filter((item) => item.date === evaluation.date).length > 1
    ? `${date} · ${timeFormatter.format(new Date(evaluation.occurredAt))} · ${evaluation.bodyComposition?.method ?? "Método não informado"}`
    : date;
}

function CompositionTimeline({
  metricKey,
  label,
  unit,
  color,
  points,
}: {
  metricKey: CompositionMetricKey;
  label: string;
  unit: string;
  color: string;
  points: readonly { evaluation: NutritionFollowUpEvaluation; value: number }[];
}) {
  const width = 380;
  const height = 232;
  const plot = { left: 52, right: 44, top: 38, bottom: 46 };
  const timestamps = points.map(({ evaluation }) => new Date(evaluation.occurredAt).getTime());
  const firstTimestamp = Math.min(...timestamps);
  const lastTimestamp = Math.max(...timestamps);
  const values = points.map((point) => point.value);
  const minimumValue = Math.min(...values);
  const maximumValue = Math.max(...values);
  const padding = Math.max((maximumValue - minimumValue) * 0.15, 0.5);
  const minimum = Math.max(0, minimumValue - padding);
  const maximum = maximumValue + padding;
  const x = (evaluation: NutritionFollowUpEvaluation) => {
    const timestamp = new Date(evaluation.occurredAt).getTime();
    return firstTimestamp === lastTimestamp
      ? width / 2
      : plot.left + ((timestamp - firstTimestamp) * (width - plot.left - plot.right)) / (lastTimestamp - firstTimestamp);
  };
  const y = (value: number) => plot.top + ((maximum - value) * (height - plot.top - plot.bottom)) / Math.max(maximum - minimum, 1);
  const polyline = points.map((point) => `${x(point.evaluation)},${y(point.value)}`).join(" ");
  const evaluations = points.map((point) => point.evaluation);

  return (
    <div className="evaluation-trend-chart mt-3 overflow-x-auto">
      <svg aria-label={`Evolução cronológica de ${label}`} className="evaluation-trend-chart-svg w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
      {[0, 1, 2, 3].map((tick) => {
        const value = minimum + ((maximum - minimum) * tick) / 3;
        const tickY = y(value);
        return <g key={tick}><line stroke="#e2e8f0" x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} /><text fill="#64748b" fontSize="9" textAnchor="end" x={plot.left - 8} y={tickY + 3}>{numberFormatter.format(value)}</text></g>;
      })}
      <polygon fill={color} fillOpacity="0.08" points={`${x(points[0].evaluation)},${height - plot.bottom} ${polyline} ${x(points.at(-1)!.evaluation)},${height - plot.bottom}`} />
      <polyline fill="none" points={polyline} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {points.map((point, index) => {
        const isFirst = index === 0;
        const isLast = index === points.length - 1;
        const valueX = x(point.evaluation) + (isFirst ? 8 : isLast ? -8 : 0);
        const valueAnchor = isFirst ? "start" : isLast ? "end" : "middle";
        return (
        <g key={point.evaluation.id}>
          <circle cx={x(point.evaluation)} cy={y(point.value)} fill="white" r="5" stroke={color} strokeWidth="3">
            <title>{`${label}: ${formatMetricValue(metricKey, point.value, unit)} em ${evaluationLabel(point.evaluation, evaluations)}`}</title>
          </circle>
          <text fill={color} fontSize="9" fontWeight="700" textAnchor={valueAnchor} x={valueX} y={Math.max(y(point.value) - 9, 12)}>{metricKey === "visceralFatLevel" ? `N. ${numberFormatter.format(point.value)}` : numberFormatter.format(point.value)}</text>
          <text fill="#64748b" fontSize="9" textAnchor="middle" x={x(point.evaluation)} y={height - 14}>{formatGraphDate(point.evaluation.date)}</text>
        </g>
        );
      })}
      </svg>
    </div>
  );
}

export function BodyCompositionComparisonPanel({
  evaluations,
}: {
  evaluations: readonly NutritionFollowUpEvaluation[];
}) {
  const withComposition = evaluations.filter(
    (evaluation) => evaluation.bodyComposition,
  );

  if (!withComposition.length) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-black text-amber-950">Composição corporal não registrada</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          As avaliações selecionadas não possuem resultados de composição corporal. Ausências não foram convertidas em zero nem estimadas.
        </p>
      </section>
    );
  }

  const first = withComposition[0];
  const latest = withComposition.at(-1)!;
  const missingCompositionCount = evaluations.length - withComposition.length;

  return (
    <div className="space-y-5">
      {withComposition.length === 1 ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-950">
          Uma medição disponível nesta seleção · {evaluationLabel(first, withComposition)} · {first.status === "FINALIZED" ? "Finalizada" : "Rascunho"}.
        </p>
      ) : null}
      {missingCompositionCount ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          A composição corporal está ausente em {missingCompositionCount} {missingCompositionCount === 1 ? "avaliação selecionada" : "avaliações selecionadas"}. Nenhuma avaliação desmarcada foi usada para preencher a ausência.
        </p>
      ) : null}
      <section aria-labelledby="composition-indicators-title">
        <div className="evaluation-section-heading flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Indicadores registrados</p>
            <h2 className="mt-1 text-xl font-black text-slate-950" id="composition-indicators-title">Primeira × última selecionada</h2>
          </div>
          <p className="text-xs font-semibold text-slate-500">{evaluationLabel(first, withComposition)} → {evaluationLabel(latest, withComposition)}</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map(([key, label, unit, color]) => {
            const points = withComposition.flatMap((evaluation) => {
              const value = evaluation.bodyComposition?.[key];
              return value === undefined ? [] : [{ evaluation, value }];
            });
            const firstPoint = points[0];
            const latestPoint = points.at(-1);
            const difference = points.length > 1 && firstPoint && latestPoint
              ? latestPoint.value - firstPoint.value
              : undefined;
            const missingCount = evaluations.length - points.length;
            return (
              <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm" key={key}>
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</h3>
                {points.length === 1 && firstPoint ? (
                  <div className="mt-3">
                    <p className="text-2xl font-black tabular-nums text-slate-950">{formatMetricValue(key, firstPoint.value, unit)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{evaluationLabel(firstPoint.evaluation, withComposition)} · {firstPoint.evaluation.status === "FINALIZED" ? "Finalizada" : "Rascunho"}</p>
                    <p className="mt-2 text-xs font-black text-sky-800">Uma medição disponível nesta seleção</p>
                  </div>
                ) : (
                  <>
                    <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-white/80 p-2 text-xs shadow-sm">
                      <div><dt className="text-slate-500">Inicial</dt><dd className="mt-1 font-black text-slate-900">{firstPoint ? formatMetricValue(key, firstPoint.value, unit) : "Não registrado"}</dd><dd className="mt-0.5 text-[10px] text-slate-500">{firstPoint ? evaluationLabel(firstPoint.evaluation, withComposition) : null}</dd></div>
                      <div className="rounded-lg px-2 py-1 text-center" style={{ backgroundColor: `${color}0d` }}><dt className="text-slate-500">Mais recente</dt><dd className="mt-1 text-base font-black text-slate-950">{latestPoint ? formatMetricValue(key, latestPoint.value, unit) : "Não registrado"}</dd><dd className="mt-0.5 text-[10px] text-slate-500">{latestPoint ? evaluationLabel(latestPoint.evaluation, withComposition) : null}</dd></div>
                      <div className="text-right"><dt className="text-slate-500">Diferença</dt><dd className="mt-1 font-black text-slate-700">{difference === undefined ? "Não calculável" : formatMetricDifference(key, difference, unit)}</dd></div>
                    </dl>
                    {points.length === 2 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Comparação com base zero</p>
                        {points.map((point) => {
                          const maximum = Math.max(...points.map((item) => item.value), 1);
                          return (
                            <div key={`${key}-bar-${point.evaluation.id}`}>
                              <div className="mb-1 flex justify-between gap-2 text-[10px] font-semibold text-slate-600"><span>{evaluationLabel(point.evaluation, withComposition)} · {point.evaluation.status === "FINALIZED" ? "Finalizada" : "Rascunho"}</span><strong className="text-slate-950">{formatMetricValue(key, point.value, unit)}</strong></div>
                              <div aria-label={`${label}: ${formatMetricValue(key, point.value, unit)}, escala iniciada em zero`} className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="img"><div className="h-full rounded-full" style={{ backgroundColor: color, width: `${Math.max((point.value / maximum) * 100, 1)}%` }} /></div>
                            </div>
                          );
                        })}
                      </div>
                    ) : points.length >= 3 ? <CompositionTimeline color={color} label={label} metricKey={key} points={points} unit={unit} /> : null}
                  </>
                )}
                {missingCount ? <p className="mt-3 text-xs leading-5 text-slate-500">Medida ausente em {missingCount} {missingCount === 1 ? "avaliação selecionada" : "avaliações selecionadas"}; nenhum dado desmarcado foi usado.</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="composition-history-title" className="space-y-3">
        <div className="evaluation-section-heading">
          <h2 className="text-xl font-black text-slate-950" id="composition-history-title">Resultados por avaliação</h2>
          <p className="mt-1 text-sm text-slate-600">Método, equipamento, status e ausências são apresentados conforme o registro de origem.</p>
        </div>
        {withComposition.map((evaluation) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={evaluation.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-black text-slate-950">{evaluationLabel(evaluation, withComposition)}</h3>
                <p className="mt-1 text-xs font-bold text-sky-800">Método: {evaluation.bodyComposition!.method}</p>
                <p className="mt-1 text-xs text-slate-600">Equipamento: {evaluation.bodyComposition!.equipment}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${evaluation.status === "FINALIZED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                {evaluation.status === "FINALIZED" ? "Finalizada" : "Rascunho"}
              </span>
            </div>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.map(([key, label, unit, color]) => {
                const value = evaluation.bodyComposition?.[key];
                return (
                  <div className="rounded-xl border-l-2 bg-slate-50 p-3" key={key} style={{ borderLeftColor: color }}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 text-sm font-black text-slate-900">{value === undefined ? "Não registrado" : formatMetricValue(key, value, unit)}</dd>
                  </div>
                );
              })}
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
