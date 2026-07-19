import { Card, SectionHeader, StatusBadge } from "@/components/ui";
import type { IntelligenceAlert } from "@/features/executive-intelligence";

const statusMap = { information: "informative", attention: "attention", priority: "priority" } as const;
const labels = { information: "Informação", attention: "Atenção", priority: "Prioridade" } as const;

export function AlertPanel({ alerts }: { alerts: readonly IntelligenceAlert[] }) {
  return <Card className="p-5 md:p-6"><SectionHeader description="Sinais empresariais demonstrativos para conferência humana." title="Alertas" /><ul className="mt-5 grid gap-3" role="list">{alerts.map((alert) => <li className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-4" key={alert.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-[var(--text-primary)]">{alert.title}</h3><p className="mt-1 text-xs font-bold text-[var(--muted)]">{alert.area}</p></div><StatusBadge label={labels[alert.level]} status={statusMap[alert.level]} /></div><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{alert.description}</p></li>)}</ul></Card>;
}

