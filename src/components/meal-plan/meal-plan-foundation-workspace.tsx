"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { PrescriptionHistory } from "./prescription-history";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type {
  FoodSearchResult,
  ProfessionalFood,
} from "@/features/food-database";
import type { MealPlanPrescriptionView } from "@/features/meal-plan";
import {
  calculateFoodNutrientsForGrams,
  calculateMealPlanTotals,
  compareMealEnergyTarget,
  EMPTY_FOOD_NUTRIENTS,
  normalizeFoodNutrients,
} from "@/features/meal-plan/nutrition-calculations";
import {
  calculateNutritionAdequacy,
  type NutritionAdequacyMetric,
  type NutritionAdequacyStatus,
} from "@/features/meal-plan/adequacy-engine";
import type {
  MealPlanAiDecision,
  MealPlanRecordFood,
  MealPlanRecordMeal,
  MealPlanRecordSupplement,
  MealPlanStrategyUpdateDecision,
} from "@/features/meal-plan/record";
import type { NutritionalEquivalent } from "@/features/meal-plan/substitution-engine";
import { NUTRITION_OBJECTIVES } from "@/features/nutrition-strategy";
import { ENERGY_PROTOCOLS } from "@/lib/nutrition";

const STANDARD_MEALS = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
] as const;
const MEAL_ENERGY_STATUS_LABEL = {
  ADEQUATE: "Adequado",
  NEAR_TARGET: "Próximo da meta",
  OUTSIDE_TARGET: "Fora da meta",
} as const;
const adequacyMetricConfig = {
  energyKcal: { label: "Energia", unit: "kcal" },
  proteinGrams: { label: "Proteínas", unit: "g" },
  carbohydratesGrams: { label: "Carboidratos", unit: "g" },
  fatsGrams: { label: "Lipídios", unit: "g" },
  fiberGrams: { label: "Fibras", unit: "g" },
  waterMl: { label: "Água", unit: "ml" },
} as const;
const adequacyStatusLabels: Record<NutritionAdequacyStatus, string> = {
  ADEQUATE: "Adequado",
  NEAR_TARGET: "Próximo da meta",
  OUTSIDE_TARGET: "Fora da meta",
};

function n(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}

function toStoredFood(food: ProfessionalFood): MealPlanRecordFood | null {
  if (!food.nutrients) return null;
  const measure =
    food.householdMeasures.find((item) => item.isDefault && item.active) ??
    food.householdMeasures.find((item) => item.active);
  const grams = measure?.grams ?? food.referenceServingGrams ?? 100;
  const per100g = normalizeFoodNutrients(food.nutrients);
  return {
    id: crypto.randomUUID(),
    catalogFoodId: food.id,
    description: food.officialName,
    foodGroup: food.foodGroup,
    source: food.source.kind,
    sourceName: food.source.name,
    sourceVersion: food.source.version,
    sourceCode: food.sourceCode,
    primaryHouseholdMeasure: measure?.name ?? "porção",
    standardWeightGrams: food.referenceServingGrams,
    grams,
    householdMeasure: measure?.name ?? "porção",
    measureOptions: food.householdMeasures
      .filter((item) => item.active)
      .map((item) => ({
        name: item.name,
        gramsPerUnit: item.grams / item.quantity,
      })),
    quantity: measure?.quantity ?? 1,
    nutrientsPer100g: per100g,
    nutrients: calculateFoodNutrientsForGrams(per100g, grams),
    substitutions: [],
  };
}

function emptyFoodLine(): MealPlanRecordFood {
  return {
    id: crypto.randomUUID(),
    catalogFoodId: "",
    description: "",
    foodGroup: "Não selecionado",
    source: "CLINIC_SV",
    sourceName: "Catálogo profissional",
    primaryHouseholdMeasure: "unidade",
    standardWeightGrams: 100,
    grams: 0,
    householdMeasure: "unidade",
    measureOptions: [],
    quantity: 1,
    nutrientsPer100g: EMPTY_FOOD_NUTRIENTS,
    nutrients: EMPTY_FOOD_NUTRIENTS,
    substitutions: [],
  };
}

