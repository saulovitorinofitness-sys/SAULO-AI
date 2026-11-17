import type { ProfessionalFood } from "@/features/food-database/contracts";

import {
  calculateFoodNutrientsForBasisAmount,
  mealPlanFoodNutritionBasis,
  normalizeFoodNutrients,
  usesPrescribedAmountAsNutritionBasis,
} from "./nutrition-calculations";
import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  type MealPlanIbgeMeasureOption,
  type MealPlanRecordDraft,
  type MealPlanRecordFood,
  type MealPlanRecordItem,
  type MealPlanRecordMeal,
} from "./record";

export type MealPlanIbgeOptionsByFoodId = ReadonlyMap<
  string,
  readonly MealPlanIbgeMeasureOption[]
>;

export const DIRECT_GRAMS_MEASURE_ID = "DIRECT_G";
export const DIRECT_MILLILITERS_MEASURE_ID = "DIRECT_ML";

export function directMealPlanMeasureId(unit: "g" | "ml") {
  return unit === "ml"
    ? DIRECT_MILLILITERS_MEASURE_ID
    : DIRECT_GRAMS_MEASURE_ID;
}

export function directMealPlanMeasureUnit(selectionId: string) {
  if (selectionId === DIRECT_GRAMS_MEASURE_ID) return "g" as const;
  if (selectionId === DIRECT_MILLILITERS_MEASURE_ID) return "ml" as const;
  return null;
}

export function mealPlanMeasureSelectionId(food: MealPlanRecordFood) {
  return (
    food.selectedIbgeMeasureId ??
    directMealPlanMeasureId(food.prescribedUnit ?? "g")
  );
}

export interface MealPlanFoodCanonicalizationIssue {
  readonly code:
    | "FOOD_NOT_FOUND"
    | "FOOD_NOT_ACTIVE"
    | "HOUSEHOLD_MEASURE_NOT_FOUND"
    | "IBGE_MEASURE_NOT_FOUND";
  readonly mealId: string;
  readonly foodId: string;
  readonly catalogFoodId: string;
  readonly householdMeasure?: string;
  readonly allowedHouseholdMeasures?: readonly string[];
  readonly selectedIbgeMeasureId?: string;
}

export function selectIbgeMeasureForDisplay(
  food: MealPlanRecordFood,
  selectedIbgeMeasureId: string | undefined,
) {
  if (
    selectedIbgeMeasureId &&
    !(food.ibgeMeasureOptions ?? []).some(
      (option) => option.id === selectedIbgeMeasureId,
    )
  ) {
    return null;
  }
  if (!selectedIbgeMeasureId) {
    const prescribedAmount = food.prescribedAmount ?? food.grams;
    return {
      ...food,
      selectedIbgeMeasureId: undefined,
      quantity: 1,
      prescribedAmount,
      prescribedUnit: food.prescribedUnit ?? "g",
    };
  }
  const option = food.ibgeMeasureOptions?.find(
    (candidate) => candidate.id === selectedIbgeMeasureId,
  );
  if (!option) return null;
  if (!usesPrescribedAmountAsNutritionBasis(food, option.unit)) return null;
  const quantity = food.quantity > 0 ? food.quantity : 1;
  const prescribedAmount = option.amountPerMeasure * quantity;
  const basis = mealPlanFoodNutritionBasis(food);
  return {
    ...food,
    selectedIbgeMeasureId,
    quantity,
    prescribedAmount,
    prescribedUnit: option.unit,
    grams: prescribedAmount,
    nutrients: calculateFoodNutrientsForBasisAmount(
      food.nutrientsPer100g,
      prescribedAmount,
      basis.amount,
    ),
  };
}

