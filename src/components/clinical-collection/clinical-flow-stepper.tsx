"use client";

import { useEffect, useRef } from "react";

import { CheckIcon } from "@/components/ui/icons";
import {
  getNutritionClinicalFlowStepAccess,
  type NutritionClinicalFlowStep,
  type NutritionClinicalFlowStepId,
} from "@/features/nutrition-clinical-flow";

export function ClinicalFlowStepper({
  activeStep,
  allowMealPlanAccess = false,
  flow,
  onSelect,
}: {
  activeStep: NutritionClinicalFlowStepId;
  allowMealPlanAccess?: boolean;
  flow: readonly NutritionClinicalFlowStep[];
  onSelect: (step: NutritionClinicalFlowStepId) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const activeStepRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const active = activeStepRef.current;
    if (!list || !active) return;

    const activeTop = active.offsetTop;
    const activeBottom = activeTop + active.offsetHeight;
    const visibleTop = list.scrollTop;
    const visibleBottom = visibleTop + list.clientHeight;
    if (activeTop < visibleTop) {
      list.scrollTo({ top: activeTop, behavior: "auto" });
    } else if (activeBottom > visibleBottom) {
      list.scrollTo({
        top: activeBottom - list.clientHeight,
        behavior: "auto",
      });
    }

    const activeLeft = active.offsetLeft;
    const activeRight = activeLeft + active.offsetWidth;
    const visibleLeft = list.scrollLeft;
    const visibleRight = visibleLeft + list.clientWidth;
    if (activeLeft < visibleLeft) {
      list.scrollTo({ left: activeLeft, behavior: "auto" });
    } else if (activeRight > visibleRight) {
      list.scrollTo({
        left: activeRight - list.clientWidth,
        behavior: "auto",
      });
    }
  }, [activeStep]);

  return (
    <nav
      aria-label="Fluxo oficial da Consulta Nutricional"
      className="rounded-2xl border border-[#dce5e0] bg-white p-2 shadow-[0_8px_24px_rgb(20_55_44/0.03)] lg:flex lg:max-h-[calc(100dvh-10.5rem)] lg:flex-col lg:overflow-hidden lg:p-3"
    >
      <ol
        className="flex max-w-full gap-1 overflow-x-auto overscroll-contain pb-1 [scrollbar-color:#dbe5df_transparent] [scrollbar-width:thin] lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0 lg:pr-1"
        ref={listRef}
        tabIndex={0}
      >
        {flow.map((step) => {
          const active = step.id === activeStep;
          const resolvedAccess = getNutritionClinicalFlowStepAccess(
            flow,
            step.id,
            activeStep,
          );
          const access =
            allowMealPlanAccess && step.id === "MEAL_PLAN"
              ? {
                  ...resolvedAccess,
                  canOpen: true,
                  status:
                    resolvedAccess.status === "COMPLETED"
                      ? "COMPLETED"
                      : "NOT_STARTED",
                  blockedReason: undefined,
                } as const
              : resolvedAccess;
          const completed = access.status === "COMPLETED";
          const blockedReasonId = access.blockedReason
            ? `clinical-flow-blocked-${step.id.toLowerCase()}`
            : undefined;

          return (
            <li
              className="group min-w-[10rem] lg:min-w-0"
              key={step.id}
              ref={active ? activeStepRef : undefined}
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
                        : access.status === "NOT_STARTED"
                          ? "Não iniciada"
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
