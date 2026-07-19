import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicalCollectionFlow } from "@/components/clinical-collection/clinical-collection-flow";
import { EmptyState } from "@/components/clinical-collection/clinical-states";
import { PatientNavigation, type PatientNavigationModule } from "@/components/master-record/patient-navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, clinicalCollectionService, type ClinicalCollectionScenarioKey, type ClinicalCollectionStepKey } from "@/features/clinical-collection";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Coleta clínica integrada" };

const validSteps: readonly ClinicalCollectionStepKey[] = ["ANTHROPOMETRY", "BIOIMPEDANCE", "PERIMETRY", "POSTURAL_ASSESSMENT", "SUMMARY"];
const navigationModuleByStep: Record<ClinicalCollectionStepKey, PatientNavigationModule> = {
  ANTHROPOMETRY: "PHYSICAL_ASSESSMENT",
  BIOIMPEDANCE: "BIOIMPEDANCE",
  PERIMETRY: "PERIMETRY",
  POSTURAL_ASSESSMENT: "POSTURAL_ASSESSMENT",
  SUMMARY: "CLINICAL_COLLECTION",
};

export default async function ClinicalCollectionPage({ params, searchParams }: { params: Promise<{ patientId: string; attendanceId: string }>; searchParams: Promise<{ scenario?: string; step?: string }> }) {
  const [{ patientId, attendanceId }, query, scenarios] = await Promise.all([params, searchParams, clinicalCollectionService.listScenarios()]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? query.scenario as ClinicalCollectionScenarioKey : "complete";
  const initialStep = validSteps.includes(query.step as ClinicalCollectionStepKey) ? query.step as ClinicalCollectionStepKey : undefined;
  const [collection, hub] = await Promise.all([clinicalCollectionService.getCollection({ patientId, attendanceId, scenario }), patientHubService.get({ patientId, scenario })]);
  if (!collection && patientId.startsWith("demo-") && attendanceId.startsWith("demo-")) return <EmptyState />;
  if (!collection || !hub) notFound();
  const currentStep = initialStep ?? collection.firstIncompleteStep ?? "SUMMARY";
  return <><PatientNavigation currentModule={navigationModuleByStep[currentStep]} initialHub={hub} /><PageHeading description="Preencha somente o que falta; os dados existentes permanecem vinculados ao mesmo prontuário." eyebrow="Atendimento completo SV" title="Coleta clínica" /><ClinicalCollectionFlow initialCollection={collection} initialStep={initialStep} scenarios={scenarios} /></>;
}