export function mealPlanMeasureDisplayOptions(food: MealPlanRecordFood) {
  const basis = mealPlanFoodNutritionBasis(food);
  const currentDirectUnit = !food.selectedIbgeMeasureId
    ? food.prescribedUnit ?? "g"
    : undefined;
  const directUnits = [currentDirectUnit, basis.unit].filter(
    (unit, index, units): unit is "g" | "ml" =>
      unit !== undefined &&
      unit !== null &&
      units.indexOf(unit) === index,
  );
  const householdOptions = (food.ibgeMeasureOptions ?? []).filter(
    (option) =>
      option.unit === basis.unit || option.id === food.selectedIbgeMeasureId,
  );
  return [
    ...directUnits.map((unit) => ({
      id: directMealPlanMeasureId(unit),
      label: unit === "ml" ? "Mililitros" : "Gramas",
    })),
    ...householdOptions.map((option) => ({
      ...option,
      label: option.measureName,
      disabled: option.unit !== basis.unit,
    })),
  ] as const;
}

function referenceMeasure(food: ProfessionalFood) {
  const grams = food.referenceServingGrams;
  const unit = food.referenceServingUnit ?? "g";
  return {
    name: `${grams} ${unit}`,
    gramsPerUnit: grams,
  };
}

function generatedHouseholdMeasure(
  label: string,
  measures: readonly { readonly name: string; readonly gramsPerUnit: number }[],
  allowReferenceFallback: boolean,
) {
  const match = label.trim().match(/^\d+(?:[.,]\d+)?\s+(.+)$/u);
  if (!match) return undefined;
  const normalizedName = match[1]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  return measures.find(
    (measure) =>
      measure.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR") === normalizedName,
  ) ?? (allowReferenceFallback ? measures[0] : undefined);
}

export function createMealPlanFoodFromMaster(
  food: ProfessionalFood,
  id = crypto.randomUUID(),
  options: { readonly allowAnyActiveMasterFood?: boolean } = {},
): MealPlanRecordFood | null {
  const validSource = options.allowAnyActiveMasterFood
    ? food.source.origin !== "DEMONSTRATIVE"
    : food.source.kind === "TACO" && food.source.origin === "OFFICIAL";
  const sourceReferenceUnit = food.referenceServingUnit ?? "g";
  if (
    !food.nutrients ||
    food.status !== "ACTIVE" ||
    !validSource ||
    food.referenceServingGrams !== 100 ||
    !["g", "ml"].includes(sourceReferenceUnit)
  ) {
    return null;
  }
  const referenceUnit: "g" | "ml" =
    sourceReferenceUnit === "ml" ? "ml" : "g";

  const measure = referenceMeasure(food);
  const nutrientsPer100g = normalizeFoodNutrients(food.nutrients);
  const grams = 0;

  return {
    id,
    catalogFoodId: food.id,
    description: food.officialName,
    foodGroup: food.foodGroup,
    source: food.source.kind,
    sourceName: food.source.name,
    sourceVersion: food.source.version,
    sourceCode: food.sourceCode,
    primaryHouseholdMeasure: measure.name,
    standardWeightGrams: food.referenceServingGrams,
    nutritionBasisUnit: referenceUnit,
    grams,
    prescribedAmount: 0,
    prescribedUnit: referenceUnit,
    householdMeasure: measure.name,
    measureOptions: [measure],
    quantity: 1,
    nutrientsPer100g,
    nutrients: calculateFoodNutrientsForBasisAmount(
      nutrientsPer100g,
      grams,
      food.referenceServingGrams,
    ),
    nutrientForms: food.nutrientForms,
    substitutions: [],
  };
}

