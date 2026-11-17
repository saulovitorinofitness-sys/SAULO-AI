import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NutritionDeliverablePreview } from "@/components/deliverables/nutrition-deliverable-preview";
import { PerformanceDeliverablePreview } from "@/components/deliverables/performance-deliverable-preview";
import { PosturalDeliverablePreview } from "@/components/deliverables/postural-deliverable-preview";
import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageState,
} from "@/components/ui";
import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { buildPosturalEvolutionTimeline } from "@/features/clinical-collection/postural-history";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionDeliverablePersistence } from "@/features/nutrition-deliverables/persistence";
import { nutritionDeliverableService } from "@/features/nutrition-deliverables/service";
import {
  nutritionClinicalFlowHref,
  type NutritionClinicalFlowStepStatus,
} from "@/features/nutrition-clinical-flow";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { nutritionStrategyService } from "@/features/nutrition-strategy";
import { getLatestOfficialWorkoutPlan } from "@/features/performance-endurance/workout-repository";
import { physicalDocumentProfessionalIdentity } from "@/features/professional-responsibility/document-identity";
import { prisma } from "@/lib/database/prisma";

export const metadata: Metadata = {
  title: "Entregáveis do Atendimento",
};

const focusedDocumentScreenStyles = (
  <style>{`@media screen and (min-width: 1024px) {
    .global-deliverable-view #nutrition-deliverable-report,
    .global-deliverable-view #postural-deliverable-report,
    .global-deliverable-view #performance-deliverable-report { max-width: 100%; }
    .global-deliverable-view #nutrition-deliverable-report .text-xs,
    .global-deliverable-view #postural-deliverable-report .text-xs,
    .global-deliverable-view #performance-deliverable-report .text-xs { font-size: 0.875rem; }
    .global-deliverable-view #nutrition-deliverable-report .text-sm,
    .global-deliverable-view #postural-deliverable-report .text-sm,
    .global-deliverable-view #performance-deliverable-report .text-sm { font-size: 1rem; }
    .global-deliverable-view #nutrition-deliverable-report .text-base,
    .global-deliverable-view #postural-deliverable-report .text-base,
    .global-deliverable-view #performance-deliverable-report .text-base { font-size: 1.125rem; }
  }`}</style>
);

type DeliverableView =
  | "central"
  | "nutrition"
  | "meal-plan"
  | "meal-plan-draft"
  | "postural"
  | "performance";

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

function isClinicalCollectionScenario(
  value: string | undefined,
): value is ClinicalCollectionScenarioKey {
  return CLINICAL_COLLECTION_SCENARIO_KEYS.some((key) => key === value);
}

function deliverableHref(input: {
  patientId: string;
  attendanceId: string;
  scenario: ClinicalCollectionScenarioKey;
  view?: DeliverableView;
  prepareNutritionReport?: boolean;
  deliverableId?: string;
  masterRecordId?: string;
  entryId?: string;
  versionId?: string;
}) {
  const params = new URLSearchParams({
    patientId: input.patientId,
    attendanceId: input.attendanceId,
    scenario: input.scenario,
  });

  if (input.view && input.view !== "central") {
    params.set("view", input.view);
  }
  if (input.prepareNutritionReport) {
    params.set("prepare", "nutrition-report");
  }
  if (input.masterRecordId) {
    params.set("source", "global-deliverables");
    params.set("masterRecordId", input.masterRecordId);
  }
  if (input.deliverableId) params.set("deliverableId", input.deliverableId);
  if (input.entryId) params.set("entryId", input.entryId);
  if (input.versionId) params.set("versionId", input.versionId);

  return `/clinica/plano-alimentar/entregavel?${params.toString()}`;
}

function physicalDocumentPrintHref(input: {
  patientId: string;
  attendanceId: string;
  documentType: "postural" | "performance";
  intent: "PRINT" | "SAVE_PDF";
  masterRecordId: string;
  entryId: string;
  versionId?: string;
}) {
  const params = new URLSearchParams({
    patientId: input.patientId,
    attendanceId: input.attendanceId,
    documentType: input.documentType,
    intent: input.intent,
    masterRecordId: input.masterRecordId,
    entryId: input.entryId,
  });
  if (input.versionId) params.set("versionId", input.versionId);
  return `/clinica/plano-alimentar/entregavel/imprimir?${params.toString()}`;
}

function nutritionPrintHref(input: {
  patientId: string;
  attendanceId: string;
  intent: "PRINT" | "SAVE_PDF";
  deliverableId?: string;
  entryId?: string;
  versionId?: string;
}) {
  const params = new URLSearchParams({
    patientId: input.patientId,
    attendanceId: input.attendanceId,
    intent: input.intent,
    documentType: input.deliverableId ? "nutrition-report" : "meal-plan",
  });
  if (input.deliverableId) params.set("deliverableId", input.deliverableId);
  if (input.entryId) params.set("entryId", input.entryId);
  if (input.versionId) params.set("versionId", input.versionId);
  return `/clinica/plano-alimentar/entregavel/imprimir?${params.toString()}`;
}

