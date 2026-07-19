import { Card, SectionHeader, StatusBadge } from "@/components/ui";
import type { BusinessAreaSummary } from "@/features/executive-intelligence";

const statuses = {
  on_track: { status: "success", label: "Acompanhado" }, attention: { status: "attention", label: "Atenção" }, priority: { status: "priority", label: "Prioridade" },
} as const;

function BusinessSummary({ area }: { area: BusinessAreaSummary }) {
  const state = statuses[area.status];
  return <Card className="p-5 md:p-6"><SectionHeader action={<StatusBadge label={state.label} status={state.status} />} description={area.description} title={area.title} /><dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{area.metrics.map((metric) => <div className="min-w-0 rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5" key={metric.id}><dt className="text-xs font-bold text-[var(--muted)]">{metric.label}</dt><dd className="mt-1 break-words text-lg font-black text-[var(--text-primary)]">{metric.value}</dd>{metric.context ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{metric.context}</p> : null}</div>)}</dl><p className="mt-4 border-t border-[var(--line)] pt-3 text-xs font-bold text-[var(--text-secondary)]">Comparativo: {area.comparison}</p></Card>;
}

export function ClinicSummary({ area }: { area: BusinessAreaSummary }) { return <BusinessSummary area={area} />; }
export function GymSummary({ area }: { area: BusinessAreaSummary }) { return <BusinessSummary area={area} />; }
export function FinancialSummary({ area }: { area: BusinessAreaSummary }) { return <BusinessSummary area={area} />; }
export function MarketingSummary({ area }: { area: BusinessAreaSummary }) { return <BusinessSummary area={area} />; }
export function CommercialSummary({ area }: { area: BusinessAreaSummary }) { return <BusinessSummary area={area} />; }

