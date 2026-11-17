"use client";

import { useState } from "react";

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
      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#0f4c81] via-[#1768a6] to-[#2386c8] px-5 py-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
            Síntese clínica
          </p>
          <h3 className="mt-1 text-lg font-black">
            Resumo Técnico Postural
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-50">
            Consolide os achados registrados, classifique a relevância geral,
            defina a conduta de acompanhamento e registre a conclusão profissional.
          </p>
        </div>

        <div className="border-t border-blue-100 bg-blue-50/50 p-4 sm:p-5">
          <button
            className="min-h-10 rounded-xl bg-[#1768a6] px-4 text-sm font-black text-white transition hover:bg-[#0f4c81] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={requestGeneration}
            type="button"
          >
            Gerar resumo dos achados
          </button>

          {message ? (
            <p
              className="mt-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
              role="status"
            >
              {message}
            </p>
          ) : null}
        </div>
      </section>

      {pendingGeneration ? (
        <div
          aria-labelledby="replace-summary-title"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4"
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
            <button
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              onClick={() => setPendingGeneration(undefined)}
              type="button"
            >
              Cancelar
            </button>

            <button
              className="min-h-10 rounded-xl bg-[#1768a6] px-4 text-sm font-black text-white transition hover:bg-[#0f4c81]"
              onClick={() => applyGeneration(pendingGeneration)}
              type="button"
            >
              Gerar nova versão
            </button>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="border-b border-blue-100 bg-blue-50/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
            Bloco 01
          </p>
          <h4 className="mt-0.5 text-sm font-black text-blue-950">
            Síntese dos achados
          </h4>
        </div>

        <div className="p-4 sm:p-5">
          <ClinicalField
            hint="Conteúdo consolidado a partir dos achados selecionados. Revise e edite antes de salvar."
            id="posturalTechnicalSummary"
            label="Resumo dos achados"
          >
            <textarea
              className={`${clinicalInputClass} min-h-64 resize-y bg-white py-3 focus:!border-blue-500 focus:!ring-blue-500`}
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
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="border-b border-blue-100 bg-blue-50/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
            Bloco 02
          </p>
          <h4 className="mt-0.5 text-sm font-black text-blue-950">
            Classificação geral
          </h4>
        </div>

        <div className="p-4 sm:p-5">
          <ClinicalField
            id="posturalOverallRelevance"
            label="Relevância geral dos achados"
          >
            <select
              className={`${clinicalInputClass} bg-white focus:!border-blue-500 focus:!ring-blue-500`}
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
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="border-b border-blue-100 bg-blue-50/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
            Bloco 03
          </p>
          <h4 className="mt-0.5 text-sm font-black text-blue-950">
            Conduta de acompanhamento
          </h4>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
          <ClinicalField
            id="posturalFollowUpConduct"
            label="Conduta de acompanhamento"
          >
            <select
              className={`${clinicalInputClass} bg-white focus:!border-blue-500 focus:!ring-blue-500`}
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
              className={`${clinicalInputClass} min-h-24 resize-y bg-white py-3 focus:!border-blue-500 focus:!ring-blue-500`}
              defaultValue={data.followUp?.observation}
              id="posturalFollowUpObservation"
              name="posturalFollowUpObservation"
              onChange={onDirty}
            />
          </ClinicalField>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="border-b border-blue-100 bg-blue-50/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
            Bloco 04
          </p>
          <h4 className="mt-0.5 text-sm font-black text-blue-950">
            Reavaliação
          </h4>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
          <ClinicalField
            id="posturalSuggestedReassessmentDate"
            label="Reavaliação sugerida"
          >
            <input
              className={`${clinicalInputClass} bg-white focus:!border-blue-500 focus:!ring-blue-500`}
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
              className={`${clinicalInputClass} min-h-24 resize-y bg-white py-3 focus:!border-blue-500 focus:!ring-blue-500`}
              defaultValue={data.followUp?.reassessmentObservation}
              id="posturalReassessmentObservation"
              name="posturalReassessmentObservation"
              onChange={onDirty}
            />
          </ClinicalField>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="border-b border-blue-100 bg-blue-50/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
            Bloco 05
          </p>
          <h4 className="mt-0.5 text-sm font-black text-blue-950">
            Conclusão do avaliador
          </h4>
        </div>

        <div className="p-4 sm:p-5">
          <ClinicalField
            hint="Campo manual e opcional. Nenhuma conclusão é preenchida automaticamente."
            id="posturalEvaluatorConclusion"
            label="Conclusão do avaliador"
          >
            <textarea
              className={`${clinicalInputClass} min-h-40 resize-y bg-white py-3 focus:!border-blue-500 focus:!ring-blue-500`}
              defaultValue={data.evaluatorConclusion}
              id="posturalEvaluatorConclusion"
              name="posturalEvaluatorConclusion"
              onChange={onDirty}
            />
          </ClinicalField>
        </div>
      </section>
    </div>
  );}
