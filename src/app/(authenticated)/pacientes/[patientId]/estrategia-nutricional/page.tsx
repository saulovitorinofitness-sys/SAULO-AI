import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import {
  NutritionClinicalPanel,
  NutritionStrategyDecisionEngine,
} from "@/components/nutrition-strategy";
import { PageState } from "@/components/ui/page-state";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { nutritionStrategyService } from "@/features/nutrition-strategy";
import { nutritionStrategyRepository } from "@/features/nutrition-strategy/strategy-repository";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Estratégia Nutricional" };

export default async function NutritionStrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ scenario?: string }>;
}) {
  const [{ patientId }, query, access] = await Promise.all([
    params,
    searchParams,
    mvpService.getSession(),
  ]);

  if (
    !canAccess(access, "NUTRITION_STRATEGY", "READ") ||
    !nutritionStrategyService.canAccess(access.user)
  ) {
    return (
      <PageState
        description="Seu perfil não possui acesso à Estratégia Nutricional."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  const view = await nutritionClinicalPanelRepository.get(patientId);
  if (!view) notFound();
  const [flow, strategy] = await Promise.all([
    nutritionClinicalFlowRepository.getFlow({
      patientId,
      attendanceId: view.attendanceId,
      scenario: query.scenario,
    }),
    nutritionStrategyRepository.get(patientId, view.attendanceId),
  ]);
  if (!flow) notFound();
  return (
    <ClinicalFlowNavigation
      activeStep="NUTRITION_STRATEGY"
      flow={flow.flow}
      patient={{
        id: patientId,
        name: view.patient.name,
        code: view.patient.code,
      }}
    >
      <NutritionClinicalPanel
        activityFactor={strategy?.activityFactor}
        view={view}
      />
      <NutritionStrategyDecisionEngine
        initialStrategy={strategy}
        view={view}
      />
    </ClinicalFlowNavigation>
  );
}
