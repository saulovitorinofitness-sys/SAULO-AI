import { CheckIcon } from "@/components/ui/icons";
import type { AttendanceProgressStep } from "@/features/clinical-collection";

const statusStyle = {
  COMPLETED: "bg-emerald-600 text-white",
  IN_PROGRESS: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  PENDING: "bg-slate-100 text-slate-500",
  BLOCKED: "bg-slate-200 text-slate-500",
  NOT_APPLICABLE: "bg-slate-50 text-slate-400 ring-1 ring-slate-200",
};

const statusSymbol = { COMPLETED: <CheckIcon className="size-3.5" />, IN_PROGRESS: "•", PENDING: "○", BLOCKED: "×", NOT_APPLICABLE: "—" };

export function AttendanceProgress({ steps }: { steps: readonly AttendanceProgressStep[] }) {
  return (
    <section aria-labelledby="attendance-progress-title" className="rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_8px_24px_rgb(20_55_44/0.03)] sm:p-5">
      <div className="mb-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#397563]">Jornada do atendimento</p><h2 className="mt-1 text-lg font-black text-slate-900" id="attendance-progress-title">Progresso do prontuário</h2></div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => <li className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-[#fafcfb] p-3" key={step.key}><span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${statusStyle[step.status]}`}>{statusSymbol[step.status]}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800"><span className="mr-1 text-xs text-slate-400">{index + 1}.</span>{step.label}</p><p className="mt-0.5 text-[11px] font-semibold text-slate-500">{step.statusLabel}</p></div></li>)}
      </ol>
    </section>
  );
}
