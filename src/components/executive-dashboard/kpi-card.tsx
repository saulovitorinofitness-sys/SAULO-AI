import { Card } from "@/components/ui";
import type { ExecutiveKpi } from "@/features/executive-dashboard";

const toneStyles: Record<ExecutiveKpi["tone"], string> = {
  neutral: "border-l-slate-300",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  info: "border-l-sky-500",
};

export function KpiCard({ metric }: { metric: ExecutiveKpi }) {
  return <Card className={`border-l-4 p-4 ${toneStyles[metric.tone]}`}><p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{metric.label}</p><p className="mt-2 text-2xl font-black tracking-tight text-[var(--text-primary)]">{metric.value}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{metric.context}</p></Card>;
}