function canonicalFoodSnapshot(
  prescribed: MealPlanRecordFood,
  catalogFood: ProfessionalFood,
  ibgeOptions: readonly MealPlanIbgeMeasureOption[] = [],
  previousFood?: MealPlanRecordFood,
  allowGeneratedMeasure = false,
): MealPlanRecordFood | null {
  if (
    !catalogFood.nutrients ||
    catalogFood.status !== "ACTIVE" ||
    catalogFood.source.origin === "DEMONSTRATIVE"
  ) {
    return null;
  }

  const catalogMeasures = catalogFood.householdMeasures.filter(
    (measure) => measure.active,
  );
  const activeMeasures = catalogMeasures.length
    ? catalogMeasures.map((measure) => ({
        name: measure.name,
        gramsPerUnit: measure.grams / measure.quantity,
      }))
    : [referenceMeasure(catalogFood)];
  const defaultCatalogMeasure = catalogMeasures.find(
    (measure) => measure.isDefault,
  );
  const primaryMeasure =
    activeMeasures.find(
      (measure) => measure.name === defaultCatalogMeasure?.name,
    ) ?? activeMeasures[0];
  const catalogMeasure =
    activeMeasures.find(
      (measure) => measure.name === prescribed.householdMeasure,
    );
  const unchangedLegacyMeasure = Boolean(
    previousFood &&
      previousFood.id === prescribed.id &&
      previousFood.catalogFoodId === prescribed.catalogFoodId &&
      previousFood.householdMeasure === prescribed.householdMeasure,
  );
  const selectedMeasure = catalogMeasure ??
    (unchangedLegacyMeasure
      ? primaryMeasure
      : allowGeneratedMeasure
        ? generatedHouseholdMeasure(
            prescribed.householdMeasure,
            activeMeasures,
            catalogMeasures.length === 0,
          )
        : undefined);
  if (!selectedMeasure) return null;
  if (
    prescribed.selectedIbgeMeasureId &&
    !ibgeOptions.some((option) => option.id === prescribed.selectedIbgeMeasureId)
  ) {
    return null;
  }
  const nutrientsPer100g = normalizeFoodNutrients(catalogFood.nutrients);
  const prescribedAmount = prescribed.prescribedAmount ?? prescribed.grams;
  const nutritionBasisUnit =
    catalogFood.referenceServingUnit === "ml" ? "ml" : "g";
  const prescribedUnit = prescribed.prescribedUnit ?? "g";

  return {
    id: prescribed.id,
    catalogFoodId: catalogFood.id,
    description: catalogFood.officialName,
    foodGroup: catalogFood.foodGroup,
    source: catalogFood.source.kind,
    sourceName: catalogFood.source.name,
    sourceVersion: catalogFood.source.version,
    sourceCode: catalogFood.sourceCode,
    primaryHouseholdMeasure: primaryMeasure.name,
    standardWeightGrams: catalogFood.referenceServingGrams,
    nutritionBasisUnit,
    grams: prescribed.grams,
    prescribedAmount,
    prescribedUnit,
    householdMeasure: selectedMeasure.name,
    measureOptions: activeMeasures,
    selectedIbgeMeasureId: prescribed.selectedIbgeMeasureId,
    ibgeMeasureOptions: ibgeOptions,
    quantity: prescribed.quantity > 0 ? prescribed.quantity : 1,
    nutrientsPer100g,
    nutrients: nutritionBasisUnit === prescribedUnit
      ? calculateFoodNutrientsForBasisAmount(
          nutrientsPer100g,
          prescribedAmount,
          catalogFood.referenceServingGrams,
        )
      : prescribed.nutrients,
    nutrientForms: catalogFood.nutrientForms,
    substitutions: prescribed.substitutions,
  };
}

export function canonicalizeMealPlanDraftFoods(
  draft: MealPlanRecordDraft,
  catalogFoods: readonly ProfessionalFood[],
  ibgeOptionsByFoodId: MealPlanIbgeOptionsByFoodId = new Map(),
  previousMeals: readonly MealPlanRecordMeal[] = [],
): MealPlanRecordDraft | null {
  const catalogById = new Map(
    catalogFoods.map((food) => [food.id, food]),
  );
  const previousFoodsById = new Map(
    previousMeals.flatMap((meal) =>
      meal.items
        .filter(isMealPlanFoodItem)
        .map((food) => [food.id, food] as const),
    ),
  );
  const allowGeneratedMeasure =
    draft.smartGenerationVersion === 2 && draft.aiDecision !== "IDLE";
  const meals: MealPlanRecordMeal[] = [];
  for (const meal of draft.meals) {
    const items: MealPlanRecordItem[] = [];
    for (const item of meal.items) {
      if (isMealPlanRecipeItem(item)) {
        items.push(item);
        continue;
      }
      const catalogFood = catalogById.get(item.catalogFoodId);
      if (!catalogFood) return null;
      const canonicalFood = canonicalFoodSnapshot(
        item,
        catalogFood,
        ibgeOptionsByFoodId.get(catalogFood.id) ?? [],
        previousFoodsById.get(item.id),
        allowGeneratedMeasure,
      );
      if (!canonicalFood) return null;
      items.push(canonicalFood);
    }
    meals.push({ ...meal, items });
  }

  return { ...draft, meals };
}

