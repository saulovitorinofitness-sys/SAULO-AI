import type { CollectionStepStatus } from "@/features/clinical-collection";

const statusConfig = {
  COMPLETED: { label: "Concluída", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  IN_PROGRESS: { label: "Em andamento", className: "border-amber-200 bg-amber-50 text-amber-800" },
  NOT_STARTED: { label: "Pendente", className: "border-slate-200 bg-slate-50 text-slate-600" },
};

export function CompletionBadge({ status, required = false }: { status: CollectionStepStatus; required?: boolean }) {
  const config = statusConfig[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${config.className}`}>{config.label}{required ? " · obrigatória" : ""}</span>;
}
