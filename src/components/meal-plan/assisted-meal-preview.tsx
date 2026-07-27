"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  Badge,
  Button,
  Card,
  Input,
  NumberInput,
  Select,
  StatusBadge,
} from "@/components/ui";
import {
  assistedFoodProfiles,
  compareMealPlanTarget,
  createAssistedMealPreview,
  createAssistedMealReferences,
  findAssistedFoodProfile,
  mealNutrition,
  MEAL_PLAN_TARGET_TOLERANCES,
  mealPlanStatusAfterEdit,
  nutritionForGrams,
  previewNutrition,
  type AssistedMealPreview,
  type AssistedPreviewFood,
  type AssistedPreviewStatus,
  type MealPlanMeal,
} from "@/features/meal-plan";
import {
  nutritionMethodOptions,
  nutritionStrategySelectionFingerprint,
  type NutritionStrategySelection,
} from "@/features/nutrition-strategy";
import type { ScientificLibraryItem } from "@/features/scientific-library";
import { demonstrativeProfessionalFoods } from "@/features/food-database";
import {
  IntelligentSubstitutionDrawer,
  type SubstitutionHistoryItem,
} from "./intelligent-substitution-drawer";
import type { SubstitutionProposal } from "@/features/meal-plan/substitution-engine";

const statusLabels: Record<AssistedPreviewStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Sugestão pendente de revisão",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  NEEDS_UPDATE: "Necessita atualização",
};

const adequacyLabels = {
  WITHIN_TARGET: "Dentro da meta",
  BELOW_TARGET: "Abaixo da meta",
  ABOVE_TARGET: "Acima da meta",
} as const;

const formatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