export function diagnoseMealPlanDraftFoodCanonicalization(
  draft: MealPlanRecordDraft,
  catalogFoods: readonly ProfessionalFood[],
  ibgeOptionsByFoodId: MealPlanIbgeOptionsByFoodId = new Map(),
): readonly MealPlanFoodCanonicalizationIssue[] {
  const catalogById = new Map(catalogFoods.map((food) => [food.id, food]));
  return draft.meals.flatMap<MealPlanFoodCanonicalizationIssue>((meal) =>
    meal.items.flatMap<MealPlanFoodCanonicalizationIssue>((item) => {
      if (isMealPlanRecipeItem(item)) return [];
      const catalogFood = catalogById.get(item.catalogFoodId);
      if (!catalogFood) {
        return [{
          code: "FOOD_NOT_FOUND" as const,
          mealId: meal.id,
          foodId: item.id,
          catalogFoodId: item.catalogFoodId,
        }];
      }
      if (
        !catalogFood.nutrients ||
        catalogFood.status !== "ACTIVE" ||
        catalogFood.source.origin === "DEMONSTRATIVE"
      ) {
        return [{
          code: "FOOD_NOT_ACTIVE" as const,
          mealId: meal.id,
          foodId: item.id,
          catalogFoodId: item.catalogFoodId,
        }];
      }
      const catalogMeasures = catalogFood.householdMeasures.filter(
        (measure) => measure.active,
      );
      const allowedHouseholdMeasures = catalogMeasures.length
        ? catalogMeasures.map((measure) => measure.name)
        : [referenceMeasure(catalogFood).name];
      if (!allowedHouseholdMeasures.includes(item.householdMeasure)) {
        return [{
          code: "HOUSEHOLD_MEASURE_NOT_FOUND" as const,
          mealId: meal.id,
          foodId: item.id,
          catalogFoodId: item.catalogFoodId,
          householdMeasure: item.householdMeasure,
          allowedHouseholdMeasures,
        }];
      }
      const ibgeOptions = ibgeOptionsByFoodId.get(catalogFood.id) ?? [];
      if (
        item.selectedIbgeMeasureId &&
        !ibgeOptions.some((option) => option.id === item.selectedIbgeMeasureId)
      ) {
        return [{
          code: "IBGE_MEASURE_NOT_FOUND" as const,
          mealId: meal.id,
          foodId: item.id,
          catalogFoodId: item.catalogFoodId,
          selectedIbgeMeasureId: item.selectedIbgeMeasureId,
        }];
      }
      return [];
    }),
  );
}

export function attachConfirmedIbgeMeasures<T extends { meals: readonly MealPlanRecordDraft["meals"][number][] }>(
  record: T,
  optionsByFoodId: MealPlanIbgeOptionsByFoodId,
): T {
  return {
    ...record,
    meals: record.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => {
        if (isMealPlanRecipeItem(item)) return item;
        const options = optionsByFoodId.get(item.catalogFoodId) ?? [];
        const selectedIbgeMeasureId = options.some(
          (option) => option.id === item.selectedIbgeMeasureId,
        )
          ? item.selectedIbgeMeasureId
          : undefined;
        return {
          ...item,
          selectedIbgeMeasureId,
          ibgeMeasureOptions: options,
          prescribedAmount: item.prescribedAmount ?? item.grams,
          prescribedUnit: item.prescribedUnit ?? "g",
          quantity:
            !selectedIbgeMeasureId && item.prescribedAmount === undefined
              ? 1
              : item.quantity > 0
                ? item.quantity
                : 1,
        };
      }),
    })),
  };
}
