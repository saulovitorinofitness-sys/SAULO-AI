"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { CheckIcon } from "@/components/ui/icons";
import { mvpService, type AttendanceContinuityView } from "@/features/mvp";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

export function ContinuityForm({ attendance, scenario = "complete" }: { attendance: AttendanceContinuityView; scenario?: string }) {
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setState("saving");
    const data = new FormData(form);
    try {
      await mvpService.saveAttendanceActivity({ attendanceId: attendance.id, stepId: String(data.get("stepId")), note: String(data.get("note")) });
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 shadow-[0_8px_24px_rgb(20_55_44/0.03)] sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#397563]">Atendimento em continuidade</p><h2 className="mt-1 text-xl font-black text-slate-900">{attendance.patientName}</h2></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">Em andamento</span>
        </div>

        {attendance.lastCompletedStep ? <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Última etapa concluída</p><p className="mt-1 flex items-center gap-2 text-sm font-black text-emerald-950"><CheckIcon className="size-4" />{attendance.lastCompletedStep.title}</p></div> : null}

        <div><p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Mostrar somente pendências</p><ol className="space-y-2">{attendance.pendingSteps.map((step, index) => <li className="flex items-center gap-3 rounded-xl border border-slate-200 p-3.5" key={step.id}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-xs font-black text-amber-800">{String(index + 1).padStart(2, "0")}</span><span className="text-sm font-bold text-slate-800">{step.title}</span></li>)}</ol></div>

        <form className="mt-7 border-t border-slate-100 pt-6" noValidate onSubmit={submit}>
          <h3 className="font-black text-slate-900">Registrar nova atividade</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">Registre somente o que ocorreu agora. Dados anteriores permanecem referenciados no Prontuário Mestre.</p>
          <div className="mt-4 grid gap-4">
            <label className="text-sm font-bold text-slate-700" htmlFor="stepId">Etapa pendente<span className="ml-1 text-rose-600">*</span><select className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#3b9b7d] focus:ring-2 focus:ring-[#3b9b7d]/15" defaultValue="" id="stepId" name="stepId" required><option disabled value="">Selecione a etapa trabalhada</option>{attendance.pendingSteps.map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700" htmlFor="note">Descrição da nova atividade<span className="ml-1 text-rose-600">*</span><textarea className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white p-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#3b9b7d] focus:ring-2 focus:ring-[#3b9b7d]/15" id="note" name="note" placeholder="Descreva apenas a atividade realizada neste momento" required /></label>
          </div>
          {state === "success" ? <div className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status"><CheckIcon className="shrink-0" /><span><strong>Validação concluída.</strong> A atividade não foi persistida porque o endpoint ainda não existe.</span></div> : null}
          {state === "error" ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800" role="alert">Não foi possível validar a atividade.</p> : null}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Link className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100" href={`/pacientes/${attendance.patientId}`}>Voltar ao prontuário</Link><button className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60" disabled={state === "saving"} type="submit">{state === "saving" ? "Validando..." : "Salvar e continuar"}</button></div>
        </form>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#9fc5b6] bg-[#edf6f2] px-4 text-sm font-black text-[#0a4938] hover:bg-[#e2f1eb]" href={`/pacientes/${attendance.patientId}/atendimentos/${attendance.id}/coleta?scenario=${scenario}`}>Abrir coleta clínica integrada</Link>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-[#dce5e0] bg-white p-5"><h2 className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Contexto reutilizado</h2><dl className="mt-4 space-y-4"><div><dt className="text-xs font-semibold text-slate-400">Profissional responsável</dt><dd className="mt-1 text-sm font-black text-slate-800">{attendance.professionalName}</dd></div><div><dt className="text-xs font-semibold text-slate-400">Última atividade</dt><dd className="mt-1 text-sm font-black text-slate-800">{attendance.lastActivityAt ? dateTimeFormatter.format(new Date(attendance.lastActivityAt)) : "Sem registro"}</dd></div><div><dt className="text-xs font-semibold text-slate-400">Prontuário</dt><dd className="mt-1 text-sm font-black text-slate-800">Carregado automaticamente</dd></div></dl></section>
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5"><h2 className="text-sm font-black text-sky-950">Sem repetição de dados</h2><p className="mt-2 text-sm leading-6 text-sky-800">Identificação e registros anteriores permanecem no Prontuário Mestre e não são solicitados novamente nesta etapa.</p></section>
      </aside>
    </div>
  );
}
