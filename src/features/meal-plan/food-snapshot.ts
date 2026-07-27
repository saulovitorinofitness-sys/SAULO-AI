import type { ProfessionalFood } from "@/features/food-database";

import {
  calculateFoodNutrientsForGrams,
  normalizeFoodNutrients,
} from "./nutrition-calculations";
import type {
  MealPlanRecordDraft,
  MealPlanRecordFood,
} from "./record";

function canonicalFoodSnapshot(
  prescribed: MealPlanRecordFood,
  catalogFood: ProfessionalFood,
): MealPlanRecordFood | null {
  if (
    !catalogFood.nutrients ||
    catalogFood.status !== "ACTIVE" ||
    catalogFood.source.origin === "DEMONSTRATIVE"
  ) {
    return null;
  }

  const activeMeasures = catalogFood.householdMeasures.filter(
    (measure) => measure.active,
  );
  const primaryMeasure =
    activeMeasures.find((measure) => measure.isDefault) ?? activeMeasures[0];
  const selectedMeasure =
    activeMeasures.find(
      (measure) => measure.name === prescribed.householdMeasure,
    ) ?? primaryMeasure;
  const nutrientsPer100g = normalizeFoodNutrients(catalogFood.nutrients);

  return {
    id: prescribed.id,
    catalogFoodId: catalogFood.id,
    description: catalogFood.officialName,
    foodGroup: catalogFood.foodGroup,
    source: catalogFood.source.kind,
    sourceName: catalogFood.source.name,
    sourceVersion: catalogFood.source.version,
    sourceCode: catalogFood.sourceCode,
    primaryHouseholdMeasure: primaryMeasure?.name ?? "grama",
    standardWeightGrams: catalogFood.referenceServingGrams,
    grams: prescribed.grams,
    householdMeasure: selectedMeasure?.name ?? "grama",
    measureOptions: activeMeasures.map((measure) => ({
      name: measure.name,
      gramsPerUnit: measure.grams / measure.quantity,
    })),
    quantity: prescribed.quantity,
    nutrientsPer100g,
    nutrients: calculateFoodNutrientsForGrams(
      nutrientsPer100g,
      prescribed.grams,
    ),
    substitutions: prescribed.substitutions,
  };
}

export function canonicalizeMealPlanDraftFoods(
  draft: MealPlanRecordDraft,
  catalogFoods: readonly ProfessionalFood[],
): MealPlanRecordDraft | null {
  const catalogById = new Map(
    catalogFoods.map((food) => [food.id, food]),
  );
  const meals = draft.meals.map((meal) => {
    const items = meal.items.map((item) => {
      const catalogFood = catalogById.get(item.catalogFoodId);
      return catalogFood
        ? canonicalFoodSnapshot(item, catalogFood)
        : null;
    });
    return items.some((item) => item === null)
      ? null
      : {
          ...meal,
          items: items as MealPlanRecordFood[],
        };
  });

  return meals.some((meal) => meal === null)
    ? null
    : {
        ...draft,
        meals: meals as MealPlanRecordDraft["meals"],
      };
}
