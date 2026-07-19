import type { ClinicalCollectionView, SaveState } from "@/features/clinical-collection";
import { clinicalStepLabels } from "@/features/clinical-collection";
import { SaveStatus } from "./save-status";

const consultationLabels = { INITIAL: "Consulta inicial", FOLLOW_UP: "Retorno", PHYSICAL_ASSESSMENT: "Avaliação física", POSTURAL_ASSESSMENT: "Avaliação postural", TRAINING: "Treinamento", NUTRITION: "Nutrição" } as const;

export function PatientContextHeader({ collection, saveState }: { collection: ClinicalCollectionView; saveState: SaveState }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[#103f32] text-white shadow-[0_16px_38px_rgb(10_73_56/0.14)]">
      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Coleta clínica integrada · mock</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"><h1 className="min-w-0 break-words text-xl font-black sm:text-2xl">{collection.patientName}</h1><span className="shrink-0 text-xs font-bold text-emerald-200">{collection.patientCode}</span></div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-emerald-50"><span>{consultationLabels[collection.consultationType]}</span><span>Profissional: <strong className="text-white">{collection.connectedProfessional.professionalName}</strong></span><span>Mesmo Prontuário Mestre</span></div>
        </div>
        <div className="min-w-[15rem] rounded-xl bg-white/10 p-4">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-emerald-100">Progresso geral</span><strong className="text-lg font-black">{collection.progressPercent}%</strong></div>
          <div aria-label={`${collection.progressPercent}% concluído`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={collection.progressPercent} className="mt-2 h-2 overflow-hidden rounded-full bg-black/20" role="progressbar"><span className="block h-full rounded-full bg-[#75d4b3] transition-all" style={{ width: `${collection.progressPercent}%` }} /></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-emerald-100">Última: {collection.lastSavedStep ? clinicalStepLabels[collection.lastSavedStep] : "nenhuma"}</span><span className="rounded-lg bg-white px-2 py-1"><SaveStatus state={saveState} /></span></div>
        </div>
      </div>
    </section>
  );
}
