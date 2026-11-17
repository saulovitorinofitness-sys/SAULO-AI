"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { AccordionSection } from "@/components/ui/accordion-section";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_POSTURAL_SYMMETROGRAPH,
  generatePosturalTechnicalSummary,
  posturalSegmentsByView,
} from "@/features/clinical-collection";
import type {
  ClinicalStepRecord,
  PosturalCompletionStatus,
  PosturalAssessmentData,
  PosturalAnnotationLayer,
  PosturalFollowUpConduct,
  PosturalOverallRelevance,
  PosturalSegmentAssessment,
  PosturalSegmentGrade,
  PosturalSegmentRelevance,
  PosturalSymmetrograph,
  PosturalReferenceLines,
  PosturalTechnicalSummary,
  PosturalViewImage,
  PosturalViewKey,
  ProfessionalAudit,
  StructuredFindingState,
} from "@/features/clinical-collection";
import type { NutritionClinicalFlowStepStatus } from "@/features/nutrition-clinical-flow/flow";

import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { focusFirstInvalidField } from "./focus-invalid-field";
import { PendingFieldsAlert } from "./pending-fields-alert";
import {
  DEFAULT_POSTURAL_REFERENCE_LINES,
  PosturalImageViewer,
} from "./postural-image-viewer";
import { PosturalEvolutionSection } from "./postural-evolution-section";
import { PosturalSegmentCard } from "./postural-segment-card";
import { PosturalTechnicalSummarySection } from "./postural-technical-summary-section";
import { ProfessionalAuditInfo } from "./professional-audit-info";
import { ResponsiveActionBar } from "./responsive-action-bar";

const viewDefinitions: readonly {
  key: PosturalViewKey;
  title: string;
}[] = [
  {
    key: "ANTERIOR",
    title: "Vista anterior",
  },
  {
    key: "POSTERIOR",
    title: "Vista posterior",
  },
  {
    key: "RIGHT_LATERAL",
    title: "Vista lateral direita",
  },
  {
    key: "LEFT_LATERAL",
    title: "Vista lateral esquerda",
  },
];

const stateOptions: readonly {
  value: StructuredFindingState;
  label: string;
}[] = [
  {
    value: "NOT_ASSESSED",
    label: "Não avaliada",
  },
  {
    value: "NO_FINDING_RECORDED",
    label: "Sem achado registrado",
  },
  {
    value: "FINDING_RECORDED",
    label: "Achado identificado",
  },
];

type PosturalMediaState = Readonly<
  Record<
    PosturalViewKey,
    {
      readonly image?: PosturalViewImage;
      readonly symmetrograph: PosturalSymmetrograph;
      readonly referenceLines: PosturalReferenceLines;
      readonly annotations: readonly PosturalAnnotationLayer[];
    }
  >
>;

type SelectedAnnotationByView = Partial<
  Record<PosturalViewKey, string | undefined>
>;

function defaultReferenceLines(): PosturalReferenceLines {
  return {
    ...DEFAULT_POSTURAL_REFERENCE_LINES,
    horizontal: [
      { ...DEFAULT_POSTURAL_REFERENCE_LINES.horizontal[0] },
      { ...DEFAULT_POSTURAL_REFERENCE_LINES.horizontal[1] },
    ],
    vertical: [
      { ...DEFAULT_POSTURAL_REFERENCE_LINES.vertical[0] },
      { ...DEFAULT_POSTURAL_REFERENCE_LINES.vertical[1] },
    ],
  };
}

