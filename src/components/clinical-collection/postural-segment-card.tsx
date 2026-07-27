"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
    <Button
      className="min-h-8 px-2"
      onClick={onClick}
      size="small"
      type="button"
      variant="ghost"
    >
      Limpar
    </Button>
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
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-black text-slate-900">
          {definition.name}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {definition.objective}
        </p>
      </header>

      <div className="space-y-5 p-4">
        <fieldset>
          <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
            <legend className="text-xs font-black uppercase tracking-wide text-slate-600">
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
                  className="flex min-h-10 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  htmlFor={id}
                  key={option}
                >
                  <input
                    checked={selectedOption === option}
                    className="mt-0.5 size-4 shrink-0 accent-[#12664f]"
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

        <fieldset>
          <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
            <legend className="text-xs font-black uppercase tracking-wide text-slate-600">
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
                  className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"
                  htmlFor={id}
                  key={option.value}
                >
                  <input
                    checked={grade === option.value}
                    className="size-4 accent-[#12664f]"
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

        <ClinicalField
          id={`${fieldPrefix}-observation`}
          label="Observação do avaliador"
        >
          <textarea
            className={`${clinicalInputClass} min-h-20 resize-y py-3`}
            defaultValue={value?.observation}
            id={`${fieldPrefix}-observation`}
            name={`${fieldPrefix}-observation`}
            onChange={onDirty}
          />
        </ClinicalField>

        <fieldset>
          <legend className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">
            Sugestões para investigação{" "}
            <span className="normal-case">(opcional)</span>
          </legend>

          <div className="grid gap-2 sm:grid-cols-2">
            {definition.investigationSuggestions.map(
              (suggestion, index) => {
                const id = `${fieldPrefix}-investigation-${index}`;

                return (
                  <label
                    className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"
                    htmlFor={id}
                    key={suggestion}
                  >
                    <input
                      className="size-4 accent-[#12664f]"
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
            className="mt-2 block text-xs font-bold text-slate-600"
            htmlFor={`${fieldPrefix}-other-investigation`}
          >
            Outra sugestão
          </label>
          <input
            className={`${clinicalInputClass} mt-1`}
            defaultValue={value?.otherInvestigation}
            id={`${fieldPrefix}-other-investigation`}
            name={`${fieldPrefix}-other-investigation`}
            onChange={onDirty}
            type="text"
          />
        </fieldset>

        <fieldset>
          <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
            <legend className="text-xs font-black uppercase tracking-wide text-slate-600">
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
                  className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"
                  htmlFor={id}
                  key={option.value}
                >
                  <input
                    checked={relevance === option.value}
                    className="size-4 accent-[#12664f]"
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

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <details className="group">
          <summary className="min-h-10 cursor-pointer list-none rounded-lg px-2 py-2 text-sm font-black text-[#12664f] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12664f]">
            Ver detalhes
          </summary>

          <div className="mt-3 space-y-3 px-2 pb-2 text-xs leading-5 text-slate-600">
            <div>
              <p className="font-black text-slate-700">
                Definição do segmento
              </p>
              <p>{definition.definition}</p>
            </div>

            <div>
              <p className="font-black text-slate-700">
                Como observar corretamente
              </p>
              <p>{definition.howToObserve}</p>
            </div>

            <div>
              <p className="font-black text-slate-700">
                Possíveis associações biomecânicas
              </p>
              <p>{definition.biomechanicalAssociations}</p>
            </div>

            <div>
              <p className="font-black text-slate-700">
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
