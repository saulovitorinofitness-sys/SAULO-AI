import type { ClinicalDecisionArea, ClinicalDecisionEvidence } from "@/features/clinical-decision";
import { CollapsibleClinicalSection } from "@/components/clinical-panel/collapsible-clinical-section";
import { ClinicalDecisionEmptyState } from "./clinical-decision-empty-state";

const areaLabels: Readonly<Record<ClinicalDecisionArea, string>> = { GENERAL: "Identificação", CLINICAL_HISTORY: "Histórico Clínico", NUTRITION: "Nutrição", PHYSICAL_EDUCATION: "Educação Física", PHYSICAL_ASSESSMENT: "Avaliação Física e Antropometria", BIOIMPEDANCE: "Bioimpedância Avanutri", PERIMETRY: "Perimetria", POSTURAL_ASSESSMENT: "Avaliação Postural", LABORATORY: "Exames Laboratoriais" };
export function ClinicalEvidenceSummary({ evidences }: { evidences: readonly ClinicalDecisionEvidence[] }) {
  if (!evidences.length) return <ClinicalDecisionEmptyState title="Sem evidências disponíveis" description="O mock atual não disponibilizou registros para esta análise." />;
  const groups = Object.entries(Object.groupBy(evidences, (item) => item.area)) as [ClinicalDecisionArea, ClinicalDecisionEvidence[]][];
  return <div className="space-y-3">{groups.map(([area, items], index) => <CollapsibleClinicalSection key={area} title={`${areaLabels[area]} · ${items.length}`}><dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div className="rounded-xl bg-[#f7faf8] p-3.5" key={item.id}><dt className="text-xs font-semibold text-slate-500">{item.label}</dt><dd className="mt-1 text-sm font-black text-slate-800">{item.value}</dd><p className="mt-2 text-[11px] leading-4 text-slate-500">Origem: {item.source}{item.recordedBy ? ` · ${item.recordedBy}` : ""}</p></div>)}</dl>{index === 0 ? <p className="sr-only">Dados reaproveitados do mesmo Prontuário Mestre.</p> : null}</CollapsibleClinicalSection>)}</div>;
}
