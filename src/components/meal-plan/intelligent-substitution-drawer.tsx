"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, Input } from "@/components/ui";
import type { ProfessionalFood } from "@/features/food-database";
import {
  createSubstitutionProposal,
  recommendSubstitutionFoods,
  searchSubstitutionFoods,
  type SubstitutionAdjustmentMode,
  type SubstitutionNutritionSnapshot,
  type SubstitutionProposal,
} from "@/features/meal-plan/substitution-engine";
import type { AssistedPreviewFood } from "@/features/meal-plan";

export interface SubstitutionHistoryItem {
  readonly id: string;
  readonly previousFood: string;
  readonly nextFood: string;
  readonly professionalName: string;
  readonly occurredAt: string;
}

const formatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

function value(value: number | null | undefined, suffix: string) {
  return value === null || value === undefined
    ? "Não informado"
    : `${formatter.format(value)} ${suffix}`;
}

function difference(
  next: number | null | undefined,
  current: number,
  suffix: string,
) {
  if (next === null || next === undefined) return "Não informado";
  const delta = next - current;
  return `${delta > 0 ? "+" : ""}${formatter.format(delta)} ${suffix}`;
}

function currentSnapshot(food: AssistedPreviewFood): SubstitutionNutritionSnapshot {
  return {
    grams: food.grams,
    energyKcal: food.nutrition.calories,
    proteinGrams: food.nutrition.proteinGrams,
    carbohydratesGrams: food.nutrition.carbohydratesGrams,
    fatsGrams: food.nutrition.fatsGrams,
    fiberGrams: food.nutrition.fiberGrams,
  };
}

