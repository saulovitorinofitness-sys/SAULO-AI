"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type {
  FoodSearchResult,
  ProfessionalFood,
} from "@/features/food-database";
import type { MealPlanPrescriptionView } from "@/features/meal-plan";
import {
  calculateFoodNutrientsForGrams,
  calculateMealPlanTotals,
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
    setMeals((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name,
        order: current.length + 1,
        items: [],
      },
    ]);
  }

  function removeMeal(mealId: string) {
    setMeals((current) =>
      current
        .filter((meal) => meal.id !== mealId)
        .map((meal, index) => ({ ...meal, order: index + 1 })),
    );
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

  async function savePlan() {
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
          status: plan.status === "PENDING_REVIEW" ? "IN_REVIEW" : "DRAFT",
          aiDecision,
          meals: meals.map((meal) => ({
            ...meal,
            items: meal.items.filter(
              (food) => food.catalogFoodId && food.description.trim(),
            ),
          })),
        }),
      },
    );
    const result = (await response.json().catch(() => null)) as
      | {
          record?: {
            updatedAt: string;
            responsibleProfessional: string;
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
    }));
    setStrategyDecision(undefined);
    setMessage("Plano Alimentar salvo no Prontuário Mestre.");
    setSaving(false);
  }

  return (
    <form
      className="space-y-5"
      id="clinical-form-meal-plan"
      onSubmit={(event) => {
        event.preventDefault();
        void savePlan();
      }}
    >
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" variant="info">
        <div>
          <p className="text-sm font-black text-sky-950">
            Motor de Prescrição Nutricional
          </p>
          <p aria-live="polite" className="mt-1 text-sm text-sky-800">
            {message}
          </p>
        </div>
        <Badge tone="warning">Decisão exclusiva do nutricionista</Badge>
      </Card>

      {plan.strategyUpdateAvailable ? (
        <Card className="space-y-3 p-4" variant="warning">
          <p className="font-black text-amber-950">
            A Estratégia Nutricional foi modificada. Deseja atualizar o Plano
            Alimentar?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setStrategyDecision("UPDATE")}
              type="button"
              variant={strategyDecision === "UPDATE" ? "primary" : "secondary"}
            >
              Atualizar Plano
            </Button>
            <Button
              onClick={() => setStrategyDecision("KEEP")}
              type="button"
              variant={strategyDecision === "KEEP" ? "primary" : "secondary"}
            >
              Manter Plano Atual
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4 p-4">
        <SectionHeader
          description="Origem oficial da prescrição. Campos bloqueados para edição."
          eyebrow="Somente leitura"
          title="Parâmetros herdados da Estratégia"
        />
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Objetivo", NUTRITION_OBJECTIVES[strategy.objective]],
            ["Método", strategy.method],
            ["Protocolo", ENERGY_PROTOCOLS[strategy.protocol]],
            ["GET", `${n(strategy.totalEnergyExpenditureKcal, 0)} kcal`],
            ["VET", `${n(strategy.caloriesKcal, 0)} kcal`],
            [
              "Déficit / superávit",
              `${strategy.calorieAdjustmentPercentage > 0 ? "+" : ""}${n(strategy.calorieAdjustmentPercentage)}%`,
            ],
            ["Proteínas", `${n(strategy.proteinGrams)} g`],
            ["Carboidratos", `${n(strategy.carbohydratesGrams)} g`],
            ["Lipídios", `${n(strategy.fatsGrams)} g`],
            ["Fibras", `${n(strategy.fiberGrams)} g`],
            ["Água", `${n(strategy.waterMl, 0)} ml`],
            ["Refeições", strategy.mealCount],
          ].map(([label, value]) => (
            <div className="rounded-xl bg-[var(--surface)] p-3" key={label}>
              <dt className="text-xs font-bold uppercase text-[var(--muted)]">
                {label}
              </dt>
              <dd className="mt-1 font-black text-[var(--text-primary)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-3 text-sm lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] p-3">
            <p className="font-bold">Suplementação</p>
            <p className="mt-1 text-[var(--muted)]">
              {strategy.supplementation.length
                ? strategy.supplementation
                    .map((item) => `${item.name} — ${item.schedule}`)
                    .join(" · ")
                : "Nenhuma suplementação prescrita."}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--line)] p-3">
            <p className="font-bold">Observações clínicas</p>
            <p className="mt-1 text-[var(--muted)]">
              {strategy.clinicalObservations || "Sem observações."}
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <SectionHeader
          description="Aderência recalculada em tempo real. Limites padrão: adequado até 5% e próximo da meta até 10% de desvio."
          eyebrow="Estratégia × Plano"
          title="Adequação nutricional"
        />
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-wide text-sky-800">
              Aderência geral
            </p>
            <p
              aria-live="polite"
              className="mt-2 text-5xl font-black tabular-nums text-sky-950"
            >
              {n(adequacy.overallAdherencePercent)}%
            </p>
            <p className="mt-2 text-sm font-bold text-sky-900">
              {adequacyStatusLabels[adequacy.overallStatus]}
            </p>
            <p className="mt-4 text-left text-xs text-sky-800">
              {adequacy.needsAdjustment.length
                ? `Ajustar: ${adequacy.needsAdjustment
                    .map((metric) => adequacyMetricConfig[metric].label)
                    .join(", ")}.`
                : "Todos os indicadores estão adequados."}
            </p>
          </aside>

          <div className="grid gap-2 sm:grid-cols-2">
            {(
              Object.keys(
                adequacyMetricConfig,
              ) as NutritionAdequacyMetric[]
            ).map((metric) => {
              const result = adequacy.metrics[metric];
              const config = adequacyMetricConfig[metric];
              return (
                <details
                  className="rounded-xl border border-[var(--line)] bg-white open:bg-[var(--surface)]"
                  key={metric}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                    <span>{config.label}</span>
                    <span
                      className={
                        result.status === "ADEQUATE"
                          ? "text-emerald-700"
                          : result.status === "NEAR_TARGET"
                            ? "text-amber-700"
                            : "text-red-700"
                      }
                    >
                      {adequacyStatusLabels[result.status]}
                    </span>
                  </summary>
                  <dl className="grid grid-cols-2 gap-2 border-t border-[var(--line)] p-3 text-xs">
                    <div>
                      <dt className="text-[var(--muted)]">Meta</dt>
                      <dd className="font-black">
                        {n(result.target)} {config.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">Realizado</dt>
                      <dd className="font-black">
                        {n(result.actual)} {config.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">
                        Diferença absoluta
                      </dt>
                      <dd className="font-black">
                        {n(result.absoluteDifference)} {config.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">
                        Diferença percentual
                      </dt>
                      <dd className="font-black">
                        {result.percentageDifference > 0 ? "+" : ""}
                        {n(result.percentageDifference)}%
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[var(--muted)]">Status</dt>
                      <dd className="font-black">
                        {adequacyStatusLabels[result.status]}
                      </dd>
                    </div>
                  </dl>
                </details>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Água corresponde à orientação prescrita herdada da Estratégia.
          Nenhuma decisão clínica ou aprovação é realizada automaticamente.
        </p>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            description="Edite horários, observações e alimentos. Todos os totais são recalculados imediatamente."
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
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Button
              onClick={() => addMeal(`Refeição personalizada ${meals.length + 1}`)}
              type="button"
              variant="secondary"
            >
              Refeição personalizada
            </Button>
          </div>
        </div>

        {meals.map((meal, mealIndex) => (
          <Card className="space-y-4 p-4" key={meal.id}>
            <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
              <label className="text-sm font-bold">
                Nome
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 font-normal"
                  onChange={(event) =>
                    updateMeal(meal.id, { name: event.target.value })
                  }
                  value={meal.name}
                />
              </label>
              <label className="text-sm font-bold">
                Horário
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 font-normal"
                  onChange={(event) =>
                    updateMeal(meal.id, {
                      time: event.target.value || undefined,
                    })
                  }
                  type="time"
                  value={meal.time ?? ""}
                />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  aria-label={`Mover ${meal.name} para cima`}
                  disabled={mealIndex === 0}
                  onClick={() => moveMeal(meal.id, -1)}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  ↑
                </Button>
                <Button
                  aria-label={`Mover ${meal.name} para baixo`}
                  disabled={mealIndex === meals.length - 1}
                  onClick={() => moveMeal(meal.id, 1)}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  ↓
                </Button>
                <Button
                  disabled={meals.length === 1}
                  onClick={() => removeMeal(meal.id)}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  Remover
                </Button>
              </div>
            </div>
            <label className="block text-sm font-bold">
              Observações
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-[var(--line)] px-3 py-2 font-normal"
                onChange={(event) =>
                  updateMeal(meal.id, {
                    observations: event.target.value || undefined,
                  })
                }
                value={meal.observations ?? ""}
              />
            </label>

            <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <div
                className="grid min-w-[1180px] grid-cols-[minmax(220px,2fr)_90px_150px_95px_repeat(5,82px)_150px] gap-2 bg-[var(--surface)] px-3 py-2 text-xs font-black uppercase text-[var(--muted)]"
                role="row"
              >
                <span>Alimento</span>
                <span>Qtd.</span>
                <span>Medida</span>
                <span>Peso</span>
                <span>kcal</span>
                <span>Prot.</span>
                <span>Carb.</span>
                <span>Lip.</span>
                <span>Fibras</span>
                <span>Ações</span>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {meal.items.map((food) => {
                  const isSearching =
                    activePicker?.mealId === meal.id &&
                    activePicker.foodId === food.id;
                  return (
                    <div
                      className="grid min-w-[1180px] grid-cols-[minmax(220px,2fr)_90px_150px_95px_repeat(5,82px)_150px] items-center gap-2 bg-white px-3 py-2"
                      key={food.id}
                      role="row"
                    >
                      <div className="min-w-0">
                        <label className="sr-only" htmlFor={`food-search-${food.id}`}>
                          Alimento
                        </label>
                        <input
                          aria-describedby={`food-help-${food.id}`}
                          autoComplete="off"
                          className="w-full rounded-lg border border-[var(--line)] px-2 py-2 text-sm font-semibold"
                          id={`food-search-${food.id}`}
                          list={`food-options-${food.id}`}
                          onChange={(event) => {
                            const value = event.target.value;
                            setQuery(value);
                            const exact = foodResults.find(
                              (candidate) =>
                                candidate.officialName.localeCompare(value, "pt-BR", {
                                  sensitivity: "base",
                                }) === 0,
                            );
                            if (exact) {
                              const equivalent = equivalents.find(
                                (item) => item.food.id === exact.id,
                              );
                              chooseFood(
                                exact,
                                equivalent?.suggestedGrams,
                              );
                            }
                          }}
                          onFocus={() => {
                            setActivePicker({ mealId: meal.id, foodId: food.id });
                            if (equivalenceFoodId !== food.id) {
                              setEquivalenceFoodId(undefined);
                              setEquivalents([]);
                              setQuery(food.description);
                            }
                          }}
                          placeholder="Digite para buscar"
                          value={isSearching ? query : food.description}
                        />
                        <datalist id={`food-options-${food.id}`}>
                          {foodResults.map((option) => (
                            <option
                              key={option.id}
                              value={option.officialName}
                            >
                              {equivalents.find(
                                (item) => item.food.id === option.id,
                              )
                                ? `${equivalents.find((item) => item.food.id === option.id)!.suggestedGrams} g · ${equivalents.find((item) => item.food.id === option.id)!.score.total}%`
                                : `${option.foodGroup} · ${option.source.kind}`}
                            </option>
                          ))}
                        </datalist>
                        <span
                          className="mt-1 block truncate text-[11px] text-[var(--muted)]"
                          id={`food-help-${food.id}`}
                        >
                          {searching && isSearching
                            ? "Buscando…"
                            : food.catalogFoodId
                              ? `${food.foodGroup} · ${food.source}`
                              : "Linha vazia — selecione um alimento"}
                        </span>
                      </div>
                      <label className="sr-only" htmlFor={`quantity-${food.id}`}>
                        Quantidade
                      </label>
                      <input
                        className="w-full rounded-lg border border-[var(--line)] px-2 py-2 text-sm"
                        id={`quantity-${food.id}`}
                        min="0.01"
                        onChange={(event) => {
                          const quantity = Number(event.target.value) || 0.01;
                          const measure = food.measureOptions.find(
                            (option) => option.name === food.householdMeasure,
                          );
                          const grams = measure
                            ? measure.gramsPerUnit * quantity
                            : food.grams;
                          updateFood(meal.id, food.id, { quantity, grams });
                        }}
                        step="0.01"
                        type="number"
                        value={food.quantity}
                      />
                      <label className="sr-only" htmlFor={`measure-${food.id}`}>
                        Unidade de medida
                      </label>
                      <select
                        className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-2 text-sm"
                        disabled={!food.catalogFoodId}
                        id={`measure-${food.id}`}
                        onChange={(event) =>
                          updateFoodMeasure(meal.id, food.id, event.target.value)
                        }
                        value={food.householdMeasure}
                      >
                        {(food.measureOptions.length
                          ? food.measureOptions
                          : [
                              {
                                name: food.householdMeasure,
                                gramsPerUnit: Math.max(food.grams, 1),
                              },
                            ]
                        ).map((measure) => (
                          <option key={measure.name} value={measure.name}>
                            {measure.name}
                          </option>
                        ))}
                      </select>
                      <label className="sr-only" htmlFor={`grams-${food.id}`}>
                        Gramagem
                      </label>
                      <input
                        className="w-full rounded-lg border border-[var(--line)] px-2 py-2 text-sm"
                        id={`grams-${food.id}`}
                        min="0"
                        onChange={(event) =>
                          updateFood(meal.id, food.id, {
                            grams: Number(event.target.value) || 0,
                          })
                        }
                        step="0.1"
                        type="number"
                        value={food.grams}
                      />
                      {[
                        food.nutrients.energyKcal,
                        food.nutrients.proteinGrams,
                        food.nutrients.carbohydratesGrams,
                        food.nutrients.fatsGrams,
                        food.nutrients.fiberGrams,
                      ].map((value, index) => (
                        <output
                          className="rounded-lg bg-[var(--surface)] px-2 py-2 text-right text-sm font-bold tabular-nums"
                          key={index}
                        >
                          {n(value)}
                        </output>
                      ))}
                      <div className="flex items-center gap-1">
                        <button
                          aria-label={`Substituir ${food.description || "alimento"}`}
                          className="rounded-lg border border-[var(--line)] px-2 py-2 text-xs font-bold hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                          onClick={() => {
                            setActivePicker({ mealId: meal.id, foodId: food.id });
                            setEquivalenceFoodId(food.id);
                            setEquivalents([]);
                            setFoodResults([]);
                            setQuery("");
                            setMessage(
                              "Calculando equivalentes nutricionais. A troca só ocorrerá após sua seleção.",
                            );
                          }}
                          title="Substituir"
                          type="button"
                        >
                          Trocar
                        </button>
                        <button
                          aria-label={`Duplicar ${food.description || "linha"}`}
                          className="rounded-lg border border-[var(--line)] px-2 py-2 text-xs font-bold hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                          disabled={!food.catalogFoodId}
                          onClick={() => duplicateFood(meal.id, food.id)}
                          title="Duplicar"
                          type="button"
                        >
                          Duplicar
                        </button>
                        <button
                          aria-label={`Excluir ${food.description || "linha vazia"}`}
                          className="rounded-lg border border-red-200 px-2 py-2 text-xs font-bold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          onClick={() => removeFood(meal.id, food.id)}
                          title="Excluir"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                onClick={() => addFoodLine(meal.id)}
                type="button"
                variant="secondary"
              >
                + Adicionar alimento
              </Button>
              <p className="text-xs font-bold tabular-nums text-[var(--muted)]">
                Total da refeição:{" "}
                {n(calculateMealPlanTotals([meal]).energyKcal)} kcal ·{" "}
                {n(calculateMealPlanTotals([meal]).proteinGrams)} g P ·{" "}
                {n(calculateMealPlanTotals([meal]).carbohydratesGrams)} g C ·{" "}
                {n(calculateMealPlanTotals([meal]).fatsGrams)} g L ·{" "}
                {n(calculateMealPlanTotals([meal]).fiberGrams)} g fibras
              </p>
            </div>
          </Card>
        ))}
      </section>

      <Card className="space-y-3 p-4" variant="info">
        <SectionHeader
          description="Ações demonstrativas: nenhuma delas prescreve ou altera alimentos automaticamente."
          eyebrow="Simulação identificada"
          title="Assistência por IA — preparada para etapa futura"
        />
        <div className="flex flex-wrap gap-2">
          {[
            ["Gerar sugestão", "SUGGESTION_GENERATED"],
            ["Regenerar", "SUGGESTION_GENERATED"],
            ["Aprovar", "APPROVED"],
            ["Rejeitar", "REJECTED"],
          ].map(([label, decision]) => (
            <Button
              key={label}
              onClick={() => {
                setAiDecision(decision as MealPlanAiDecision);
                setMessage(
                  `${label}: decisão simulada registrada; nenhuma prescrição automática foi executada.`,
                );
              }}
              type="button"
              variant="secondary"
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-sky-800">
          Estado simulado atual: {aiDecision}. A decisão clínica final permanece
          com o Nutricionista.
        </p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          Responsável: {plan.responsibleProfessional} · última gravação{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(plan.updatedAt))}
        </p>
        <Button
          disabled={
            saving ||
            (plan.strategyUpdateAvailable && !strategyDecision) ||
            meals.length === 0
          }
          type="submit"
        >
          {saving ? "Salvando…" : "Salvar Plano Alimentar"}
        </Button>
      </div>
    </form>
  );
}
