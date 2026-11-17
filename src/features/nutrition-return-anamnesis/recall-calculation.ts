import type {
  ManualRecallFood,
  ReturnRecall24Hours,
  ReturnRecallFood,
  ReturnRecallFoodNutrients,
  ReturnRecallItem,
  ReturnRecallRecipe,
} from "./contracts";

export interface CalculatedRecallFood {
  readonly foodId: string;
  readonly name: string;
  readonly consumedAmount: number;
  readonly consumedUnit: "g" | "ml" | "portion";
  /** Compatibilidade com consumidores anteriores; equivale ao valor consumido. */
  readonly grams: number | null;
  readonly itemType: "FOOD" | "RECIPE";
  readonly source: string;
  readonly nutrients: ReturnRecallFoodNutrients;
}

export interface RecallMissingNutrients {
  readonly itemId: string;
  readonly itemName: string;
  readonly nutrients: readonly string[];
}

export interface ReturnRecallMealCalculation {
  readonly mealId: string;
  readonly totals?: ReturnRecallFoodNutrients;
  readonly calculatedFoods: number;
  readonly foodsWithoutComposition: number;
}

export interface ReturnRecallCalculation {
  readonly totals?: ReturnRecallFoodNutrients;
  readonly calculatedFoods: readonly CalculatedRecallFood[];
  readonly foodsWithoutComposition: readonly string[];
  readonly foodsWithoutQuantifiableMeasure: readonly string[];
  readonly missingNutrients: readonly RecallMissingNutrients[];
  readonly unconfirmedPreviousPlanItems: number;
  readonly unselectedFoods: number;
  readonly sourcesUsed: readonly string[];
  readonly meals: readonly ReturnRecallMealCalculation[];
  readonly partial: boolean;
}

type CompleteCoreNutrients = ReturnRecallFoodNutrients & {
  readonly energyKcal: number;
  readonly proteinGrams: number;
  readonly carbohydratesGrams: number;
  readonly fatsGrams: number;
};

function hasCompleteCore(
  nutrients: ReturnRecallFoodNutrients | undefined,
): nutrients is CompleteCoreNutrients {
  return Boolean(
    nutrients &&
      [
        nutrients.energyKcal,
        nutrients.proteinGrams,
        nutrients.carbohydratesGrams,
        nutrients.fatsGrams,
      ].every((value) => typeof value === "number" && Number.isFinite(value)),
  );
}

function scaledNutrients(
  nutrients: CompleteCoreNutrients,
  factor: number,
): ReturnRecallFoodNutrients {
  return {
    energyKcal: nutrients.energyKcal * factor,
    proteinGrams: nutrients.proteinGrams * factor,
    carbohydratesGrams: nutrients.carbohydratesGrams * factor,
    fatsGrams: nutrients.fatsGrams * factor,
    fiberGrams:
      typeof nutrients.fiberGrams === "number"
        ? nutrients.fiberGrams * factor
        : null,
    sodiumMg:
      typeof nutrients.sodiumMg === "number"
        ? nutrients.sodiumMg * factor
        : null,
  };
}

function manualCalculation(
  food: ManualRecallFood,
): CalculatedRecallFood | null {
  if (
    food.compositionStatus !== "MANUAL_WITH_COMPOSITION" ||
    !hasCompleteCore(food.nutrients)
  ) {
    return null;
  }
  const basis = food.nutritionBasis ?? "NONE";
  if (basis === "NONE") return null;
  if (
    (food.consumedWeight === undefined || !food.consumedWeightUnit)
  ) {
    return null;
  }
  const consumedAmount = food.consumedWeight ?? 0;
  const consumedUnit = food.consumedWeightUnit ?? "g";
  const factor = basis === "PER_100" ? consumedAmount / 100 : 1;
  return {
    foodId: food.id,
    name: food.name,
    consumedAmount,
    consumedUnit,
    grams: consumedAmount,
    itemType: "FOOD",
    source: "Manual",
    nutrients: scaledNutrients(food.nutrients, factor),
  };
}

