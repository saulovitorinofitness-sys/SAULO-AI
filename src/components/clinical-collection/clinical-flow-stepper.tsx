import { CheckIcon } from "@/components/ui/icons";
import {
  getNutritionClinicalFlowStepAccess,
  type NutritionClinicalFlowStep,
  type NutritionClinicalFlowStepId,
} from "@/features/nutrition-clinical-flow";

export function ClinicalFlowStepper({
  activeStep,
  flow,
  onSelect,
}: {
  activeStep: NutritionClinicalFlowStepId;
  flow: readonly NutritionClinicalFlowStep[];
  onSelect: (step: NutritionClinicalFlowStepId) => void;
}) {
  return (
    <nav
      aria-label="Fluxo oficial da Consulta Nutricional"
      className="rounded-2xl border border-[#dce5e0] bg-white p-2 shadow-[0_8px_24px_rgb(20_55_44/0.03)] lg:p-3"
    >
      <ol className="no-scrollbar flex max-w-full gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {flow.map((step) => {
          const active = step.id === activeStep;
          const access = getNutritionClinicalFlowStepAccess(
            flow,
            step.id,
            activeStep,
          );
          const completed = access.status === "COMPLETED";
          const blockedReasonId = access.blockedReason
            ? `clinical-flow-blocked-${step.id.toLowerCase()}`
            : undefined;

          return (
            <li
              className="group min-w-[10rem] lg:min-w-0"
              key={step.id}
              title={access.blockedReason}
            >
              <button
                aria-current={active ? "step" : undefined}
                aria-describedby={blockedReasonId}
                aria-disabled={!access.canOpen}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                  active
                    ? "bg-[#e7f2ed] text-[#0a4938]"
                    : access.canOpen
                      ? "text-slate-600 hover:bg-slate-50"
                      : "cursor-not-allowed text-slate-400"
                }`}
                onClick={() => {
                  if (access.canOpen) onSelect(step.id);
                }}
                type="button"
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                    completed
                      ? "bg-emerald-600 text-white"
                      : active
                        ? "bg-[#12664f] text-white"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {completed ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    step.order
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block leading-4">{step.title}</span>
                  <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {access.status === "COMPLETED"
                      ? "Concluída"
                      : access.status === "IN_PROGRESS"
                        ? "Em andamento"
                        : access.status === "AVAILABLE"
                          ? "Disponível"
                          : "Bloqueada"}
                  </span>
                </span>
              </button>
              {access.blockedReason ? (
                <span
                  className="hidden px-3 pb-2 pt-1 text-xs font-semibold leading-4 text-amber-800 group-focus-within:block"
                  id={blockedReasonId}
                  role="status"
                >
                  {access.blockedReason}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
