import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicalDecisionRouteGuard } from "@/components/clinical-decision/clinical-decision-route-guard";
import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, clinicalCollectionService, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { clinicalDecisionService, type ClinicalDecisionScenarioKey } from "@/features/clinical-decision";
import { canAccess, mvpService } from "@/features/mvp";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Decisão Clínica" };
const decisionScenarios: readonly ClinicalDecisionScenarioKey[] = ["COMPLETE", "POSTURAL_PENDING", "MARIA_FUNCTIONAL", "EMPTY", "SAVE_ERROR"];

export default async function ClinicalDecisionPage({ params, searchParams }: { params: Promise<{ patientId: string; attendanceId: string }>; searchParams: Promise<{ scenario?: string; decisionScenario?: string }> }) {
  const [{ patientId, attendanceId }, query, access, scenarios] = await Promise.all([params, searchParams, mvpService.getSession(), clinicalDecisionService.listScenarios()]);
  if (!canAccess(access, "CLINICAL_REASONING", "READ")) return <PageState description="Seu perfil não pode acessar o Motor de Decisão Clínica." title="Acesso não permitido" tone="blocked" />;
  const collectionScenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? query.scenario as ClinicalCollectionScenarioKey : "complete";
  const decisionScenario = decisionScenarios.includes(query.decisionScenario as ClinicalDecisionScenarioKey) ? query.decisionScenario as ClinicalDecisionScenarioKey : undefined;
  const [panel, hub] = await Promise.all([clinicalCollectionService.getClinicalPanel({ patientId, attendanceId, scenario: collectionScenario }), patientHubService.get({ patientId, scenario: collectionScenario })]);
  if (!panel || !hub) notFound();
  return <><PatientNavigation currentModule="CLINICAL_DECISION" initialHub={hub} /><PageHeading description="Disponível somente após coleta completa e confirmação profissional do Painel Clínico Integrado." eyebrow="Fluxo clínico oficial · sem IA" title="Motor de Decisão Clínica Assistido" /><ClinicalDecisionRouteGuard attendanceId={attendanceId} collectionScenario={collectionScenario} decisionScenario={decisionScenario} patientId={patientId} scenarios={scenarios} /></>;
}
