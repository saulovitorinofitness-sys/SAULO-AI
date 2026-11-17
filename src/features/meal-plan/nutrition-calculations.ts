import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  type MealPlanFoodNutrients,
  type MealPlanNutritionValues,
  type MealPlanRecipeNutrients,
  type MealPlanRecordFood,
  type MealPlanRecordMeal,
  type MealPlanRecordRecipe,
} from "./record";
import {
  DEFAULT_NUTRITION_ADEQUACY_THRESHOLDS,
  type NutritionAdequacyStatus,
} from "./adequacy-engine";
import type { FoodNutrientsPer100g } from "@/features/food-database/contracts";

export const EMPTY_NUTRITION_VALUES: MealPlanNutritionValues = {
  energyKcal: 0,
  proteinGrams: 0,
  carbohydratesGrams: 0,
  fatsGrams: 0,
  fiberGrams: 0,
};

const nutritionKeys = Object.keys(
  EMPTY_NUTRITION_VALUES,
) as (keyof MealPlanNutritionValues)[];

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPortion(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function formatMealPlanDecimalInput(value: number) {
  return String(roundPortion(value)).replace(".", ",");
}

function greatestCommonDivisor(left: number, right: number): number {
  return right === 0 ? Math.abs(left) : greatestCommonDivisor(right, left % right);
}

export function formatRecipePortionDescription(
  prescribedServings: number,
  recipeServings: number,
) {
  const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const portionLabel = `${number.format(prescribedServings)} ${prescribedServings === 1 ? "porção" : "porções"}`;
  if (
    Number.isInteger(prescribedServings) &&
    Number.isInteger(recipeServings)
  ) {
    const divisor = greatestCommonDivisor(prescribedServings, recipeServings);
    return `${portionLabel} (${prescribedServings / divisor}/${recipeServings / divisor} da receita)`;
  }
  return `${portionLabel} (${number.format((prescribedServings / recipeServings) * 100)}% da receita)`;
}

export function parsePositiveMealPlanDecimal(
  input: string,
  maximum: number,
) {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false as const, message: "O campo não pode ficar vazio." };
  }
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { success: false as const, message: "Informe um número válido." };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return {
      success: false as const,
      message: "O valor deve ser maior que zero.",
    };
  }
  if (value > maximum) {
    return {
      success: false as const,
      message: `O valor máximo permitido é ${maximum}.`,
    };
  }
  return { success: true as const, value };
}

const micronutrientKeys = [
  "sugarsGrams",
  "cholesterolMg",
  "saturatedFatsGrams",
  "transFatsGrams",
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
] as const satisfies readonly (keyof FoodNutrientsPer100g)[];

export const EMPTY_FOOD_NUTRIENTS = {
  ...EMPTY_NUTRITION_VALUES,
  ...Object.fromEntries(micronutrientKeys.map((key) => [key, null])),
} as MealPlanFoodNutrients;

export function normalizeFoodNutrients(
  nutrients: FoodNutrientsPer100g,
): MealPlanFoodNutrients {
  return {
    energyKcal: nutrients.energyKcal ?? 0,
    proteinGrams: nutrients.proteinGrams ?? 0,
    carbohydratesGrams: nutrients.carbohydratesGrams ?? 0,
    fatsGrams: nutrients.fatsGrams ?? 0,
    fiberGrams: nutrients.fiberGrams ?? 0,
    ...Object.fromEntries(
      micronutrientKeys.map((key) => [key, nutrients[key] ?? null]),
    ),
  } as MealPlanFoodNutrients;
}

export function calculateFoodNutrientsForGrams(
  per100g: MealPlanFoodNutrients,
  grams: number,
): MealPlanFoodNutrients {
  return calculateFoodNutrientsForBasisAmount(per100g, grams, 100);
}

export function calculateFoodNutrientsForBasisAmount(
  nutrientsPerBasis: MealPlanFoodNutrients,
  prescribedAmount: number,
  nutritionBasisAmount: number,
): MealPlanFoodNutrients {
  const factor =
    nutritionBasisAmount > 0
      ? Math.max(0, prescribedAmount) / nutritionBasisAmount
      : 0;
  return Object.fromEntries(
    Object.entries(nutrientsPerBasis).map(([key, value]) => [
      key,
      value === null ? null : round(value * factor),
    ]),
  ) as unknown as MealPlanFoodNutrients;
}

