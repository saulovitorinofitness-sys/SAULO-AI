"use client";

import type { NutritionFollowUpEvaluation } from "@/features/nutrition-follow-up/service";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function sortEvaluations(
  evaluations: readonly NutritionFollowUpEvaluation[],
) {
  return [...evaluations].sort((left, right) =>
    left.date.localeCompare(right.date) ||
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.id.localeCompare(right.id),
  );
}

export function initialEvaluationSelection(
  evaluations: readonly NutritionFollowUpEvaluation[],
) {
  const ordered = sortEvaluations(evaluations);
  if (ordered.length <= 2) return ordered.map((evaluation) => evaluation.id);
  return [ordered[0].id, ordered.at(-1)!.id];
}

export function selectedEvaluations(
  evaluations: readonly NutritionFollowUpEvaluation[],
  selectedIds: readonly string[],
) {
  const selected = new Set(selectedIds);
  return sortEvaluations(evaluations).filter((evaluation) =>
    selected.has(evaluation.id),
  );
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function evaluationType(evaluation: NutritionFollowUpEvaluation) {
  return evaluation.sources.map((source) => source.modality).join(" · ");
}

export function EvaluationComparisonSelector({
  evaluations,
  selectedIds,
  onChange,
  className = "",
}: {
  evaluations: readonly NutritionFollowUpEvaluation[];
  selectedIds: readonly string[];
  onChange: (ids: readonly string[]) => void;
  className?: string;
}) {
  const ordered = sortEvaluations(evaluations);
  const selected = new Set(selectedIds);
  const selectedCount = ordered.filter((evaluation) =>
    selected.has(evaluation.id),
  ).length;
  const repeatedDates = new Set(
    ordered
      .map((evaluation) => evaluation.date)
      .filter(
        (date, index, dates) =>
          dates.indexOf(date) !== dates.lastIndexOf(date),
      ),
  );

  function toggle(id: string, checked: boolean) {
    const next = checked
      ? [...selectedIds, id]
      : selectedIds.filter((selectedId) => selectedId !== id);
    onChange(
      ordered
        .filter((evaluation) => next.includes(evaluation.id))
        .map((evaluation) => evaluation.id),
    );
  }

  return (
    <section
      aria-labelledby="evaluation-comparison-selector-title"
      className={`rounded-2xl border border-sky-200 bg-sky-50/50 p-4 ${className}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2
            className="text-sm font-black text-slate-950"
            id="evaluation-comparison-selector-title"
          >
            Avaliações usadas no comparativo
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            A seleção afeta somente a visualização. Datas, medidas e registros não são alterados e não precisam ser salvos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de seleção">
          <button
            className="min-h-10 rounded-xl border border-sky-300 bg-white px-3 text-xs font-black text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            onClick={() => onChange(initialEvaluationSelection(ordered))}
            type="button"
          >
            Primeira e última
          </button>
          <button
            className="min-h-10 rounded-xl border border-sky-300 bg-white px-3 text-xs font-black text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            onClick={() => onChange(ordered.map((evaluation) => evaluation.id))}
            type="button"
          >
            Todas
          </button>
          <button
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            onClick={() => onChange([])}
            type="button"
          >
            Limpar seleção
          </button>
        </div>
      </div>

      {ordered.length ? (
        <fieldset className="mt-4">
          <legend className="sr-only">Avaliações salvas</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ordered.map((evaluation) => {
              const isSelected = selected.has(evaluation.id);
              const showTime = repeatedDates.has(evaluation.date);
              return (
                <label
                  className={`cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-sky-600 ${
                    isSelected
                      ? "border-sky-700 bg-white shadow-sm"
                      : "border-slate-200 bg-slate-50/80 hover:border-sky-300"
                  }`}
                  key={evaluation.id}
                >
                  <span className="flex items-start gap-3">
                    <input
                      checked={isSelected}
                      className="mt-0.5 size-4 shrink-0 accent-sky-700"
                      onChange={(event) => {
                        event.stopPropagation();
                        toggle(evaluation.id, event.target.checked);
                      }}
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-950">
                        {formatDate(evaluation.date)}
                        {showTime
                          ? ` · ${timeFormatter.format(new Date(evaluation.occurredAt))}`
                          : ""}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-slate-600">
                        {evaluationType(evaluation) || "Tipo não informado"}
                      </span>
                      {evaluation.dataLabel ? (
                        <span className="mt-2 block w-fit rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black text-sky-900">
                          {evaluation.dataLabel}
                        </span>
                      ) : null}
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${
                          evaluation.status === "FINALIZED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {evaluation.status === "FINALIZED"
                          ? "Finalizada"
                          : "Rascunho"}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="mt-4 text-sm font-semibold text-slate-700">
          Não há avaliações salvas disponíveis para seleção.
        </p>
      )}

      <p className="mt-3 text-xs font-bold text-slate-700" role="status" aria-live="polite">
        {selectedCount === 0
          ? "Nenhuma avaliação selecionada."
          : `${selectedCount} ${selectedCount === 1 ? "avaliação selecionada" : "avaliações selecionadas"}.`}
        {selectedCount < 2
          ? " Selecione ao menos duas avaliações para comparar diferenças."
          : " As diferenças usam a primeira e a última da seleção."}
      </p>
    </section>
  );
}
