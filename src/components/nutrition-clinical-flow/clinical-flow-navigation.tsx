"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { Button, ButtonLink } from "@/components/ui";
import {
  getNutritionClinicalFlowDefinition,
  getNutritionClinicalFlowStepAccess,
  isVisibleNutritionClinicalFlowStep,
  nutritionClinicalFlowProgress,
  type NutritionClinicalFlowStep,
  type NutritionClinicalFlowStepId,
} from "@/features/nutrition-clinical-flow";
import { ClinicalFlowStepper } from "../clinical-collection/clinical-flow-stepper";

export interface ClinicalFlowPrimaryAction {
  readonly label: string;
  readonly form?: string;
  readonly name?: string;
  readonly value?: string;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

interface ClinicalFlowPrimaryActionState {
  readonly disabled: boolean;
  readonly blockedReason?: string;
}

const ClinicalFlowPrimaryActionStateContext = createContext<
  Dispatch<SetStateAction<ClinicalFlowPrimaryActionState | undefined>> | null
>(null);

export function useClinicalFlowPrimaryActionState(
  state: ClinicalFlowPrimaryActionState,
) {
  const updateState = useContext(ClinicalFlowPrimaryActionStateContext);
  const { blockedReason, disabled } = state;

  useEffect(() => {
    updateState?.({ blockedReason, disabled });
  }, [blockedReason, disabled, updateState]);

  useEffect(
    () => () => updateState?.(undefined),
    [updateState],
  );
}

export function ClinicalFlowNavigation({
  activeStep,
  children,
  flow,
  patient,
  primaryAction,
  onNavigate,
}: {
  activeStep: NutritionClinicalFlowStepId;
  children: ReactNode;
  flow: readonly NutritionClinicalFlowStep[];
  patient: {
    readonly id: string;
    readonly name: string;
    readonly code: string;
  };
  primaryAction?: ClinicalFlowPrimaryAction;
  onNavigate?: (step: NutritionClinicalFlowStepId) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const router = useRouter();

  const [primaryActionState, setPrimaryActionState] = useState<
    ClinicalFlowPrimaryActionState | undefined
  >();

  const definition =
    getNutritionClinicalFlowDefinition(activeStep);

  const next = definition.nextStepId
    ? flow.find(
        (step) =>
          step.id === definition.nextStepId,
      )
    : undefined;

  function getStepAccess(stepId: NutritionClinicalFlowStepId) {
    return getNutritionClinicalFlowStepAccess(
      flow,
      stepId,
      activeStep,
    );
  }

  const nextAccess = next
    ? getStepAccess(next.id)
    : undefined;
  const activeFlowStep = flow.find((step) => step.id === activeStep);
  const mandatoryStepIncomplete =
    (activeStep === "PATIENT_REGISTRATION" || activeStep === "ANAMNESIS") &&
    activeFlowStep?.status !== "COMPLETED";

  const progress =
    nutritionClinicalFlowProgress(flow);
  const visibleFlow = flow.filter(
    isVisibleNutritionClinicalFlowStep,
  );
  const activeStepPosition =
    visibleFlow.findIndex((step) => step.id === activeStep) + 1;

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [pathname, search]);

  function navigate(
    step: NutritionClinicalFlowStep,
  ) {
    const access = getStepAccess(step.id);

    if (!access.canOpen) {
      return;
    }

    if (onNavigate) {
      onNavigate(step.id);
      return;
    }

    router.push(step.href, {
      scroll: true,
    });
  }

  const primaryActionDisabled = Boolean(
    primaryAction?.disabled || primaryActionState?.disabled,
  );
  const primaryActionBlockedReason = primaryActionState?.blockedReason;

  return (
    <ClinicalFlowPrimaryActionStateContext.Provider value={setPrimaryActionState}>
    <div className="space-y-4">
      <section className="sticky top-16 z-10 rounded-2xl border border-[#dce5e0] bg-white/95 px-3 py-2.5 shadow-[0_8px_24px_rgb(20_55_44/0.08)] backdrop-blur lg:top-[4.5rem]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <strong className="truncate text-sm text-[#103f32]">
                {patient.name}
              </strong>

              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-800">
                {patient.code}
              </span>
            </div>

            <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
              {definition.title} · Etapa{" "}
              {activeStepPosition} de {visibleFlow.length} ·{" "}
              {progress}%
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
  {primaryActionBlockedReason ? (
    <span
      className="max-w-72 text-right text-[11px] font-bold leading-4 text-amber-800"
      id="clinical-flow-primary-action-blocked-reason"
    >
      {primaryActionBlockedReason}
    </span>
  ) : null}
  {primaryAction ? (
    <Button
      aria-describedby={primaryActionBlockedReason ? "clinical-flow-primary-action-blocked-reason" : undefined}
      disabled={primaryActionDisabled}
      form={primaryAction.form}
      name={primaryAction.name}
      onClick={primaryAction.onClick}
      size="small"
      type={primaryAction.form ? "submit" : "button"}
      value={primaryAction.value}
    >
      {primaryAction.label}
    </Button>
  ) : mandatoryStepIncomplete && next ? (
    <Button disabled size="small" type="button">
      Próximo
    </Button>
  ) : next && nextAccess?.canOpen ? (
    <Button
      onClick={() => navigate(next)}
      size="small"
      type="button"
    >
      Próximo
    </Button>
  ) : null}

  <ButtonLink
    href={`/pacientes/${patient.id}`}
    size="small"
    variant="ghost"
  >
    Voltar ao prontuário
  </ButtonLink>
  <ButtonLink
    href="/pacientes"
    size="small"
    variant="ghost"
  >
    Voltar aos pacientes
  </ButtonLink>
</div>
          </div>
      </section>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[11.5rem_minmax(0,1fr)]">
        <div className="min-w-0 lg:sticky lg:top-[9.5rem] lg:self-start lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
          <ClinicalFlowStepper
            activeStep={activeStep}
            flow={flow}
            onSelect={(stepId) => {
              const step = flow.find(
                (item) =>
                  item.id === stepId,
              );

              if (step) {
                navigate(step);
              }
            }}
          />
        </div>

        <div className="min-w-0 pb-24">
          {children}
        </div>
      </div>

      
    </div>
    </ClinicalFlowPrimaryActionStateContext.Provider>
  );
}
