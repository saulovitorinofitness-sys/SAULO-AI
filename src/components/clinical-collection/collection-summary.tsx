import Link from "next/link";

import type { ClinicalCollectionView, ClinicalCollectionStepKey } from "@/features/clinical-collection";
import { clinicalStepLabels } from "@/features/clinical-collection";
import { CheckIcon } from "@/components/ui/icons";
import { CompletionBadge } from "./completion-badge";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";
import { SectionCard } from "./section-card";

const steps = ["ANTHROPOMETRY", "BIOIMPEDANCE", "PERIMETRY", "POSTURAL_ASSESSMENT"] as const;
const recordKey = { ANTHROPOMETRY: "anthropometry", BIOIMPEDANCE: "bioimpedance", PERIMETRY: "perimetry", POSTURAL_ASSESSMENT: "posturalAssessment" } as const;

export function CollectionSummary({ collection, completing, onComplete, onCorrect }: { collection: ClinicalCollectionView; completing: boolean; onComplete: () => Promise<void>; onCorrect: (step: ClinicalCollectionStepKey) => void }) {
  const pending = steps.filter((step) => collection.records[recordKey[step]].status !== "COMPLETED");
  const missing = pending.flatMap((step) => collection.records[recordKey[step]].missingRequiredFields.map((field) => `${clinicalStepLabels[step]}: ${field}`));
  return (
    <div className="space-y-4">
      {collection.completed ? <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" role="status"><CheckIcon className="mt-0.5 shrink-0" /><div><p className="text-sm font-black">Coleta concluída no mock</p><p className="mt-1 text-xs">Próxima etapa: revisar e confirmar os dados no Painel Clínico Integrado. O Motor de Decisão será liberado somente após essa confirmação profissional.</p></div></div> : null}
      <PendingFieldsAlert fields={missing} />
      <SectionCard title="Situação das etapas">
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => { const record = collection.records[recordKey[step]]; return <button className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#9fc5b6]" key={step} onClick={() => onCorrect(step)} type="button"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-black text-slate-800">{clinicalStepLabels[step]}</span><CompletionBadge required={step === "POSTURAL_ASSESSMENT"} status={record.status} /></div><div className="mt-3"><ProfessionalAuditInfo audit={record.audit} origin={record.origin} /></div></button>; })}
        </div>
      </SectionCard>
      <SectionCard title="Principais dados registrados">
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold text-slate-500">Peso</dt><dd className="mt-1 text-lg font-black text-slate-900">{collection.records.anthropometry.data.weightKg ?? "—"} <span className="text-xs text-slate-400">kg</span></dd></div>
          <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold text-slate-500">Estatura</dt><dd className="mt-1 text-lg font-black text-slate-900">{collection.records.anthropometry.data.heightCm ?? "—"} <span className="text-xs text-slate-400">cm</span></dd></div>
          <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold text-slate-500">IMC</dt><dd className="mt-1 text-lg font-black text-slate-900">{collection.records.anthropometry.data.bmi ?? "—"}</dd></div>
          <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold text-slate-500">Gordura corporal Avanutri</dt><dd className="mt-1 text-lg font-black text-slate-900">{collection.records.bioimpedance.data.bodyFatPercent ?? "—"} <span className="text-xs text-slate-400">%</span></dd></div>
        </dl>
      </SectionCard>
      <ResponsiveActionBar>
        <button className="min-h-11 rounded-xl px-4 text-sm font-black text-slate-600 hover:bg-slate-100" onClick={() => onCorrect(collection.firstIncompleteStep === "SUMMARY" ? "ANTHROPOMETRY" : collection.firstIncompleteStep)} type="button">Voltar e corrigir</button>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50" href={`/pacientes/${collection.patientId}?scenario=${collection.scenario}`}>Voltar ao prontuário</Link>
        {collection.completed ? <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938]" href={`/pacientes/${collection.patientId}/atendimentos/${collection.attendanceId}/painel-clinico?scenario=${collection.scenario}`}>Abrir Painel Clínico</Link> : null}
        {!collection.completed ? <button className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:cursor-not-allowed disabled:bg-slate-300" disabled={collection.progressPercent < 100 || completing} onClick={onComplete} type="button">{completing ? "Concluindo..." : "Concluir coleta"}</button> : null}
      </ResponsiveActionBar>
    </div>
  );
}
