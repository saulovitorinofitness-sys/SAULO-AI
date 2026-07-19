import type { AnthropometryAssessmentStatus } from "@/features/anthropometry-perimetry";

const labels: Readonly<Record<AnthropometryAssessmentStatus, string>> = { NOT_STARTED: "Não iniciada", IN_PROGRESS: "Em preenchimento", COMPLETED: "Concluída", REVIEWED: "Revisada" };
const styles: Readonly<Record<AnthropometryAssessmentStatus, string>> = { NOT_STARTED: "bg-slate-100 text-slate-700", IN_PROGRESS: "bg-amber-100 text-amber-900", COMPLETED: "bg-emerald-100 text-emerald-800", REVIEWED: "bg-sky-100 text-sky-800" };

export function AssessmentStatusBadge({ status }: { status: AnthropometryAssessmentStatus }) {
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${styles[status]}`}>{labels[status]}</span>;
}

