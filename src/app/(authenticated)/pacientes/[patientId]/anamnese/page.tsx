import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import { ButtonLink } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { DEMO_PATIENT_ID } from "@/features/mvp/mock-data";
import { clinicalAnamnesisService } from "@/features/clinical-anamnesis";
import { clinicalAnamnesisObjectivesRepository } from "@/features/clinical-anamnesis/objectives-repository";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { nutritionReturnAnamnesisRepository } from "@/features/nutrition-return-anamnesis/repository";
import { returnFoodSafetyRepository } from "@/features/nutrition-return-anamnesis/food-safety-update";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const metadata: Metadata = { title: "Anamnese" };

const ClinicalAnamnesisLazy = dynamic(
  () => import("@/components/clinical-anamnesis/clinical-anamnesis").then((module) => module.ClinicalAnamnesis),
  { loading: () => <PageState description="Carregando a anamnese clínica." title="Anamnese" /> },
);

const ReturnAnamnesisLazy = dynamic(
  () =>
    import("@/components/clinical-anamnesis/return-anamnesis").then(
      (module) => module.ReturnAnamnesis,
    ),
  {
    loading: () => (
      <PageState
        description="Carregando a Anamnese de retorno."
        title="Anamnese de retorno"
      />
    ),
  },
);

function safeDeliverableReturnHref(
  value: string | undefined,
  patientId: string,
  attendanceId: string | undefined,
) {
  if (!value || !attendanceId || !value.startsWith("/")) return undefined;

  const url = new URL(value, "http://localhost");
  if (
    url.pathname !== "/clinica/plano-alimentar/entregavel" ||
    url.searchParams.get("patientId") !== patientId ||
    url.searchParams.get("attendanceId") !== attendanceId
  ) {
    return undefined;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export default async function AnamnesisPage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ attendanceId?: string; scenario?: string; section?: string; returnTo?: string }> }) {
  const [{ patientId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const selectedAttendanceId = query.attendanceId?.trim();
  const deliverableReturnHref = safeDeliverableReturnHref(
    query.returnTo,
    patientId,
    selectedAttendanceId,
  );

  if (patientId !== DEMO_PATIENT_ID && !selectedAttendanceId) {
    return (
      <PageState
        description="Abra a Anamnese pelo fluxo de um atendimento identificado. Nenhum registro clínico foi associado automaticamente."
        title="Atendimento não identificado"
        tone="blocked"
      />
    );
  }

  const returnView =
    patientId !== DEMO_PATIENT_ID && selectedAttendanceId
      ? await nutritionReturnAnamnesisRepository.getView(
          patientId,
          selectedAttendanceId,
        )
      : null;

  if (returnView) {
    const foodSafetyUpdate = await returnFoodSafetyRepository.get(
      patientId,
      returnView.attendanceId,
    );
    const canReadReturn =
      access.user.id !== BUILT_IN_IDS.users.mariaDeLourdesGomes &&
      canAccess(access, "MASTER_RECORD", "READ") &&
      canAccess(access, "NUTRITION_STRATEGY", "READ");
    if (!canReadReturn) {
      return (
        <PageState
          description="Seu perfil não possui acesso à Anamnese nutricional de retorno."
          title="Acesso não permitido"
          tone="blocked"
        />
      );
    }

    const flow = await nutritionClinicalFlowRepository.getFlow({
      patientId,
      attendanceId: returnView.attendanceId,
      scenario,
    });
    if (!flow) notFound();
    const canEditReturn =
      returnView.canEdit &&
      canAccess(access, "MASTER_RECORD", "UPDATE") &&
      canAccess(access, "NUTRITION_STRATEGY", "UPDATE");

    return (
      <ClinicalFlowNavigation
        activeStep="ANAMNESIS"
        flow={flow.flow}
        patient={{
          id: patientId,
          name: returnView.patientName,
          code: returnView.patientCode,
        }}
      >
        <PageHeading
          description="Histórico permanente preservado como referência e registro novo vinculado somente ao retorno atual."
          eyebrow="Prontuário Mestre"
          title="Anamnese de retorno"
        />
        {deliverableReturnHref ? (
          <div className="mb-4 flex justify-end">
            <ButtonLink href={deliverableReturnHref} variant="secondary">
              Voltar ao Entregável
            </ButtonLink>
          </div>
        ) : null}
        <ReturnAnamnesisLazy
          canUpdateFoodSafety={
            returnView.attendanceStatus === "IN_PROGRESS" &&
            canAccess(access, "MASTER_RECORD", "UPDATE") &&
            canAccess(access, "NUTRITION_STRATEGY", "UPDATE")
          }
          initialFoodSafetyUpdate={foodSafetyUpdate}
          initialView={{ ...returnView, canEdit: canEditReturn }}
        />
      </ClinicalFlowNavigation>
    );
  }

  const view =
    patientId === DEMO_PATIENT_ID
      ? await clinicalAnamnesisService.get({ patientId, scenario })
      : await clinicalAnamnesisObjectivesRepository.getView(
          patientId,
          scenario,
          selectedAttendanceId,
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
      {deliverableReturnHref ? (
        <div className="mb-4 flex justify-end">
          <ButtonLink href={deliverableReturnHref} variant="secondary">
            Voltar ao Entregável
          </ButtonLink>
        </div>
      ) : null}
      <ClinicalAnamnesisLazy
        initialSection={query.section === "clinical-history" ? "HISTORICO" : undefined}
        initialView={{ ...view, canEdit: canAccess(access, "MASTER_RECORD", "UPDATE") && view.canEdit }}
      />
    </ClinicalFlowNavigation>
  );
}
