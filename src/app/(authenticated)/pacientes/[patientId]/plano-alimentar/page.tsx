import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { ButtonLink, PageHeading, PageState } from "@/components/ui";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { mealPlanService } from "@/features/meal-plan";
import { nutritionStrategyService } from "@/features/nutrition-strategy";
import { nutritionPrescriptionService } from "@/features/nutrition-prescription";
import { canAccess, mvpService } from "@/features/mvp";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Plano Alimentar" };

const MealPlanWorkspaceLazy = dynamic(() => import("@/components/meal-plan/meal-plan-workspace").then((module) => module.MealPlanWorkspace), {
  loading: () => <PageState description="Carregando o Plano Alimentar." title="Plano Alimentar" />,
});

export default async function MealPlanPage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const [{ patientId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);
  const [plan, hub, prescription, strategy] = await Promise.all([
    mealPlanService.get({ patientId, scenario }),
    patientHubService.get({ patientId, scenario }),
    nutritionPrescriptionService.get({ patientId, scenario, user: viewer }),
    nutritionStrategyService.get({ patientId, scenario, user: viewer }),
  ]);

  if (!hub) notFound();
  if (!canAccess(access, "MEAL_PLAN", "READ") || !hub.showNutrition) {
    return <PageState description="Seu perfil não possui acesso às funcionalidades exclusivas da Nutrição." title="Acesso não permitido" tone="blocked" />;
  }
  if (!plan || !prescription || !strategy) notFound();
  if (!strategy.canOpenMealPlan) {
    return (
      <>
        <PatientNavigation currentModule="MEAL_PLAN" initialHub={hub} />
        <PageState
          action={<ButtonLink href={`/pacientes/${patientId}/estrategia-nutricional?scenario=${scenario}`}>Abrir Estratégia Nutricional</ButtonLink>}
          description="A Estratégia Nutricional é obrigatória antes da elaboração do Plano Alimentar."
          title="Plano Alimentar bloqueado"
          tone="blocked"
        />
      </>
    );
  }

  return (
    <>
      <PatientNavigation currentModule="MEAL_PLAN" initialHub={hub} />
      <PageHeading description="Editor assistido pela Biblioteca Científica, sem geração automática, cálculo ou prescrição." eyebrow="Nutrição · decisão profissional" title="Plano Alimentar Inteligente" />
      <MealPlanWorkspaceLazy initialPlan={plan} prescription={prescription} />
    </>
  );
}
