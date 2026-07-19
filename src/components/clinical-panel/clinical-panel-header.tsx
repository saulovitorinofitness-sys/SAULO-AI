import type { ClinicalPanelView } from "@/features/clinical-collection";

const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });
const consultationLabels = { INITIAL: "Consulta inicial", FOLLOW_UP: "Retorno", PHYSICAL_ASSESSMENT: "Avaliação física", POSTURAL_ASSESSMENT: "Avaliação postural", TRAINING: "Treinamento", NUTRITION: "Nutrição" } as const;

export function ClinicalPanelHeader({ panel }: { panel: ClinicalPanelView }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[#103f32] text-white shadow-[0_16px_38px_rgb(10_73_56/0.14)]">
      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1fr_auto] xl:items-center">
        <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Painel Clínico Integrado · mock</p><div className="mt-2 flex flex-wrap items-baseline gap-2"><h1 className="break-words text-xl font-black sm:text-2xl">{panel.patient.fullName}</h1><span className="text-xs font-bold text-emerald-200">{panel.patient.code}</span></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-emerald-50"><span>{panel.patient.age} anos</span><span>{panel.patient.sexLabel}</span><span>Objetivo: {panel.patient.mainObjective ?? "Não disponibilizado"}</span><span>{consultationLabels[panel.collection.consultationType]}</span></div></div>
        <div className="w-full rounded-xl bg-white/10 p-4 xl:w-72"><div className="flex items-center justify-between"><span className="text-xs font-bold text-emerald-100">Status da coleta</span><strong className="text-lg font-black">{panel.collection.progressPercent}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20"><span className="block h-full rounded-full bg-[#75d4b3]" style={{ width: `${panel.collection.progressPercent}%` }} /></div><p className="mt-3 text-xs text-emerald-50">{panel.collection.completed ? "Concluída" : "Pendente"} · {panel.collectedAt ? formatter.format(new Date(panel.collectedAt)) : "Sem data"}</p><p className="mt-1 text-xs text-emerald-50">Profissional conectado: <strong className="text-white">{panel.collection.connectedProfessional.professionalName}</strong></p></div>
      </div>
    </section>
  );
}
