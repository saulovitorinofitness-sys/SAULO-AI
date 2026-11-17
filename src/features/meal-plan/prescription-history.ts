import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  type MealPlanRecipeNutrients,
  type MealPlanRecordDraft,
  type MealPlanRecordFood,
  type MealPlanRecordItem,
  type MealPlanRecordMeal,
  type MealPlanRecordRecipe,
  type MealPlanRecordSupplement,
} from "./record";

export const PRESCRIPTION_ACTION_TYPES = [
  "FOOD_ADDED",
  "FOOD_REMOVED",
  "FOOD_SUBSTITUTED",
  "GRAMS_CHANGED",
  "MEASURE_CHANGED",
  "RECIPE_ADDED",
  "RECIPE_REMOVED",
  "RECIPE_REPLACED",
  "RECIPE_SNAPSHOT_CHANGED",
  "RECIPE_PORTION_CHANGED",
  "TIME_CHANGED",
  "SUPPLEMENT_ADDED",
  "SUPPLEMENT_REMOVED",
] as const;

export type PrescriptionActionType =
  (typeof PRESCRIPTION_ACTION_TYPES)[number];

export const PRESCRIPTION_ACTION_LABELS: Record<
  PrescriptionActionType,
  string
> = {
  FOOD_ADDED: "Alimento adicionado",
  FOOD_REMOVED: "Alimento removido",
  FOOD_SUBSTITUTED: "Alimento substituído",
  GRAMS_CHANGED: "Quantidade alterada",
  MEASURE_CHANGED: "Medida alterada",
  RECIPE_ADDED: "Receita adicionada",
  RECIPE_REMOVED: "Receita removida",
  RECIPE_REPLACED: "Receita substituída",
  RECIPE_SNAPSHOT_CHANGED: "Versão nutricional da receita alterada",
  RECIPE_PORTION_CHANGED: "Porção da receita alterada",
  TIME_CHANGED: "Horário alterado",
  SUPPLEMENT_ADDED: "Suplementação incluída",
  SUPPLEMENT_REMOVED: "Suplementação removida",
};

export interface PrescriptionChange {
  readonly type: PrescriptionActionType;
  readonly previousValue: string | null;
  readonly currentValue: string | null;
}

export interface PrescriptionHistoryEntry extends PrescriptionChange {
  readonly id: string;
  readonly occurredAt: string;
  readonly professionalUserId: string;
  readonly professionalName: string;
  readonly clinicalJustification?: string;
}

function foodValue(meal: MealPlanRecordMeal, food: MealPlanRecordFood) {
  const amount = food.prescribedAmount ?? food.grams;
  const unit = food.prescribedUnit ?? "g";
  return `${food.description} · ${amount} ${unit} · ${food.quantity} ${food.householdMeasure} · ${meal.name}`;
}

const recipeNutrientKeys = [
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
  "fiberGrams",
  "sugarsGrams",
  "cholesterolMg",
  "saturatedFatsGrams",
  "monounsaturatedFatsGrams",
  "polyunsaturatedFatsGrams",
  "sodiumMg",
  "calciumMg",
  "ironMg",
  "magnesiumMg",
  "phosphorusMg",
  "potassiumMg",
  "zincMg",
  "copperMg",
  "manganeseMg",
  "seleniumMcg",
  "vitaminAMcg",
  "vitaminCMg",
  "vitaminDMcg",
  "vitaminEMg",
  "vitaminKMcg",
  "thiamineMg",
  "riboflavinMg",
  "niacinMg",
  "vitaminB6Mg",
  "folateMcg",
  "vitaminB12Mcg",
] as const satisfies readonly (keyof MealPlanRecipeNutrients)[];

function recipeValue(meal: MealPlanRecordMeal, recipe: MealPlanRecordRecipe) {
  return `${recipe.recipeTitle} · receita ${recipe.recipeId} · snapshot ${recipe.recipeNutritionSnapshotId} v${recipe.recipeNutritionSnapshotVersion} · ${recipe.portion.prescribedServings} de ${recipe.portion.recipeServings} porções · ${meal.name} · referência ${JSON.stringify(recipe.snapshotNutrients)} · prescrito ${JSON.stringify(recipe.prescribedNutrients)} · completude ${recipe.nutritionCompleteness}`;
}

