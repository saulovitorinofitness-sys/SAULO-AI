import type { ClinicalDecisionAlertLevel, ClinicalDecisionReviewStatus } from "@/features/clinical-decision";

const levelStyle = { INFORMATIVE: "bg-sky-50 text-sky-800 ring-sky-200", ATTENTION: "bg-amber-50 text-amber-900 ring-amber-200", PRIORITY: "bg-rose-50 text-rose-800 ring-rose-200" } as const;
const statusStyle = { PENDING: "bg-amber-50 text-amber-900 ring-amber-200", IN_REVIEW: "bg-sky-50 text-sky-800 ring-sky-200", RESOLVED: "bg-emerald-50 text-emerald-800 ring-emerald-200", NOT_APPLICABLE: "bg-slate-100 text-slate-700 ring-slate-200" } as const;
const labels = { INFORMATIVE: "Informativo", ATTENTION: "Atenção", PRIORITY: "Prioritário", PENDING: "Pendente", IN_REVIEW: "Em revisão", RESOLVED: "Resolvida", NOT_APPLICABLE: "Não aplicável" } as const;

export function ClinicalDecisionStatusBadge({ value }: { value: ClinicalDecisionAlertLevel | ClinicalDecisionReviewStatus }) {
  const style = value in levelStyle ? levelStyle[value as ClinicalDecisionAlertLevel] : statusStyle[value as ClinicalDecisionReviewStatus];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${style}`}>{labels[value]}</span>;
}
