import { randomUUID } from "node:crypto";

import { createMealPlanFoodFromMaster } from "@/features/meal-plan/food-snapshot";
import { calculateFoodNutrientsForGrams } from "@/features/meal-plan/nutrition-calculations";
import { calculateMealPlanTotals } from "@/features/meal-plan/nutrition-calculations";
import { compareMealPlanTarget } from "@/features/meal-plan/config";
import type { MealPlanRecordMeal } from "@/features/meal-plan/record";

import {
  optionalPatientContextFields,
  type PatientContext,
} from "./patient-context-service";
import type {
  SmartPlanDraft,
  SmartPlanDraftMeal,
} from "./smart-plan-draft-generator";
import { SMART_PLAN_TOLERANCES } from "./smart-plan-draft-generator";

function canonicalHouseholdMeasure(
  draftLabel: string,
  food: PatientContext["foodCatalog"]["foods"][number],
) {
  const activeMeasures = food.householdMeasures
    .filter((measure) => measure.active)
    .map((measure) => ({
      name: measure.name,
      gramsPerUnit: measure.grams / measure.quantity,
      isDefault: measure.isDefault,
    }));
  if (!activeMeasures.length) return null;

  const normalizedLabel = draftLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  const matchingMeasure = activeMeasures.find((measure) =>
    normalizedLabel.endsWith(
      measure.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR"),
    ),
  );
  const primaryMeasure =
    activeMeasures.find((measure) => measure.isDefault) ?? activeMeasures[0];

  return {
    selected: matchingMeasure ?? primaryMeasure,
    primary: primaryMeasure,
    options: activeMeasures.map(({ name, gramsPerUnit }) => ({
      name,
      gramsPerUnit,
    })),
  };
}

export function mealPlanMealsToSmartPlanDraft(
  meals: readonly MealPlanRecordMeal[],
  patientContext: PatientContext,
  options: { readonly now?: () => Date } = {},
): SmartPlanDraft {
  const totals = calculateMealPlanTotals(meals);
  const targets = {
    energyKcal: patientContext.nutritionStrategy.caloriesKcal,
    proteinGrams: patientContext.nutritionStrategy.protein.grams,
    carbohydratesGrams: patientContext.nutritionStrategy.carbohydrates.grams,
    fatsGrams: patientContext.nutritionStrategy.fats.grams,
  };
  const comparison = Object.fromEntries(
    (Object.keys(targets) as (keyof typeof targets)[]).map((key) => {
      const tolerance = SMART_PLAN_TOLERANCES[key];
      const result = compareMealPlanTarget(targets[key], totals[key], tolerance);
      return [
        key,
        {
          ...result,
          withinTolerance: result.status === "WITHIN_TARGET",
          tolerancePercentage: tolerance * 100,
        },
      ];
    }),
  ) as SmartPlanDraft["targetComparison"];
  const foodById = new Map(
    patientContext.foodCatalog.foods.map((food) => [food.id, food]),
  );
  const sourceFoods = [
    ...new Map(
      meals.flatMap((meal) =>
        meal.items.flatMap((item) => {
          const food = foodById.get(item.catalogFoodId);
          return food
            ? [[
                food.id,
                {
                  foodId: food.id,
                  name: food.officialName,
                  source: food.source.kind,
                  sourceCode: food.sourceCode,
                },
              ] as const]
            : [];
        }),
      ),
    ).values(),
  ];
  const smartMeals = meals.map((meal) => {
    const items = meal.items.map((item) => ({
      foodId: item.catalogFoodId,
      name: item.description,
      source: item.source,
      group: item.foodGroup,
      prescribedAmount: item.prescribedAmount ?? item.grams,
      unit: item.prescribedUnit ?? ("g" as const),
      householdMeasure: item.householdMeasure,
      energyKcal: item.nutrients.energyKcal,
      proteinGrams: item.nutrients.proteinGrams,
      carbohydratesGrams: item.nutrients.carbohydratesGrams,
      fatsGrams: item.nutrients.fatsGrams,
      selectionReason: "Mantido do último plano válido e ajustado somente quando necessário.",
    }));
    const mealTotals = calculateMealPlanTotals([meal]);
    return {
      id: meal.id,
      name: meal.name,
      time: meal.time!,
      items,
      totals: {
        energyKcal: mealTotals.energyKcal,
        proteinGrams: mealTotals.proteinGrams,
        carbohydratesGrams: mealTotals.carbohydratesGrams,
        fatsGrams: mealTotals.fatsGrams,
      },
      internalJustification:
        "Hipótese clínica de retorno baseada no último plano válido, preservando composição, rotina e medidas para revisão profissional.",
    };
  });
  const outOfTolerance = Object.values(comparison).some(
    (value) => !value.withinTolerance,
  );

  return {
    semanticVersion: 2,
    patientId: patientContext.patient.patientId,
    attendanceId: patientContext.patient.attendanceId,
    nutritionStrategyId: patientContext.nutritionStrategy.sourceStrategyId,
    generationStatus: "PREVIEW_NOT_APPROVED",
    approvalLabel: "Prévia não aprovada.",
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
    requiresProfessionalAdjustment: outOfTolerance,
    warnings: [
      "Plano de retorno: composição herdada do último plano válido.",
      ...(outOfTolerance
        ? ["As metas ainda exigem ajuste e validação profissional."]
        : []),
    ],
    optionalDataNotProvided: optionalPatientContextFields(
      patientContext.clinical,
    ),
    inputSummary: {
      objective:
        patientContext.nutritionStrategy.objective ??
        patientContext.patient.objective,
      routine: patientContext.clinical.dailyRoutine.length
        ? patientContext.clinical.dailyRoutine
        : "Não informado.",
      preferences: patientContext.clinical.preferredFoods.length
        ? patientContext.clinical.preferredFoods
        : "Não informado.",
      schedules: smartMeals.map((meal) => meal.time),
      habitualIntakeBasis:
        patientContext.clinical.habitualIntakeBasis ?? "NOT_INFORMED",
    },
    meals: smartMeals,
    dailyTotals: {
      energyKcal: totals.energyKcal,
      proteinGrams: totals.proteinGrams,
      carbohydratesGrams: totals.carbohydratesGrams,
      fatsGrams: totals.fatsGrams,
    },
    targetComparison: comparison,
    sourceFoods,
  };
}

