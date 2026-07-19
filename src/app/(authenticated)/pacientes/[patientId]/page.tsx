import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Prontuário Mestre" };

const PatientHubLazy = dynamic(() => import("@/components/patient-hub/patient-hub").then((module) => module.PatientHub), {
  loading: () => <PageState description="Carregando o painel central do paciente." title="Prontuário Mestre" />,
});

export default async function MasterRecordPage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const [access, hub] = await Promise.all([mvpService.getSession(), patientHubService.get({ patientId, scenario })]);

  if (!canAccess(access, "MASTER_RECORD", "READ")) {
    return <PageState description="Seu perfil não possui acesso ao Prontuário Mestre. A autorização do servidor permanece obrigatória." title="Acesso não permitido" tone="blocked" />;
  }

  if (!hub) notFound();

  return (
    <>
      <PatientNavigation currentModule="SUMMARY" initialHub={hub} />
      <PatientHubLazy initialHub={hub} />
    </>
  );
}
