import { Card, SectionHeader, StatusBadge } from "@/components/ui";
import type { ExecutiveAlert } from "@/features/executive-dashboard";

const status = { information: "informative", attention: "attention", priority: "priority" } as const;
const area = { clinic: "Clínica", academy: "Academia", marketing: "Marketing", operations: "Operações" } as const;

export function AlertPanel({ alerts }: { alerts: readonly ExecutiveAlert[] }) {
  return <Card className="p-5 md:p-6"><SectionHeader description="Sinais operacionais mockados que aguardam conferência de Saulo." title="Alertas" /><ul className="mt-5 grid gap-3" role="list">{alerts.map((alert) => <li className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4" key={alert.id}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-[var(--text-primary)]">{alert.title}</h3><StatusBadge label={alert.level === "information" ? "Informação" : alert.level === "attention" ? "Atenção" : "Prioridade"} status={status[alert.level]} /></div><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{alert.description}</p><p className="mt-2 text-xs font-bold text-[var(--muted)]">Área: {area[alert.area]}</p></li>)}</ul></Card>;
}

