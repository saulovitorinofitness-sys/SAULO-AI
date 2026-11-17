import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import {
  NutritionClinicalPanel,
  NutritionStrategyDecisionEngine,
} from "@/components/nutrition-strategy";
import { PageState } from "@/components/ui/page-state";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import {
  calculateReturnRecall,
  nutritionReturnAnamnesisRepository,
} from "@/features/nutrition-return-anamnesis";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { nutritionStrategyService } from "@/features/nutrition-strategy";
import { nutritionStrategyRepository } from "@/features/nutrition-strategy/strategy-repository";
import { canAccess, mvpService } from "@/features/mvp";
import { SkipNutritionStrategyAction } from "./skip-nutrition-strategy-action";

export const metadata: Metadata = { title: "Estratégia Nutricional" };

export default async function NutritionStrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{
    attendanceId?: string;
    scenario?: string;
    section?: string;
    returnTo?: string;
  }>;
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

  const view = await nutritionClinicalPanelRepository.get(
    patientId,
    query.attendanceId,
  );
  if (!view) notFound();
  const [flow, strategy, returnAnamnesis] = await Promise.all([
    nutritionClinicalFlowRepository.getFlow({
      patientId,
      attendanceId: view.attendanceId,
      scenario: query.scenario,
    }),
    nutritionStrategyRepository.getForClinicalAttendance(
      patientId,
      view.attendanceId,
    ),
    nutritionReturnAnamnesisRepository.getView(
      patientId,
      view.attendanceId,
    ),
  ]);
  if (!flow) notFound();
  const nutritionStrategyStep = flow.flow.find(
    (step) => step.id === "NUTRITION_STRATEGY",
  );
  if (!nutritionStrategyStep) notFound();
  const recall = returnAnamnesis?.data.recall24h;
  const recallCalculation = recall ? calculateReturnRecall(recall) : undefined;
  const recallPerformed = Boolean(recall?.meals.length);

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
      <SkipNutritionStrategyAction
        attendanceId={view.attendanceId}
        operationalStatus={nutritionStrategyStep.status}
        patientId={patientId}
      >
        <NutritionStrategyDecisionEngine
          anamnesisRecall={{
            performed: recallPerformed,
            totals: recallCalculation?.totals,
            confidence: !recallCalculation?.totals
              ? "NOT_ESTIMATED"
              : recallCalculation.partial
                ? "LOW"
                : "HIGH",
            reviewHref: `/pacientes/${patientId}/anamnese?attendanceId=${encodeURIComponent(view.attendanceId)}#recordatorio-24h`,
          }}
          clinicalSummary={
            <NutritionClinicalPanel
              activityFactor={strategy?.activityFactor}
              view={view}
            />
          }
          initialStrategy={strategy}
          scheduleCorrection={
            query.section === "daily-distribution" &&
            query.returnTo === "meal-plan"
          }
          view={view}
        />
      </SkipNutritionStrategyAction>
    </ClinicalFlowNavigation>
  );
}
