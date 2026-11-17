"use client";

import { useState } from "react";

import type {
  PosturalSegmentAssessment,
  PosturalSegmentDefinition,
  PosturalSegmentGrade,
  PosturalSegmentRelevance,
} from "@/features/clinical-collection";

import { ClinicalField, clinicalInputClass } from "./clinical-field";

const gradeOptions: readonly {
  value: PosturalSegmentGrade;
  label: string;
}[] = [
  { value: "DISCREET", label: "Discreto" },
  { value: "MODERATE", label: "Moderado" },
  { value: "ACCENTUATED", label: "Acentuado" },
];

const relevanceOptions: readonly {
  value: PosturalSegmentRelevance;
  label: string;
}[] = [
  { value: "NONE", label: "Sem relevância" },
  { value: "LOW", label: "Baixa" },
  { value: "MODERATE", label: "Moderada" },
  { value: "HIGH", label: "Alta" },
];

function ClearSelectionButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      className="min-h-8 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onClick={onClick}
      type="button"
    >
      Limpar
    </button>
  );
}

export function PosturalSegmentCard({
  definition,
  namePrefix,
  onDirty,
  value,
}: {
  definition: PosturalSegmentDefinition;
  namePrefix: string;
  onDirty: () => void;
  value?: PosturalSegmentAssessment;
}) {
  const [selectedOption, setSelectedOption] = useState(
    value?.selectedOption ?? "",
  );
  const [grade, setGrade] = useState<PosturalSegmentGrade | "">(
    value?.grade ?? "",
  );
  const [relevance, setRelevance] = useState<
    PosturalSegmentRelevance | ""
  >(value?.relevance ?? "");
  const fieldPrefix = `${namePrefix}-segment-${definition.key}`;
  const selectedInvestigations = new Set(
    value?.investigationSuggestions ?? [],
  );

  function clearSelection(
    setter: (nextValue: "") => void,
  ) {
    setter("");
    onDirty();
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <header className="border-b border-blue-200 bg-gradient-to-r from-blue-100 via-blue-50 to-sky-50 px-4 py-4">
        <h3 className="text-sm font-black text-blue-950">
          {definition.name}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {definition.objective}
        </p>
      </header>

      <div className="space-y-5 bg-blue-50/20 p-4 sm:p-5">
        <fieldset className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 sm:p-4">
          <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
            <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-800">
              Opções
            </legend>
            {selectedOption ? (
              <ClearSelectionButton
                onClick={() => clearSelection(setSelectedOption)}
              />
            ) : null}
          </div>

          <div className="grid gap-2">
            {definition.options.map((option, index) => {
              const id = `${fieldPrefix}-option-${index}`;

              return (
                <label
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-100/80 has-[:checked]:text-blue-950"
                  htmlFor={id}
                  key={option}
                >
                  <input
                    checked={selectedOption === option}
                    className="mt-0.5 size-4 shrink-0 accent-[#1768a6]"
                    id={id}
                    name={`${fieldPrefix}-option`}
                    onChange={() => {
                      setSelectedOption(option);
                      onDirty();
                    }}
                    type="radio"
                    value={option}
                  />
                  {option}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 sm:p-4">
          <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
            <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-800">
              Grau <span className="normal-case">(opcional)</span>
            </legend>
            {grade ? (
              <ClearSelectionButton
                onClick={() => clearSelection(setGrade)}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {gradeOptions.map((option) => {
              const id = `${fieldPrefix}-grade-${option.value.toLocaleLowerCase("en-US")}`;

              return (
                <label
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-100/80 has-[:checked]:text-blue-950"
                  htmlFor={id}
                  key={option.value}
                >
                  <input
                    checked={grade === option.value}
                    className="size-4 accent-[#1768a6]"
                    id={id}
                    name={`${fieldPrefix}-grade`}
                    onChange={() => {
                      setGrade(option.value);
                      onDirty();
                    }}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 sm:p-4">
          <ClinicalField
            id={`${fieldPrefix}-observation`}
            label="Observação do avaliador"
          >
            <textarea
              className={`${clinicalInputClass} min-h-20 resize-y bg-white py-3 focus:!border-blue-500 focus:!ring-blue-500`}
              defaultValue={value?.observation}
              id={`${fieldPrefix}-observation`}
              name={`${fieldPrefix}-observation`}
              onChange={onDirty}
            />
          </ClinicalField>
        </div>

        <fieldset className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 sm:p-4">
          <legend className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-blue-800">
            Sugestões para investigação{" "}
            <span className="normal-case">(opcional)</span>
          </legend>

          <div className="grid gap-2 sm:grid-cols-2">
            {definition.investigationSuggestions.map(
              (suggestion, index) => {
                const id = `${fieldPrefix}-investigation-${index}`;

                return (
                  <label
                    className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-100/80 has-[:checked]:text-blue-950"
                    htmlFor={id}
                    key={suggestion}
                  >
                    <input
                      className="size-4 accent-[#1768a6]"
                      defaultChecked={selectedInvestigations.has(
                        suggestion,
                      )}
                      id={id}
                      name={`${fieldPrefix}-investigation`}
                      onChange={onDirty}
                      type="checkbox"
                      value={suggestion}
                    />
                    {suggestion}
                  </label>
                );
              },
            )}
          </div>

          <label
            className="mt-3 block text-xs font-black text-blue-800"
            htmlFor={`${fieldPrefix}-other-investigation`}
          >
            Outra sugestão
          </label>
          <input
            className={`${clinicalInputClass} mt-1 bg-white focus:!border-blue-500 focus:!ring-blue-500`}
            defaultValue={value?.otherInvestigation}
            id={`${fieldPrefix}-other-investigation`}
            name={`${fieldPrefix}-other-investigation`}
            onChange={onDirty}
            type="text"
          />
        </fieldset>

        <fieldset className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 sm:p-4">
          <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
            <legend className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-800">
              Relevância para o atendimento{" "}
              <span className="normal-case">(opcional)</span>
            </legend>
            {relevance ? (
              <ClearSelectionButton
                onClick={() => clearSelection(setRelevance)}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {relevanceOptions.map((option) => {
              const id = `${fieldPrefix}-relevance-${option.value.toLocaleLowerCase("en-US")}`;

              return (
                <label
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-100/80 has-[:checked]:text-blue-950"
                  htmlFor={id}
                  key={option.value}
                >
                  <input
                    checked={relevance === option.value}
                    className="size-4 accent-[#1768a6]"
                    id={id}
                    name={`${fieldPrefix}-relevance`}
                    onChange={() => {
                      setRelevance(option.value);
                      onDirty();
                    }}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <footer className="border-t border-blue-200 bg-blue-50/80 px-4 py-3">
        <details className="group">
          <summary className="min-h-10 cursor-pointer list-none rounded-lg px-2 py-2 text-sm font-black text-[#1768a6] transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Ver detalhes
          </summary>

          <div className="mt-3 space-y-3 px-2 pb-2 text-xs leading-5 text-slate-600">
            <div>
              <p className="font-black text-blue-950">
                Definição do segmento
              </p>
              <p>{definition.definition}</p>
            </div>

            <div>
              <p className="font-black text-blue-950">
                Como observar corretamente
              </p>
              <p>{definition.howToObserve}</p>
            </div>

            <div>
              <p className="font-black text-blue-950">
                Possíveis associações biomecânicas
              </p>
              <p>{definition.biomechanicalAssociations}</p>
            </div>

            <div>
              <p className="font-black text-blue-950">
                Sugere investigar
              </p>
              <p>
                {definition.investigationSuggestions.join(", ")}.
              </p>
            </div>
          </div>
        </details>
      </footer>
    </article>
  );
}