function recipeNutrientsEqual(
  current: MealPlanRecipeNutrients,
  next: MealPlanRecipeNutrients,
) {
  return recipeNutrientKeys.every((key) => current[key] === next[key]);
}

function stringSetsEqual(
  current: readonly string[],
  next: readonly string[],
) {
  return (
    current.length === next.length &&
    current.every((value) => next.includes(value))
  );
}

function recipeSnapshotEqual(
  current: MealPlanRecordRecipe,
  next: MealPlanRecordRecipe,
) {
  return (
    current.recipeNutritionSnapshotId === next.recipeNutritionSnapshotId &&
    current.recipeNutritionSnapshotVersion ===
      next.recipeNutritionSnapshotVersion &&
    current.nutritionCompleteness === next.nutritionCompleteness &&
    stringSetsEqual(current.missingNutrients, next.missingNutrients) &&
    recipeNutrientsEqual(current.snapshotNutrients, next.snapshotNutrients)
  );
}

function recipePortionEqual(
  current: MealPlanRecordRecipe,
  next: MealPlanRecordRecipe,
) {
  return (
    current.portion.kind === next.portion.kind &&
    current.portion.prescribedServings === next.portion.prescribedServings &&
    current.portion.recipeServings === next.portion.recipeServings &&
    current.portion.description === next.portion.description &&
    current.portion.servingSize?.amount === next.portion.servingSize?.amount &&
    current.portion.servingSize?.unit === next.portion.servingSize?.unit &&
    recipeNutrientsEqual(
      current.prescribedNutrients,
      next.prescribedNutrients,
    )
  );
}

function supplementValue(supplement: MealPlanRecordSupplement) {
  return supplement.description;
}

function mealMap(meals: readonly MealPlanRecordMeal[]) {
  return new Map(meals.map((meal) => [meal.id, meal]));
}

function itemMap(meals: readonly MealPlanRecordMeal[]) {
  const items = new Map<
    string,
    { readonly meal: MealPlanRecordMeal; readonly item: MealPlanRecordItem }
  >();
  for (const meal of meals) {
    for (const item of meal.items) items.set(item.id, { meal, item });
  }
  return items;
}

function supplementMap(supplements: readonly MealPlanRecordSupplement[]) {
  return new Map(supplements.map((supplement) => [supplement.id, supplement]));
}

