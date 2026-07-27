import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import { InitialConsultationProgress } from "@/components/patients/initial-consultation-progress";
import { PageState } from "@/components/ui/page-state";
import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { DEMO_PATIENT_ID } from "@/features/mvp/mock-data";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { patientHubService } from "@/features/patient-hub";
import { patientRegistrationRepository } from "@/features/patient-registration";

export const metadata: Metadata = { title: "Prontuário Mestre" };

const PatientHubLazy = dynamic(
  () =>
    import("@/components/patient-hub/patient-hub").then(
      (module) => module.PatientHub,
    ),
  {
    loading: () => (
      <PageState
        description="Carregando o painel central do paciente."
        title="Prontuário Mestre"
      />
    ),
  },
);

export default async function MasterRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ scenario?: string; registered?: string }>;
}) {
  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const access = await mvpService.getSession();

  if (!canAccess(access, "MASTER_RECORD", "READ")) {
    return (
      <PageState
        description="Seu perfil não possui acesso ao Prontuário Mestre."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  if (patientId !== DEMO_PATIENT_ID) {
    const patient = await patientRegistrationRepository.findEntry(patientId);
    if (!patient) notFound();
    const flow = await nutritionClinicalFlowRepository.getFlow({
      patientId,
      attendanceId: patient.attendanceId,
      scenario: query.scenario,
    });
    if (!flow) notFound();

    return (
      <ClinicalFlowNavigation
        activeStep="PATIENT_REGISTRATION"
        flow={flow.flow}
        patient={{
          id: patientId,
          name: patient.fullName,
          code: patient.clinicalCode,
        }}
      >
        <InitialConsultationProgress
          patient={patient}
          registered={query.registered === "1"}
        />
      </ClinicalFlowNavigation>
    );
  }

  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    query.scenario as ClinicalCollectionScenarioKey,
  )
    ? (query.scenario as ClinicalCollectionScenarioKey)
    : "complete";
  const hub = await patientHubService.get({ patientId, scenario });

  if (!hub) notFound();

  return (
    <>
      <PatientNavigation currentModule="SUMMARY" initialHub={hub} />
      <PatientHubLazy initialHub={hub} />
    </>
  );
}
