"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { clinicalCollectionService, type ClinicalCollectionScenario, type ClinicalCollectionScenarioKey, type CurrentAttendanceView } from "@/features/clinical-collection";
import { AttendanceProgress } from "./attendance-progress";
import { ContextualAttendanceAction } from "./contextual-attendance-action";

const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const consultationLabels = { INITIAL: "Consulta inicial", FOLLOW_UP: "Retorno", PHYSICAL_ASSESSMENT: "Avaliação física", POSTURAL_ASSESSMENT: "Avaliação postural", TRAINING: "Treinamento", NUTRITION: "Nutrição" } as const;

export function CurrentAttendanceCard({ initialAttendance, scenarios }: { initialAttendance: CurrentAttendanceView; scenarios: readonly ClinicalCollectionScenario[] }) {
  const [attendance, setAttendance] = useState(initialAttendance);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void clinicalCollectionService.getCurrentAttendance({ patientId: initialAttendance.patientId, attendanceId: initialAttendance.attendanceId, scenario: initialAttendance.scenario }).then((updated) => {
      if (active && updated) setAttendance(updated);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [initialAttendance]);

  function changeScenario(scenario: ClinicalCollectionScenarioKey) {
    window.location.assign(`/pacientes/${attendance.patientId}?scenario=${scenario}`);
  }

  const tone = attendance.status === "COLLECTION_COMPLETE" ? "success" : attendance.status === "INTEGRITY_PENDING" ? "warning" : "info";

  return (
    <div className="space-y-4">
      <section aria-busy={loading} className="scroll-mt-24 rounded-2xl border border-[#bdd4ca] bg-gradient-to-br from-white to-[#edf6f2] p-4 shadow-[0_12px_30px_rgb(20_55_44/0.06)] sm:p-6" id="atendimento-atual">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#397563]">Atendimento atual</p><Badge tone={tone}>{attendance.statusLabel}</Badge></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div><p className="text-xs font-semibold text-slate-400">Tipo</p><p className="mt-1 text-sm font-black text-slate-800">{consultationLabels[attendance.consultationType]}</p></div>
              <div><p className="text-xs font-semibold text-slate-400">Profissional responsável</p><p className="mt-1 text-sm font-black text-slate-800">{attendance.responsibleProfessionalName}</p></div>
              <div><p className="text-xs font-semibold text-slate-400">Início</p><p className="mt-1 text-sm font-black text-slate-800">{formatter.format(new Date(attendance.startedAt))}</p></div>
              <div><p className="text-xs font-semibold text-slate-400">Última atualização</p><p className="mt-1 text-sm font-black text-slate-800">{formatter.format(new Date(attendance.updatedAt))}</p></div>
            </div>
          </div>
          <div className="w-full rounded-xl border border-white bg-white/80 p-4 xl:w-64">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">Coleta concluída</span><strong className="text-xl font-black text-[#0a4938]">{attendance.progressPercent}%</strong></div>
            <div aria-valuemax={100} aria-valuemin={0} aria-valuenow={attendance.progressPercent} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar"><span className="block h-full rounded-full bg-[#3b9b7d]" style={{ width: `${attendance.progressPercent}%` }} /></div>
            <p className="mt-3 text-xs text-slate-500"><strong className="text-slate-700">Última:</strong> {attendance.lastCompletedStep ?? "Nenhuma"}</p>
            <p className="mt-1 text-xs text-slate-500"><strong className="text-slate-700">Próxima:</strong> {attendance.nextPendingStep ?? "Não indicada"}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-[#d9e7e1] pt-5 lg:flex-row lg:items-end lg:justify-between">
          <label className="text-xs font-bold text-slate-600" htmlFor="attendance-scenario">Cenário mock<select className="mt-1.5 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-[#3b9b7d] sm:w-64" id="attendance-scenario" onChange={(event) => changeScenario(event.target.value as ClinicalCollectionScenarioKey)} value={attendance.scenario}>{scenarios.map((scenario) => <option key={scenario.key} value={scenario.key}>{scenario.label}</option>)}</select></label>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">{attendance.actions.map((action) => <ContextualAttendanceAction action={action} key={action.key} />)}</div>
        </div>
      </section>
      <AttendanceProgress steps={attendance.progress} />
    </div>
  );
}
