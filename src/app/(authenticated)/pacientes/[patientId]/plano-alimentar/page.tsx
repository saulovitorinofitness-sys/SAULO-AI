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
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { nutritionStrategyService } from "@/features/nutrition-strategy";
import { canAccess, mvpService } from "@/features/mvp";
import {
  DEVELOPMENT_PROFESSIONALS,
  isDevelopmentUserKey,
} from "@/features/development-session";

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
  searchParams: Promise<{ scenario?: string; devUser?: string }>;
}) {
  const [{ patientId }, query, access] = await Promise.all([
    params,
    searchParams,
    mvpService.getSession(),
  ]);
  const selectedAccess =
    process.env.NODE_ENV === "development" &&
    isDevelopmentUserKey(query.devUser)
      ? DEVELOPMENT_PROFESSIONALS[query.devUser].access
      : access;
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    query.scenario as ClinicalCollectionScenarioKey,
  )
    ? (query.scenario as ClinicalCollectionScenarioKey)
    : "complete";

  if (
    !canAccess(selectedAccess, "MEAL_PLAN", "READ") ||
    !nutritionStrategyService.canAccess(selectedAccess.user)
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
    await nutritionClinicalPanelRepository.get(patientId);
  if (!patientContext) notFound();

  const foundation = await mealPlanFoundationService.getOrCreate({
    patientId,
    attendanceId: patientContext.attendanceId,
    scenario,
    professionalUserId: selectedAccess.user.id,
  });
  const flow = await nutritionClinicalFlowRepository.getFlow({
    patientId,
    attendanceId: patientContext.attendanceId,
    scenario,
  });
  if (!flow) notFound();

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
        <MealPlanWorkspaceLazy initialPlan={foundation.plan} />
      ) : (
        <PageState
          action={
            <ButtonLink
              href={`/pacientes/${patientId}/estrategia-nutricional?scenario=${scenario}`}
            >
              Abrir Estratégia Nutricional
            </ButtonLink>
          }
          description="A Estratégia Nutricional da consulta atual precisa ser aprovada antes de iniciar uma prescrição definitiva."
          title="Plano Alimentar bloqueado"
          tone="blocked"
        />
      )}
    </ClinicalFlowNavigation>
  );
}