export type MealPlanPortionEdit =
  | { readonly field: "quantity"; readonly input: string }
  | { readonly field: "grams"; readonly input: string }
  | {
      readonly field: "directAmount";
      readonly input: string;
      readonly unit: "g" | "ml";
    }
  | { readonly field: "householdMeasure"; readonly value: string };

export function mealPlanFoodNutritionBasis(food: MealPlanRecordFood) {
  if (food.nutritionBasisUnit) {
    return { amount: food.standardWeightGrams, unit: food.nutritionBasisUnit } as const;
  }
  const label = food.primaryHouseholdMeasure.trim().match(
    /^(\d+(?:[.,]\d+)?)\s*(g|ml)$/i,
  );
  if (label) {
    const amount = Number(label[1]!.replace(",", "."));
    if (Number.isFinite(amount) && Math.abs(amount - food.standardWeightGrams) < 1e-9) {
      return { amount: food.standardWeightGrams, unit: label[2]!.toLocaleLowerCase("pt-BR") as "g" | "ml" } as const;
    }
  }
  if (food.source === "TACO") {
    return { amount: food.standardWeightGrams, unit: "g" as const };
  }
  return { amount: food.standardWeightGrams, unit: null } as const;
}

export function mealPlanFoodBasisCompatibility(
  food: MealPlanRecordFood,
  prescribedUnit = food.prescribedUnit ?? "g",
) {
  const basis = mealPlanFoodNutritionBasis(food);
  return {
    basis,
    compatible: basis.unit !== null && basis.unit === prescribedUnit,
    missingConversion: basis.unit !== null && basis.unit !== prescribedUnit,
  } as const;
}

export function usesPrescribedAmountAsNutritionBasis(
  food: MealPlanRecordFood,
  unit: "g" | "ml",
) {
  return mealPlanFoodBasisCompatibility(food, unit).compatible;
}