function format(value: number) {
  return formatter.format(value);
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function statusBadgeStatus(status: AssistedPreviewStatus) {
  if (status === "APPROVED") return "completed" as const;
  if (status === "REJECTED") return "blocked" as const;
  if (status === "NEEDS_UPDATE") return "pending" as const;
  return "in_progress" as const;
}

function editedPreview(preview: AssistedMealPreview) {
  return {
    ...preview,
    status: mealPlanStatusAfterEdit(preview.status),
    approvedAt: undefined,
    approvedBy: undefined,
  } satisfies AssistedMealPreview;
}

function foodFromLibrary(
  item: ScientificLibraryItem,
  grams?: number,
  id?: string,
): AssistedPreviewFood | null {
  const profile = findAssistedFoodProfile(item.name);
  if (!profile) return null;
  const centralFood = demonstrativeProfessionalFoods.find(
    (food) => food.officialName === item.name,
  );
  const defaultMeasure =
    centralFood?.householdMeasures.find((measure) => measure.isDefault) ??
    centralFood?.householdMeasures[0];
  const gramsPerMeasure = defaultMeasure?.grams ?? profile.gramsPerMeasure;

  const resolvedGrams = Math.max(
    0,
    grams ?? profile.defaultQuantity * gramsPerMeasure,
  );

  return {
    id: id ?? `assisted-manual-${Date.now()}-${item.id}`,
    scientificLibraryItemId: item.id,
    name: item.name,
    category: item.category,
    householdMeasure: defaultMeasure?.name ?? profile.householdMeasure,
    gramsPerMeasure,
    quantity: round(resolvedGrams / gramsPerMeasure, 2),
    grams: resolvedGrams,
    nutrition: nutritionForGrams(profile, resolvedGrams),
    source:
      centralFood?.source.name ??
      `${item.source} · composição nutricional demonstrativa local`,
    demonstrative: true,
  };
}

interface EditingFood {
  readonly mealId: string;
  readonly original: AssistedPreviewFood;
  readonly draft: AssistedPreviewFood;
}

export function AssistedMealPreviewPanel({
  strategy,
  planMeals,
  foods,
  preview,
  professionalName,
  onPreviewChange,
}: {
  strategy: NutritionStrategySelection;
  planMeals: readonly MealPlanMeal[];
  foods: readonly ScientificLibraryItem[];
  preview: AssistedMealPreview;
  professionalName: string;
  onPreviewChange: Dispatch<SetStateAction<AssistedMealPreview>>;
}) {
  const references = useMemo(
    () => createAssistedMealReferences(strategy, planMeals),
    [planMeals, strategy],
  );
  const [editingFood, setEditingFood] = useState<EditingFood>();
  const [substitutionContext, setSubstitutionContext] = useState<{
    readonly mealId: string;
    readonly food: AssistedPreviewFood;
  }>();
  const [substitutionHistory, setSubstitutionHistory] = useState<
    readonly SubstitutionHistoryItem[]
  >([]);
  const [addTargetMealId, setAddTargetMealId] = useState<string>();
  const [query, setQuery] = useState("");
  const totals = previewNutrition(preview);
  const method =
    nutritionMethodOptions.find(([value]) => value === strategy.method)?.[1] ??
    strategy.method;
  const strategyFingerprint = nutritionStrategySelectionFingerprint(strategy);
  const previewOutdated =
    preview.strategyFingerprint !== strategyFingerprint;
  const availableFoods = foods.filter((item) =>
    assistedFoodProfiles.some((profile) => profile.name === item.name),
  );

  function updatePreview(
    updater: (current: AssistedMealPreview) => AssistedMealPreview,
  ) {
    onPreviewChange((current) => updater(editedPreview(current)));
  }

  function approve() {
    onPreviewChange((current) => ({
      ...current,
      status: "APPROVED",
      approvedAt: new Date().toISOString(),
      approvedBy: professionalName,
    }));
  }

  function reject() {
    onPreviewChange((current) => ({
      ...current,
      status: "REJECTED",
      approvedAt: undefined,
      approvedBy: undefined,
    }));
  }

  function generateNext() {
    onPreviewChange((current) =>
      createAssistedMealPreview(
        strategy,
        references,
        foods,
        current.revision + 1,
      ),
    );
    setEditingFood(undefined);
    setSubstitutionContext(undefined);
    setAddTargetMealId(undefined);
    setQuery("");
  }

  function refreshFromStrategy() {
    generateNext();
  }

  function updateFood(
    mealId: string,
    foodId: string,
    nextFood: AssistedPreviewFood,
  ) {
    updatePreview((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              foods: meal.foods.map((food) =>
                food.id === foodId ? nextFood : food,
              ),
            }
          : meal,
      ),
    }));
  }

  function editWithLibraryItem(itemId: string) {
    if (!editingFood) return;
    const item = availableFoods.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const next = foodFromLibrary(
      item,
      editingFood.draft.grams,
      editingFood.original.id,
    );
    if (!next) return;
    setEditingFood({ ...editingFood, draft: next });
  }

  function editQuantity(quantity: number) {
    if (!editingFood) return;
    const profile = findAssistedFoodProfile(editingFood.draft.name);
    if (!profile) return;
    const safeQuantity = Math.max(0, quantity);
    const grams = round(
      safeQuantity * editingFood.draft.gramsPerMeasure,
    );
    setEditingFood({
      ...editingFood,
      draft: {
        ...editingFood.draft,
        quantity: safeQuantity,
        grams,
        nutrition: nutritionForGrams(profile, grams),
      },
    });
  }

  function editGrams(gramsValue: number) {
    if (!editingFood) return;
    const profile = findAssistedFoodProfile(editingFood.draft.name);
    if (!profile) return;
    const grams = Math.max(0, gramsValue);
    setEditingFood({
      ...editingFood,
      draft: {
        ...editingFood.draft,
        grams,
        quantity: round(
          grams / editingFood.draft.gramsPerMeasure,
          2,
        ),
        nutrition: nutritionForGrams(profile, grams),
      },
    });
  }

  function confirmEdit() {
    if (!editingFood) return;
    updateFood(
      editingFood.mealId,
      editingFood.original.id,
      editingFood.draft,
    );
    setEditingFood(undefined);
  }

  function removeFood(mealId: string, food: AssistedPreviewFood) {
    if (!window.confirm(`Remover “${food.name}” desta refeição?`)) return;
    updatePreview((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              foods: meal.foods.filter((item) => item.id !== food.id),
            }
          : meal,
      ),
    }));
  }

  function addFood(mealId: string, item: ScientificLibraryItem) {
    const food = foodFromLibrary(item);
    if (!food) return;
    updatePreview((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? { ...meal, foods: [...meal.foods, food] }
          : meal,
      ),
    }));
    setAddTargetMealId(undefined);
    setQuery("");
  }

  function duplicateFood(mealId: string, food: AssistedPreviewFood) {
    updatePreview((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              foods: [
                ...meal.foods,
                {
                  ...food,
                  id: `${food.id}-copy-${Date.now()}`,
                },
              ],
            }
          : meal,
      ),
    }));
  }

  function applySubstitution(proposal: SubstitutionProposal) {
    if (!substitutionContext) return;
    const libraryItem = foods.find(
      (item) => item.name === proposal.food.officialName,
    );
    if (!libraryItem) return;

    const measureGrams =
      proposal.measureGrams > 0 ? proposal.measureGrams : proposal.grams;
    const nextFood: AssistedPreviewFood = {
      ...substitutionContext.food,
      scientificLibraryItemId: libraryItem.id,
      name: proposal.food.officialName,
      category: proposal.food.category,
      householdMeasure: proposal.measureName,
      gramsPerMeasure: measureGrams,
      quantity:
        measureGrams > 0 ? proposal.grams / measureGrams : 1,
      grams: proposal.grams,
      nutrition: {
        calories: proposal.nutrition.energyKcal ?? 0,
        proteinGrams: proposal.nutrition.proteinGrams ?? 0,
        carbohydratesGrams:
          proposal.nutrition.carbohydratesGrams ?? 0,
        fatsGrams: proposal.nutrition.fatsGrams ?? 0,
        fiberGrams: proposal.nutrition.fiberGrams ?? 0,
        micronutrients: {
          calciumMg: proposal.nutrition.calciumMg ?? 0,
          ironMg: proposal.nutrition.ironMg ?? 0,
          magnesiumMg: proposal.nutrition.magnesiumMg ?? 0,
          zincMg: proposal.nutrition.zincMg ?? 0,
          sodiumMg: proposal.nutrition.sodiumMg ?? 0,
          potassiumMg: proposal.nutrition.potassiumMg ?? 0,
          vitaminAMcg: proposal.nutrition.vitaminAMcg ?? 0,
          vitaminCMg: proposal.nutrition.vitaminCMg ?? 0,
          vitaminDMcg: proposal.nutrition.vitaminDMcg ?? 0,
          vitaminEMg: proposal.nutrition.vitaminEMg ?? 0,
          vitaminB1Mg: proposal.nutrition.thiamineMg ?? 0,
          vitaminB2Mg: proposal.nutrition.riboflavinMg ?? 0,
          vitaminB6Mg: proposal.nutrition.vitaminB6Mg ?? 0,
          vitaminB12Mcg: proposal.nutrition.vitaminB12Mcg ?? 0,
          folateMcg: proposal.nutrition.folateMcg ?? 0,
        },
      },
      source: proposal.food.source.name,
    };

    updateFood(
      substitutionContext.mealId,
      substitutionContext.food.id,
      nextFood,
    );
    setSubstitutionHistory((current) => [
      {
        id: `substitution-${Date.now()}`,
        previousFood: substitutionContext.food.name,
        nextFood: nextFood.name,
        professionalName,
        occurredAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setSubstitutionContext(undefined);
  }

  const comparisons = [
    {
      label: "kcal",
      ...compareMealPlanTarget(
        strategy.targetCalories,
        totals.calories,
        MEAL_PLAN_TARGET_TOLERANCES.calories,
      ),
    },
    {
      label: "Carb. g",
      ...compareMealPlanTarget(
        strategy.carbohydrates.grams,
        totals.carbohydratesGrams,
        MEAL_PLAN_TARGET_TOLERANCES.carbohydratesGrams,
      ),
    },
    {
      label: "Prot. g",
      ...compareMealPlanTarget(
        strategy.protein.grams,
        totals.proteinGrams,
        MEAL_PLAN_TARGET_TOLERANCES.proteinGrams,
      ),
    },
    {
      label: "Lip. g",
      ...compareMealPlanTarget(
        strategy.fats.grams,
        totals.fatsGrams,
        MEAL_PLAN_TARGET_TOLERANCES.fatsGrams,
      ),
    },
  ];

  return (
    <section aria-labelledby="assisted-preview-title" className="space-y-4">
      <Card className="p-4 md:p-5" variant="info">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">Estratégia utilizada · mock controlado</Badge>
              <StatusBadge
                label={statusLabels[preview.status]}
                status={statusBadgeStatus(preview.status)}
              />
            </div>
            <h2
              className="mt-3 text-lg font-black text-sky-950"
              id="assisted-preview-title"
            >
              Plano alimentar assistido
            </h2>
            <p className="mt-1 text-sm font-bold text-sky-900">
              Sugestão baseada na estratégia nutricional. A decisão final
              permanece com o nutricionista.
            </p>
            <p className="mt-1 text-xs leading-5 text-sky-800">
              Mecanismo determinístico local e catálogo demonstrativo atual;
              nenhuma API externa foi utilizada.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={generateNext} size="small">
              Gerar sugestão de Plano Alimentar
            </Button>
            <Button
              disabled={
                preview.status === "APPROVED" ||
                preview.status === "REJECTED" ||
                previewOutdated
              }
              onClick={approve}
              size="small"
              variant="outline"
            >
              Aprovar
            </Button>
            <Button
              disabled={preview.status === "REJECTED"}
              onClick={reject}
              size="small"
              variant="destructive"
            >
              Rejeitar
            </Button>
            <Button onClick={generateNext} size="small" variant="outline">
              Regenerar
            </Button>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 border-t border-sky-200 pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs font-bold text-sky-800">
              Objetivo principal
            </dt>
            <dd className="mt-1 font-black text-sky-950">
              {strategy.objectiveMain}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-sky-800">
              Método nutricional
            </dt>
            <dd className="mt-1 font-black text-sky-950">{method}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-sky-800">
              Meta energética
            </dt>
            <dd className="mt-1 font-black text-sky-950">
              {format(strategy.targetCalories)} kcal
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-sky-800">Refeições</dt>
            <dd className="mt-1 font-black text-sky-950">
              {strategy.mealCount} · {strategy.mealTimes.join(", ")}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold text-sky-800">
              Macros planejados
            </dt>
            <dd className="mt-1 font-black text-sky-950">
              C {format(strategy.carbohydrates.percentage)}% ·{" "}
              {format(strategy.carbohydrates.grams)} g | P{" "}
              {format(strategy.protein.percentage)}% ·{" "}
              {format(strategy.protein.grams)} g | L{" "}
              {format(strategy.fats.percentage)}% ·{" "}
              {format(strategy.fats.grams)} g
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold text-sky-800">
              Estratégias complementares
            </dt>
            <dd className="mt-1 font-black text-sky-950">
              {strategy.complementaryStrategies.join(" · ") ||
                "Nenhuma selecionada"}
            </dd>
          </div>
        </dl>
      </Card>

      {previewOutdated ? (
        <Card className="flex flex-col gap-3 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-amber-950">
              A Estratégia Nutricional foi modificada. Deseja atualizar as
              metas do Plano Alimentar?
            </p>
            <p className="mt-1 text-sm text-amber-900">
              O plano atual foi preservado e não será alterado sem sua
              confirmação.
            </p>
          </div>
          <Button onClick={refreshFromStrategy} size="small">
            Atualizar metas
          </Button>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          {preview.meals.map((meal) => {
            const mealTotals = mealNutrition(meal);
            const addOpen = addTargetMealId === meal.id;

            return (
              <Card className="p-3 md:p-4" key={meal.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                  <div>
                    <h3 className="font-black text-[var(--text-primary)]">
                      {meal.time} · {meal.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {meal.foods.length} itens
                    </p>
                  </div>
                  <p className="text-xs font-black text-[var(--text-secondary)]">
                    {format(mealTotals.calories)} kcal · C{" "}
                    {format(mealTotals.carbohydratesGrams)} g · P{" "}
                    {format(mealTotals.proteinGrams)} g · L{" "}
                    {format(mealTotals.fatsGrams)} g
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  {meal.foods.map((food) => {
                    const isEditing =
                      editingFood?.mealId === meal.id &&
                      editingFood.original.id === food.id;
                    const activeFood = isEditing
                      ? editingFood.draft
                      : food;

                    return (
                      <article
                        className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3"
                        key={food.id}
                      >
                        <div className="grid gap-3 lg:grid-cols-[minmax(11rem,1.4fr)_6rem_7rem_minmax(9rem,1fr)_auto] lg:items-end">
                          <div>
                            {isEditing ? (
                              <label className="text-xs font-bold text-[var(--text-secondary)]">
                                Alimento
                                <Select
                                  className="mt-1"
                                  onChange={(event) =>
                                    editWithLibraryItem(event.target.value)
                                  }
                                  value={activeFood.scientificLibraryItemId}
                                >
                                  {availableFoods.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </Select>
                              </label>
                            ) : (
                              <>
                                <p className="text-sm font-black text-[var(--text-primary)]">
                                  {food.name}
                                </p>
                                <p className="mt-1 text-[0.7rem] leading-4 text-[var(--muted)]">
                                  Fonte: {food.source}
                                </p>
                              </>
                            )}
                          </div>

                          <label className="text-xs font-bold text-[var(--text-secondary)]">
                            Quantidade
                            <NumberInput
                              aria-label={`Quantidade de ${activeFood.name}`}
                              className="mt-1"
                              disabled={!isEditing}
                              min={0}
                              onChange={(event) =>
                                editQuantity(Number(event.target.value))
                              }
                              value={activeFood.quantity}
                            />
                          </label>

                          <label className="text-xs font-bold text-[var(--text-secondary)]">
                            Gramagem
                            <NumberInput
                              aria-label={`Gramagem de ${activeFood.name}`}
                              className="mt-1"
                              disabled={!isEditing}
                              min={0}
                              onChange={(event) =>
                                editGrams(Number(event.target.value))
                              }
                              value={activeFood.grams}
                            />
                          </label>

                          <div>
                            {isEditing ? (
                              <label className="text-xs font-bold text-[var(--text-secondary)]">
                                Medida caseira
                                <Input
                                  className="mt-1"
                                  onChange={(event) =>
                                    setEditingFood({
                                      ...editingFood,
                                      draft: {
                                        ...editingFood.draft,
                                        householdMeasure:
                                          event.target.value,
                                      },
                                    })
                                  }
                                  value={activeFood.householdMeasure}
                                />
                              </label>
                            ) : (
                              <p className="text-xs font-bold text-[var(--muted)]">
                                {food.householdMeasure}
                              </p>
                            )}
                            <p className="mt-1 text-xs font-black text-[var(--text-secondary)]">
                              {format(activeFood.nutrition.calories)} kcal · C{" "}
                              {format(
                                activeFood.nutrition.carbohydratesGrams,
                              )}{" "}
                              · P{" "}
                              {format(activeFood.nutrition.proteinGrams)} · L{" "}
                              {format(activeFood.nutrition.fatsGrams)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-1 lg:justify-end">
                            {isEditing ? (
                              <>
                                <Button onClick={confirmEdit} size="small">
                                  Confirmar
                                </Button>
                                <Button
                                  onClick={() => setEditingFood(undefined)}
                                  size="small"
                                  variant="outline"
                                >
                                  Cancelar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  onClick={() =>
                                    setEditingFood({
                                      mealId: meal.id,
                                      original: food,
                                      draft: food,
                                    })
                                  }
                                  size="small"
                                  variant="outline"
                                >
                                  Editar
                                </Button>
                                <Button
                                  onClick={() =>
                                    setSubstitutionContext({
                                      mealId: meal.id,
                                      food,
                                    })
                                  }
                                  size="small"
                                  variant="outline"
                                >
                                  Substituir
                                </Button>
                                <Button
                                  onClick={() => duplicateFood(meal.id, food)}
                                  size="small"
                                  variant="outline"
                                >
                                  Duplicar
                                </Button>
                                <Button
                                  onClick={() => removeFood(meal.id, food)}
                                  size="small"
                                  variant="destructive"
                                >
                                  Excluir
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <Button
                    onClick={() => {
                      setAddTargetMealId(addOpen ? undefined : meal.id);
                      setQuery("");
                    }}
                    size="small"
                    variant="outline"
                  >
                    Adicionar alimento
                  </Button>
                  {addOpen ? (
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <Input
                        aria-label={`Buscar alimento para ${meal.name}`}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Pesquisar no catálogo atual"
                        value={query}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {availableFoods
                          .filter((item) =>
                            normalized(
                              `${item.name} ${item.category}`,
                            ).includes(normalized(query)),
                          )
                          .slice(0, 8)
                          .map((item) => (
                            <Button
                              key={item.id}
                              onClick={() => addFood(meal.id, item)}
                              size="small"
                              variant="outline"
                            >
                              {item.name}
                            </Button>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Card className="p-4" variant="elevated">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-black text-[var(--text-primary)]">
                Estratégia × plano
              </h3>
              <Badge tone="info">Revisão {preview.revision}</Badge>
            </div>
            <div className="mt-2">
              <StatusBadge
                label={statusLabels[preview.status]}
                status={statusBadgeStatus(preview.status)}
              />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="w-full min-w-[20rem] text-xs">
                <thead className="bg-[var(--surface-elevated)] text-[var(--muted)]">
                  <tr>
                    <th className="px-2 py-2 text-left">Indicador</th>
                    <th className="px-2 py-2 text-right">Meta</th>
                    <th className="px-2 py-2 text-right">Plano</th>
                    <th className="px-2 py-2 text-right">Dif.</th>
                    <th className="px-2 py-2 text-right">Adeq.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {comparisons.map((comparison) => (
                    <tr key={comparison.label}>
                      <th className="px-2 py-2 text-left font-bold text-[var(--text-secondary)]">
                        {comparison.label}
                      </th>
                      <td className="px-2 py-2 text-right">
                        {format(comparison.target)}
                      </td>
                      <td className="px-2 py-2 text-right font-black">
                        {format(comparison.current)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {comparison.difference > 0 ? "+" : ""}
                        {format(comparison.difference)}
                      </td>
                      <td className="px-2 py-2 text-right font-black">
                        {format(comparison.adequacyPercentage)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
              {comparisons.map((comparison) => (
                <li
                  className="flex items-center justify-between gap-2"
                  key={`${comparison.label}-status`}
                >
                  <span>{comparison.label}</span>
                  <span className="font-black">
                    {adequacyLabels[comparison.status]}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Tolerância centralizada de ±5% para energia e macronutrientes.
              Totais recalculados pela mesma função após cada confirmação.
            </p>
            {preview.approvedAt && preview.approvedBy ? (
              <p className="mt-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
                Aprovado por{" "}
                <strong className="text-[var(--text-secondary)]">
                  {preview.approvedBy}
                </strong>{" "}
                em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(preview.approvedAt))}
                .
              </p>
            ) : null}
          </Card>
        </aside>
      </div>

      {substitutionContext ? (
        <IntelligentSubstitutionDrawer
          catalog={demonstrativeProfessionalFoods}
          currentFood={substitutionContext.food}
          history={substitutionHistory}
          key={`${substitutionContext.mealId}:${substitutionContext.food.id}`}
          onApply={applySubstitution}
          onClose={() => setSubstitutionContext(undefined)}
        />
      ) : null}
    </section>
  );
}