export function detectPrescriptionChanges(
  current: Pick<MealPlanRecordDraft, "meals" | "supplements">,
  next: Pick<MealPlanRecordDraft, "meals" | "supplements">,
): readonly PrescriptionChange[] {
  const changes: PrescriptionChange[] = [];
  const currentMeals = mealMap(current.meals);
  const nextMeals = mealMap(next.meals);
  const currentItems = itemMap(current.meals);
  const nextItems = itemMap(next.meals);

  for (const [itemId, { meal, item }] of currentItems) {
    const nextItem = nextItems.get(itemId);
    if (!nextItem) {
      changes.push({
        type: isMealPlanRecipeItem(item) ? "RECIPE_REMOVED" : "FOOD_REMOVED",
        previousValue: isMealPlanRecipeItem(item)
          ? recipeValue(meal, item)
          : foodValue(meal, item),
        currentValue: null,
      });
      continue;
    }
    if (isMealPlanRecipeItem(item) !== isMealPlanRecipeItem(nextItem.item)) {
      changes.push({
        type: isMealPlanRecipeItem(item) ? "RECIPE_REMOVED" : "FOOD_REMOVED",
        previousValue: isMealPlanRecipeItem(item)
          ? recipeValue(meal, item)
          : foodValue(meal, item),
        currentValue: null,
      });
      changes.push({
        type: isMealPlanRecipeItem(nextItem.item)
          ? "RECIPE_ADDED"
          : "FOOD_ADDED",
        previousValue: null,
        currentValue: isMealPlanRecipeItem(nextItem.item)
          ? recipeValue(nextItem.meal, nextItem.item)
          : foodValue(nextItem.meal, nextItem.item),
      });
      continue;
    }

    if (isMealPlanFoodItem(item) && isMealPlanFoodItem(nextItem.item)) {
      if (item.catalogFoodId !== nextItem.item.catalogFoodId) {
        changes.push({
          type: "FOOD_SUBSTITUTED",
          previousValue: foodValue(meal, item),
          currentValue: foodValue(nextItem.meal, nextItem.item),
        });
      }
      const previousAmount = item.prescribedAmount ?? item.grams;
      const currentAmount =
        nextItem.item.prescribedAmount ?? nextItem.item.grams;
      const previousUnit = item.prescribedUnit ?? "g";
      const currentUnit = nextItem.item.prescribedUnit ?? "g";
      if (
        previousAmount !== currentAmount ||
        previousUnit !== currentUnit
      ) {
        changes.push({
          type: "GRAMS_CHANGED",
          previousValue: `${item.description} · ${previousAmount} ${previousUnit} · ${meal.name}`,
          currentValue: `${nextItem.item.description} · ${currentAmount} ${currentUnit} · ${nextItem.meal.name}`,
        });
      }
      if (
        item.householdMeasure !== nextItem.item.householdMeasure ||
        item.quantity !== nextItem.item.quantity
      ) {
        changes.push({
          type: "MEASURE_CHANGED",
          previousValue: `${item.description} · ${item.quantity} ${item.householdMeasure} · ${meal.name}`,
          currentValue: `${nextItem.item.description} · ${nextItem.item.quantity} ${nextItem.item.householdMeasure} · ${nextItem.meal.name}`,
        });
      }
      continue;
    }

    if (!isMealPlanRecipeItem(item) || !isMealPlanRecipeItem(nextItem.item)) {
      continue;
    }
    if (
      item.recipeId !== nextItem.item.recipeId ||
      item.recipeTitle !== nextItem.item.recipeTitle
    ) {
      changes.push({
        type: "RECIPE_REPLACED",
        previousValue: recipeValue(meal, item),
        currentValue: recipeValue(nextItem.meal, nextItem.item),
      });
      continue;
    }
    if (!recipeSnapshotEqual(item, nextItem.item)) {
      changes.push({
        type: "RECIPE_SNAPSHOT_CHANGED",
        previousValue: recipeValue(meal, item),
        currentValue: recipeValue(nextItem.meal, nextItem.item),
      });
      continue;
    }
    if (!recipePortionEqual(item, nextItem.item)) {
      changes.push({
        type: "RECIPE_PORTION_CHANGED",
        previousValue: recipeValue(meal, item),
        currentValue: recipeValue(nextItem.meal, nextItem.item),
      });
    }
  }

  for (const [itemId, { meal, item }] of nextItems) {
    if (!currentItems.has(itemId)) {
      changes.push({
        type: isMealPlanRecipeItem(item) ? "RECIPE_ADDED" : "FOOD_ADDED",
        previousValue: null,
        currentValue: isMealPlanRecipeItem(item)
          ? recipeValue(meal, item)
          : foodValue(meal, item),
      });
    }
  }

  for (const [mealId, meal] of currentMeals) {
    const nextMeal = nextMeals.get(mealId);
    if (nextMeal && meal.time !== nextMeal.time) {
      changes.push({
        type: "TIME_CHANGED",
        previousValue: `${meal.name} · ${meal.time || "Sem horário"}`,
        currentValue: `${nextMeal.name} · ${nextMeal.time || "Sem horário"}`,
      });
    }
  }
  for (const [mealId, meal] of nextMeals) {
    if (!currentMeals.has(mealId) && meal.time) {
      changes.push({
        type: "TIME_CHANGED",
        previousValue: null,
        currentValue: `${meal.name} · ${meal.time}`,
      });
    }
  }

  const currentSupplements = supplementMap(current.supplements);
  const nextSupplements = supplementMap(next.supplements);
  for (const [id, supplement] of currentSupplements) {
    if (!nextSupplements.has(id)) {
      changes.push({
        type: "SUPPLEMENT_REMOVED",
        previousValue: supplementValue(supplement),
        currentValue: null,
      });
    }
  }
  for (const [id, supplement] of nextSupplements) {
    if (!currentSupplements.has(id)) {
      changes.push({
        type: "SUPPLEMENT_ADDED",
        previousValue: null,
        currentValue: supplementValue(supplement),
      });
    }
  }

  return changes;
}
