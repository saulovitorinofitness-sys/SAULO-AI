"use client";

import {
  useEffect,
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
  compareMealPlanTarget,
  createAssistedMealPreview,
  createAssistedMealReferences,
  mealNutrition,
  MEAL_PLAN_TARGET_TOLERANCES,
  mealPlanStatusAfterEdit,
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
import type {
  FoodNutrientsPer100g,
  FoodSearchResult,
  ProfessionalFood,
} from "@/features/food-database";
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

const FOOD_CATALOG_PAGE_SIZE = 50;
const FOOD_CATALOG_REQUEST_CONCURRENCY = 6;

type FoodCatalogState = "loading" | "ready" | "empty" | "error" | "offline";

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

function mapCompleteNutrition(
  nutrients: FoodNutrientsPer100g | null,
  factor: number,
) {
  if (!nutrients) return null;
  const required = [
    nutrients.energyKcal,
    nutrients.proteinGrams,
    nutrients.carbohydratesGrams,
    nutrients.fatsGrams,
    nutrients.fiberGrams,
    nutrients.calciumMg,
    nutrients.ironMg,
    nutrients.magnesiumMg,
    nutrients.zincMg,
    nutrients.sodiumMg,
    nutrients.potassiumMg,
    nutrients.vitaminAMcg,
    nutrients.vitaminCMg,
    nutrients.vitaminDMcg,
    nutrients.vitaminEMg,
    nutrients.thiamineMg,
    nutrients.riboflavinMg,
    nutrients.vitaminB6Mg,
    nutrients.vitaminB12Mcg,
    nutrients.folateMcg,
  ];
  if (required.some((value) => value === null)) return null;

  return {
    calories: nutrients.energyKcal! * factor,
    proteinGrams: nutrients.proteinGrams! * factor,
    carbohydratesGrams: nutrients.carbohydratesGrams! * factor,
    fatsGrams: nutrients.fatsGrams! * factor,
    fiberGrams: nutrients.fiberGrams! * factor,
    micronutrients: {
      calciumMg: nutrients.calciumMg! * factor,
      ironMg: nutrients.ironMg! * factor,
      magnesiumMg: nutrients.magnesiumMg! * factor,
      zincMg: nutrients.zincMg! * factor,
      sodiumMg: nutrients.sodiumMg! * factor,
      potassiumMg: nutrients.potassiumMg! * factor,
      vitaminAMcg: nutrients.vitaminAMcg! * factor,
      vitaminCMg: nutrients.vitaminCMg! * factor,
      vitaminDMcg: nutrients.vitaminDMcg! * factor,
      vitaminEMg: nutrients.vitaminEMg! * factor,
      vitaminB1Mg: nutrients.thiamineMg! * factor,
      vitaminB2Mg: nutrients.riboflavinMg! * factor,
      vitaminB6Mg: nutrients.vitaminB6Mg! * factor,
      vitaminB12Mcg: nutrients.vitaminB12Mcg! * factor,
      folateMcg: nutrients.folateMcg! * factor,
    },
  };
}

function hasCompleteAssistedNutrition(food: ProfessionalFood) {
  return mapCompleteNutrition(food.nutrients, 1) !== null;
}

async function requestFoodCatalogPage(page: number, signal: AbortSignal) {
  const parameters = new URLSearchParams({
    source: "ALL",
    page: String(page),
    pageSize: String(FOOD_CATALOG_PAGE_SIZE),
  });
  const response = await fetch(`/api/foods?${parameters}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`FOOD_CATALOG_HTTP_${response.status}`);
  return (await response.json()) as FoodSearchResult;
}

async function requestCompleteFoodCatalog(
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
) {
  const firstPage = await requestFoodCatalogPage(1, signal);
  const items = [...firstPage.items];
  onProgress(items.length, firstPage.total);

  for (
    let firstPendingPage = 2;
    firstPendingPage <= firstPage.totalPages;
    firstPendingPage += FOOD_CATALOG_REQUEST_CONCURRENCY
  ) {
    const pages = Array.from(
      {
        length: Math.min(
          FOOD_CATALOG_REQUEST_CONCURRENCY,
          firstPage.totalPages - firstPendingPage + 1,
        ),
      },
      (_, index) => firstPendingPage + index,
    );
    const results = await Promise.all(
      pages.map((page) => requestFoodCatalogPage(page, signal)),
    );
    for (const result of results) items.push(...result.items);
    onProgress(items.length, firstPage.total);
  }

  return [...new Map(items.map((food) => [food.id, food])).values()];
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

function foodFromCatalog(
  centralFood: ProfessionalFood,
  grams?: number,
  id?: string,
): AssistedPreviewFood | null {
  const defaultMeasure =
    centralFood.householdMeasures.find((measure) => measure.isDefault) ??
    centralFood.householdMeasures[0];
  const gramsPerMeasure = defaultMeasure
    ? defaultMeasure.grams / defaultMeasure.quantity
    : centralFood.referenceServingGrams;

  const resolvedGrams = Math.max(
    0,
    grams ?? gramsPerMeasure,
  );
  const nutrition = mapCompleteNutrition(
    centralFood.nutrients,
    resolvedGrams / 100,
  );
  if (!nutrition || !Number.isFinite(gramsPerMeasure) || gramsPerMeasure <= 0) {
    return null;
  }

  return {
    id: id ?? `assisted-manual-${Date.now()}-${centralFood.id}`,
    scientificLibraryItemId: centralFood.id,
    name: centralFood.officialName,
    category: centralFood.category,
    householdMeasure:
      defaultMeasure?.name ?? centralFood.referenceServingUnit ?? "gramas",
    gramsPerMeasure,
    quantity: round(resolvedGrams / gramsPerMeasure, 2),
    grams: resolvedGrams,
    nutrition,
    source: centralFood.source.name,
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
  const [foodCatalog, setFoodCatalog] = useState<readonly ProfessionalFood[]>(
    [],
  );
  const [catalogState, setCatalogState] =
    useState<FoodCatalogState>("loading");
  const [catalogProgress, setCatalogProgress] = useState({ loaded: 0, total: 0 });
  const [catalogRequest, setCatalogRequest] = useState(0);
  const totals = previewNutrition(preview);
  const method =
    nutritionMethodOptions.find(([value]) => value === strategy.method)?.[1] ??
    strategy.method;
  const strategyFingerprint = nutritionStrategySelectionFingerprint(strategy);
  const previewOutdated =
    preview.strategyFingerprint !== strategyFingerprint;
  const usableCatalog = useMemo(
    () => foodCatalog.filter(hasCompleteAssistedNutrition),
    [foodCatalog],
  );
  const availableFoods = usableCatalog;

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      if (!window.navigator.onLine) {
        setCatalogState("offline");
        return;
      }

      try {
        const catalog = await requestCompleteFoodCatalog(
          controller.signal,
          (loaded, total) => setCatalogProgress({ loaded, total }),
        );
        if (controller.signal.aborted) return;
        setFoodCatalog(catalog);
        setCatalogState(catalog.length ? "ready" : "empty");
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setFoodCatalog([]);
        setCatalogState(
          !window.navigator.onLine || error instanceof TypeError
            ? "offline"
            : "error",
        );
      }
    }

    void loadCatalog();

    return () => controller.abort();
  }, [catalogRequest]);

  const catalogAvailable =
    catalogState === "ready" && usableCatalog.length > 0;
  const catalogUnavailableReason =
    catalogState === "offline"
      ? "Sem conexão. O catálogo alimentar não possui cache offline disponível."
      : catalogState === "error"
        ? "Não foi possível consultar o catálogo alimentar real."
        : catalogState === "empty"
          ? "Nenhum alimento ativo foi encontrado no catálogo real."
          : catalogState === "ready" && usableCatalog.length === 0
            ? "Nenhum alimento possui composição completa para este fluxo assistido."
            : undefined;

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
    const selectedFood = availableFoods.find((candidate) => candidate.id === itemId);
    if (!selectedFood) return;
    const next = foodFromCatalog(
      selectedFood,
      editingFood.draft.grams,
      editingFood.original.id,
    );
    if (!next) return;
    setEditingFood({ ...editingFood, draft: next });
  }

  function editQuantity(quantity: number) {
    if (!editingFood) return;
    const selectedFood = availableFoods.find(
      (candidate) =>
        candidate.id === editingFood.draft.scientificLibraryItemId ||
        normalized(candidate.officialName) === normalized(editingFood.draft.name),
    );
    if (!selectedFood) return;
    const safeQuantity = Math.max(0, quantity);
    const grams = round(
      safeQuantity * editingFood.draft.gramsPerMeasure,
    );
    const nutrition = mapCompleteNutrition(
      selectedFood.nutrients,
      grams / 100,
    );
    if (!nutrition) return;
    setEditingFood({
      ...editingFood,
      draft: {
        ...editingFood.draft,
        quantity: safeQuantity,
        grams,
        nutrition,
      },
    });
  }

  function editGrams(gramsValue: number) {
    if (!editingFood) return;
    const selectedFood = availableFoods.find(
      (candidate) =>
        candidate.id === editingFood.draft.scientificLibraryItemId ||
        normalized(candidate.officialName) === normalized(editingFood.draft.name),
    );
    if (!selectedFood) return;
    const grams = Math.max(0, gramsValue);
    const nutrition = mapCompleteNutrition(
      selectedFood.nutrients,
      grams / 100,
    );
    if (!nutrition) return;
    setEditingFood({
      ...editingFood,
      draft: {
        ...editingFood.draft,
        grams,
        quantity: round(
          grams / editingFood.draft.gramsPerMeasure,
          2,
        ),
        nutrition,
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

  function addFood(mealId: string, selectedFood: ProfessionalFood) {
    const food = foodFromCatalog(selectedFood);
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

    const measureGrams =
      proposal.measureGrams > 0 ? proposal.measureGrams : proposal.grams;
    const nutrition = mapCompleteNutrition(proposal.nutrition, 1);
    if (!nutrition) return;
    const nextFood: AssistedPreviewFood = {
      ...substitutionContext.food,
      scientificLibraryItemId: proposal.food.id,
      name: proposal.food.officialName,
      category: proposal.food.category,
      householdMeasure: proposal.measureName,
      gramsPerMeasure: measureGrams,
      quantity:
        measureGrams > 0 ? proposal.grams / measureGrams : 1,
      grams: proposal.grams,
      nutrition,
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
  const matchingAvailableFoods = availableFoods
    .filter((food) =>
      normalized(`${food.officialName} ${food.category}`).includes(
        normalized(query),
      ),
    )
    .slice(0, 8);

  return (
    <section aria-labelledby="assisted-preview-title" className="space-y-4">
      <Card className="p-4 md:p-5" variant="info">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">Estratégia utilizada · regras locais</Badge>
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
              Mecanismo determinístico local conectado ao catálogo alimentar
              real do sistema; nenhuma API externa foi utilizada.
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

      {catalogState === "loading" ? (
        <Card
          aria-live="polite"
          className="border-sky-200 bg-sky-50 p-4"
          role="status"
        >
          <p className="font-black text-sky-950">
            Carregando catálogo alimentar real
          </p>
          <p className="mt-1 text-sm text-sky-800">
            {catalogProgress.total
              ? `${catalogProgress.loaded} de ${catalogProgress.total} alimentos carregados.`
              : "Consultando o serviço de alimentos do sistema."}
          </p>
        </Card>
      ) : catalogUnavailableReason ? (
        <Card
          aria-live="assertive"
          className="flex flex-col gap-3 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div>
            <p className="font-black text-amber-950">Catálogo indisponível</p>
            <p className="mt-1 text-sm text-amber-900">
              {catalogUnavailableReason}
            </p>
          </div>
          <Button
            onClick={() => {
              setCatalogProgress({ loaded: 0, total: 0 });
              setCatalogState("loading");
              setCatalogRequest((current) => current + 1);
            }}
            size="small"
            variant="outline"
          >
            Tentar novamente
          </Button>
        </Card>
      ) : (
        <Card
          aria-live="polite"
          className="border-emerald-200 bg-emerald-50 p-4"
          role="status"
        >
          <p className="font-black text-emerald-950">
            Catálogo alimentar real disponível
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            {foodCatalog.length} alimentos carregados; {usableCatalog.length}{" "}
            possuem composição completa para o formato atual da montagem
            assistida.
          </p>
        </Card>
      )}

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
                    const activeCatalogFood = isEditing
                      ? availableFoods.find(
                          (candidate) =>
                            candidate.id ===
                              activeFood.scientificLibraryItemId ||
                            normalized(candidate.officialName) ===
                              normalized(activeFood.name),
                        )
                      : undefined;

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
                                  value={activeCatalogFood?.id ?? ""}
                                >
                                  <option value="">
                                    Selecione um alimento real
                                  </option>
                                  {availableFoods.map((food) => (
                                    <option key={food.id} value={food.id}>
                                      {food.officialName}
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
                                  disabled={!catalogAvailable || !availableFoods.length}
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
                                  disabled={!catalogAvailable}
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
                    disabled={!catalogAvailable || !availableFoods.length}
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
                      {matchingAvailableFoods.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {matchingAvailableFoods.map((food) => (
                            <Button
                              key={food.id}
                              onClick={() => addFood(meal.id, food)}
                              size="small"
                              variant="outline"
                            >
                              {food.officialName}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p
                          className="mt-2 rounded-lg bg-white p-3 text-sm text-slate-600"
                          role="status"
                        >
                          Nenhum resultado real com composição completa foi
                          encontrado para esta busca.
                        </p>
                      )}
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
          catalog={usableCatalog}
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
