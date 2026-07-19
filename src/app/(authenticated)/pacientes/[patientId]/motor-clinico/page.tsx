import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicalEngineWorkspace } from "@/components/clinical-engine";
import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { PageHeading, PageState } from "@/components/ui";
import { clinicalEngineService } from "@/features/clinical-engine";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Motor Clínico" };

export default async function ClinicalEnginePage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const [{ patientId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);

  if (!canAccess(access, "MASTER_RECORD", "READ")) {
    return <PageState description="Seu perfil não possui acesso ao Prontuário Mestre." title="Acesso não permitido" tone="blocked" />;
  }

  const view = await clinicalEngineService.get({ patientId, scenario, user: viewer });
  if (!view) notFound();

  return (
    <>
      <PatientNavigation currentModule="CLINICAL_ENGINE" initialHub={view.hub} />
      <PageHeading description="Todas as informações existentes do paciente reunidas antes da decisão profissional, sem interpretação clínica automática." eyebrow="Prontuário Mestre" title="Motor Clínico Inteligente" />
      <ClinicalEngineWorkspace view={view} />
    </>
  );
}
