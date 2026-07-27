"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();
  const [approvalState, setApprovalState] = useState<
    "IDLE" | "SAVING" | "ERROR"
  >("IDLE");
  const definition = getNutritionClinicalFlowDefinition(activeStep);
  const previous = definition.previousStepId
    ? flow.find((step) => step.id === definition.previousStepId)
    : undefined;
  const next = definition.nextStepId
    ? flow.find((step) => step.id === definition.nextStepId)
    : undefined;
  const previousAccess = previous
    ? getNutritionClinicalFlowStepAccess(flow, previous.id, activeStep)
    : undefined;
  const nextAccess = next
    ? getNutritionClinicalFlowStepAccess(flow, next.id, activeStep)
    : undefined;
  const progress = nutritionClinicalFlowProgress(flow);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname, search]);

  function navigate(step: NutritionClinicalFlowStep) {
    const access = getNutritionClinicalFlowStepAccess(
      flow,
      step.id,
      activeStep,
    );
    if (!access.canOpen) return;
    if (onNavigate) {
      onNavigate(step.id);
      return;
    }
    router.push(step.href, { scroll: true });
  }

  async function approve() {
    if (!approvalAction || approvalState === "SAVING") return;
    setApprovalState("SAVING");
    const response = await fetch(approvalAction.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        strategy: approvalAction.strategy,
      }),
    }).catch(() => null);
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
              {definition.title} · Etapa {definition.order} de 10 · {progress}%
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!previous || !previousAccess?.canOpen}
              onClick={() => previous && navigate(previous)}
              size="small"
              title={previousAccess?.blockedReason}
              type="button"
              variant="outline"
            >
              Anterior
            </Button>
            <Button
              disabled={!next || !nextAccess?.canOpen}
              onClick={() => next && navigate(next)}
              size="small"
              title={nextAccess?.blockedReason}
              type="button"
            >
              Próximo
            </Button>
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
            flow={flow}
            onSelect={(stepId) => {
              const step = flow.find((item) => item.id === stepId);
              if (step) navigate(step);
            }}
          />
        </div>
        <div className="min-w-0 pb-24">{children}</div>
      </div>

      <section className="fixed bottom-20 left-4 right-4 z-10 rounded-2xl border border-[#dce5e0] bg-white/95 p-2.5 shadow-[0_-8px_24px_rgb(20_55_44/0.08)] backdrop-blur lg:bottom-4 lg:left-[17.25rem] lg:right-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            disabled={!previous || !previousAccess?.canOpen}
            onClick={() => previous && navigate(previous)}
            size="small"
            title={previousAccess?.blockedReason}
            type="button"
            variant="outline"
          >
            Anterior
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {approvalState === "ERROR" ? (
              <p className="text-xs font-bold text-rose-700" role="alert">
                Não foi possível aprovar. Revise os dados obrigatórios.
              </p>
            ) : null}
            {primaryAction ? (
              <Button
                disabled={primaryAction.disabled}
                form={primaryAction.form}
                onClick={primaryAction.onClick}
                size="small"
                type={primaryAction.form ? "submit" : "button"}
                variant="secondary"
              >
                {primaryAction.label}
              </Button>
            ) : null}
            {approvalAction ? (
              <Button
                disabled={approvalState === "SAVING"}
                onClick={approve}
                size="small"
                type="button"
                variant="secondary"
              >
                {approvalState === "SAVING"
                  ? "Aprovando..."
                  : "Aprovar estratégia"}
              </Button>
            ) : null}
            <Button
              disabled={!next || !nextAccess?.canOpen}
              onClick={() => next && navigate(next)}
              size="small"
              title={nextAccess?.blockedReason}
              type="button"
            >
              Próximo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
