import { normalizeFoodSearchText, type ProfessionalFood } from "@/features/food-database";
import {
  calculateFoodNutrientsForGrams,
  calculateMealPlanTotals,
} from "@/features/meal-plan/nutrition-calculations";
import type { MealPlanRecordMeal } from "@/features/meal-plan/record";

import type { EligibleFood } from "./nutritional-decision-engine";
import type { PatientContext } from "./patient-context-service";
import { practicalPortionGrams } from "./smart-plan-draft-generator";

export type ReturnPlanAdjustmentResult =
  | {
      readonly success: true;
      readonly meals: readonly MealPlanRecordMeal[];
      readonly notice: string;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly missing: readonly string[];
    };

function practicalQuantity(label: string, value: number) {
  const normalized = normalizeFoodSearchText(label);
  const step = normalized.includes("unidade") || normalized.includes("ovo")
    ? 1
    : 0.5;
  return Math.max(step, Math.round(value / step) * step);
}

export function inheritMissingMealSchedules(
  context: PatientContext,
  previousMeals: readonly MealPlanRecordMeal[],
): PatientContext {
  return {
    ...context,
    nutritionStrategy: {
      ...context.nutritionStrategy,
      dailyDistribution: context.nutritionStrategy.dailyDistribution.map(
        (meal, index) => ({
          ...meal,
          time: meal.time.trim() || previousMeals[index]?.time || "",
        }),
      ),
    },
  };
}

export function adjustPreviousPlanMeals(input: {
  readonly context: PatientContext;
  readonly previousMeals: readonly MealPlanRecordMeal[];
  readonly catalogFoods: readonly ProfessionalFood[];
  readonly eligibleFoods: readonly EligibleFood[];
}): ReturnPlanAdjustmentResult {
  const { context, previousMeals } = input;
  if (previousMeals.length !== context.nutritionStrategy.dailyDistribution.length) {
    return {
      success: false,
      message:
        "O número de refeições do último plano difere da Estratégia atual. Revise a distribuição antes de gerar.",
      missing: ["Distribuição de refeições compatível com o último plano"],
    };
  }

  const foodById = new Map(input.catalogFoods.map((food) => [food.id, food]));
  const approvedIds = new Set(
    input.eligibleFoods
      .filter((food) => food.status === "APROVADO")
      .map((food) => food.foodId),
  );
  const unavailable = previousMeals.flatMap((meal) =>
    meal.items.flatMap((item) =>
      foodById.has(item.catalogFoodId) && approvedIds.has(item.catalogFoodId)
        ? []
        : [item.description],
    ),
  );
  if (unavailable.length) {
    return {
      success: false,
      message:
        "O último plano contém alimentos indisponíveis ou incompatíveis com as restrições atuais.",
      missing: [...new Set(unavailable)],
    };
  }

  const totalTarget = context.nutritionStrategy.caloriesKcal;
  const distribution = context.nutritionStrategy.dailyDistribution;
  const distributionTotal = distribution.reduce(
    (sum, meal) => sum + meal.vetPercentage,
    0,
  );
  const meals = previousMeals.map((meal, index): MealPlanRecordMeal => {
    const strategyMeal = distribution[index];
    const currentEnergy = calculateMealPlanTotals([meal]).energyKcal;
    const plannedEnergy = strategyMeal.plannedCaloriesKcal ?? 0;
    const targetEnergy =
      plannedEnergy > 0
        ? plannedEnergy
        : totalTarget * (strategyMeal.vetPercentage / distributionTotal);
    const scale = currentEnergy > 0
      ? Math.max(0.7, Math.min(1.3, targetEnergy / currentEnergy))
      : 1;

    return {
      ...meal,
      name: strategyMeal.name.trim() || meal.name,
      time: strategyMeal.time.trim() || meal.time,
      order: strategyMeal.mealNumber,
      vetPercentage: strategyMeal.vetPercentage,
      plannedEnergyKcal: targetEnergy,
      items: meal.items.map((item) => {
        const catalogFood = foodById.get(item.catalogFoodId)!;
        const selectedMeasure = item.selectedIbgeMeasureId
          ? item.ibgeMeasureOptions?.find(
              (option) => option.id === item.selectedIbgeMeasureId,
            )
          : undefined;
        if (selectedMeasure) {
          const quantity = practicalQuantity(
            selectedMeasure.measureName,
            item.quantity * scale,
          );
          const prescribedAmount = selectedMeasure.amountPerMeasure * quantity;
          const grams = prescribedAmount;
          return {
            ...item,
            quantity,
            prescribedAmount,
            prescribedUnit: selectedMeasure.unit,
            grams,
            nutrients: calculateFoodNutrientsForGrams(
              item.nutrientsPer100g,
              grams,
            ),
          };
        }
        const grams = practicalPortionGrams(catalogFood, item.grams * scale);
        return {
          ...item,
          grams,
          prescribedAmount: grams,
          prescribedUnit: item.prescribedUnit ?? "g",
          nutrients: calculateFoodNutrientsForGrams(
            item.nutrientsPer100g,
            grams,
          ),
        };
      }),
    };
  });

  if (meals.some((meal) => !meal.time)) {
    return {
      success: false,
      message:
        "Há refeições sem horário na Estratégia e no último plano válido.",
      missing: meals.filter((meal) => !meal.time).map((meal) => meal.name),
    };
  }

  return {
    success: true,
    meals,
    notice:
      "Prévia de retorno criada a partir do último plano válido; somente porções e metas foram ajustadas para revisão.",
  };
}
