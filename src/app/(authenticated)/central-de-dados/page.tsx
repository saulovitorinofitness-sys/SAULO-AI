import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { ButtonLink, PageHeading } from "@/components/ui";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { mvpService } from "@/features/mvp";
import { sharedDataService } from "@/features/shared-data";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const metadata: Metadata = { title: "Central de Dados" };

const SharedDataWorkspaceLazy = dynamic(
  () => import("@/components/shared-data/shared-data-workspace").then((module) => module.SharedDataWorkspace),
  { loading: () => <PageHeading description="Carregando catálogos administrativos." eyebrow="SAULO AI · dados mockados" title="Central de Dados Compartilhados" /> },
);

export default async function SharedDataPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const [query, access] = await Promise.all([searchParams, mvpService.getSession()]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);
  const workspace = await sharedDataService.getWorkspace({ scenario, defaultUser: access.user });

  return (
    <>
      <PatientBreadcrumb items={[{ label: "Gestão", href: "/dashboard" }, { label: "Central de Dados" }]} />
      <PageHeading
        action={
          viewer.id === BUILT_IN_IDS.users.sauloXavierVitorino ? (
            <ButtonLink href={`/central-de-dados/alimentos?scenario=${scenario}`}>
              Banco de Alimentos
            </ButtonLink>
          ) : undefined
        }
        description="Catálogos administrativos reutilizáveis, separados do Prontuário Mestre."
        eyebrow="SAULO AI · dados mockados"
        title="Central de Dados Compartilhados"
      />
      <SharedDataWorkspaceLazy initialView={workspace} />
    </>
  );
}
