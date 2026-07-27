import type { Metadata } from "next";

import { FoodDatabaseWorkspace } from "@/components/food-database/food-database-workspace";
import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { PageHeading, PageState } from "@/components/ui";
import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const metadata: Metadata = { title: "Banco de Alimentos" };

export default async function FoodDatabasePage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const [query, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    query.scenario as ClinicalCollectionScenarioKey,
  )
    ? (query.scenario as ClinicalCollectionScenarioKey)
    : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);

  if (viewer.id === BUILT_IN_IDS.users.mariaDeLourdesGomes) {
    return (
      <PageState
        description="Seu perfil não possui acesso às funcionalidades exclusivas da Nutrição."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  return (
    <>
      <PatientBreadcrumb
        items={[
          { label: "Central de Dados", href: "/central-de-dados" },
          { label: "Banco de Alimentos" },
        ]}
      />
      <PageHeading
        description="Alimentos, fontes nutricionais, medidas caseiras, sinônimos e nutrientes em uma estrutura central."
        eyebrow="Nutrição · Clínica SV"
        title="Banco de Alimentos Profissional"
      />
      <FoodDatabaseWorkspace
        canManage={viewer.id === BUILT_IN_IDS.users.sauloXavierVitorino}
        scenario={scenario}
      />
    </>
  );
}
