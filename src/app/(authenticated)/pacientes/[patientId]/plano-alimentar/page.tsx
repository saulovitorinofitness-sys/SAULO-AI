import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import { ButtonLink, PageState } from "@/components/ui";
import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { mealPlanFoundationService } from "@/features/meal-plan/foundation-service";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { nutritionClinicalFlowHref } from "@/features/nutrition-clinical-flow";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { nutritionStrategyService } from "@/features/nutrition-strategy";
import { mealPlanStrategyInheritanceIssues } from "@/features/nutrition-strategy/inheritance";
import { nutritionStrategyRepository } from "@/features/nutrition-strategy/strategy-repository";
import { canAccess, mvpService } from "@/features/mvp";

import { SkipMealPlanAction } from "./skip-meal-plan-action";

export const metadata: Metadata = { title: "Plano Alimentar" };

const MealPlanWorkspaceLazy = dynamic(() =>
  import(
    "@/components/meal-plan/meal-plan-foundation-workspace"
  ).then((module) => module.MealPlanFoundationWorkspace),
);

export default async function MealPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{
    attendanceId?: string;
    scenario?: string;
  }>;
}) {
  const [{ patientId }, query, access] = await Promise.all([
    params,
    searchParams,
    mvpService.getSession(),
  ]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    query.scenario as ClinicalCollectionScenarioKey,
  )
    ? (query.scenario as ClinicalCollectionScenarioKey)
    : "complete";

  if (
    !canAccess(access, "MEAL_PLAN", "READ") ||
    !nutritionStrategyService.canAccess(access.user)
  ) {
    return (
      <PageState
        description="Seu perfil não possui acesso às funcionalidades exclusivas da Nutrição."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  const patientContext =
    await nutritionClinicalPanelRepository.get(
      patientId,
      query.attendanceId,
    );
  if (!patientContext) notFound();

  const flow = await nutritionClinicalFlowRepository.getFlow({
    patientId,
    attendanceId: patientContext.attendanceId,
    scenario,
  });
  if (!flow) notFound();
  const mealPlanStep = flow.flow.find((step) => step.id === "MEAL_PLAN");
  const strategyStep = flow.flow.find((step) => step.id === "NUTRITION_STRATEGY");
  const strategyWasSkipped = strategyStep?.status === "SKIPPED";
  const foundation = await mealPlanFoundationService.getOrCreate({
    patientId,
    attendanceId: patientContext.attendanceId,
    scenario,
    professionalUserId: access.user.id,
    strategySkipped: strategyWasSkipped,
  });
  const blockingStrategy =
    !foundation && !strategyWasSkipped
      ? await nutritionStrategyRepository.get(
          patientId,
          patientContext.attendanceId,
        )
      : null;
  const blockingIssues = blockingStrategy
    ? mealPlanStrategyInheritanceIssues(blockingStrategy)
    : [];
  const mealPlanWasSkipped = mealPlanStep?.status === "SKIPPED";
  const mealPlanCanBeSkipped =
    mealPlanStep?.status === "NOT_STARTED" ||
    mealPlanStep?.status === "IN_PROGRESS" ||
    mealPlanStep?.status === "BLOCKED";

  return (
    <ClinicalFlowNavigation
      activeStep="MEAL_PLAN"
      flow={flow.flow}
      patient={{
        id: patientId,
        name: patientContext.patient.name,
        code: patientContext.patient.code,
      }}
      primaryAction={
        foundation
          ? {
              label:
                foundation.plan.status === "APPROVED"
                  ? "Plano concluído"
                  : "Concluir Plano Alimentar",
              form: "clinical-form-meal-plan",
              name: "mealPlanAction",
              value: "complete",
              disabled: foundation.plan.status === "APPROVED",
            }
          : undefined
      }
    >
      {foundation ? (
        <>
          {strategyWasSkipped ? (
            <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950" role="status">
              Estratégia nutricional não realizada neste atendimento. O Plano Alimentar pode ser elaborado manualmente, sem metas de GET, VET ou macronutrientes presumidas.
            </div>
          ) : null}
          <MealPlanWorkspaceLazy
            initialPlan={{
              ...foundation.plan,
              currentWeightKg:
                patientContext.anthropometry.weightKg &&
                patientContext.anthropometry.weightKg > 0
                  ? patientContext.anthropometry.weightKg
                  : undefined,
            }}
          />
        </>
      ) : mealPlanWasSkipped ? (
        <PageState
          description="Esta etapa foi registrada como não realizada somente neste atendimento. Nenhum dado clínico vazio foi criado."
          title="Plano Alimentar · Não realizada"
        />
      ) : (
        <PageState
          action={
            <div className="mx-auto flex max-w-sm flex-col gap-3">
              <ButtonLink
                href={nutritionClinicalFlowHref("NUTRITION_STRATEGY", {
                  patientId,
                  attendanceId: patientContext.attendanceId,
                  scenario,
                })}
              >
                Abrir Estratégia Nutricional
              </ButtonLink>
              {mealPlanCanBeSkipped ? (
                <SkipMealPlanAction
                  attendanceId={patientContext.attendanceId}
                  patientId={patientId}
                />
              ) : null}
            </div>
          }
          description={
            blockingIssues.length
              ? `A Estratégia Nutricional deste atendimento não pode liberar o Plano enquanto estes dados estiverem ausentes ou pendentes: ${blockingIssues.join("; ")}. Abra a estratégia e escolha conscientemente como completar os campos; nenhum valor foi presumido.`
              : "Finalize primeiro a Estratégia Nutricional deste atendimento."
          }
          title="Plano Alimentar bloqueado"
          tone="blocked"
        />
      )}
    </ClinicalFlowNavigation>
  );
}