function statusLabel(
  status: NutritionClinicalFlowStepStatus,
) {
  if (status === "COMPLETED") return "Concluído";
  if (status === "SKIPPED") return "Não realizada";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (status === "BLOCKED") return "Bloqueado";
  return "Não iniciado";
}

export default async function NutritionDeliverablePage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    attendanceId?: string;
    scenario?: string;
    view?: string;
    source?: string;
    masterRecordId?: string;
    entryId?: string;
    versionId?: string;
    deliverableId?: string;
    prepare?: string;
    print?: string;
  }>;
}) {
  const [query, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);

  const patientId = query.patientId?.trim();
  const requestedView: DeliverableView =
    query.view === "nutrition" ||
    query.view === "meal-plan" ||
    query.view === "meal-plan-draft" ||
    query.view === "postural" ||
    query.view === "performance"
      ? query.view
      : "central";
  const focusedView =
    query.source === "global-deliverables" && requestedView !== "central";
  const hasDocumentSelector = query.masterRecordId !== undefined ||
    query.entryId !== undefined || query.versionId !== undefined;
  const hasNutritionDocumentSelector = query.deliverableId !== undefined;
  const printMode = query.print === "1";
  const exactMealPlanDocument =
    requestedView === "meal-plan" || requestedView === "meal-plan-draft";
  const exactOfficialDocument = focusedView &&
    (requestedView === "postural" || requestedView === "performance");
  const printablePhysicalDocument =
    requestedView === "postural" || requestedView === "performance";
  if (hasDocumentSelector && !exactOfficialDocument && !exactMealPlanDocument) {
    notFound();
  }
  if (
    hasNutritionDocumentSelector &&
    (requestedView !== "nutrition" || !isUuid(query.deliverableId))
  ) notFound();
  if (
    printMode &&
    !hasNutritionDocumentSelector &&
    !exactMealPlanDocument &&
    !exactOfficialDocument &&
    !printablePhysicalDocument
  ) {
    notFound();
  }
  if (requestedView === "meal-plan" &&
    (!isUuid(query.entryId) || !isUuid(query.versionId))) notFound();
  if (requestedView === "meal-plan-draft" && !isUuid(query.entryId)) notFound();
  if (exactOfficialDocument && (
    !isUuid(query.masterRecordId) ||
    !isUuid(query.entryId) ||
    (requestedView === "performance" && !isUuid(query.versionId)) ||
    (query.versionId !== undefined && !isUuid(query.versionId))
  )) notFound();

  const scenario = isClinicalCollectionScenario(query.scenario)
    ? query.scenario
    : "complete";

  if (!patientId) {
    return (
      <PageState
        action={<ButtonLink href="/pacientes">Selecionar paciente</ButtonLink>}
        description="Selecione um paciente antes de abrir os entregáveis profissionais."
        title="Nenhum paciente selecionado"
      />
    );
  }

  const requestedAttendanceId = query.attendanceId?.trim();

  if (!requestedAttendanceId) {
    return (
      <PageState
        action={
          <ButtonLink href={`/pacientes/${encodeURIComponent(patientId)}`}>
            Voltar ao prontuário
          </ButtonLink>
        }
        description="Selecione explicitamente o atendimento antes de abrir os entregáveis profissionais."
        title="Nenhum atendimento selecionado"
      />
    );
  }

  const attendanceIds =
    await clinicalCollectionRepository.findAttendanceIds(patientId);

  if (!attendanceIds.length) notFound();

  const selectedAttendanceId = requestedAttendanceId;

  if (!attendanceIds.includes(selectedAttendanceId)) notFound();

  const flowResults = (
    await Promise.all(
      [selectedAttendanceId].map(async (attendanceId) => {
        const flow = await nutritionClinicalFlowRepository.getFlow({
          patientId,
          attendanceId,
          scenario,
        });

        return flow ? { attendanceId, flow } : null;
      }),
    )
  ).filter(
    (
      result,
    ): result is {
      attendanceId: string;
      flow: NonNullable<
        Awaited<
          ReturnType<typeof nutritionClinicalFlowRepository.getFlow>
        >
      >;
    } => Boolean(result),
  );

  if (!flowResults.length) notFound();

  const [latestWorkoutPlanEntry, posturalEvolution] = await Promise.all([
    prisma.masterRecordEntry.findFirst({
      where: {
        attendanceId: selectedAttendanceId,
        type: "WORKOUT_PLAN",
        deletedAt: null,
        status: { not: "VOIDED" },
        workoutPlan: { isNot: null },
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      orderBy: [{ occurredAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        masterRecordId: true,
        attendanceId: true,
        status: true,
      },
    }),
    clinicalCollectionRepository.getPosturalEvolution(patientId),
  ]);

  const collection = await clinicalCollectionRepository.getCollection(
    patientId,
    selectedAttendanceId,
  );

  if (!collection) notFound();

  const statusRank = {
    BLOCKED: 0,
    NOT_STARTED: 1,
    SKIPPED: 2,
    IN_PROGRESS: 3,
    COMPLETED: 4,
  } as const;

  function bestStep(
    stepId:
      | "NUTRITION_STRATEGY"
      | "MEAL_PLAN"
      | "POSTURAL_ASSESSMENT"
      | "PERFORMANCE",
  ) {
    return flowResults
      .map(({ attendanceId, flow }) => {
        const step = flow.flow.find((candidate) => candidate.id === stepId);
        return step ? { attendanceId, step } : null;
      })
      .filter(
        (
          result,
        ): result is {
          attendanceId: string;
          step: NonNullable<
            (typeof flowResults)[number]["flow"]["flow"][number]
          >;
        } => Boolean(result),
      )
      .sort(
        (left, right) =>
          statusRank[right.step.status] - statusRank[left.step.status],
      )[0];
  }

  const nutritionStrategyResult = bestStep("NUTRITION_STRATEGY");
  const nutritionResult = bestStep("MEAL_PLAN");
  const posturalResult = bestStep("POSTURAL_ASSESSMENT");
  const performanceResult = bestStep("PERFORMANCE");
  const persistedPerformanceStatus =
    latestWorkoutPlanEntry?.status === "FINALIZED"
      ? "COMPLETED"
      : latestWorkoutPlanEntry
        ? "IN_PROGRESS"
        : undefined;

  const preferredFlowResult = [...flowResults].sort((left, right) => {
    const score = (result: (typeof flowResults)[number]) =>
      result.flow.flow.reduce(
        (total, step) => total + statusRank[step.status],
        0,
      );

    return score(right) - score(left);
  })[0];

  const flow = preferredFlowResult.flow;

  const navigation = {
    id: patientId,
    name: collection.patientName,
    code: collection.patientCode,
  };

  const nutritionStep = nutritionResult?.step;
  const selectedPosturalHistory = posturalEvolution.history.filter(
    (assessment) => assessment.attendanceId === selectedAttendanceId,
  );
  const latestPosturalAssessment = selectedPosturalHistory.at(-1);
  const [latestPosturalVersion, latestWorkoutVersion] = await Promise.all([
    latestPosturalAssessment
      ? prisma.recordVersion.findFirst({
          where: {
            entityType: "ASSESSMENT_POSTURAL_ASSESSMENT",
            entityId: latestPosturalAssessment.assessmentId,
            status: "COMPLETED",
          },
          orderBy: [{ version: "desc" }, { createdAt: "desc" }],
          select: { id: true, version: true },
        })
      : null,
    latestWorkoutPlanEntry?.status === "FINALIZED"
      ? prisma.recordVersion.findFirst({
          where: {
            entityType: "WORKOUT_PLAN",
            entityId: latestWorkoutPlanEntry.id,
            status: "FINALIZED",
          },
          orderBy: [{ version: "desc" }, { createdAt: "desc" }],
          select: { id: true, version: true },
        })
      : null,
  ]);
  const persistedPosturalStatus = latestPosturalAssessment
    ? latestPosturalAssessment.status === "FINALIZED" ||
      latestPosturalAssessment.data.completionStatus === "COMPLETED"
      ? "COMPLETED"
      : "IN_PROGRESS"
    : undefined;
  const posturalOperationalStatus =
    posturalResult?.step.status ?? "NOT_STARTED";
  const performanceOperationalStatus =
    performanceResult?.step.status ?? "NOT_STARTED";
  const posturalStatus: Parameters<typeof statusLabel>[0] =
    posturalOperationalStatus === "SKIPPED"
      ? "SKIPPED"
      : persistedPosturalStatus ?? posturalOperationalStatus;
  const performanceStatus: Parameters<typeof statusLabel>[0] =
    performanceOperationalStatus === "SKIPPED"
      ? "SKIPPED"
      : persistedPerformanceStatus ?? performanceOperationalStatus;
  const nutritionDocumentAvailable =
    nutritionStrategyResult?.step.status === "COMPLETED" &&
    nutritionStep?.status === "COMPLETED";
  const posturalDocumentAvailable =
    posturalStatus === "COMPLETED" && Boolean(latestPosturalAssessment);
  const performanceDocumentAvailable =
    performanceStatus === "COMPLETED" &&
    latestWorkoutPlanEntry?.status === "FINALIZED";
  const hasNutritionAccess =
    canAccess(access, "MEAL_PLAN", "READ") &&
    nutritionStrategyService.canAccess(access.user);
  const canOpenNutrition = nutritionDocumentAvailable && hasNutritionAccess;
  const canOpenPostural =
    posturalDocumentAvailable &&
    canAccess(access, "POSTURAL_ASSESSMENT", "READ");
  const canOpenPerformance =
    performanceDocumentAvailable &&
    canAccess(access, "WORKOUT_PLAN", "READ");

  if (requestedView === "meal-plan" || requestedView === "meal-plan-draft") {
    if (!hasNutritionAccess) {
      return (
        <PageState
          description="Seu perfil não possui acesso de leitura ao Plano Alimentar."
          title="Acesso não permitido"
          tone="blocked"
        />
      );
    }

    const draftPlanPreview = requestedView === "meal-plan-draft";
    const source = draftPlanPreview
      ? await nutritionDeliverableService.getDraftPlanSource({
          patientId,
          attendanceId: selectedAttendanceId,
          entryId: query.entryId!,
        })
      : await nutritionDeliverableService.getFinalizedPlanSource({
          patientId,
          attendanceId: selectedAttendanceId,
          entryId: query.entryId,
          versionId: query.versionId,
        });
    if (!source) notFound();

    const panel = await nutritionClinicalPanelRepository.get(
      patientId,
      selectedAttendanceId,
    );
    if (!panel) notFound();
    const draft = await nutritionDeliverableService.createDraft({
      patientId,
      attendanceId: selectedAttendanceId,
      panel,
      planSource: {
        entryId: source.entryId,
        ...(draftPlanPreview ? {} : { versionId: query.versionId! }),
      },
      allowDraftPlan: draftPlanPreview,
    });
    if (!draft) notFound();

    const preview = (
      <NutritionDeliverablePreview
        documentType={draftPlanPreview ? "nutrition-report" : "meal-plan"}
        focused={focusedView}
        initialDraft={draft}
        officialVersion={source.version}
        printMode={printMode}
        sourcePlanDraftPreview={draftPlanPreview}
        sourceEntryId={source.entryId}
        sourceVersionId={draftPlanPreview ? undefined : query.versionId}
      />
    );
    if (printMode) {
      return <div className="print-document-page mx-auto w-full max-w-[76rem] bg-white">{preview}</div>;
    }
    if (focusedView) {
      return (
        <div className="global-deliverable-view mx-auto w-full max-w-[76rem] space-y-4 lg:px-5">
          {focusedDocumentScreenStyles}
          <div className="flex justify-end print:hidden">
            <ButtonLink href="/entregaveis" variant="secondary">
              Voltar à Central de Entregáveis
            </ButtonLink>
          </div>
          {preview}
        </div>
      );
    }
    return (
      <ClinicalFlowNavigation
        activeStep="DELIVERABLES"
        flow={flow.flow}
        patient={navigation}
      >
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <ButtonLink
              href={deliverableHref({
                patientId,
                attendanceId: selectedAttendanceId,
                scenario,
              })}
              variant="secondary"
            >
              Voltar aos Entregáveis
            </ButtonLink>
          </div>
          {preview}
        </div>
      </ClinicalFlowNavigation>
    );
  }

  if (requestedView === "nutrition") {
    if (
      !hasNutritionAccess
    ) {
      return (
        <PageState
          action={
            <ButtonLink
              href={deliverableHref({
                patientId,
                attendanceId: collection.attendanceId,
                scenario,
              })}
            >
              Voltar aos Entregáveis
            </ButtonLink>
          }
          description="Seu perfil não possui acesso às funcionalidades exclusivas da Nutrição."
          title="Acesso não permitido"
          tone="blocked"
        />
      );
    }

    const officialDocument = query.deliverableId
      ? await nutritionDeliverablePersistence.getOfficial({
          patientId,
          attendanceId: selectedAttendanceId,
          deliverableId: query.deliverableId,
        })
      : null;
    if (query.deliverableId && !officialDocument) notFound();

    if (!officialDocument && !canOpenNutrition) {
      return (
        <PageState
          action={
            <ButtonLink
              href={deliverableHref({
                patientId,
                attendanceId: selectedAttendanceId,
                scenario,
              })}
            >
              Voltar aos Entregáveis
            </ButtonLink>
          }
          description="Estratégia Nutricional e Plano Alimentar precisam estar concluídos neste atendimento. Nenhum relatório vazio foi criado."
          title="Relatório Nutricional indisponível"
          tone="blocked"
        />
      );
    }

    const nutritionAttendanceId =
      nutritionResult?.attendanceId ?? collection.attendanceId;

    if (officialDocument) {
      const preview = (
        <NutritionDeliverablePreview
          focused={focusedView}
          initialDraft={officialDocument.snapshot}
          officialDocumentId={officialDocument.id}
          officialVersion={officialDocument.version}
          printMode={printMode}
        />
      );
      if (printMode) {
        return (
          <div className="print-document-page mx-auto w-full max-w-[76rem] bg-white">
            {preview}
          </div>
        );
      }
      if (focusedView) {
        return (
          <div className="global-deliverable-view mx-auto w-full max-w-[76rem] space-y-4 lg:px-5">
            {focusedDocumentScreenStyles}
            <div className="flex justify-end print:hidden">
              <ButtonLink href="/entregaveis" variant="secondary">
                Voltar à Central de Entregáveis
              </ButtonLink>
            </div>
            {preview}
          </div>
        );
      }
      return (
        <ClinicalFlowNavigation
          activeStep="DELIVERABLES"
          flow={flow.flow}
          patient={navigation}
        >
          <div className="space-y-4">
            <div className="flex justify-end print:hidden">
              <ButtonLink
                href={deliverableHref({
                  patientId,
                  attendanceId: selectedAttendanceId,
                  scenario,
                })}
                variant="secondary"
              >
                Voltar aos Entregáveis
              </ButtonLink>
            </div>
            {preview}
          </div>
        </ClinicalFlowNavigation>
      );
    }

    const panel = await nutritionClinicalPanelRepository.get(
      patientId,
      nutritionAttendanceId,
    );

    if (!panel) notFound();

    const draft = await nutritionDeliverableService.createDraft({
      patientId,
      attendanceId: panel.attendanceId,
      panel,
    });

    if (focusedView) {
      return (
        <div className="global-deliverable-view mx-auto w-full max-w-[76rem] space-y-4 lg:px-5">
          {focusedDocumentScreenStyles}
          <div className="flex justify-end print:hidden">
            <ButtonLink href="/entregaveis" variant="secondary">
              Voltar à Central de Entregáveis
            </ButtonLink>
          </div>
          {draft ? (
            <NutritionDeliverablePreview focused initialDraft={draft} />
          ) : (
            <PageState
              description="O plano concluído não possui um profissional responsável identificado para esta prévia."
              title="Responsável não identificado"
              tone="blocked"
            />
          )}
        </div>
      );
    }

    return (
      <ClinicalFlowNavigation
        activeStep="DELIVERABLES"
        flow={flow.flow}
        patient={navigation}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <ButtonLink
              href={deliverableHref({
                patientId,
                attendanceId: collection.attendanceId,
                scenario,
              })}
              variant="secondary"
            >
              Voltar à Central de Entregáveis
            </ButtonLink>
          </div>

          {draft ? (
            <NutritionDeliverablePreview initialDraft={draft} />
          ) : (
            <PageState
              action={
                <ButtonLink
                  href={nutritionClinicalFlowHref("MEAL_PLAN", {
                    patientId,
                    attendanceId: panel.attendanceId,
                    scenario,
                  })}
                >
                  Revisar Plano Alimentar
                </ButtonLink>
              }
              description="Confirme o profissional responsável deste atendimento para abrir a prévia."
              title="Responsável não identificado"
              tone="blocked"
            />
          )}
        </div>
      </ClinicalFlowNavigation>
    );
  }

  if (requestedView === "postural") {
    if (!canAccess(access, "POSTURAL_ASSESSMENT", "READ")) {
      return (
        <PageState
          action={<ButtonLink href={deliverableHref({ patientId, attendanceId: collection.attendanceId, scenario })}>Voltar aos Entregáveis</ButtonLink>}
          description="Seu perfil não possui acesso à Avaliação Postural."
          title="Acesso não permitido"
          tone="blocked"
        />
      );
    }
    const selectedOfficialAssessment = exactOfficialDocument
      ? await clinicalCollectionRepository.getOfficialPosturalAssessment({
          patientId,
          masterRecordId: query.masterRecordId!,
          attendanceId: selectedAttendanceId,
          entryId: query.entryId!,
          versionId: query.versionId,
        })
      : null;
    if (exactOfficialDocument && (!selectedOfficialAssessment || posturalStatus === "SKIPPED")) {
      notFound();
    }
    const reportHistory = selectedOfficialAssessment
      ? buildPosturalEvolutionTimeline([
          ...selectedPosturalHistory.filter((assessment) =>
            assessment.assessmentId !== selectedOfficialAssessment.assessmentId &&
            assessment.assessedAt < selectedOfficialAssessment.assessedAt,
          ),
          selectedOfficialAssessment,
        ])
      : selectedPosturalHistory;
    const reportAssessment = reportHistory.at(-1);
    if ((!exactOfficialDocument && !canOpenPostural) || !reportAssessment) {
      return (
        <PageState
          action={
            <ButtonLink
              href={deliverableHref({
                patientId,
                attendanceId: selectedAttendanceId,
                scenario,
              })}
            >
              Voltar aos Entregáveis
            </ButtonLink>
          }
          description="A Avaliação Postural não possui uma conclusão disponível para este atendimento."
          title="Relatório Postural indisponível"
          tone="blocked"
        />
      );
    }
    const professional = await physicalDocumentProfessionalIdentity(
      reportAssessment.audit.professionalUserId,
      reportAssessment.audit.professionalName,
    );
    const comparison = posturalEvolution.comparisons.find(
      (item) =>
        item.currentAssessmentId === reportAssessment.assessmentId,
    );

    if (printMode) {
      return (
        <div className="print-document-page mx-auto w-full max-w-[76rem] bg-white">
          <PosturalDeliverablePreview
            comparison={comparison}
            history={reportHistory}
            patient={{ name: collection.patientName, code: collection.patientCode, age: collection.patientAge }}
            printMode
            professional={professional}
          />
        </div>
      );
    }

    if (focusedView) {
      return (
        <div className="global-deliverable-view mx-auto w-full max-w-[76rem] space-y-4 lg:px-5">
          {focusedDocumentScreenStyles}
          <div className="flex justify-end print:hidden">
            <ButtonLink href="/entregaveis" variant="secondary">
              Voltar à Central de Entregáveis
            </ButtonLink>
          </div>
          <PosturalDeliverablePreview comparison={comparison} history={reportHistory} patient={{ name: collection.patientName, code: collection.patientCode, age: collection.patientAge }} professional={professional} />
        </div>
      );
    }

    return (
      <ClinicalFlowNavigation activeStep="DELIVERABLES" flow={flow.flow} patient={navigation}>
        <div className="space-y-4">
          <div className="flex justify-end print:hidden"><ButtonLink href={deliverableHref({ patientId, attendanceId: collection.attendanceId, scenario })} variant="secondary">Voltar à Central de Entregáveis</ButtonLink></div>
          <PosturalDeliverablePreview comparison={comparison} history={reportHistory} patient={{ name: collection.patientName, code: collection.patientCode, age: collection.patientAge }} professional={professional} />
        </div>
      </ClinicalFlowNavigation>
    );
  }

  if (requestedView === "performance") {
    if (!canAccess(access, "WORKOUT_PLAN", "READ")) {
      return (
        <PageState
          action={<ButtonLink href={deliverableHref({ patientId, attendanceId: collection.attendanceId, scenario })}>Voltar aos Entregáveis</ButtonLink>}
          description="Seu perfil não possui acesso ao Plano de Treino."
          title="Acesso não permitido"
          tone="blocked"
        />
      );
    }
    if ((!exactOfficialDocument && !canOpenPerformance) || performanceStatus === "SKIPPED") {
      return (
        <PageState
          action={
            <ButtonLink
              href={deliverableHref({
                patientId,
                attendanceId: selectedAttendanceId,
                scenario,
              })}
            >
              Voltar aos Entregáveis
            </ButtonLink>
          }
          description="Performance não possui um Plano de Treino oficial concluído neste atendimento."
          title="Plano de Treino indisponível"
          tone="blocked"
        />
      );
    }
    const performanceAttendanceId = selectedAttendanceId;
    const workout = performanceAttendanceId
      ? await getLatestOfficialWorkoutPlan({
          patientId,
          attendanceId: performanceAttendanceId,
          professionalUserId: access.user.id,
          masterRecordId: exactOfficialDocument ? query.masterRecordId : undefined,
          entryId: exactOfficialDocument ? query.entryId : undefined,
          versionId: exactOfficialDocument ? query.versionId : undefined,
        })
      : null;
    if (exactOfficialDocument && !workout) notFound();
    if (!workout?.entryId) {
      return (
        <PageState
          action={
            <ButtonLink
              href={deliverableHref({
                patientId,
                attendanceId: collection.attendanceId,
                scenario,
              })}
            >
              Voltar aos Entregáveis
            </ButtonLink>
          }
          description="O Plano de Treino ainda não possui uma entrega oficial finalizada."
          title="Entrega oficial indisponível"
          tone="blocked"
        />
      );
    }
    const professional = await physicalDocumentProfessionalIdentity(
      workout.responsibleProfessionalId,
      workout.responsibleProfessional,
    );
    const workoutAttendanceId = workout.attendanceId.trim();
    const performancePlanHref =
      patientId && workoutAttendanceId
        ? `/performance-endurance?${new URLSearchParams({
            patientId,
            attendanceId: workoutAttendanceId,
          }).toString()}`
        : "/performance-endurance";

    if (printMode) {
      return (
        <div className="print-document-page mx-auto w-full max-w-[76rem] bg-white">
          <PerformanceDeliverablePreview
            printMode
            professional={professional}
            view={workout}
          />
        </div>
      );
    }

    return (
      <div className={`${focusedView ? "global-deliverable-view max-w-[76rem] lg:px-5" : "max-w-[86rem]"} mx-auto w-full space-y-3`}>
        {focusedView ? focusedDocumentScreenStyles : null}
        <nav
          aria-label="Ações da entrega oficial de Performance"
          className="flex min-w-0 items-center print:hidden"
        >
          <ButtonLink
            href={focusedView ? "/entregaveis" : performancePlanHref}
            size="small"
            variant="secondary"
          >
            {focusedView ? "Voltar à Central de Entregáveis" : "Voltar ao Plano de Treino"}
          </ButtonLink>
        </nav>
        <PerformanceDeliverablePreview
          professional={professional}
          view={workout}
        />
      </div>
    );
  }

  const [officialNutritionDocuments, finalizedMealPlanSource] =
    hasNutritionAccess
      ? await Promise.all([
          nutritionDeliverablePersistence.listOfficial({
            patientId,
            attendanceId: selectedAttendanceId,
          }),
          nutritionDeliverableService.getFinalizedPlanSource({
            patientId,
            attendanceId: selectedAttendanceId,
          }),
        ])
      : [[], null];

  return (
    <ClinicalFlowNavigation
      activeStep="DELIVERABLES"
      flow={flow.flow}
      patient={navigation}
    >
      <div className="space-y-5">
        <Card className="overflow-hidden p-0" variant="elevated">
          <div className="bg-[var(--primary)] px-6 py-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
              Etapa 10 · Entregáveis profissionais
            </p>
            <h1 className="mt-2 text-2xl font-black">
              Central de Entregáveis
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-emerald-50">
              Cada serviço mantém seu documento profissional separado. Nutrição,
              Avaliação Postural e Performance não são misturados no mesmo
              relatório.
            </p>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[var(--primary)]">
                  Nutrição
                </p>
                <h2 className="mt-2 text-lg font-black">
                  Documentos Nutricionais
                </h2>
              </div>
              <Badge
                tone={
                  officialNutritionDocuments.length > 0 || finalizedMealPlanSource
                    ? "success"
                    : "warning"
                }
              >
                {officialNutritionDocuments.length > 0 && finalizedMealPlanSource
                  ? "Entregável completo e plano disponíveis"
                  : officialNutritionDocuments.length > 0
                    ? "Entregável completo publicado"
                    : finalizedMealPlanSource
                      ? "Prévia completa disponível"
                    : statusLabel(nutritionStep?.status ?? "NOT_STARTED")}
              </Badge>
            </div>

            <p className="mt-3 flex-1 text-sm text-[var(--text-secondary)]">
              O Entregável Nutricional Completo reúne avaliação, estratégia,
              plano, receitas, lista de compras, análise e acompanhamento. O
              Plano Alimentar isolado permanece como opção adicional.
            </p>

            <div className="mt-5 space-y-2">
              {officialNutritionDocuments.map((document) => (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3" key={document.id}>
                  <p className="text-xs font-black text-emerald-950">
                    Entregável Nutricional Completo · versão {document.version}
                  </p>
                  <p className="mt-1 text-xs text-emerald-900">
                    Documento publicado. Visualizar e imprimir são operações de leitura.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <ButtonLink
                      href={deliverableHref({
                        patientId,
                        attendanceId: selectedAttendanceId,
                        scenario,
                        view: "nutrition",
                        deliverableId: document.id,
                      })}
                      size="small"
                      variant="secondary"
                    >
                      Visualizar
                    </ButtonLink>
                    <ButtonLink
                      href={nutritionPrintHref({
                        patientId,
                        attendanceId: selectedAttendanceId,
                        intent: "PRINT",
                        deliverableId: document.id,
                      })}
                      size="small"
                    >
                      Imprimir
                    </ButtonLink>
                    <ButtonLink
                      href={nutritionPrintHref({
                        patientId,
                        attendanceId: selectedAttendanceId,
                        intent: "SAVE_PDF",
                        deliverableId: document.id,
                      })}
                      size="small"
                      variant="secondary"
                    >
                      Salvar em PDF
                    </ButtonLink>
                  </div>
                </div>
              ))}
              {officialNutritionDocuments.length === 0 && canOpenNutrition ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-black text-amber-950">
                    Entregável Nutricional Completo · prévia não publicada
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    O conteúdo completo pode ser conferido e impresso sem publicar.
                    Salvar o relatório oficial continua sendo uma ação separada.
                  </p>
                  <ButtonLink
                    className="mt-3 w-full"
                    href={deliverableHref({
                      patientId,
                      attendanceId:
                        nutritionResult?.attendanceId ?? collection.attendanceId,
                      scenario,
                      view: "nutrition",
                    })}
                  >
                    Visualizar entregável completo
                  </ButtonLink>
                </div>
              ) : officialNutritionDocuments.length === 0 && nutritionDocumentAvailable ? (
                <Button disabled className="w-full" type="button">
                  Sem acesso à Nutrição
                </Button>
              ) : officialNutritionDocuments.length === 0 ? (
                <Button disabled className="w-full" type="button">
                  Entregável Nutricional Completo indisponível
                </Button>
              ) : null}
              {finalizedMealPlanSource ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-black text-slate-800">
                    Plano Alimentar isolado · versão {finalizedMealPlanSource.version}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Opção adicional somente com a prescrição alimentar e suas receitas.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <ButtonLink
                      href={deliverableHref({
                        patientId,
                        attendanceId: selectedAttendanceId,
                        scenario,
                        view: "meal-plan",
                        entryId: finalizedMealPlanSource.entryId,
                        versionId: finalizedMealPlanSource.versionId,
                      })}
                      size="small"
                      variant="secondary"
                    >
                      Visualizar
                    </ButtonLink>
                    <ButtonLink
                      href={nutritionPrintHref({
                        patientId,
                        attendanceId: selectedAttendanceId,
                        intent: "PRINT",
                        entryId: finalizedMealPlanSource.entryId,
                        versionId: finalizedMealPlanSource.versionId,
                      })}
                      size="small"
                    >
                      Imprimir
                    </ButtonLink>
                    <ButtonLink
                      href={nutritionPrintHref({
                        patientId,
                        attendanceId: selectedAttendanceId,
                        intent: "SAVE_PDF",
                        entryId: finalizedMealPlanSource.entryId,
                        versionId: finalizedMealPlanSource.versionId,
                      })}
                      size="small"
                      variant="secondary"
                    >
                      Salvar em PDF
                    </ButtonLink>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-sky-700">
                  Avaliação Postural
                </p>
                <h2 className="mt-2 text-lg font-black">
                  Relatório Postural
                </h2>
              </div>
              <Badge
                tone={
                  posturalStatus === "COMPLETED"
                    ? "success"
                    : "warning"
                }
              >
                {statusLabel(posturalStatus)}
              </Badge>
            </div>

            <p className="mt-3 flex-1 text-sm text-[var(--text-secondary)]">
              Documento próprio da Avaliação Postural com registros,
              fotografias, achados e conclusão profissional.
            </p>

            <div className="mt-5">
              {canOpenPostural && latestPosturalAssessment ? (
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <ButtonLink href={deliverableHref({
                    patientId,
                    attendanceId: latestPosturalAssessment.attendanceId ?? collection.attendanceId,
                    scenario,
                    view: "postural",
                    masterRecordId: latestPosturalAssessment.masterRecordId,
                    entryId: latestPosturalAssessment.assessmentId,
                    versionId: latestPosturalVersion?.id,
                  })} size="small" variant="secondary">Visualizar</ButtonLink>
                  <ButtonLink href={physicalDocumentPrintHref({
                    patientId,
                    attendanceId: latestPosturalAssessment.attendanceId ?? collection.attendanceId,
                    documentType: "postural",
                    intent: "PRINT",
                    masterRecordId: latestPosturalAssessment.masterRecordId,
                    entryId: latestPosturalAssessment.assessmentId,
                    versionId: latestPosturalVersion?.id,
                  })} size="small">Imprimir</ButtonLink>
                  <ButtonLink href={physicalDocumentPrintHref({
                    patientId,
                    attendanceId: latestPosturalAssessment.attendanceId ?? collection.attendanceId,
                    documentType: "postural",
                    intent: "SAVE_PDF",
                    masterRecordId: latestPosturalAssessment.masterRecordId,
                    entryId: latestPosturalAssessment.assessmentId,
                    versionId: latestPosturalVersion?.id,
                  })} size="small" variant="secondary">Salvar em PDF</ButtonLink>
                </div>
              ) : (
                <Button disabled className="w-full" type="button" variant="secondary">Relatório Postural indisponível</Button>
              )}
            </div>
          </Card>

          <Card className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-indigo-700">
                  Performance
                </p>
                <h2 className="mt-2 text-lg font-black">
                  Plano de Treino
                </h2>
              </div>
              <Badge
                tone={
                  performanceStatus === "COMPLETED"
                    ? "success"
                    : "warning"
                }
              >
                {statusLabel(performanceStatus)}
              </Badge>
            </div>

            <p className="mt-3 flex-1 text-sm text-[var(--text-secondary)]">
              Documento de prescrição do treino com estratégia, periodização,
              sessões, exercícios e orientações de execução.
            </p>

            <div className="mt-5">
              {canOpenPerformance && latestWorkoutPlanEntry?.attendanceId && latestWorkoutVersion ? (
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <ButtonLink href={deliverableHref({
                    patientId,
                    attendanceId: latestWorkoutPlanEntry.attendanceId,
                    scenario,
                    view: "performance",
                    masterRecordId: latestWorkoutPlanEntry.masterRecordId,
                    entryId: latestWorkoutPlanEntry.id,
                    versionId: latestWorkoutVersion.id,
                  })} size="small" variant="secondary">Visualizar</ButtonLink>
                  <ButtonLink href={physicalDocumentPrintHref({
                    patientId,
                    attendanceId: latestWorkoutPlanEntry.attendanceId,
                    documentType: "performance",
                    intent: "PRINT",
                    masterRecordId: latestWorkoutPlanEntry.masterRecordId,
                    entryId: latestWorkoutPlanEntry.id,
                    versionId: latestWorkoutVersion.id,
                  })} size="small">Imprimir</ButtonLink>
                  <ButtonLink href={physicalDocumentPrintHref({
                    patientId,
                    attendanceId: latestWorkoutPlanEntry.attendanceId,
                    documentType: "performance",
                    intent: "SAVE_PDF",
                    masterRecordId: latestWorkoutPlanEntry.masterRecordId,
                    entryId: latestWorkoutPlanEntry.id,
                    versionId: latestWorkoutVersion.id,
                  })} size="small" variant="secondary">Salvar em PDF</ButtonLink>
                </div>
              ) : (
                <Button disabled className="w-full" type="button" variant="secondary">Plano de Treino indisponível</Button>
              )}
            </div>
          </Card>
        </div>

        <p className="text-xs font-semibold text-[var(--muted)]">
          Prontuário consolidado · {attendanceIds.length} atendimento
          {attendanceIds.length === 1 ? "" : "s"} localizado
          {attendanceIds.length === 1 ? "" : "s"}
        </p>
      </div>
    </ClinicalFlowNavigation>
  );
}
