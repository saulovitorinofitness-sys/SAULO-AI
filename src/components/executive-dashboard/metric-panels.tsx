import { Card, SectionHeader } from "@/components/ui";
import type { ExecutiveMetric } from "@/features/executive-dashboard";

function MetricPanel({ title, description, metrics }: { title: string; description: string; metrics: readonly ExecutiveMetric[] }) {
  return <Card className="p-5 md:p-6"><SectionHeader description={description} title={title} /><dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">{metrics.map((metric) => <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5" key={metric.id}><dt className="text-xs font-bold text-[var(--muted)]">{metric.label}</dt><dd className="mt-1 text-lg font-black text-[var(--text-primary)]">{metric.value}</dd>{metric.context ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{metric.context}</p> : null}</div>)}</dl></Card>;
}

export function ClinicMetrics({ metrics }: { metrics: readonly ExecutiveMetric[] }) { return <MetricPanel description="Atendimento e desempenho comercial demonstrativos." metrics={metrics} title="Indicadores da Clínica" />; }
export function GymMetrics({ metrics }: { metrics: readonly ExecutiveMetric[] }) { return <MetricPanel description="Dados provenientes da última importação demonstrativa." metrics={metrics} title="Indicadores da Academia" />; }
export function MarketingMetrics({ metrics }: { metrics: readonly ExecutiveMetric[] }) { return <MetricPanel description="Atividade e aquisição registradas no mock executivo." metrics={metrics} title="Marketing" />; }
