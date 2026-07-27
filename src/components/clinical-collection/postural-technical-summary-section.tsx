"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  GeneratedPosturalSummary,
  PosturalAssessmentData,
  PosturalTechnicalSummary,
} from "@/features/clinical-collection";

import { ClinicalField, clinicalInputClass } from "./clinical-field";

const noFindingsMessage =
  "Não existem achados registrados suficientes para gerar o resumo.";

export function PosturalTechnicalSummarySection({
  data,
  onDirty,
  onGenerate,
  onSummaryChange,
  summary,
}: {
  data: PosturalAssessmentData;
  onDirty: () => void;
  onGenerate: () => GeneratedPosturalSummary;
  onSummaryChange: (value: PosturalTechnicalSummary) => void;
  summary: PosturalTechnicalSummary;
}) {
  const [manualChanges, setManualChanges] = useState(
    Boolean(
      summary.editedSummary !== summary.generatedOriginal &&
        (summary.editedSummary || summary.generatedOriginal),
    ),
  );
  const [pendingGeneration, setPendingGeneration] =
    useState<GeneratedPosturalSummary>();
  const [message, setMessage] = useState<string>();

  function applyGeneration(generated: GeneratedPosturalSummary) {
    if (!generated.content) {
      setMessage(noFindingsMessage);
      return;
    }

    const generatedAt = new Date().toISOString();
    onSummaryChange({
      generatedOriginal: generated.content,
      editedSummary: generated.content,
      generatedAt,
      generationHistory: [
        ...(summary.generationHistory ?? []),
        {
          content: generated.content,
          generatedAt,
        },
      ],
    });
    setManualChanges(false);
    setPendingGeneration(undefined);
    setMessage(
      "Resumo gerado. Revise o conteúdo antes de salvar a avaliação.",
    );
    onDirty();
  }

  function requestGeneration() {
    const generated = onGenerate();
    if (!generated.content) {
      setMessage(noFindingsMessage);
      return;
    }

    if (manualChanges) {
      setPendingGeneration(generated);
      setMessage(undefined);
      return;
    }

    applyGeneration(generated);
  }

  return (
    <div className="space-y-5">
      <div>
        <Button
          onClick={requestGeneration}
          size="small"
          type="button"
        >
          Gerar resumo dos achados
        </Button>

        {message ? (
          <p
            className="mt-2 text-sm font-semibold text-slate-600"
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>

      {pendingGeneration ? (
        <div
          aria-labelledby="replace-summary-title"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4"
          role="alertdialog"
        >
          <p
            className="text-sm font-black text-amber-950"
            id="replace-summary-title"
          >
            O resumo possui alterações manuais. Deseja substituí-lo por
            uma nova versão gerada a partir dos achados atuais?
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => setPendingGeneration(undefined)}
              size="small"
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => applyGeneration(pendingGeneration)}
              size="small"
              type="button"
            >
              Gerar nova versão
            </Button>
          </div>
        </div>
      ) : null}

      <ClinicalField
        hint="Conteúdo consolidado a partir dos achados selecionados. Revise e edite antes de salvar."
        id="posturalTechnicalSummary"
        label="Resumo dos achados"
      >
        <textarea
          className={`${clinicalInputClass} min-h-64 resize-y py-3`}
          id="posturalTechnicalSummary"
          onChange={(event) => {
            const editedSummary =
              event.target.value.trim() || undefined;
            onSummaryChange({
              ...summary,
              editedSummary,
              lastEditedAt: new Date().toISOString(),
            });
            setManualChanges(
              editedSummary !== summary.generatedOriginal,
            );
            setMessage(undefined);
            onDirty();
          }}
          value={summary.editedSummary ?? ""}
        />
      </ClinicalField>

      <ClinicalField
        id="posturalOverallRelevance"
        label="Relevância geral dos achados"
      >
        <select
          className={clinicalInputClass}
          defaultValue={data.overallRelevance ?? ""}
          id="posturalOverallRelevance"
          name="posturalOverallRelevance"
          onChange={onDirty}
        >
          <option value="">Não informada</option>
          <option value="LOW">Baixa</option>
          <option value="MODERATE">Moderada</option>
          <option value="HIGH">Alta</option>
        </select>
      </ClinicalField>

      <div className="grid gap-4 md:grid-cols-2">
        <ClinicalField
          id="posturalFollowUpConduct"
          label="Conduta de acompanhamento"
        >
          <select
            className={clinicalInputClass}
            defaultValue={data.followUp?.conduct ?? ""}
            id="posturalFollowUpConduct"
            name="posturalFollowUpConduct"
            onChange={onDirty}
          >
            <option value="">Não informada</option>
            <option value="REGISTER_ONLY">Apenas registrar</option>
            <option value="MONITOR_EVOLUTION">
              Acompanhar evolução
            </option>
            <option value="REASSESS_LATER">
              Reavaliar posteriormente
            </option>
            <option value="CONSIDER_IN_TRAINING">
              Considerar no planejamento do treinamento
            </option>
            <option value="SUGGEST_COMPLEMENTARY_INVESTIGATION">
              Sugerir investigação complementar
            </option>
            <option value="SUGGEST_QUALIFIED_REFERRAL">
              Sugerir encaminhamento a profissional habilitado
            </option>
            <option value="OTHER">Outra</option>
          </select>
        </ClinicalField>

        <ClinicalField
          id="posturalFollowUpObservation"
          label="Observação complementar da conduta"
        >
          <textarea
            className={`${clinicalInputClass} min-h-24 resize-y py-3`}
            defaultValue={data.followUp?.observation}
            id="posturalFollowUpObservation"
            name="posturalFollowUpObservation"
            onChange={onDirty}
          />
        </ClinicalField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ClinicalField
          id="posturalSuggestedReassessmentDate"
          label="Reavaliação sugerida"
        >
          <input
            className={clinicalInputClass}
            defaultValue={
              data.followUp?.suggestedReassessmentDate ?? ""
            }
            id="posturalSuggestedReassessmentDate"
            name="posturalSuggestedReassessmentDate"
            onChange={onDirty}
            type="date"
          />
        </ClinicalField>

        <ClinicalField
          id="posturalReassessmentObservation"
          label="Observação da reavaliação"
        >
          <textarea
            className={`${clinicalInputClass} min-h-24 resize-y py-3`}
            defaultValue={data.followUp?.reassessmentObservation}
            id="posturalReassessmentObservation"
            name="posturalReassessmentObservation"
            onChange={onDirty}
          />
        </ClinicalField>
      </div>

      <ClinicalField
        hint="Campo manual e opcional. Nenhuma conclusão é preenchida automaticamente."
        id="posturalEvaluatorConclusion"
        label="Conclusão do avaliador"
      >
        <textarea
          className={`${clinicalInputClass} min-h-40 resize-y py-3`}
          defaultValue={data.evaluatorConclusion}
          id="posturalEvaluatorConclusion"
          name="posturalEvaluatorConclusion"
          onChange={onDirty}
        />
      </ClinicalField>
    </div>
  );
}