export function MealPlanFoundationWorkspace({
  initialPlan,
}: {
  initialPlan: MealPlanPrescriptionView;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [meals, setMeals] = useState<MealPlanRecordMeal[]>(
    initialPlan.prescriptionMeals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => ({ ...item })),
    })),
  );
  const [message, setMessage] = useState(
    "Plano vinculado à Estratégia Nutricional aprovada.",
  );
  const [supplements, setSupplements] = useState<
    MealPlanRecordSupplement[]
  >(
    initialPlan.prescriptionSupplements.map((supplement) => ({
      ...supplement,
    })),
  );
  const [newSupplement, setNewSupplement] = useState("");
  const [clinicalJustification, setClinicalJustification] = useState("");
  const [activeTab, setActiveTab] = useState<"PLAN" | "HISTORY">("PLAN");
  const [activeMealId, setActiveMealId] = useState<string | undefined>(
    initialPlan.prescriptionMeals[0]?.id,
  );
  const [showStrategyDetails, setShowStrategyDetails] = useState(false);
  const [showClinicalJustification, setShowClinicalJustification] = useState(false);
  const [saving, setSaving] = useState(false);
  const [strategyDecision, setStrategyDecision] =
    useState<MealPlanStrategyUpdateDecision>();
  const [aiDecision, setAiDecision] = useState<MealPlanAiDecision>(
    initialPlan.aiDecision,
  );
  const [activePicker, setActivePicker] = useState<{
    mealId: string;
    foodId?: string;
  }>();
  const [query, setQuery] = useState("");
  const [foodResults, setFoodResults] = useState<readonly ProfessionalFood[]>(
    [],
  );
  const [equivalenceFoodId, setEquivalenceFoodId] = useState<string>();
  const [equivalents, setEquivalents] = useState<
    readonly NutritionalEquivalent[]
  >([]);
  const [searching, setSearching] = useState(false);
  const strategy =
    strategyDecision === "UPDATE" ? plan.latestStrategy : plan.strategy;
  const totals = useMemo(() => calculateMealPlanTotals(meals), [meals]);
  const hasFoods = useMemo(
    () => meals.some((meal) => meal.items.some((food) => food.catalogFoodId)),
    [meals],
  );
  const activeMeal = meals.find((meal) => meal.id === activeMealId) ?? meals[0];
  const adequacy = useMemo(
    () =>
      calculateNutritionAdequacy({
        target: {
          energyKcal: strategy.caloriesKcal,
          proteinGrams: strategy.proteinGrams,
          carbohydratesGrams: strategy.carbohydratesGrams,
          fatsGrams: strategy.fatsGrams,
          fiberGrams: strategy.fiberGrams,
          waterMl: strategy.waterMl,
        },
        actual: {
          ...totals,
          waterMl: strategy.waterMl,
        },
      }),
    [strategy, totals],
  );

  useEffect(() => {
    if (!activePicker || equivalenceFoodId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const params = new URLSearchParams({
        scenario: "complete",
        pageSize: "12",
      });
      if (query.trim()) params.set("query", query.trim());
      const response = await fetch(`/api/foods?${params}`, {
        headers: developmentUserRequestHeaders(),
        signal: controller.signal,
      }).catch(() => null);
      const result = response
        ? ((await response.json().catch(() => null)) as FoodSearchResult | null)
        : null;
      if (response?.ok && result) setFoodResults(result.items);
      else setFoodResults([]);
      setSearching(false);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activePicker, equivalenceFoodId, query]);

  useEffect(() => {
    if (!activePicker?.foodId || !equivalenceFoodId) return;
    const currentFood = meals
      .find((meal) => meal.id === activePicker.mealId)
      ?.items.find((food) => food.id === activePicker.foodId);
    if (
      !currentFood ||
      currentFood.id !== equivalenceFoodId ||
      !currentFood.catalogFoodId
    ) {
      return;
    }
    const controller = new AbortController();
    void (async () => {
      setSearching(true);
      const response = await fetch(
        `/api/foods/${currentFood.catalogFoodId}/equivalents?grams=${currentFood.grams}`,
        {
          headers: developmentUserRequestHeaders(),
          signal: controller.signal,
        },
      ).catch(() => null);
      const result = response
        ? ((await response.json().catch(() => null)) as
            | { equivalents?: readonly NutritionalEquivalent[] }
            | null)
        : null;
      const suggestions =
        response?.ok && result?.equivalents ? result.equivalents : [];
      setEquivalents(suggestions);
      setFoodResults(suggestions.map((item) => item.food));
      setSearching(false);
      setMessage(
        suggestions.length
          ? `${suggestions.length} equivalente(s) calculado(s). Selecione para confirmar a substituição.`
          : "Nenhum equivalente nutricional compatível foi encontrado.",
      );
    })();
    return () => controller.abort();
  }, [activePicker, equivalenceFoodId, meals]);

  useEffect(() => {
    if (!activePicker?.foodId) return;
    document.getElementById(`food-search-${activePicker.foodId}`)?.focus();
  }, [activePicker]);

  function updateMeal(
    mealId: string,
    change: Partial<Pick<MealPlanRecordMeal, "name" | "time" | "observations">>,
  ) {
    setMeals((current) =>
      current.map((meal) =>
        meal.id === mealId ? { ...meal, ...change } : meal,
      ),
    );
  }

  function addMeal(name: string) {
    const id = crypto.randomUUID();
    setMeals((current) => [
      ...current,
      {
        id,
        name,
        order: current.length + 1,
        items: [],
      },
    ]);
    setActiveMealId(id);
  }

  function removeMeal(mealId: string) {
    setMeals((current) => {
      const next = current
        .filter((meal) => meal.id !== mealId)
        .map((meal, index) => ({ ...meal, order: index + 1 }));
      if (activeMealId === mealId) setActiveMealId(next[0]?.id);
      return next;
    });
  }

  function moveMeal(mealId: string, direction: -1 | 1) {
    setMeals((current) => {
      const index = current.findIndex((meal) => meal.id === mealId);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) {
        return current;
      }
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [
        reordered[destination],
        reordered[index],
      ];
      return reordered.map((meal, order) => ({ ...meal, order: order + 1 }));
    });
  }

  function addFoodLine(mealId: string) {
    const food = emptyFoodLine();
    setMeals((current) =>
      current.map((meal) =>
        meal.id === mealId
          ? { ...meal, items: [...meal.items, food] }
          : meal,
      ),
    );
    setQuery("");
    setEquivalenceFoodId(undefined);
    setEquivalents([]);
    setActivePicker({ mealId, foodId: food.id });
  }

  function chooseFood(
    food: ProfessionalFood,
    suggestedGrams?: number,
  ) {
    if (!activePicker) return;
    const selected = toStoredFood(food);
    if (!selected) {
      setMessage("Este alimento ainda não possui composição nutricional.");
      return;
    }
    setMeals((current) =>
      current.map((meal) => {
        if (meal.id !== activePicker.mealId) return meal;
        return {
          ...meal,
          items: meal.items.map((item) => {
            if (item.id !== activePicker.foodId) return item;
            const selectedMeasure = selected.measureOptions.find(
              (measure) => measure.name === selected.householdMeasure,
            );
            const grams =
              suggestedGrams ??
              (selectedMeasure
                ? selectedMeasure.gramsPerUnit * item.quantity
                : selected.standardWeightGrams * item.quantity);
            return {
              ...selected,
              id: item.id,
              quantity: item.quantity,
              grams,
              nutrients: calculateFoodNutrientsForGrams(
                selected.nutrientsPer100g,
                grams,
              ),
              substitutions: item.catalogFoodId
                ? [
                    ...item.substitutions,
                    {
                      id: crypto.randomUUID(),
                      replacedFoodId: item.catalogFoodId,
                      replacedDescription: item.description,
                      replacementFoodId: selected.catalogFoodId,
                      replacementDescription: selected.description,
                      occurredAt: new Date().toISOString(),
                    },
                  ]
                : [],
            };
          }),
        };
      }),
    );
    setActivePicker(undefined);
    setEquivalenceFoodId(undefined);
    setEquivalents([]);
    setQuery("");
    setMessage(
      activePicker.foodId
        ? "Alimento substituído inline e nutrientes recalculados."
        : "Alimento adicionado e nutrientes recalculados.",
    );
  }

  function duplicateFood(mealId: string, foodId: string) {
    setMeals((current) =>
      current.map((meal) => {
        if (meal.id !== mealId) return meal;
        const index = meal.items.findIndex((food) => food.id === foodId);
        if (index < 0) return meal;
        const items = [...meal.items];
        items.splice(index + 1, 0, {
          ...meal.items[index],
          id: crypto.randomUUID(),
          substitutions: [],
        });
        return { ...meal, items };
      }),
    );
  }

  function updateFoodMeasure(
    mealId: string,
    foodId: string,
    householdMeasure: string,
  ) {
    setMeals((current) =>
      current.map((meal) =>
        meal.id !== mealId
          ? meal
          : {
              ...meal,
              items: meal.items.map((food) => {
                if (food.id !== foodId) return food;
                const measure = food.measureOptions.find(
                  (option) => option.name === householdMeasure,
                );
                const grams = measure
                  ? measure.gramsPerUnit * food.quantity
                  : food.grams;
                return {
                  ...food,
                  householdMeasure,
                  grams,
                  nutrients: calculateFoodNutrientsForGrams(
                    food.nutrientsPer100g,
                    grams,
                  ),
                };
              }),
            },
      ),
    );
  }

  function updateFood(
    mealId: string,
    foodId: string,
    change: Partial<Pick<MealPlanRecordFood, "grams" | "quantity">>,
  ) {
    setMeals((current) =>
      current.map((meal) =>
        meal.id !== mealId
          ? meal
          : {
              ...meal,
              items: meal.items.map((food) => {
                if (food.id !== foodId) return food;
                const grams = change.grams ?? food.grams;
                return {
                  ...food,
                  ...change,
                  grams,
                  nutrients: calculateFoodNutrientsForGrams(
                    food.nutrientsPer100g,
                    grams,
                  ),
                };
              }),
            },
      ),
    );
  }

  function removeFood(mealId: string, foodId: string) {
    setMeals((current) =>
      current.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              items: meal.items.filter((food) => food.id !== foodId),
            }
          : meal,
      ),
    );
  }

  function prepareAssistedAssembly() {
    const emptyMeals = meals.filter((meal) => meal.items.length === 0);

    if (emptyMeals.length === 0) {
      setMessage(
        "Todas as refeições já possuem alimentos. Continue a edição ou substituição inline.",
      );
      return;
    }

    const createdLines = new Map(
      emptyMeals.map((meal) => [meal.id, emptyFoodLine()] as const),
    );

    setMeals((current) =>
      current.map((meal) => {
        const food = createdLines.get(meal.id);
        return food ? { ...meal, items: [food] } : meal;
      }),
    );

    const firstMeal = emptyMeals[0];
    const firstFood = createdLines.get(firstMeal.id);

    setAiDecision("SUGGESTION_GENERATED");
    setQuery("");
    setEquivalenceFoodId(undefined);
    setEquivalents([]);

    if (firstFood) {
      setActivePicker({ mealId: firstMeal.id, foodId: firstFood.id });
    }

    setMessage(
      "Estrutura preparada conforme as refeições herdadas da Estratégia Nutricional. Selecione os alimentos no catálogo profissional.",
    );
  }
  async function savePlan(complete = false) {
    if (!plan.attendanceId || !plan.strategyEntryId || meals.length === 0) {
      setMessage("Adicione ao menos uma refeição antes de salvar.");
      return;
    }
    setSaving(true);
    setMessage("Salvando prescrição no Prontuário Mestre.");
    const response = await fetch(
      `/api/patients/${plan.patientId}/attendances/${plan.attendanceId}/meal-plan`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify({
          strategyEntryId: plan.strategyEntryId,
          strategyUpdateDecision: plan.strategyUpdateAvailable
            ? strategyDecision
            : undefined,
          status: complete
            ? "APPROVED"
            : plan.status === "PENDING_REVIEW"
              ? "IN_REVIEW"
              : "DRAFT",
          aiDecision,
          clinicalJustification: clinicalJustification || undefined,
          meals: meals.map((meal) => ({
            ...meal,
            items: meal.items.filter(
              (food) => food.catalogFoodId && food.description.trim(),
            ),
          })),
          supplements,
        }),
      },
    );
    const result = (await response.json().catch(() => null)) as
      | {
          record?: {
            updatedAt: string;
            responsibleProfessional: string;
            history: MealPlanPrescriptionView["prescriptionHistory"];
            status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
          };
          message?: string;
        }
      | null;
    if (!response.ok || !result?.record) {
      setMessage(result?.message ?? "Não foi possível salvar o Plano Alimentar.");
      setSaving(false);
      return;
    }
    setPlan((current) => ({
      ...current,
      strategy:
        strategyDecision === "UPDATE"
          ? current.latestStrategy
          : current.strategy,
      strategyUpdateAvailable: false,
      updatedAt: result.record!.updatedAt,
      responsibleProfessional: result.record!.responsibleProfessional,
      prescriptionHistory: result.record!.history,
      status:
        result.record!.status === "IN_REVIEW"
          ? "PENDING_REVIEW"
          : result.record!.status,
    }));
    setStrategyDecision(undefined);
    setClinicalJustification("");
    setMessage(
      complete
        ? "Plano Alimentar concluído. Entregáveis liberados."
        : "Plano Alimentar salvo no Prontuário Mestre.",
    );
    setSaving(false);
    router.refresh();
  }

  return (
    <form
      className="space-y-4 pb-24"
      id="clinical-form-meal-plan"
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        void savePlan(
          submitter?.name === "mealPlanAction" &&
            submitter.value === "complete",
        );
      }}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">
            Plano Alimentar
          </p>
          <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">
            {NUTRITION_OBJECTIVES[strategy.objective]} · {n(strategy.caloriesKcal, 0)} kcal · {strategy.mealCount} refeições
          </h2>
          <p aria-live="polite" className="mt-1 text-sm text-[var(--muted)]">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning">Decisão do nutricionista</Badge>
          <Button
            onClick={() => setActiveTab(activeTab === "PLAN" ? "HISTORY" : "PLAN")}
            type="button"
            variant="secondary"
          >
            {activeTab === "PLAN" ? "Histórico" : "Voltar ao plano"}
          </Button>
        </div>
      </div>

      {activeTab === "PLAN" ? (
        <div className="space-y-4">
          {plan.strategyUpdateAvailable && hasFoods ? (
            <Card className="space-y-3 p-4" variant="warning">
              <p className="font-black text-amber-950">
                A Estratégia Nutricional foi alterada após a criação deste plano.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setStrategyDecision("UPDATE")}
                  type="button"
                  variant={strategyDecision === "UPDATE" ? "primary" : "secondary"}
                >
                  Atualizar com a nova estratégia
                </Button>
                <Button
                  onClick={() => setStrategyDecision("KEEP")}
                  type="button"
                  variant={strategyDecision === "KEEP" ? "primary" : "secondary"}
                >
                  Manter plano atual
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className="space-y-3 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
                  Estratégia vinculada
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Referência clínica bloqueada para edição.
                </p>
              </div>
              <Button
                onClick={() => setShowStrategyDetails((current) => !current)}
                size="small"
                type="button"
                variant="secondary"
              >
                {showStrategyDetails ? "Ocultar detalhes" : "Ver detalhes"}
              </Button>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Objetivo", NUTRITION_OBJECTIVES[strategy.objective]],
                ["VET", `${n(strategy.caloriesKcal, 0)} kcal`],
                ["Proteínas", `${n(strategy.proteinGrams)} g`],
                ["Carboidratos", `${n(strategy.carbohydratesGrams)} g`],
                ["Lipídios", `${n(strategy.fatsGrams)} g`],
              ].map(([label, value]) => (
                <div className="rounded-xl bg-[var(--surface)] px-3 py-2" key={label}>
                  <dt className="text-[11px] font-black uppercase text-[var(--muted)]">{label}</dt>
                  <dd className="mt-1 text-sm font-black">{value}</dd>
                </div>
              ))}
            </dl>
            {showStrategyDetails ? (
              <div className="grid gap-3 border-t border-[var(--line)] pt-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Método", strategy.method],
                  ["Protocolo", ENERGY_PROTOCOLS[strategy.protocol]],
                  ["GET", `${n(strategy.totalEnergyExpenditureKcal, 0)} kcal`],
                  ["Ajuste", `${strategy.calorieAdjustmentPercentage > 0 ? "+" : ""}${n(strategy.calorieAdjustmentPercentage)}%`],
                  ["Fibras", `${n(strategy.fiberGrams)} g`],
                  ["Água", `${n(strategy.waterMl, 0)} ml`],
                  ["Suplementação", strategy.supplementation.length ? strategy.supplementation.map((item) => `${item.name} — ${item.schedule}`).join(" · ") : "Nenhuma"],
                  ["Observações", strategy.clinicalObservations || "Sem observações"],
                ].map(([label, value]) => (
                  <div className="rounded-xl border border-[var(--line)] p-3" key={label}>
                    <p className="text-xs font-black uppercase text-[var(--muted)]">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          {!hasFoods ? (
            <Card className="space-y-4 p-5" variant="info">
              <div>
                <p className="text-lg font-black text-sky-950">Plano Alimentar ainda não iniciado</p>
                <p className="mt-1 text-sm text-sky-800">
                  Escolha como deseja iniciar a prescrição. Nenhum alimento será incluído sem sua seleção e validação.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={prepareAssistedAssembly} type="button">
                  Preparar montagem assistida
                </Button>
                <Button
                  onClick={() => {
                    if (activeMeal) addFoodLine(activeMeal.id);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Montar manualmente
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <SectionHeader
                description="Trabalhe em uma refeição por vez. Quantidades e nutrientes são recalculados imediatamente."
                eyebrow="Prescrição"
                title="Refeições"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Adicionar refeição padrão"
                  className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) addMeal(event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">Adicionar refeição</option>
                  {STANDARD_MEALS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <Button
                  onClick={() => addMeal(`Refeição personalizada ${meals.length + 1}`)}
                  type="button"
                  variant="secondary"
                >
                  Personalizada
                </Button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-[var(--line)] pb-2">
              {meals.map((meal) => (
                <button
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black transition ${
                    activeMeal?.id === meal.id
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-emerald-50"
                  }`}
                  key={meal.id}
                  onClick={() => setActiveMealId(meal.id)}
                  type="button"
                >
                  {meal.name}
                </button>
              ))}
            </div>

            {activeMeal ? (() => {
              const mealIndex = meals.findIndex((meal) => meal.id === activeMeal.id);
              const mealTotals = calculateMealPlanTotals([activeMeal]);
              return (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
                    <label className="text-sm font-bold">
                      Nome
                      <input
                        className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 font-normal"
                        onChange={(event) => updateMeal(activeMeal.id, { name: event.target.value })}
                        value={activeMeal.name}
                      />
                    </label>
                    <label className="text-sm font-bold">
                      Horário
                      <input
                        className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 font-normal"
                        onChange={(event) => updateMeal(activeMeal.id, { time: event.target.value || undefined })}
                        type="time"
                        value={activeMeal.time ?? ""}
                      />
                    </label>
                    <div className="flex flex-wrap items-end gap-2">
                      <Button disabled={mealIndex === 0} onClick={() => moveMeal(activeMeal.id, -1)} size="small" type="button" variant="secondary">↑</Button>
                      <Button disabled={mealIndex === meals.length - 1} onClick={() => moveMeal(activeMeal.id, 1)} size="small" type="button" variant="secondary">↓</Button>
                      <Button disabled={meals.length === 1} onClick={() => removeMeal(activeMeal.id)} size="small" type="button" variant="secondary">Remover</Button>
                    </div>
                  </div>

                  <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-black">Observações da refeição</summary>
                    <div className="border-t border-[var(--line)] p-3">
                      <textarea
                        className="min-h-20 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        onChange={(event) => updateMeal(activeMeal.id, { observations: event.target.value || undefined })}
                        placeholder="Orientações específicas desta refeição"
                        value={activeMeal.observations ?? ""}
                      />
                    </div>
                  </details>

                  <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                    <div className="grid min-w-[980px] grid-cols-[minmax(240px,2fr)_78px_145px_86px_repeat(4,68px)_170px] gap-2 bg-[var(--surface)] px-3 py-2 text-[11px] font-black uppercase text-[var(--muted)]">
                      <span>Alimento</span><span>Qtd.</span><span>Medida</span><span>Peso</span><span>kcal</span><span>P</span><span>C</span><span>L</span><span>Ações</span>
                    </div>
                    <div className="divide-y divide-[var(--line)]">
                      {activeMeal.items.filter((food) => food.catalogFoodId).map((food) => (
                        <div className="grid min-w-[980px] grid-cols-[minmax(240px,2fr)_78px_145px_86px_repeat(4,68px)_170px] items-center gap-2 bg-white px-3 py-2" key={food.id}>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">{food.description}</p>
                            <p className="truncate text-[11px] text-[var(--muted)]">{food.foodGroup} · {food.source}</p>
                          </div>
                          <input className="w-full rounded-lg border border-[var(--line)] px-2 py-2 text-sm" min="0.01" onChange={(event) => {
                            const quantity = Number(event.target.value) || 0.01;
                            const measure = food.measureOptions.find((option) => option.name === food.householdMeasure);
                            updateFood(activeMeal.id, food.id, { quantity, grams: measure ? measure.gramsPerUnit * quantity : food.grams });
                          }} step="0.01" type="number" value={food.quantity} />
                          <select className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-2 text-sm" onChange={(event) => updateFoodMeasure(activeMeal.id, food.id, event.target.value)} value={food.householdMeasure}>
                            {(food.measureOptions.length ? food.measureOptions : [{ name: food.householdMeasure, gramsPerUnit: Math.max(food.grams, 1) }]).map((measure) => <option key={measure.name} value={measure.name}>{measure.name}</option>)}
                          </select>
                          <input className="w-full rounded-lg border border-[var(--line)] px-2 py-2 text-sm" min="0" onChange={(event) => updateFood(activeMeal.id, food.id, { grams: Number(event.target.value) || 0 })} step="0.1" type="number" value={food.grams} />
                          {[food.nutrients.energyKcal, food.nutrients.proteinGrams, food.nutrients.carbohydratesGrams, food.nutrients.fatsGrams].map((value, index) => <output className="text-right text-sm font-bold tabular-nums" key={index}>{n(value)}</output>)}
                          <div className="flex gap-1">
                            <Button onClick={() => { setActivePicker({ mealId: activeMeal.id, foodId: food.id }); setEquivalenceFoodId(food.id); setQuery(""); }} size="small" type="button" variant="secondary">Trocar</Button>
                            <Button onClick={() => duplicateFood(activeMeal.id, food.id)} size="small" type="button" variant="secondary">Duplicar</Button>
                            <button className="rounded-lg border border-red-200 px-2 text-red-700" onClick={() => removeFood(activeMeal.id, food.id)} type="button">×</button>
                          </div>
                        </div>
                      ))}
                      {activeMeal.items.filter((food) => food.catalogFoodId).length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">Nenhum alimento adicionado nesta refeição.</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button onClick={() => addFoodLine(activeMeal.id)} type="button" variant="secondary">+ Adicionar alimento</Button>
                    <p className="text-xs font-bold tabular-nums text-[var(--muted)]">
                      {activeMeal.plannedEnergyKcal ? `Meta ${n(activeMeal.plannedEnergyKcal)} kcal · ` : ""}
                      Atual {n(mealTotals.energyKcal)} kcal · {n(mealTotals.proteinGrams)} g P · {n(mealTotals.carbohydratesGrams)} g C · {n(mealTotals.fatsGrams)} g L
                    </p>
                  </div>
                </div>
              );
            })() : null}
          </Card>

          <Card className="space-y-4 p-4">
            <SectionHeader
              description={hasFoods ? "Comparação atualizada conforme os alimentos prescritos." : "Adicione alimentos para comparar o plano com a estratégia."}
              eyebrow="Estratégia × Plano"
              title="Resumo nutricional"
            />
            {!hasFoods ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                Adequação ainda não calculada.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {(["energyKcal", "proteinGrams", "carbohydratesGrams", "fatsGrams", "fiberGrams"] as NutritionAdequacyMetric[]).map((metric) => {
                  const result = adequacy.metrics[metric];
                  const config = adequacyMetricConfig[metric];
                  return (
                    <div className="rounded-xl border border-[var(--line)] p-3" key={metric}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase text-[var(--muted)]">{config.label}</p>
                        <span className={result.status === "ADEQUATE" ? "text-emerald-700" : result.status === "NEAR_TARGET" ? "text-amber-700" : "text-red-700"}>{adequacyStatusLabels[result.status]}</span>
                      </div>
                      <p className="mt-2 text-lg font-black">{n(result.actual)} / {n(result.target)} {config.unit}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <details className="rounded-2xl border border-[var(--line)] bg-white" open={showClinicalJustification} onToggle={(event) => setShowClinicalJustification((event.currentTarget as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer list-none px-4 py-4 text-sm font-black">Justificativa clínica das alterações <span className="font-normal text-[var(--muted)]">(opcional)</span></summary>
            <div className="border-t border-[var(--line)] p-4">
              <textarea className="min-h-28 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm" id="clinical-justification" maxLength={10_000} onChange={(event) => setClinicalJustification(event.target.value)} placeholder="Preferência alimentar, intolerância, aderência, rotina ou decisão clínica..." value={clinicalJustification} />
            </div>
          </details>

          <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted)]">{meals.reduce((sum, meal) => sum + meal.items.filter((food) => food.catalogFoodId).length, 0)} alimentos · {n(totals.energyKcal, 0)} kcal · Responsável: {plan.responsibleProfessional}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving || (plan.strategyUpdateAvailable && hasFoods && !strategyDecision) || meals.length === 0} type="submit" variant="secondary">{saving ? "Salvando…" : "Salvar rascunho"}</Button>
              <Button disabled={saving || !hasFoods || (plan.strategyUpdateAvailable && !strategyDecision)} name="mealPlanAction" type="submit" value="complete">Concluir Plano Alimentar</Button>
            </div>
          </div>
        </div>
      ) : (
        <PrescriptionHistory entries={plan.prescriptionHistory} />
      )}

      {activePicker ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Catálogo profissional</p>
                <h3 className="mt-1 text-xl font-black">{equivalenceFoodId ? "Substituir alimento" : "Adicionar alimento"}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{meals.find((meal) => meal.id === activePicker.mealId)?.name}</p>
              </div>
              <button aria-label="Fechar" className="rounded-full border border-[var(--line)] px-3 py-1 text-xl" onClick={() => { if (!equivalenceFoodId && activePicker.foodId) removeFood(activePicker.mealId, activePicker.foodId); setActivePicker(undefined); setEquivalenceFoodId(undefined); setQuery(""); }} type="button">×</button>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2">
                {["Todos", "TACO", "IBGE", "TBCA", "Meus alimentos", "Favoritos"].map((source) => <span className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-bold" key={source}>{source}</span>)}
              </div>
              <label className="block text-sm font-black">
                Alimento
                <input autoFocus className="mt-1 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-base" onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar alimento..." value={query} />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {searching ? <p className="text-sm text-[var(--muted)]">Buscando alimentos…</p> : null}
                {!searching && foodResults.length === 0 ? <p className="text-sm text-[var(--muted)]">Digite o nome do alimento para pesquisar no catálogo.</p> : null}
                {foodResults.map((food) => (
                  <button className="rounded-xl border border-[var(--line)] p-3 text-left hover:border-[var(--primary)] hover:bg-emerald-50" key={food.id} onClick={() => {
                    const equivalent = equivalents.find((item) => item.food.id === food.id);
                    chooseFood(food, equivalent?.suggestedGrams);
                  }} type="button">
                    <p className="font-black">{food.officialName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{food.foodGroup} · {food.source.kind}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
                <Button onClick={() => { if (!equivalenceFoodId && activePicker.foodId) removeFood(activePicker.mealId, activePicker.foodId); setActivePicker(undefined); setEquivalenceFoodId(undefined); setQuery(""); }} type="button" variant="secondary">Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
