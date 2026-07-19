import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { nutritionStrategyService } from "@/features/nutrition-strategy";
import { canAccess, mvpService } from "@/features/mvp";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Estratégia Nutricional" };

const NutritionStrategyWorkspaceLazy = dynamic(
  () => import("@/components/nutrition-strategy").then((module) => module.NutritionStrategyWorkspace),
  { loading: () => <PageState description="Carregando a estratégia nutricional." title="Estratégia Nutricional" /> },
);

export default async function NutritionStrategyPage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const [{ patientId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);
  const [hub, view] = await Promise.all([
    patientHubService.get({ patientId, scenario }),
    nutritionStrategyService.get({ patientId, scenario, user: viewer }),
  ]);

  if (!hub) notFound();
  if (!canAccess(access, "NUTRITION_STRATEGY", "READ") || !hub.showNutrition) {
    return <PageState description="Seu perfil não possui acesso à Estratégia Nutricional." title="Acesso não permitido" tone="blocked" />;
  }

  if (!hub.motorAvailable) {
    return (
      <>
        <PatientNavigation currentModule="NUTRITION_STRATEGY" initialHub={hub} />
        <PageState
          description="A Estratégia Nutricional fica disponível após o Motor de Decisão Clínico estar liberado."
          title="Estratégia Nutricional bloqueada"
          tone="blocked"
        />
      </>
    );
  }

  if (!view) notFound();

  return (
    <>
      <PatientNavigation currentModule="NUTRITION_STRATEGY" initialHub={hub} />
      <PageHeading
        description="Estratégia estrutural obrigatória antes da elaboração do Plano Alimentar. A decisão final continua sendo do nutricionista."
        eyebrow="Nutrição · decisão profissional"
        title="Estratégia Nutricional"
      />
      <NutritionStrategyWorkspaceLazy view={view} />
    </>
  );
}