export function updateMealPlanFoodPortion(
  food: MealPlanRecordFood,
  edit: MealPlanPortionEdit,
) {
  const clinicalPortionMode =
    food.prescribedAmount !== undefined ||
    food.prescribedUnit !== undefined ||
    (food.ibgeMeasureOptions?.length ?? 0) > 0;
  if (clinicalPortionMode && edit.field !== "householdMeasure") {
    const selectedIbgeMeasure =
      edit.field !== "directAmount" && food.selectedIbgeMeasureId
      ? food.ibgeMeasureOptions?.find(
          (measure) => measure.id === food.selectedIbgeMeasureId,
        )
      : undefined;
    if (
      edit.field !== "directAmount" &&
      food.selectedIbgeMeasureId &&
      !selectedIbgeMeasure
    ) {
      return {
        success: false as const,
        message: "A medida caseira não está disponível para este alimento.",
      };
    }
    const unit =
      edit.field === "directAmount"
        ? edit.unit
        : selectedIbgeMeasure?.unit ?? food.prescribedUnit ?? "g";
    const recalculatesFromAmount = usesPrescribedAmountAsNutritionBasis(
      food,
      unit,
    );
    if (!recalculatesFromAmount) {
      const basis = mealPlanFoodNutritionBasis(food);
      return {
        success: false as const,
        message: basis.unit
          ? `A composição usa base em ${basis.unit}, mas a prescrição está em ${unit}. Selecione uma medida compatível ou documente a conversão antes de recalcular.`
          : "A unidade da base nutricional não está identificada; não é possível recalcular esta quantidade com segurança.",
      };
    }
    let quantity = food.quantity;
    let prescribedAmount = food.prescribedAmount ?? food.grams;
    if (edit.field === "directAmount") {
      const parsed = parsePositiveMealPlanDecimal(edit.input, 100_000);
      if (!parsed.success) return parsed;
      quantity = 1;
      prescribedAmount = parsed.value;
    } else if (edit.field === "quantity") {
      const parsed = parsePositiveMealPlanDecimal(edit.input, 1_000);
      if (!parsed.success) return parsed;
      quantity = parsed.value;
      if (selectedIbgeMeasure) {
        prescribedAmount = roundPortion(
          selectedIbgeMeasure.amountPerMeasure * quantity,
        );
      }
    } else {
      const parsed = parsePositiveMealPlanDecimal(edit.input, 100_000);
      if (!parsed.success) return parsed;
      prescribedAmount = parsed.value;
    }
    const grams = recalculatesFromAmount ? prescribedAmount : food.grams;
    return {
      success: true as const,
      food: {
        ...food,
        quantity,
        grams,
        prescribedAmount,
        prescribedUnit: unit,
        selectedIbgeMeasureId:
          edit.field === "directAmount"
            ? undefined
            : food.selectedIbgeMeasureId,
        householdMeasure:
          edit.field === "directAmount"
            ? `${mealPlanFoodNutritionBasis(food).amount} ${unit}`
            : food.householdMeasure,
        nutrients: recalculatesFromAmount
          ? calculateFoodNutrientsForBasisAmount(
              food.nutrientsPer100g,
              prescribedAmount,
              mealPlanFoodNutritionBasis(food).amount,
            )
          : food.nutrients,
      },
      quantityInput: formatMealPlanDecimalInput(quantity),
      gramsInput: formatMealPlanDecimalInput(prescribedAmount),
    };
  }

  const selectedMeasure = food.measureOptions.find((measure) =>
    edit.field === "householdMeasure"
      ? measure.name === edit.value
      : measure.name === food.householdMeasure,
  );
  if (!selectedMeasure) {
    return {
      success: false as const,
      message: "A medida caseira não está disponível para este alimento.",
    };
  }

  let quantity = food.quantity;
  let grams = food.grams;
  let householdMeasure = food.householdMeasure;
  if (edit.field === "quantity") {
    const parsed = parsePositiveMealPlanDecimal(edit.input, 1_000);
    if (!parsed.success) return parsed;
    quantity = parsed.value;
    grams = roundPortion(selectedMeasure.gramsPerUnit * quantity);
  } else if (edit.field === "grams") {
    const parsed = parsePositiveMealPlanDecimal(edit.input, 10_000);
    if (!parsed.success) return parsed;
    grams = parsed.value;
    quantity = roundPortion(grams / selectedMeasure.gramsPerUnit);
  } else {
    householdMeasure = selectedMeasure.name;
    grams = roundPortion(selectedMeasure.gramsPerUnit * quantity);
  }

  return {
    success: true as const,
    food: {
      ...food,
      quantity,
      grams,
      householdMeasure,
      nutrients: calculateFoodNutrientsForGrams(food.nutrientsPer100g, grams),
    },
    quantityInput: formatMealPlanDecimalInput(quantity),
    gramsInput: formatMealPlanDecimalInput(grams),
  };
}

function scaleNullableNutrient(value: number | null, fraction: number) {
  return value === null ? null : value * fraction;
}