export function calculateReturnRecallFood(
  food: ReturnRecallFood,
): CalculatedRecallFood | null {
  if (food.source === "UNSELECTED") return null;
  if (food.source === "MANUAL") return manualCalculation(food);
  const amountPerUnit = food.measureAmountPerUnit ?? food.gramsPerUnit;
  if (
    food.compositionStatus !== "AVAILABLE" ||
    !hasCompleteCore(food.nutrientsPer100g) ||
    food.quantity === undefined ||
    amountPerUnit === undefined
  ) {
    return null;
  }
  const consumedAmount = food.quantity * amountPerUnit;
  const consumedUnit =
    food.measureUnit ?? food.nutritionReferenceUnit ?? "g";
  const referenceAmount = food.nutritionReferenceAmount ?? 100;
  return {
    foodId: food.id,
    name: food.name,
    consumedAmount,
    consumedUnit,
    grams: consumedAmount,
    itemType: "FOOD",
    source: food.catalogSource,
    nutrients: scaledNutrients(
      food.nutrientsPer100g,
      consumedAmount / referenceAmount,
    ),
  };
}

function sumNutrients(
  foods: readonly CalculatedRecallFood[],
): ReturnRecallFoodNutrients | undefined {
  if (!foods.length) return undefined;
  const knownTotal = (key: keyof ReturnRecallFoodNutrients) => {
    const values = foods
      .map((food) => food.nutrients[key])
      .filter((value): value is number => typeof value === "number");
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  return {
    energyKcal: knownTotal("energyKcal"),
    proteinGrams: knownTotal("proteinGrams"),
    carbohydratesGrams: knownTotal("carbohydratesGrams"),
    fatsGrams: knownTotal("fatsGrams"),
    fiberGrams: knownTotal("fiberGrams"),
    sodiumMg: knownTotal("sodiumMg"),
  };
}

function calculateReturnRecallRecipe(
  recipe: ReturnRecallRecipe,
): CalculatedRecallFood | null {
  const status = recipe.previousPlanComparison.status;
  if (
    (status !== "AS_PRESCRIBED" &&
      status !== "DIFFERENT_QUANTITY" &&
      status !== "ADDED") ||
    recipe.consumedServings === null
  ) {
    return null;
  }
  const factor =
    recipe.consumedServings / recipe.prescribedPortion.recipeServings;
  const scale = (value: number | null) =>
    value === null ? null : value * factor;
  return {
    foodId: recipe.id,
    name: recipe.recipeTitle,
    consumedAmount: recipe.consumedServings,
    consumedUnit: "portion",
    grams: null,
    itemType: "RECIPE",
    source: `Receita · snapshot v${recipe.recipeNutritionSnapshotVersion}`,
    nutrients: {
      energyKcal: scale(recipe.snapshotNutrients.energyKcal),
      proteinGrams: scale(recipe.snapshotNutrients.proteinGrams),
      carbohydratesGrams: scale(recipe.snapshotNutrients.carbohydratesGrams),
      fatsGrams: scale(recipe.snapshotNutrients.fatsGrams),
      fiberGrams: scale(recipe.snapshotNutrients.fiberGrams),
      sodiumMg: scale(recipe.snapshotNutrients.sodiumMg),
    },
  };
}

function isReportedAsConsumed(food: ReturnRecallFood) {
  const comparison = food.previousPlanComparison;
  if (!comparison) return true;
  return (
    comparison.status === "AS_PRESCRIBED" ||
    comparison.status === "DIFFERENT_QUANTITY" ||
    comparison.status === "SUBSTITUTED" ||
    comparison.status === "ADDED"
  );
}

function recallItems(recall: ReturnRecall24Hours) {
  return recall.meals.flatMap((meal) => meal.items ?? meal.foods);
}

function isConfirmedRecipeConsumption(recipe: ReturnRecallRecipe) {
  return (
    recipe.previousPlanComparison.status === "AS_PRESCRIBED" ||
    recipe.previousPlanComparison.status === "DIFFERENT_QUANTITY" ||
    recipe.previousPlanComparison.status === "ADDED"
  );
}

function isReportedItem(item: ReturnRecallItem) {
  return item.source === "RECIPE"
    ? isConfirmedRecipeConsumption(item)
    : isReportedAsConsumed(item);
}

function calculateReturnRecallItem(item: ReturnRecallItem) {
  return item.source === "RECIPE"
    ? calculateReturnRecallRecipe(item)
    : calculateReturnRecallFood(item);
}

export function calculateReturnRecall(
  recall: ReturnRecall24Hours,
): ReturnRecallCalculation {
  const foodsByMeal = recall.meals.map((meal) => ({
    meal,
    items: meal.items ?? meal.foods,
    calculated: (meal.items ?? meal.foods).flatMap((item) => {
      if (!isReportedItem(item)) return [];
      const result = calculateReturnRecallItem(item);
      return result ? [result] : [];
    }),
  }));
  const allItems = recallItems(recall);
  const reportedItems = allItems.filter(isReportedItem);
  const foods = reportedItems.filter(
    (item): item is ReturnRecallFood => item.source !== "RECIPE",
  );
  const recipes = reportedItems.filter(
    (item): item is ReturnRecallRecipe => item.source === "RECIPE",
  );
  const calculatedFoods = foodsByMeal.flatMap((meal) => meal.calculated);
  const foodsWithoutComposition = foods
    .filter(
      (food) =>
        (food.source === "MANUAL" &&
          (food.compositionStatus !== "MANUAL_WITH_COMPOSITION" ||
            !hasCompleteCore(food.nutrients))) ||
        (food.source === "LOCAL_DATABASE" &&
          food.compositionStatus === "UNAVAILABLE"),
    )
    .map((food) => food.name || "Alimento sem nome");
  const foodsWithoutQuantifiableMeasure = foods
    .filter((food) => {
      if (food.source === "LOCAL_DATABASE") {
        return (
          food.compositionStatus === "AVAILABLE" &&
          (food.quantity === undefined ||
            (food.measureAmountPerUnit === undefined &&
              food.gramsPerUnit === undefined))
        );
      }
      return (
        food.source === "MANUAL" &&
        food.compositionStatus === "MANUAL_WITH_COMPOSITION" &&
        food.consumedWeight === undefined
      );
    })
    .map((food) => food.name || "Alimento sem nome");
  const unselectedFoods = foods.filter(
    (food) => food.source === "UNSELECTED",
  ).length;
  const missingNutrients = recipes
    .filter((recipe) => recipe.missingNutrients.length > 0)
    .map((recipe) => ({
      itemId: recipe.id,
      itemName: recipe.recipeTitle,
      nutrients: recipe.missingNutrients,
    }));
  const unconfirmedPreviousPlanItems = allItems.filter((item) => {
    if (item.source === "RECIPE") {
      return item.previousPlanComparison.status === "";
    }
    return Boolean(
      item.previousPlanComparison?.sourceFoodId &&
        item.previousPlanComparison.status === "",
    );
  }).length;

  return {
    totals: sumNutrients(calculatedFoods),
    calculatedFoods,
    foodsWithoutComposition,
    foodsWithoutQuantifiableMeasure,
    missingNutrients,
    unconfirmedPreviousPlanItems,
    unselectedFoods,
    sourcesUsed: [...new Set(calculatedFoods.map((food) => food.source))],
    meals: foodsByMeal.map(({ meal, items, calculated }) => ({
      mealId: meal.id,
      totals: sumNutrients(calculated),
      calculatedFoods: calculated.length,
      foodsWithoutComposition: items.filter(isReportedItem).length - calculated.length,
    })),
    partial:
      foodsWithoutComposition.length > 0 ||
      foodsWithoutQuantifiableMeasure.length > 0 ||
      missingNutrients.length > 0 ||
      unselectedFoods > 0 ||
      unconfirmedPreviousPlanItems > 0,
  };
}
