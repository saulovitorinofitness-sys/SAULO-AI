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
  PosturalFollowUpConduct,
  PosturalOverallRelevance,
  PosturalSegmentAssessment,
  PosturalSegmentGrade,
  PosturalSegmentRelevance,
  PosturalSymmetrograph,
  PosturalTechnicalSummary,
  PosturalViewImage,
  PosturalViewKey,
  StructuredFindingState,
} from "@/features/clinical-collection";

import { ClinicalField, clinicalInputClass } from "./clinical-field";
import { focusFirstInvalidField } from "./focus-invalid-field";
import { PendingFieldsAlert } from "./pending-fields-alert";
import { PosturalImageViewer } from "./postural-image-viewer";
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
    }
  >
>;

function PosturalImageBlock({
  assessmentId,
  image,
  onChangeImage,
  onChangeSymmetrograph,
  patientId,
  symmetrograph,
  title,
  viewKey,
}: {
  assessmentId?: string;
  image?: PosturalViewImage;
  onChangeImage: (image?: PosturalViewImage) => void;
  onChangeSymmetrograph: (
    symmetrograph: PosturalSymmetrograph,
  ) => void;
  patientId: string;
  symmetrograph: PosturalSymmetrograph;
  title: string;
  viewKey: PosturalViewKey;
}) {
  return (
    <PosturalImageViewer
      assessmentId={assessmentId}
      gridEnabled={symmetrograph.enabled}
      gridOpacity={symmetrograph.opacity}
      image={image}
      onChange={onChangeImage}
      onGridChange={onChangeSymmetrograph}
      onRemove={() => onChangeImage(undefined)}
      patientId={patientId}
      readOnly={false}
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
  assessmentId,
  evaluatorName,
  patientId,
  record,
  saving,
  onDirty,
  onSave,
}: {
  assessmentId?: string;
  evaluatorName: string;
  patientId: string;
  record: ClinicalStepRecord<PosturalAssessmentData>;
  saving: boolean;
  onDirty: () => void;
  onSave: (data: PosturalAssessmentData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const completionIntent = useRef<PosturalCompletionStatus>(
    record.data.completionStatus ?? "IN_PROGRESS",
  );
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
          },
        ]),
      ) as unknown as PosturalMediaState,
    );

  function toggleSection(section: string) {
    setOpenSection((current) =>
      current === section ? "" : section,
    );
  }

  function assessmentData(form: FormData): PosturalAssessmentData {
    const state = (key: string) =>
      String(form.get(key)) as StructuredFindingState;
    const viewData = (
      viewKey: PosturalViewKey,
      formKey: string,
    ) => ({
      state: state(`${formKey}-state`),
      observation: text(form, `${formKey}-observation`),
      image: mediaByView[viewKey].image,
      symmetrograph: mediaByView[viewKey].symmetrograph,
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
      completionStatus: completionIntent.current,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmCompletion(false);
    await onSave(assessmentData(new FormData(event.currentTarget)));
  }

  function generateCurrentSummary() {
    const form = formRef.current;
    if (!form) {
      return { findingCount: 0, includedViews: [] };
    }

    return generatePosturalTechnicalSummary(
      assessmentData(new FormData(form)),
      {
        assessedAt:
          record.audit?.updatedAt ?? new Date().toISOString(),
        evaluatorName,
      },
    );
  }

  return (
    <form
      id="clinical-form-postural_assessment"
      onChange={onDirty}
      onInvalid={focusFirstInvalidField}
      onSubmit={submit}
      ref={formRef}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-amber-950">
              Documentação clínica flexível
            </p>

            <p className="mt-1 text-xs text-amber-800">
              Utilize somente as vistas e os itens que considerar
              necessários para este atendimento.
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
            Campos opcionais
          </span>
        </div>

        <PendingFieldsAlert
          fields={record.missingRequiredFields}
        />

        <ProfessionalAuditInfo
          audit={record.audit}
          origin={record.origin}
        />

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
              <div>
                <PosturalImageBlock
                  assessmentId={assessmentId}
                  image={mediaByView[view.key].image}
                  onChangeImage={(image) => {
                    setMediaByView((current) => ({
                      ...current,
                      [view.key]: {
                        ...current[view.key],
                        image,
                      },
                    }));
                    onDirty();
                  }}
                  onChangeSymmetrograph={(symmetrograph) => {
                    setMediaByView((current) => ({
                      ...current,
                      [view.key]: {
                        ...current[view.key],
                        symmetrograph,
                      },
                    }));
                    onDirty();
                  }}
                  patientId={patientId}
                  symmetrograph={
                    mediaByView[view.key].symmetrograph
                  }
                  title={view.title}
                  viewKey={view.key}
                />
              </div>

              <div className="mt-4">
                <PosturalArea
                  id={sectionKey}
                  observation={
                    record.data.views[view.key].observation
                  }
                  onDirty={onDirty}
                  state={record.data.views[view.key].state}
                />
              </div>

              <div className="mt-5 space-y-4">
                {posturalSegmentsByView[view.key].map(
                  (definition) => (
                    <PosturalSegmentCard
                      definition={definition}
                      key={definition.key}
                      namePrefix={sectionKey}
                      onDirty={onDirty}
                      value={
                        record.data.views[view.key].segments?.[
                          definition.key
                        ]
                      }
                    />
                  ),
                )}
              </div>
            </AccordionSection>
          );
        })}

        <AccordionSection
          number={5}
          onToggle={() => toggleSection("technicalSummary")}
          open={openSection === "technicalSummary"}
          title="Resumo técnico da avaliação postural"
        >
          <PosturalTechnicalSummarySection
            data={record.data}
            onDirty={onDirty}
            onGenerate={generateCurrentSummary}
            onSummaryChange={setTechnicalSummary}
            summary={technicalSummary}
          />
        </AccordionSection>

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
                onChange={onDirty}
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
                onChange={onDirty}
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
              onChange={onDirty}
            />
          </ClinicalField>
        </AccordionSection>

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
              "Nenhum exercício vinculado nesta Sprint."}
          </p>
        </AccordionSection>

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
          className="min-h-11 rounded-xl border border-[#12664f] bg-white px-5 text-sm font-black text-[#12664f] hover:bg-emerald-50 disabled:opacity-60"
          disabled={saving}
          onClick={() => {
            completionIntent.current = "IN_PROGRESS";
          }}
          type="submit"
        >
          {saving ? "Salvando..." : "Salvar como em andamento"}
        </button>

        <button
          className="min-h-11 rounded-xl bg-[#12664f] px-6 text-sm font-black text-white hover:bg-[#0a4938] disabled:opacity-60"
          disabled={saving}
          onClick={() => setConfirmCompletion(true)}
          type="button"
        >
          Concluir avaliação
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
                onClick={() => {
                  completionIntent.current = "COMPLETED";
                }}
                size="small"
                type="submit"
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