export function IntelligentSubstitutionDrawer({
  currentFood,
  catalog,
  history,
  onApply,
  onClose,
}: {
  currentFood: AssistedPreviewFood;
  catalog: readonly ProfessionalFood[];
  history: readonly SubstitutionHistoryItem[];
  onApply: (proposal: SubstitutionProposal) => void;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const currentCentralFood = catalog.find(
    (food) => food.officialName === currentFood.name,
  );
  const recommendations = useMemo(
    () =>
      currentCentralFood
        ? recommendSubstitutionFoods(currentCentralFood, catalog)
        : [],
    [catalog, currentCentralFood],
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    recommendations[0]?.id ?? "",
  );
  const [mode, setMode] =
    useState<SubstitutionAdjustmentMode>("KEEP_GRAMS");
  const results = query
    ? searchSubstitutionFoods(catalog, query, currentCentralFood?.id)
    : recommendations;
  const selected =
    catalog.find((food) => food.id === selectedId) ?? results[0];
  const proposal = selected
    ? createSubstitutionProposal(currentSnapshot(currentFood), selected, mode)
    : null;

  useEffect(() => {
    headingRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const comparisonRows = proposal
    ? [
        [
          "Energia",
          currentFood.nutrition.calories,
          proposal.nutrition.energyKcal,
          "kcal",
        ],
        [
          "Proteína",
          currentFood.nutrition.proteinGrams,
          proposal.nutrition.proteinGrams,
          "g",
        ],
        [
          "Carboidrato",
          currentFood.nutrition.carbohydratesGrams,
          proposal.nutrition.carbohydratesGrams,
          "g",
        ],
        [
          "Lipídio",
          currentFood.nutrition.fatsGrams,
          proposal.nutrition.fatsGrams,
          "g",
        ],
        [
          "Fibras",
          currentFood.nutrition.fiberGrams,
          proposal.nutrition.fiberGrams,
          "g",
        ],
      ] as const
    : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--overlay)]"
      onMouseDown={onClose}
    >
      <section
        aria-labelledby="substitution-drawer-title"
        aria-modal="true"
        className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-[var(--surface)] shadow-[var(--shadow-elevated)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--line)] bg-white p-4 md:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
              Decisão exclusiva do nutricionista
            </p>
            <h2
              className="mt-1 text-xl font-black text-[var(--text-primary)] outline-none"
              id="substitution-drawer-title"
              ref={headingRef}
              tabIndex={-1}
            >
              Substituir {currentFood.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Pesquise, compare e confirme antes de alterar o plano.
            </p>
          </div>
          <Button
            aria-label="Fechar substituição"
            onClick={onClose}
            size="small"
            variant="ghost"
          >
            Fechar
          </Button>
        </header>

        <div className="space-y-5 p-4 md:p-5">
          <label className="block">
            <span className="text-xs font-black text-[var(--text-secondary)]">
              Pesquisar alimento
            </span>
            <Input
              className="mt-1"
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId("");
              }}
              placeholder="Nome, sinônimo, categoria, grupo ou fonte"
              type="search"
              value={query}
            />
          </label>

          <section aria-labelledby="recommended-substitutions">
            <div className="flex items-center justify-between gap-2">
              <h3
                className="font-black text-[var(--text-primary)]"
                id="recommended-substitutions"
              >
                {query
                  ? "Resultados da pesquisa"
                  : "Substituições recomendadas"}
              </h3>
              <Badge tone="info">{results.length} opções</Badge>
            </div>
            {results.length ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {results.slice(0, query ? 20 : 6).map((food) => (
                  <button
                    className={`rounded-xl border p-3 text-left transition ${
                      selected?.id === food.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-[var(--line)] bg-white hover:border-emerald-300"
                    }`}
                    key={food.id}
                    onClick={() => setSelectedId(food.id)}
                    type="button"
                  >
                    <span className="block text-sm font-black">
                      {food.officialName}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      {food.foodGroup} · {food.source.kind}
                    </span>
                    {!food.nutrients ? (
                      <span className="mt-1 block text-xs font-bold text-amber-700">
                        Sem composição nutricional disponível
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Nenhuma equivalência cadastrada. Use a pesquisa completa para
                localizar outro alimento.
              </p>
            )}
          </section>

          {selected ? (
            <>
              <fieldset className="rounded-xl border border-[var(--line)] p-3">
                <legend className="px-1 text-xs font-black text-[var(--text-secondary)]">
                  Ajuste da gramagem
                </legend>
                <div className="mt-1 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      checked={mode === "KEEP_GRAMS"}
                      name="substitution-mode"
                      onChange={() => setMode("KEEP_GRAMS")}
                      type="radio"
                    />
                    Manter gramagem
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      checked={mode === "AUTO_ADJUST"}
                      name="substitution-mode"
                      onChange={() => setMode("AUTO_ADJUST")}
                      type="radio"
                    />
                    Ajustar automaticamente
                  </label>
                </div>
                {proposal ? (
                  <p className="mt-3 text-xs font-bold text-[var(--text-secondary)]">
                    {formatter.format(currentFood.grams)} g →{" "}
                    {formatter.format(proposal.grams)} g · prioridade{" "}
                    {proposal.adjustmentBasis === "PROTEIN"
                      ? "proteína"
                      : proposal.adjustmentBasis === "ENERGY"
                        ? "energia"
                        : "gramagem atual"}
                  </p>
                ) : null}
              </fieldset>

              {proposal ? (
                <section aria-labelledby="nutrition-comparison">
                  <h3
                    className="font-black text-[var(--text-primary)]"
                    id="nutrition-comparison"
                  >
                    Comparação nutricional
                  </h3>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--line)]">
                    <table className="w-full min-w-[31rem] text-xs">
                      <thead className="bg-[var(--surface-elevated)]">
                        <tr>
                          <th className="px-3 py-2 text-left">Indicador</th>
                          <th className="px-3 py-2 text-right">
                            Atual · {currentFood.name}
                          </th>
                          <th className="px-3 py-2 text-right">
                            Novo · {proposal.food.officialName}
                          </th>
                          <th className="px-3 py-2 text-right">Diferença</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        <tr>
                          <th className="px-3 py-2 text-left">Gramagem</th>
                          <td className="px-3 py-2 text-right">
                            {value(currentFood.grams, "g")}
                          </td>
                          <td className="px-3 py-2 text-right font-black">
                            {value(proposal.grams, "g")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {difference(
                              proposal.grams,
                              currentFood.grams,
                              "g",
                            )}
                          </td>
                        </tr>
                        {comparisonRows.map(
                          ([label, current, next, suffix]) => (
                            <tr key={label}>
                              <th className="px-3 py-2 text-left">{label}</th>
                              <td className="px-3 py-2 text-right">
                                {value(current, suffix)}
                              </td>
                              <td className="px-3 py-2 text-right font-black">
                                {value(next, suffix)}
                              </td>
                              <td className="px-3 py-2 text-right text-[var(--primary-hover)]">
                                {difference(next, current, suffix)}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Medida sugerida: {proposal.measureName}. Nenhuma alteração
                    será aplicada sem confirmação.
                  </p>
                </section>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                  Este alimento não possui composição nutricional suficiente
                  para uma substituição assistida.
                </p>
              )}
            </>
          ) : null}

          {history.length ? (
            <details className="rounded-xl border border-[var(--line)] p-3">
              <summary className="cursor-pointer text-sm font-black">
                Histórico desta edição · {history.length}
              </summary>
              <ul className="mt-3 space-y-2 text-xs">
                {history.map((item) => (
                  <li className="rounded-lg bg-slate-50 p-2" key={item.id}>
                    <strong>{item.previousFood}</strong> →{" "}
                    <strong>{item.nextFood}</strong>
                    <span className="mt-1 block text-[var(--muted)]">
                      {item.professionalName} ·{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(item.occurredAt))}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <footer className="sticky bottom-0 mt-auto flex flex-col-reverse gap-2 border-t border-[var(--line)] bg-white p-4 sm:flex-row sm:justify-end md:p-5">
          <Button onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button
            disabled={!proposal}
            onClick={() => {
              if (proposal) onApply(proposal);
            }}
          >
            Aplicar substituição
          </Button>
        </footer>
      </section>
    </div>
  );
}