export function calculatePrescribedRecipeNutrients(
  snapshot: MealPlanRecipeNutrients,
  prescribedServings: number,
  recipeServings: number,
): MealPlanRecipeNutrients {
  const fraction = prescribedServings / recipeServings;
  return {
    energyKcal: scaleNullableNutrient(snapshot.energyKcal, fraction),
    proteinGrams: scaleNullableNutrient(snapshot.proteinGrams, fraction),
    carbohydratesGrams: scaleNullableNutrient(
      snapshot.carbohydratesGrams,
      fraction,
    ),
    fatsGrams: scaleNullableNutrient(snapshot.fatsGrams, fraction),
    fiberGrams: scaleNullableNutrient(snapshot.fiberGrams, fraction),
    sugarsGrams: scaleNullableNutrient(snapshot.sugarsGrams, fraction),
    cholesterolMg: scaleNullableNutrient(snapshot.cholesterolMg, fraction),
    saturatedFatsGrams: scaleNullableNutrient(
      snapshot.saturatedFatsGrams,
      fraction,
    ),
    transFatsGrams: scaleNullableNutrient(snapshot.transFatsGrams, fraction),
    monounsaturatedFatsGrams: scaleNullableNutrient(
      snapshot.monounsaturatedFatsGrams,
      fraction,
    ),
    polyunsaturatedFatsGrams: scaleNullableNutrient(
      snapshot.polyunsaturatedFatsGrams,
      fraction,
    ),
    sodiumMg: scaleNullableNutrient(snapshot.sodiumMg, fraction),
    calciumMg: scaleNullableNutrient(snapshot.calciumMg, fraction),
    ironMg: scaleNullableNutrient(snapshot.ironMg, fraction),
    magnesiumMg: scaleNullableNutrient(snapshot.magnesiumMg, fraction),
    phosphorusMg: scaleNullableNutrient(snapshot.phosphorusMg, fraction),
    potassiumMg: scaleNullableNutrient(snapshot.potassiumMg, fraction),
    zincMg: scaleNullableNutrient(snapshot.zincMg, fraction),
    copperMg: scaleNullableNutrient(snapshot.copperMg, fraction),
    manganeseMg: scaleNullableNutrient(snapshot.manganeseMg, fraction),
    seleniumMcg: scaleNullableNutrient(snapshot.seleniumMcg, fraction),
    vitaminAMcg: scaleNullableNutrient(snapshot.vitaminAMcg, fraction),
    vitaminCMg: scaleNullableNutrient(snapshot.vitaminCMg, fraction),
    vitaminDMcg: scaleNullableNutrient(snapshot.vitaminDMcg, fraction),
    vitaminEMg: scaleNullableNutrient(snapshot.vitaminEMg, fraction),
    vitaminKMcg: scaleNullableNutrient(snapshot.vitaminKMcg, fraction),
    thiamineMg: scaleNullableNutrient(snapshot.thiamineMg, fraction),
    riboflavinMg: scaleNullableNutrient(snapshot.riboflavinMg, fraction),
    niacinMg: scaleNullableNutrient(snapshot.niacinMg, fraction),
    vitaminB6Mg: scaleNullableNutrient(snapshot.vitaminB6Mg, fraction),
    folateMcg: scaleNullableNutrient(snapshot.folateMcg, fraction),
    vitaminB12Mcg: scaleNullableNutrient(snapshot.vitaminB12Mcg, fraction),
  };
}

export function updateMealPlanRecipePortion(
  recipe: MealPlanRecordRecipe,
  prescribedServingsInput: string,
) {
  const parsed = parsePositiveMealPlanDecimal(prescribedServingsInput, 1_000);
  if (!parsed.success) return parsed;
  if (
    !Number.isFinite(recipe.portion.recipeServings) ||
    recipe.portion.recipeServings <= 0
  ) {
    return {
      success: false as const,
      message: "O snapshot da receita não possui número de porções válido.",
    };
  }

  const prescribedServings = parsed.value;
  return {
    success: true as const,
    recipe: {
      ...recipe,
      portion: {
        ...recipe.portion,
        prescribedServings,
        description: formatRecipePortionDescription(
          prescribedServings,
          recipe.portion.recipeServings,
        ),
      },
      prescribedNutrients: calculatePrescribedRecipeNutrients(
        recipe.snapshotNutrients,
        prescribedServings,
        recipe.portion.recipeServings,
      ),
    } satisfies MealPlanRecordRecipe,
    prescribedServingsInput: formatMealPlanDecimalInput(prescribedServings),
  };
}

export function nutritionForGrams(
  per100g: MealPlanNutritionValues,
  grams: number,
): MealPlanNutritionValues {
  return Object.fromEntries(
    nutritionKeys.map((key) => [key, round((per100g[key] * grams) / 100)]),
  ) as unknown as MealPlanNutritionValues;
}

export interface MealPlanMissingNutritionContribution {
  readonly mealId: string;
  readonly itemId: string;
  readonly itemType: "RECIPE";
  readonly nutrient: keyof MealPlanFoodNutrients;
}

