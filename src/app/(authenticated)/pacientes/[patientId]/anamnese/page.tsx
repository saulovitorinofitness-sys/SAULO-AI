import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { DEMO_PATIENT_ID } from "@/features/mvp/mock-data";
import { clinicalAnamnesisService } from "@/features/clinical-anamnesis";
import { clinicalAnamnesisObjectivesRepository } from "@/features/clinical-anamnesis/objectives-repository";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";

export const metadata: Metadata = { title: "Anamnese" };

const ClinicalAnamnesisLazy = dynamic(
  () => import("@/components/clinical-anamnesis/clinical-anamnesis").then((module) => module.ClinicalAnamnesis),
  { loading: () => <PageState description="Carregando a anamnese clínica." title="Anamnese" /> },
);

export default async function AnamnesisPage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const [{ patientId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const view =
    patientId === DEMO_PATIENT_ID
      ? await clinicalAnamnesisService.get({ patientId, scenario })
      : await clinicalAnamnesisObjectivesRepository.getView(
          patientId,
          scenario,
        );

  if (!view) notFound();

  if (patientId === DEMO_PATIENT_ID) {
    return (
      <>
        <PatientNavigation
          currentModule="ANAMNESIS"
          patientContext={{
            patientId,
            fullName: view.patientName,
            scenario,
          }}
        />
        <PageHeading description="Registro clínico compartilhado, versionado e vinculado ao mesmo Prontuário Mestre." eyebrow="Prontuário Mestre" title="Anamnese Clínica Completa" />
        <ClinicalAnamnesisLazy initialView={{ ...view, canEdit: canAccess(access, "MASTER_RECORD", "UPDATE") && view.canEdit }} />
      </>
    );
  }

  if (!view.attendanceId) notFound();

  const flow = await nutritionClinicalFlowRepository.getFlow({
    patientId,
    attendanceId: view.attendanceId,
    scenario,
  });
  if (!flow) notFound();

  const anthropometryStep = flow.flow.find(
    (step) => step.id === "ANTHROPOMETRY",
  );
  if (!anthropometryStep) notFound();

  return (
    <ClinicalFlowNavigation
      activeStep="ANAMNESIS"
      flow={flow.flow}
      patient={{
        id: patientId,
        name: view.patientName,
        code: view.patientCode,
      }}
    >
      <PageHeading description="Registro clínico compartilhado, versionado e vinculado ao mesmo Prontuário Mestre." eyebrow="Prontuário Mestre" title="Anamnese Clínica Completa" />
      <ClinicalAnamnesisLazy
        continueHref={anthropometryStep.href}
        initialView={{ ...view, canEdit: canAccess(access, "MASTER_RECORD", "UPDATE") && view.canEdit }}
      />
    </ClinicalFlowNavigation>
  );
}