function PosturalImageBlock({
  annotations,
  assessmentId,
  image,
  onAnnotationsChange,
  onChangeImage,
  onChangeSymmetrograph,
  onReferenceLinesChange,
  onSelectedAnnotationChange,
  patientId,
  referenceLines,
  selectedAnnotationId,
  symmetrograph,
  title,
  viewKey,
}: {
  annotations: readonly PosturalAnnotationLayer[];
  assessmentId?: string;
  image?: PosturalViewImage;
  onAnnotationsChange: (
    annotations: readonly PosturalAnnotationLayer[],
  ) => void;
  onChangeImage: (image?: PosturalViewImage) => void;
  onChangeSymmetrograph: (
    symmetrograph: PosturalSymmetrograph,
  ) => void;
  onReferenceLinesChange: (
    referenceLines: PosturalReferenceLines,
  ) => void;
  onSelectedAnnotationChange: (id?: string) => void;
  patientId: string;
  referenceLines: PosturalReferenceLines;
  selectedAnnotationId?: string;
  symmetrograph: PosturalSymmetrograph;
  title: string;
  viewKey: PosturalViewKey;
}) {
  return (
    <PosturalImageViewer
      annotations={annotations}
      assessmentId={assessmentId}
      gridEnabled={symmetrograph.enabled}
      gridOpacity={symmetrograph.opacity}
      image={image}
      onAnnotationsChange={onAnnotationsChange}
      onChange={onChangeImage}
      onGridChange={onChangeSymmetrograph}
      onReferenceLinesChange={onReferenceLinesChange}
      onRemove={() => onChangeImage(undefined)}
      onSelectedAnnotationChange={onSelectedAnnotationChange}
      patientId={patientId}
      readOnly={false}
      referenceLines={referenceLines}
      selectedAnnotationId={selectedAnnotationId}
      title={title}
      viewType={viewKey}
    />
  );
}