export interface MealPlanNutritionTotalsResult {
  readonly values: MealPlanNutritionValues;
  readonly nutritionCompleteness: "COMPLETE" | "PARTIAL";
  readonly missingNutrients: readonly (keyof MealPlanFoodNutrients)[];
  readonly partialNutrients: readonly (keyof MealPlanFoodNutrients)[];
  readonly missingContributions: readonly MealPlanMissingNutritionContribution[];
  readonly partialContributions: readonly MealPlanMissingNutritionContribution[];
}

export function calculateMealPlanNutritionTotals(
  meals: readonly MealPlanRecordMeal[],
): MealPlanNutritionTotalsResult {
  const totals = { ...EMPTY_NUTRITION_VALUES };
  const missingNutrients = new Set<keyof MealPlanFoodNutrients>();
  const partialNutrients = new Set<keyof MealPlanFoodNutrients>();
  const missingContributions: MealPlanMissingNutritionContribution[] = [];
  const partialContributions: MealPlanMissingNutritionContribution[] = [];
  for (const meal of meals) {
    for (const item of meal.items) {
      if (isMealPlanFoodItem(item)) {
        for (const key of nutritionKeys) totals[key] += item.nutrients[key];
        continue;
      }
      if (!isMealPlanRecipeItem(item)) continue;

      const prescribedNutrients = calculatePrescribedRecipeNutrients(
        item.snapshotNutrients,
        item.portion.prescribedServings,
        item.portion.recipeServings,
      );
      for (const key of nutritionKeys) {
        const value = prescribedNutrients[key];
        if (value === null) missingNutrients.add(key);
        else totals[key] += value;
      }
      for (const nutrient of item.missingNutrients) {
        missingNutrients.add(nutrient);
        missingContributions.push({
          mealId: meal.id,
          itemId: item.id,
          itemType: "RECIPE",
          nutrient,
        });
      }
      for (const nutrient of item.partialNutrients ?? []) {
        partialNutrients.add(nutrient);
        partialContributions.push({
          mealId: meal.id,
          itemId: item.id,
          itemType: "RECIPE",
          nutrient,
        });
      }
    }
  }
  for (const key of nutritionKeys) totals[key] = round(totals[key]);
  return {
    values: totals,
    nutritionCompleteness:
      missingNutrients.size || partialNutrients.size ? "PARTIAL" : "COMPLETE",
    missingNutrients: [...missingNutrients],
    partialNutrients: [...partialNutrients],
    missingContributions,
    partialContributions,
  };
}

/**
 * Compatibilidade numérica para consumidores legados. Interfaces que exibem
 * totais devem usar calculateMealPlanNutritionTotals e conferir a completude.
 */
export function calculateMealPlanTotals(
  meals: readonly MealPlanRecordMeal[],
): MealPlanNutritionValues {
  return calculateMealPlanNutritionTotals(meals).values;
}

export function compareMealPlanNutrition(
  target: MealPlanNutritionValues,
  actual: MealPlanNutritionValues,
) {
  return Object.fromEntries(
    nutritionKeys.map((key) => {
      const tolerance = Math.max(target[key] * 0.02, 0.1);
      const difference = actual[key] - target[key];
      return [
        key,
        Math.abs(difference) <= tolerance
          ? "COMPATIBLE"
          : difference > 0
            ? "ABOVE"
            : "BELOW",
      ];
    }),
  ) as Record<
    keyof MealPlanNutritionValues,
    "COMPATIBLE" | "ABOVE" | "BELOW"
  >;
}

export function compareMealEnergyTarget(
  targetKcal: number,
  actualKcal: number,
): NutritionAdequacyStatus {
  if (targetKcal <= 0) return "OUTSIDE_TARGET";
  const deviationPercentage =
    (Math.abs(actualKcal - targetKcal) / targetKcal) * 100;
  const threshold = DEFAULT_NUTRITION_ADEQUACY_THRESHOLDS.energyKcal;
  if (deviationPercentage <= threshold.adequateMaximumDeviationPercent) {
    return "ADEQUATE";
  }
  if (deviationPercentage <= threshold.nearTargetMaximumDeviationPercent) {
    return "NEAR_TARGET";
  }
  return "OUTSIDE_TARGET";
}