export function smartPlanDraftMealToMealPlanMeal(
  draftMeal: SmartPlanDraftMeal,
  patientContext: PatientContext,
  mealIndex: number,
  createId: () => string = randomUUID,
): MealPlanRecordMeal | null {
  const foodsById = new Map(
    patientContext.foodCatalog.foods.map((food) => [food.id, food]),
  );
  const items = [];
  for (const draftItem of draftMeal.items) {
    const catalogFood = foodsById.get(draftItem.foodId);
    if (!catalogFood || draftItem.unit !== "g") return null;
    const base = createMealPlanFoodFromMaster(catalogFood, createId(), {
      allowAnyActiveMasterFood: true,
    });
    if (!base) return null;
    const measure = canonicalHouseholdMeasure(
      draftItem.householdMeasure,
      catalogFood,
    );
    items.push({
      ...base,
      grams: draftItem.prescribedAmount,
      prescribedAmount: draftItem.prescribedAmount,
      prescribedUnit: "g" as const,
      primaryHouseholdMeasure:
        measure?.primary.name ?? base.primaryHouseholdMeasure,
      householdMeasure: measure?.selected.name ?? base.householdMeasure,
      measureOptions: measure?.options ?? base.measureOptions,
      quantity: 1,
      nutrients: calculateFoodNutrientsForGrams(
        base.nutrientsPer100g,
        draftItem.prescribedAmount,
      ),
    });
  }
  const strategyMeal = patientContext.nutritionStrategy.dailyDistribution[mealIndex];
  return {
    id: createId(),
    name: draftMeal.name,
    order: mealIndex + 1,
    time: draftMeal.time === "N\u00e3o informado." ? undefined : draftMeal.time,
    vetPercentage: draftMeal.targetPercentage ?? strategyMeal?.vetPercentage,
    plannedEnergyKcal:
      draftMeal.targetEnergyKcal ?? strategyMeal?.plannedCaloriesKcal,
    items,
  };
}

export function smartPlanDraftToMealPlanMeals(
  draft: SmartPlanDraft,
  patientContext: PatientContext,
  createId: () => string = randomUUID,
): readonly MealPlanRecordMeal[] | null {
  const meals: MealPlanRecordMeal[] = [];
  for (let mealIndex = 0; mealIndex < draft.meals.length; mealIndex += 1) {
    const meal = smartPlanDraftMealToMealPlanMeal(
      draft.meals[mealIndex],
      patientContext,
      mealIndex,
      createId,
    );
    if (!meal) return null;
    meals.push(meal);
  }
  return meals;
}
