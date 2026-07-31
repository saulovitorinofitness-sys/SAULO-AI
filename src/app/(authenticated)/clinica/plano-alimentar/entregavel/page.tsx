import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MealPlanDocumentPreview } from "@/components/documents/meal-plan/meal-plan-document-preview";
import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import { ButtonLink, PageState } from "@/components/ui";
import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import {
  createAssistedMealPreview,
  createAssistedMealReferences,
  mealPlanService,
} from "@/features/meal-plan";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { getNutritionClinicalFlowStepAccess } from "@/features/nutrition-clinical-flow";
import { nutritionPrescriptionService } from "@/features/nutrition-prescription";
import {
  nutritionStrategySelectionFromView,
  nutritionStrategyService,
} from "@/features/nutrition-strategy";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { patientHubService } from "@/features/patient-hub";
import { professionalResponsibilityService } from "@/features/professional-responsibility";

export const metadata: Metadata = {
  title: "Entregável do Plano Alimentar",
};

export default async function MealPlanDeliverablePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; scenario?: string }>;
}) {
  const [query, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);
  const patientId = query.patientId?.trim();

  if (!patientId) {
    return (
      <PageState
        action={<ButtonLink href="/pacientes">Selecionar paciente</ButtonLink>}
        description="Selecione um paciente antes de abrir a prévia profissional."
        title="Nenhum paciente selecionado"
      />
    );
  }

  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    query.scenario as ClinicalCollectionScenarioKey,
  )
    ? (query.scenario as ClinicalCollectionScenarioKey)
    : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);
  const [hub, masterRecord, plan, prescription, strategy, patientContext] =
    await Promise.all([
      patientHubService.get({ patientId, scenario }),
      mvpService.getPatientMasterRecord(patientId),
      mealPlanService.get({ patientId, scenario }),
      nutritionPrescriptionService.get({ patientId, scenario, user: viewer }),
      nutritionStrategyService.get({ patientId, scenario, user: viewer }),
      nutritionClinicalPanelRepository.get(patientId),
    ]);

  if (!canAccess(access, "MEAL_PLAN", "READ") || !hub?.showNutrition) {
    return (
      <PageState
        description="Seu perfil não possui acesso às funcionalidades exclusivas da Nutrição."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  if (!patientContext) notFound();
  const flow = await nutritionClinicalFlowRepository.getFlow({
    patientId,
    attendanceId: patientContext.attendanceId,
    scenario,
  });
  if (!flow) notFound();

  const navigation = {
    id: patientId,
    name: patientContext.patient.name,
    code: patientContext.patient.code,
  };
  const deliverablesAccess = getNutritionClinicalFlowStepAccess(
    flow.flow,
    "DELIVERABLES",
    "DELIVERABLES",
  );

  if (!deliverablesAccess.canOpen) {
    return (
      <ClinicalFlowNavigation
        activeStep="DELIVERABLES"
        flow={flow.flow}
        patient={navigation}
      >
        <PageState
          action={
            <ButtonLink
              href={`/pacientes/${encodeURIComponent(patientId)}/plano-alimentar?scenario=${scenario}`}
            >
              Abrir Plano Alimentar
            </ButtonLink>
          }
          description="Conclua o Plano Alimentar antes de acessar os Entregáveis."
          title="Entregáveis bloqueados"
          tone="blocked"
        />
      </ClinicalFlowNavigation>
    );
  }

  if (!plan || !prescription || !strategy) {
    return (
      <ClinicalFlowNavigation
        activeStep="DELIVERABLES"
        flow={flow.flow}
        patient={navigation}
      >
        <PageState
          action={
            <ButtonLink href={`/pacientes/${encodeURIComponent(patientId)}`}>
              Voltar ao prontuário
            </ButtonLink>
          }
          description="Não foi possível localizar um Plano Alimentar disponível para este paciente."
          title="Entregável indisponível"
        />
      </ClinicalFlowNavigation>
    );
  }

  const strategySelection = nutritionStrategySelectionFromView(strategy);
  const mealReferences = createAssistedMealReferences(
    strategySelection,
    plan.meals,
  );
  const preview = createAssistedMealPreview(
    strategySelection,
    mealReferences,
    prescription.foods,
  );
  const recordedParticipants =
    await professionalResponsibilityService.listAttendanceParticipants({
      masterRecordId: plan.masterRecordId,
      attendanceId: patientContext.attendanceId,
    });
  const responsible =
    recordedParticipants.length === 0
      ? await professionalResponsibilityService.getProfessional(
          plan.responsibleUserId,
        )
      : null;
  const participants =
    recordedParticipants.length > 0
      ? recordedParticipants
      : responsible
        ? [
            {
              ...responsible,
              modules: [
                {
                  moduleKey: "MEAL_PLAN" as const,
                  moduleName: "Plano Alimentar",
                  executedAt: plan.updatedAt,
                },
              ],
            },
          ]
        : [];

  return (
    <ClinicalFlowNavigation
      activeStep="DELIVERABLES"
      flow={flow.flow}
      patient={navigation}
    >
      <MealPlanDocumentPreview
        foods={prescription.foods}
        initialPlan={plan}
        initialPreview={preview}
        initialStrategy={strategySelection}
        issuedAt={new Date().toISOString()}
        patient={{
          age: hub.header.age,
          sex:
            hub.header.sexLabel && hub.header.sexLabel !== "Não informado"
              ? hub.header.sexLabel
              : undefined,
          phone: masterRecord?.patient.primaryPhone || undefined,
        }}
        professionals={participants}
      />
    </ClinicalFlowNavigation>
  );
}
