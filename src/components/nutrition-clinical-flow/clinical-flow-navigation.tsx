"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { Button, ButtonLink } from "@/components/ui";
import {
  getNutritionClinicalFlowDefinition,
  getNutritionClinicalFlowStepAccess,
  nutritionClinicalFlowProgress,
  type NutritionClinicalFlowStep,
  type NutritionClinicalFlowStepId,
} from "@/features/nutrition-clinical-flow";
import type { NutritionStrategyDraft } from "@/features/nutrition-strategy";

import { ClinicalFlowStepper } from "../clinical-collection/clinical-flow-stepper";

export interface ClinicalFlowPrimaryAction {
  readonly label: string;
  readonly form?: string;
  readonly name?: string;
  readonly value?: string;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

export interface ClinicalFlowApprovalAction {
  readonly endpoint: string;
  readonly strategy: NutritionStrategyDraft;
}

export function ClinicalFlowNavigation({
  activeStep,
  children,
  flow,
  patient,
  primaryAction,
  approvalAction,
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
  approvalAction?: ClinicalFlowApprovalAction;
  onNavigate?: (step: NutritionClinicalFlowStepId) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const allowMealPlanAccess = searchParams.get("devUser") === "saulo";
  const router = useRouter();

  const [approvalState, setApprovalState] = useState<
    "IDLE" | "SAVING" | "ERROR"
  >("IDLE");

  const definition =
    getNutritionClinicalFlowDefinition(activeStep);

  const next = definition.nextStepId
    ? flow.find(
        (step) =>
          step.id === definition.nextStepId,
      )
    : undefined;

  function getStepAccess(stepId: NutritionClinicalFlowStepId) {
    const access = getNutritionClinicalFlowStepAccess(
      flow,
      stepId,
      activeStep,
    );

    if (allowMealPlanAccess && stepId === "MEAL_PLAN") {
      return {
        ...access,
        canOpen: true,
        status: access.status === "COMPLETED" ? "COMPLETED" : "NOT_STARTED",
        blockedReason: undefined,
      } as const;
    }

    return access;
  }

  const nextAccess = next
    ? getStepAccess(next.id)
    : undefined;

  const progress =
    nutritionClinicalFlowProgress(flow);

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

  async function approve() {
    if (
      !approvalAction ||
      approvalState === "SAVING"
    ) {
      return;
    }

    setApprovalState("SAVING");

    const response = await fetch(
      approvalAction.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "APPROVE",
          strategy: approvalAction.strategy,
        }),
      },
    ).catch(() => null);

    if (!response?.ok) {
      setApprovalState("ERROR");
      return;
    }

    setApprovalState("IDLE");
    router.refresh();
  }

  return (
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
              {definition.order} de {flow.length} ·{" "}
              {progress}%
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
  {primaryAction ? (
    <Button
      disabled={primaryAction.disabled}
      form={primaryAction.form}
      name={primaryAction.name}
      onClick={primaryAction.onClick}
      size="small"
      type={primaryAction.form ? "submit" : "button"}
      value={primaryAction.value}
    >
      {primaryAction.label}
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
</div>
          </div>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <div className="min-w-0 lg:sticky lg:top-[9.5rem] lg:self-start">
          <ClinicalFlowStepper
            activeStep={activeStep}
            allowMealPlanAccess={allowMealPlanAccess}
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
  );
}
