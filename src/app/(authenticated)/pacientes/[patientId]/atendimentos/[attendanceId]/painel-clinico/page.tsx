import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicalPanel } from "@/components/clinical-panel/clinical-panel";
import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, clinicalCollectionService, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Painel Clínico Integrado" };

export default async function ClinicalPanelPage({ params, searchParams }: { params: Promise<{ patientId: string; attendanceId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const [{ patientId, attendanceId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  if (!canAccess(access, "MASTER_RECORD", "READ")) return <PageState description="Seu perfil não pode visualizar o Painel Clínico Integrado." title="Acesso não permitido" tone="blocked" />;
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? query.scenario as ClinicalCollectionScenarioKey : "complete";
  const [panel, hub] = await Promise.all([clinicalCollectionService.getClinicalPanel({ patientId, attendanceId, scenario }), patientHubService.get({ patientId, scenario })]);
  if (!panel || !hub) notFound();
  return <><PatientNavigation currentModule="CLINICAL_PANEL" initialHub={hub} /><PageHeading description="Conferência integrada dos registros existentes, sem nova coleta de dados." eyebrow="Preparação para decisão profissional" title="Painel Clínico Integrado" /><ClinicalPanel initialPanel={panel} /></>;
}
