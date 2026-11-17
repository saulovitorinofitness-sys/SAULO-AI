import type { ReactNode } from "react";

const toneStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof toneStyles }) {
  return <span className={`inline-flex max-w-full flex-wrap items-center gap-1 whitespace-normal break-words rounded-[var(--radius-full)] border px-2.5 py-1 text-xs font-bold ${toneStyles[tone]}`}>{children}</span>;
}

export type StatusBadgeStatus = "active" | "inactive" | "completed" | "pending" | "in_progress" | "reviewed" | "blocked" | "unavailable" | "informative" | "attention" | "priority" | "success" | "error";
const statusConfig: Readonly<Record<StatusBadgeStatus, { label: string; tone: keyof typeof toneStyles; marker: string }>> = {
  active: { label: "Ativo", tone: "success", marker: "●" }, inactive: { label: "Inativo", tone: "neutral", marker: "○" }, completed: { label: "Concluído", tone: "success", marker: "✓" }, pending: { label: "Pendente", tone: "warning", marker: "•" }, in_progress: { label: "Em andamento", tone: "warning", marker: "…" }, reviewed: { label: "Revisado", tone: "info", marker: "✓" }, blocked: { label: "Bloqueado", tone: "neutral", marker: "×" }, unavailable: { label: "Indisponível", tone: "neutral", marker: "—" }, informative: { label: "Informativo", tone: "info", marker: "i" }, attention: { label: "Atenção", tone: "warning", marker: "!" }, priority: { label: "Prioridade", tone: "danger", marker: "!" }, success: { label: "Sucesso", tone: "success", marker: "✓" }, error: { label: "Erro", tone: "danger", marker: "!" },
};
export function StatusBadge({ status, label }: { status: StatusBadgeStatus; label?: string }) { const config = statusConfig[status]; return <Badge tone={config.tone}><span aria-hidden="true">{config.marker}</span>{label ?? config.label}</Badge>; }
