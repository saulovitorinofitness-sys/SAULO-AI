import { Card, Progress, SectionHeader, StatusBadge } from "@/components/ui";
import type { ExecutiveIntelligenceSummary } from "@/features/executive-intelligence";

const statusMap = {
  on_track: { status: "success", label: "Dentro do acompanhamento" },
  attention: { status: "attention", label: "Requer atenção" },
  priority: { status: "priority", label: "Prioridade operacional" },
} as const;

export function ExecutiveSummary({ summary }: { summary: ExecutiveIntelligenceSummary }) {
  const state = statusMap[summary.status];
  const metrics = [
    ["Receita", summary.revenue], ["Despesas", summary.expenses], ["Lucro", summary.profit], ["Meta", summary.goal],
  ] as const;
  return <Card className="overflow-hidden" variant="elevated"><div className="border-b border-[var(--line)] bg-[var(--brand-strong)] p-5 text-white md:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Resumo executivo</p><h1 className="mt-1 text-2xl font-black tracking-tight">{summary.week}</h1><p className="mt-1 text-sm text-emerald-50">{summary.period} · dados demonstrativos</p></div><StatusBadge label={state.label} status={state.status} /></div></div><div className="p-5 md:p-6"><SectionHeader description="Consolidação mockada da Clínica SV e da Academia Saulo Fitness." title="Resultado da semana" /><dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value]) => <div className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-4" key={label}><dt className="text-xs font-bold text-[var(--muted)]">{label}</dt><dd className="mt-1 text-xl font-black text-[var(--text-primary)]">{value}</dd></div>)}</dl><div className="mt-5 rounded-[var(--radius-medium)] border border-[var(--line)] p-4"><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-[var(--text-secondary)]">Percentual da meta</span><strong className="text-[var(--text-primary)]">{summary.goalPercent}%</strong></div><Progress label={`${summary.goalPercent}% da meta demonstrativa atingida`} value={summary.goalPercent} /></div></div></Card>;
}