function PosturalArea({
  id,
  state,
  observation,
  onDirty,
}: {
  id: string;
  state: StructuredFindingState;
  observation?: string;
  onDirty: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ClinicalField
        id={`${id}-state`}
        label="Situação geral"
      >
        <select
          className={clinicalInputClass}
          defaultValue={state}
          id={`${id}-state`}
          name={`${id}-state`}
          onChange={onDirty}
        >
          {stateOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </ClinicalField>

      <ClinicalField
        hint="Descreva somente o que foi observado; nenhuma análise automática será aplicada."
        id={`${id}-observation`}
        label="Observações gerais"
      >
        <textarea
          className={`${clinicalInputClass} min-h-24 resize-y py-3`}
          defaultValue={observation}
          id={`${id}-observation`}
          name={`${id}-observation`}
          onChange={onDirty}
        />
      </ClinicalField>
    </div>
  );
}

const text = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim() || undefined;

function posturalSegments(
  form: FormData,
  formKey: string,
  viewKey: PosturalViewKey,
) {
  const assessments: Record<string, PosturalSegmentAssessment> =
    {};

  for (const definition of posturalSegmentsByView[viewKey]) {
    const prefix = `${formKey}-segment-${definition.key}`;
    const selectedOption = text(form, `${prefix}-option`);
    const grade = text(form, `${prefix}-grade`) as
      | PosturalSegmentGrade
      | undefined;
    const observation = text(form, `${prefix}-observation`);
    const investigationSuggestions = form
      .getAll(`${prefix}-investigation`)
      .map(String)
      .filter(Boolean);
    const otherInvestigation = text(
      form,
      `${prefix}-other-investigation`,
    );
    const relevance = text(form, `${prefix}-relevance`) as
      | PosturalSegmentRelevance
      | undefined;

    if (
      selectedOption ||
      grade ||
      observation ||
      investigationSuggestions.length ||
      otherInvestigation ||
      relevance
    ) {
      assessments[definition.key] = {
        selectedOption,
        grade,
        observation,
        investigationSuggestions:
          investigationSuggestions.length > 0
            ? investigationSuggestions
            : undefined,
        otherInvestigation,
        relevance,
      };
    }
  }

  return Object.keys(assessments).length > 0
    ? assessments
    : undefined;
}

export function PosturalStep({
  assessedAt,
  assessmentId,
  evaluatorName,
  onBack,
  operationalStatus,
  patientId,
  record,
  responsibleProfessional,
  saving,
  onDirty,
  onSave,
}: {
  assessedAt?: string;
  assessmentId?: string;
  evaluatorName?: string;
  onBack: () => void;
  operationalStatus?: NutritionClinicalFlowStepStatus;
  patientId: string;
  record: ClinicalStepRecord<PosturalAssessmentData>;
  responsibleProfessional?: ProfessionalAudit;
  saving: boolean;
  onDirty: (data: PosturalAssessmentData) => void;
  onSave: (
    data: PosturalAssessmentData,
    continueAfterSave: boolean,
  ) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const assessmentWasSkipped = operationalStatus === "SKIPPED";
  const [openSection, setOpenSection] = useState("anterior");
  const [confirmCompletion, setConfirmCompletion] =
    useState(false);
  const [technicalSummary, setTechnicalSummary] =
    useState<PosturalTechnicalSummary>(
      record.data.technicalSummary ?? {},
    );

  useEffect(() => {
    if (!confirmCompletion) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmCompletion(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () =>
      document.removeEventListener("keydown", closeOnEscape);
  }, [confirmCompletion]);

  const [mediaByView, setMediaByView] =
    useState<PosturalMediaState>(() =>
      Object.fromEntries(
        viewDefinitions.map(({ key }) => [
          key,
          {
            image: record.data.views[key].image,
            symmetrograph:
              record.data.views[key].symmetrograph ??
              DEFAULT_POSTURAL_SYMMETROGRAPH,
            referenceLines:
              record.data.referenceLines?.[key] ??
              defaultReferenceLines(),
            annotations:
              record.data.annotationLayers?.[key] ?? [],
          },
        ]),
      ) as unknown as PosturalMediaState,
    );
  const mediaByViewRef = useRef(mediaByView);
  const [selectedAnnotationByView, setSelectedAnnotationByView] =
    useState<SelectedAnnotationByView>({});

  function updateMediaView(
    viewKey: PosturalViewKey,
    updater: (
      current: PosturalMediaState[PosturalViewKey],
    ) => PosturalMediaState[PosturalViewKey],
  ) {
    const current = mediaByViewRef.current;
    const next = {
      ...current,
      [viewKey]: updater(current[viewKey]),
    };

    mediaByViewRef.current = next;
    setMediaByView(next);
  }

  function toggleSection(section: string) {
    setOpenSection((current) =>
      current === section ? "" : section,
    );
  }

  function assessmentData(
    form: FormData,
    completionStatus: PosturalCompletionStatus =
      record.data.completionStatus ?? "IN_PROGRESS",
  ): PosturalAssessmentData {
    const state = (key: string) =>
      String(form.get(key)) as StructuredFindingState;
    const viewData = (
      viewKey: PosturalViewKey,
      formKey: string,
    ) => ({
      state: state(`${formKey}-state`),
      observation: text(form, `${formKey}-observation`),
      image: mediaByViewRef.current[viewKey].image,
      symmetrograph: mediaByViewRef.current[viewKey].symmetrograph,
      segments: posturalSegments(form, formKey, viewKey),
    });
    const overallRelevance = text(
      form,
      "posturalOverallRelevance",
    ) as PosturalOverallRelevance | undefined;
    const conduct = text(
      form,
      "posturalFollowUpConduct",
    ) as PosturalFollowUpConduct | undefined;
    const followUpObservation = text(
      form,
      "posturalFollowUpObservation",
    );
    const suggestedReassessmentDate = text(
      form,
      "posturalSuggestedReassessmentDate",
    );
    const reassessmentObservation = text(
      form,
      "posturalReassessmentObservation",
    );
    const followUp =
      conduct ||
      followUpObservation ||
      suggestedReassessmentDate ||
      reassessmentObservation
        ? {
            conduct,
            observation: followUpObservation,
            suggestedReassessmentDate,
            reassessmentObservation,
          }
        : undefined;

    return {
      views: {
        ANTERIOR: viewData("ANTERIOR", "anterior"),
        POSTERIOR: viewData("POSTERIOR", "posterior"),
        RIGHT_LATERAL: viewData(
          "RIGHT_LATERAL",
          "right_lateral",
        ),
        LEFT_LATERAL: viewData(
          "LEFT_LATERAL",
          "left_lateral",
        ),
      },
      identifiedChanges: state("identifiedChanges"),
      identifiedChangesNotes: text(
        form,
        "identifiedChangesNotes",
      ),
      functionalLimitations: state("functionalLimitations"),
      functionalLimitationsNotes: text(
        form,
        "functionalLimitationsNotes",
      ),
      notes: text(form, "posturalNotes"),
      futureCorrectiveExercisesNote:
        record.data.futureCorrectiveExercisesNote,
      referenceLines: Object.fromEntries(
        viewDefinitions.map(({ key }) => [
          key,
          mediaByViewRef.current[key].referenceLines,
        ]),
      ) as PosturalAssessmentData["referenceLines"],
      annotationLayers: Object.fromEntries(
        viewDefinitions.map(({ key }) => [
          key,
          mediaByViewRef.current[key].annotations,
        ]),
      ) as PosturalAssessmentData["annotationLayers"],
      technicalSummary:
        technicalSummary.generatedOriginal ||
        technicalSummary.editedSummary
          ? technicalSummary
          : undefined,
      evaluatorConclusion: text(
        form,
        "posturalEvaluatorConclusion",
      ),
      overallRelevance,
      followUp,
      completionStatus,
    };
  }

  function markDirty() {
    const form = formRef.current;
    if (!form) return;
    onDirty(
      assessmentData(
        new FormData(form),
        record.data.completionStatus ?? "IN_PROGRESS",
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmCompletion(false);

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const continueAfterSave = submitter?.value !== "SAVE";
    await onSave(
      assessmentData(
        new FormData(event.currentTarget),
        continueAfterSave ? "COMPLETED" : "IN_PROGRESS",
      ),
      continueAfterSave,
    );
  }

  function generateCurrentSummary() {
    const form = formRef.current;
    if (!form) {
      return { findingCount: 0, includedViews: [] };
    }

    return generatePosturalTechnicalSummary(
      assessmentData(new FormData(form)),
      {
        assessedAt: assessedAt ?? record.audit?.updatedAt,
        evaluatorName,
      },
    );
  }

  return (
    <form
      id="clinical-form-postural_assessment"
      onChange={markDirty}
      onInvalid={focusFirstInvalidField}
      onSubmit={submit}
      ref={formRef}
    >
      <div className="space-y-6">
        <section className="m-0 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm xl:max-h-full">
          <div className="bg-gradient-to-r from-[#0f4c81] via-[#1768a6] to-[#2386c8] px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-100">
                  Avaliação física • CREF
                </p>
                <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                  Avaliação Postural Profissional
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">
                  Registro postural integrado ao Prontuário Mestre, com documentação
                  fotográfica, análise segmentar, síntese técnica e acompanhamento
                  de evolução.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-black text-white">
                  Prontuário Mestre
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-black text-white">
                  Avaliação Postural
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-blue-100 sm:grid-cols-2">
            <div className="bg-white px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Profissional responsável
              </p>
              <p className="mt-1 text-sm font-black text-slate-900">
                {evaluatorName?.trim() || "Profissional vinculado"}
              </p>
            </div>

            <div className="bg-white px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Status da avaliação
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    assessmentWasSkipped
                      ? "bg-amber-500"
                      : record.data.completionStatus === "COMPLETED"
                      ? "bg-emerald-500"
                      : "bg-amber-400"
                  }`}
                />
                <p
                  className={`text-sm font-black ${
                    assessmentWasSkipped ? "text-amber-900" : "text-slate-900"
                  }`}
                >
                  {assessmentWasSkipped
                    ? "Avaliação não realizada"
                    : record.data.completionStatus === "COMPLETED"
                      ? "Avaliação concluída"
                      : "Avaliação em andamento"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-blue-950">
              Documentação clínica flexível
            </p>

            <p className="mt-1 text-xs text-blue-700">
              Utilize somente as vistas e os itens que considerar
              necessários para este atendimento.
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-800">
            Campos opcionais
          </span>
        </div>

        <PendingFieldsAlert
          fields={record.missingRequiredFields}
        />

        <ProfessionalAuditInfo
          audit={record.audit}
          origin={record.origin}
          responsible={responsibleProfessional}
        />

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
            Etapa 01
          </p>
          <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
            Registro fotográfico e avaliação por vistas
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Registre as imagens necessárias e documente os achados observados em cada vista.
          </p>
        </div>

        {viewDefinitions.map((view, index) => {
          const sectionKey = view.key.toLocaleLowerCase("en-US");

          return (
            <AccordionSection
              key={view.key}
              number={index + 1}
              onToggle={() => toggleSection(sectionKey)}
              open={openSection === sectionKey}
              title={view.title}
            >
              <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(340px,42%)_minmax(0,1fr)] xl:[&>*]:mt-0">
                <aside className="m-0 self-start xl:sticky xl:top-28 xl:self-start xl:pt-0">
                  <div className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/80 px-4 py-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                          Imagem de referência
                        </p>
                        <p className="mt-0.5 text-sm font-black text-blue-950">
                          {view.title}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">
                        Fixa durante a análise
                      </span>
                    </div>

                    <div className="bg-blue-50/30 p-3 sm:p-4">
                      <PosturalImageBlock
                        annotations={
                          mediaByView[view.key].annotations
                        }
                        assessmentId={assessmentId}
                        image={mediaByView[view.key].image}
                        onAnnotationsChange={(annotations) => {
                          updateMediaView(
                            view.key,
                            (current) => ({
                              ...current,
                              annotations,
                            }),
                          );
                          markDirty();
                        }}
                        onChangeImage={(image) => {
                          updateMediaView(
                            view.key,
                            (current) => ({
                              ...current,
                              image,
                            }),
                          );
                          markDirty();
                        }}
                        onChangeSymmetrograph={(symmetrograph) => {
                          updateMediaView(
                            view.key,
                            (current) => ({
                              ...current,
                              symmetrograph,
                            }),
                          );
                          markDirty();
                        }}
                        onReferenceLinesChange={(referenceLines) => {
                          updateMediaView(
                            view.key,
                            (current) => ({
                              ...current,
                              referenceLines,
                            }),
                          );
                          markDirty();
                        }}
                        onSelectedAnnotationChange={(id) => {
                          setSelectedAnnotationByView(
                            (current) => ({
                              ...current,
                              [view.key]: id,
                            }),
                          );
                        }}
                        patientId={patientId}
                        referenceLines={
                          mediaByView[view.key].referenceLines
                        }
                        selectedAnnotationId={
                          selectedAnnotationByView[view.key]
                        }
                        symmetrograph={
                          mediaByView[view.key].symmetrograph
                        }
                        title={view.title}
                        viewKey={view.key}
                      />
                    </div>
                  </div>
                </aside>

                <div className="m-0 min-w-0 self-stretch xl:relative xl:min-h-0">
                  <div className="space-y-5 xl:absolute xl:inset-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-2">
                  <div className="m-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                        Vista atual
                      </p>
                      <h3 className="mt-1 text-base font-black text-slate-950">
                        {view.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Responda os campos abaixo mantendo a fotografia
                        visível ao lado durante toda a análise.
                      </p>
                    </div>

                    <PosturalArea
                      id={sectionKey}
                      observation={
                        record.data.views[view.key].observation
                      }
                      onDirty={markDirty}
                      state={record.data.views[view.key].state}
                    />
                  </div>

                  <div>
                    <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                      <p className="text-sm font-black text-blue-950">
                        Avaliação segmentar
                      </p>
                      <p className="mt-1 text-xs leading-5 text-blue-700">
                        A fotografia permanece fixa à esquerda enquanto
                        você percorre todos os segmentos desta vista.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {posturalSegmentsByView[view.key].map(
                        (definition) => (
                          <PosturalSegmentCard
                            definition={definition}
                            key={definition.key}
                            namePrefix={sectionKey}
                            onDirty={markDirty}
                            value={
                              record.data.views[view.key].segments?.[
                                definition.key
                              ]
                            }
                          />
                        ),
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </AccordionSection>
          );
        })}

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
            Etapa 02
          </p>
          <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
            Diagnóstico e síntese postural
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Consolidação técnica dos achados registrados durante a avaliação.
          </p>
        </div>

        <AccordionSection
          number={5}
          onToggle={() => toggleSection("technicalSummary")}
          open={openSection === "technicalSummary"}
          title="Resumo técnico da avaliação postural"
        >
          <PosturalTechnicalSummarySection
            data={record.data}
            onDirty={markDirty}
            onGenerate={generateCurrentSummary}
            onSummaryChange={setTechnicalSummary}
            summary={technicalSummary}
          />
        </AccordionSection>

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
            Etapa 03
          </p>
          <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
            Achados clínicos e limitações funcionais
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Registre alterações globais, limitações funcionais e observações relevantes.
          </p>
        </div>

        <AccordionSection
          number={6}
          onToggle={() => toggleSection("identifiedChanges")}
          open={openSection === "identifiedChanges"}
          title="Alterações identificadas"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ClinicalField
              id="identifiedChanges"
              label="Situação"
            >
              <select
                className={clinicalInputClass}
                defaultValue={record.data.identifiedChanges}
                id="identifiedChanges"
                name="identifiedChanges"
                onChange={markDirty}
              >
                {stateOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </ClinicalField>

            <ClinicalField
              id="identifiedChangesNotes"
              label="Descrição"
            >
              <textarea
                className={`${clinicalInputClass} min-h-24 resize-y py-3`}
                defaultValue={
                  record.data.identifiedChangesNotes
                }
                id="identifiedChangesNotes"
                name="identifiedChangesNotes"
                onChange={markDirty}
              />
            </ClinicalField>
          </div>
        </AccordionSection>

        <AccordionSection
          number={7}
          onToggle={() => toggleSection("functionalLimitations")}
          open={openSection === "functionalLimitations"}
          title="Limitações funcionais"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ClinicalField
              id="functionalLimitations"
              label="Situação"
            >
              <select
                className={clinicalInputClass}
                defaultValue={
                  record.data.functionalLimitations
                }
                id="functionalLimitations"
                name="functionalLimitations"
                onChange={markDirty}
              >
                {stateOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </ClinicalField>

            <ClinicalField
              id="functionalLimitationsNotes"
              label="Descrição"
            >
              <textarea
                className={`${clinicalInputClass} min-h-24 resize-y py-3`}
                defaultValue={
                  record.data.functionalLimitationsNotes
                }
                id="functionalLimitationsNotes"
                name="functionalLimitationsNotes"
                onChange={markDirty}
              />
            </ClinicalField>
          </div>
        </AccordionSection>

        <AccordionSection
          number={8}
          onToggle={() => toggleSection("posturalNotes")}
          open={openSection === "posturalNotes"}
          title="Observações"
        >
          <ClinicalField
            id="posturalNotes"
            label="Observações gerais"
          >
            <textarea
              className={`${clinicalInputClass} min-h-28 resize-y py-3`}
              defaultValue={record.data.notes}
              id="posturalNotes"
              name="posturalNotes"
              onChange={markDirty}
            />
          </ClinicalField>
        </AccordionSection>

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
            Etapa 04
          </p>
          <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
            Conduta e plano corretivo
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Área preparada para o vínculo futuro entre achados posturais e condutas corretivas.
          </p>
        </div>

        <AccordionSection
          description="Vínculo preparado apenas visualmente; nenhum plano de treino é gerado nesta Sprint."
          number={9}
          onToggle={() =>
            toggleSection("correctiveExercises")
          }
          open={openSection === "correctiveExercises"}
          title="Exercícios corretivos sugeridos ou vinculados futuramente"
        >
          <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            {record.data.futureCorrectiveExercisesNote ??
              "Não informado"}
          </p>
        </AccordionSection>

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
            Etapa 05
          </p>
          <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
            Evolução postural
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Consulte avaliações anteriores preservadas por atendimento para acompanhar a evolução.
          </p>
        </div>

        <AccordionSection
          description="Registros preservados por avaliação, com comparação observacional entre datas."
          number={10}
          onToggle={() => toggleSection("posturalEvolution")}
          open={openSection === "posturalEvolution"}
          title="Histórico de avaliações posturais"
        >
          <PosturalEvolutionSection patientId={patientId} />
        </AccordionSection>
      </div>

      <ResponsiveActionBar>
        <button
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          disabled={saving}
          onClick={onBack}
          type="button"
        >
          Voltar
        </button>

        <button
          className="min-h-11 rounded-xl border border-[#1768a6] bg-white px-5 text-sm font-black text-[#1768a6] hover:bg-blue-50 disabled:opacity-60"
          disabled={saving}
          name="saveIntent"
          type="submit"
          value="SAVE"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>

        <button
          className="min-h-11 rounded-xl bg-[#1768a6] px-6 text-sm font-black text-white hover:bg-[#0f4c81] disabled:opacity-60"
          disabled={saving}
          onClick={() => setConfirmCompletion(true)}
          type="button"
        >
          Salvar e continuar
        </button>
      </ResponsiveActionBar>

      {confirmCompletion ? (
        <div
          aria-labelledby="complete-postural-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setConfirmCompletion(false)}
          role="dialog"
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              className="text-lg font-black text-slate-900"
              id="complete-postural-title"
            >
              Concluir avaliação postural?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Todos os dados registrados serão preservados. Uma futura
              reavaliação deverá ser criada em um novo atendimento, sem
              substituir este registro.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                autoFocus
                onClick={() => setConfirmCompletion(false)}
                size="small"
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                loading={saving}
                name="saveIntent"
                size="small"
                type="submit"
                value="CONTINUE"
              >
                Confirmar conclusão
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </form>
  );
}
