import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  type MealPlanFoodNutrients,
  type MealPlanRecordItem,
  type MealPlanRecordMeal,
} from "./record";
import {
  calculatePrescribedRecipeNutrients,
  mealPlanFoodBasisCompatibility,
} from "./nutrition-calculations";
import { normalizeFoodGroup } from "./food-group-normalization";
import type { FolateForm, VitaminAForm } from "@/features/food-database/contracts";

export type NutrientCoverageState = "COMPLETE" | "PARTIAL" | "ABSENT";

export const PLAN_NUTRIENT_KEYS = [
  "energyKcal", "proteinGrams", "carbohydratesGrams", "fatsGrams", "fiberGrams",
  "sugarsGrams", "cholesterolMg", "saturatedFatsGrams", "transFatsGrams",
  "monounsaturatedFatsGrams", "polyunsaturatedFatsGrams", "sodiumMg",
  "calciumMg", "ironMg", "magnesiumMg", "phosphorusMg", "potassiumMg",
  "zincMg", "copperMg", "manganeseMg", "seleniumMcg", "vitaminAMcg",
  "vitaminCMg", "vitaminDMcg", "vitaminEMg", "vitaminKMcg", "thiamineMg",
  "riboflavinMg", "niacinMg", "vitaminB6Mg", "folateMcg", "vitaminB12Mcg",
] as const satisfies readonly (keyof MealPlanFoodNutrients)[];

export interface NutrientContributor {
  readonly mealId: string;
  readonly mealName: string;
  readonly itemId: string;
  readonly itemType: "FOOD" | "RECIPE";
  readonly itemName: string;
  readonly prescribedAmount: number;
  readonly prescribedUnit: "g" | "ml" | "SERVING";
  readonly prescribedQuantityLabel: string;
  readonly selectedMeasureLabel?: string;
  readonly documentedEquivalent?: {
    readonly amount: number;
    readonly unit: "g" | "ml";
  };
  readonly nutritionBasis?: {
    readonly amount: number;
    readonly unit: "g" | "ml" | null;
  };
  readonly nutritionCalculationFactor?: number;
  readonly quantityCompatibility: "COMPATIBLE" | "MISSING_CONVERSION" | "UNKNOWN";
  readonly knownAmount: number | null;
  readonly coverage: NutrientCoverageState;
  readonly nutrientForm?: VitaminAForm | FolateForm;
  readonly shareOfKnownTotalPercent: number | null;
}

export interface PlannedNutrientTotal {
  readonly nutrient: keyof MealPlanFoodNutrients;
  readonly knownAmount: number | null;
  readonly coverage: NutrientCoverageState;
  readonly knownItemCount: number;
  readonly completeItemCount: number;
  readonly partialItemCount: number;
  readonly absentItemCount: number;
  readonly totalItemCount: number;
  readonly nutrientForm?: VitaminAForm | FolateForm | "MIXED";
  readonly contributors: readonly NutrientContributor[];
}

export interface MealMacroSummary {
  readonly mealId: string;
  readonly mealName: string;
  readonly energyKcal: number | null;
  readonly proteinGrams: number | null;
  readonly carbohydratesGrams: number | null;
  readonly fatsGrams: number | null;
  readonly coverage: NutrientCoverageState;
}

export interface FoodGroupSummary {
  readonly groupId: string;
  readonly group: string;
  readonly originalGroups: readonly string[];
  readonly prescribedItemCount: number;
  readonly denominatorItemCount: number;
  readonly percentageOfPrescribedItems: number;
}

export interface MealPlanNutritionAnalysis {
  readonly nutrients: Readonly<Record<keyof MealPlanFoodNutrients, PlannedNutrientTotal>>;
  readonly meals: readonly MealMacroSummary[];
  readonly foodGroups: readonly FoodGroupSummary[];
  readonly prescribedItemCount: number;
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function valueFor(item: MealPlanRecordItem, nutrient: keyof MealPlanFoodNutrients) {
  if (isMealPlanFoodItem(item)) return item.nutrients[nutrient];
  if (!isMealPlanRecipeItem(item)) return null;
  return calculatePrescribedRecipeNutrients(
    item.snapshotNutrients,
    item.portion.prescribedServings,
    item.portion.recipeServings,
  )[nutrient];
}

function itemCoverage(item: MealPlanRecordItem, nutrient: keyof MealPlanFoodNutrients): NutrientCoverageState {
  const value = valueFor(item, nutrient);
  if (value === null) return "ABSENT";
  if (isMealPlanRecipeItem(item) && (item.partialNutrients ?? []).includes(nutrient)) return "PARTIAL";
  if (isMealPlanFoodItem(item) && prescribedQuantity(item).quantityCompatibility !== "COMPATIBLE") return "PARTIAL";
  return "COMPLETE";
}

function itemNutrientForm(item: MealPlanRecordItem, nutrient: keyof MealPlanFoodNutrients) {
  if (nutrient !== "vitaminAMcg" && nutrient !== "folateMcg") return undefined;
  return item.nutrientForms?.[nutrient] ?? "UNSPECIFIED";
}

function prescribedQuantity(item: MealPlanRecordItem) {
  if (isMealPlanRecipeItem(item)) {
    return {
      prescribedAmount: item.portion.prescribedServings,
      prescribedUnit: "SERVING" as const,
      prescribedQuantityLabel: item.portion.description,
      selectedMeasureLabel: undefined,
      documentedEquivalent: undefined,
      nutritionBasis: undefined,
      nutritionCalculationFactor: undefined,
      quantityCompatibility: "COMPATIBLE" as const,
    };
  }
  const prescribedAmount = item.prescribedAmount ?? item.grams;
  const prescribedUnit = item.prescribedUnit ?? "g";
  const selectedIbgeMeasure = item.selectedIbgeMeasureId
    ? item.ibgeMeasureOptions?.find((option) => option.id === item.selectedIbgeMeasureId)
    : undefined;
  const ibgeEquivalent = selectedIbgeMeasure
    ? selectedIbgeMeasure.amountPerMeasure * item.quantity
    : null;
  const validIbgeLink = Boolean(
    selectedIbgeMeasure &&
    selectedIbgeMeasure.unit === prescribedUnit &&
    ibgeEquivalent !== null &&
    Math.abs(ibgeEquivalent - prescribedAmount) < 1e-6,
  );
  const legacyMeasure = !item.selectedIbgeMeasureId && item.householdMeasure !== item.primaryHouseholdMeasure
    ? item.measureOptions.find((option) => option.name === item.householdMeasure)
    : undefined;
  const legacyEquivalent = legacyMeasure ? legacyMeasure.gramsPerUnit * item.quantity : null;
  const validLegacyLink = Boolean(
    legacyMeasure &&
    prescribedUnit === "g" &&
    legacyEquivalent !== null &&
    Math.abs(legacyEquivalent - prescribedAmount) < 1e-6,
  );
  const compatibility = mealPlanFoodBasisCompatibility(item, prescribedUnit);
  return {
    prescribedAmount,
    prescribedUnit,
    prescribedQuantityLabel: `${prescribedAmount} ${prescribedUnit}`,
    selectedMeasureLabel: validIbgeLink
      ? selectedIbgeMeasure!.label
      : validLegacyLink
        ? `${numberLabel(item.quantity)} ${legacyMeasure!.name}`
        : undefined,
    documentedEquivalent: validIbgeLink
      ? { amount: ibgeEquivalent!, unit: selectedIbgeMeasure!.unit }
      : validLegacyLink
        ? { amount: legacyEquivalent!, unit: "g" as const }
        : undefined,
    nutritionBasis: compatibility.basis,
    nutritionCalculationFactor: compatibility.basis.amount > 0
      ? prescribedAmount / compatibility.basis.amount
      : undefined,
    quantityCompatibility: compatibility.compatible
      ? "COMPATIBLE" as const
      : compatibility.missingConversion
        ? "MISSING_CONVERSION" as const
        : "UNKNOWN" as const,
  };
}

function numberLabel(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function combinedCoverage(states: readonly NutrientCoverageState[]): NutrientCoverageState {
  if (!states.length || states.every((state) => state === "ABSENT")) return "ABSENT";
  return states.every((state) => state === "COMPLETE") ? "COMPLETE" : "PARTIAL";
}

export function analyzeMealPlanNutrition(meals: readonly MealPlanRecordMeal[]): MealPlanNutritionAnalysis {
  const flatItems = meals.flatMap((meal) =>
    meal.items.map((item) => ({ mealId: meal.id, mealName: meal.name, item })),
  );
  const nutrientEntries = PLAN_NUTRIENT_KEYS.map((nutrient) => {
    const raw = flatItems.map(({ mealId, mealName, item }) => ({
      mealId,
      mealName,
      itemId: item.id,
      itemType: isMealPlanRecipeItem(item) ? "RECIPE" as const : "FOOD" as const,
      itemName: isMealPlanRecipeItem(item) ? item.recipeTitle : item.description,
      ...prescribedQuantity(item),
      knownAmount: valueFor(item, nutrient),
      coverage: itemCoverage(item, nutrient),
      nutrientForm: itemNutrientForm(item, nutrient),
    }));
    const numeric = raw.filter((entry): entry is typeof entry & { knownAmount: number } => entry.knownAmount !== null);
    const knownAmount = numeric.length ? numeric.reduce((sum, entry) => sum + entry.knownAmount, 0) : null;
    const contributingForms = numeric.map((entry) => entry.nutrientForm).filter(
      (form): form is VitaminAForm | FolateForm => form !== undefined,
    );
    const nutrientForm = contributingForms.length
      ? contributingForms.every((form) => form === contributingForms[0]) ? contributingForms[0] : "MIXED" as const
      : undefined;
    const contributors = raw
      .map((entry): NutrientContributor => ({
        ...entry,
        shareOfKnownTotalPercent:
          entry.knownAmount === null || !knownAmount
            ? null
            : rounded((entry.knownAmount / knownAmount) * 100),
      }))
      .sort((left, right) => (right.knownAmount ?? -1) - (left.knownAmount ?? -1));
    return [nutrient, {
      nutrient,
      knownAmount,
      coverage: combinedCoverage(raw.map((entry) => entry.coverage)),
      knownItemCount: numeric.length,
      completeItemCount: raw.filter((entry) => entry.coverage === "COMPLETE").length,
      partialItemCount: raw.filter((entry) => entry.coverage === "PARTIAL").length,
      absentItemCount: raw.filter((entry) => entry.coverage === "ABSENT").length,
      totalItemCount: raw.length,
      nutrientForm,
      contributors,
    }] as const;
  });

  const mealSummaries = meals.map((meal): MealMacroSummary => {
    const keys = ["energyKcal", "proteinGrams", "carbohydratesGrams", "fatsGrams"] as const;
    const entries = keys.map((key) => {
      const values = meal.items.map((item) => valueFor(item, key));
      return {
        key,
        value: values.some((value) => value !== null)
          ? rounded(values.reduce<number>((sum, value) => sum + (value ?? 0), 0))
          : null,
        coverage: combinedCoverage(meal.items.map((item) => itemCoverage(item, key))),
      };
    });
    const get = (key: typeof keys[number]) => entries.find((entry) => entry.key === key)!;
    return {
      mealId: meal.id,
      mealName: meal.name,
      energyKcal: get("energyKcal").value,
      proteinGrams: get("proteinGrams").value,
      carbohydratesGrams: get("carbohydratesGrams").value,
      fatsGrams: get("fatsGrams").value,
      coverage: combinedCoverage(entries.map((entry) => entry.coverage)),
    };
  });

  const groups = new Map<string, { label: string; count: number; originals: Set<string> }>();
  for (const { item } of flatItems) {
    const normalized = isMealPlanFoodItem(item)
      ? normalizeFoodGroup(item.foodGroup)
      : { id: "RECIPES", label: "Receitas", originalLabel: "Receitas" };
    const current = groups.get(normalized.id);
    if (current) {
      current.count += 1;
      current.originals.add(normalized.originalLabel);
    } else {
      groups.set(normalized.id, {
        label: normalized.label,
        count: 1,
        originals: new Set([normalized.originalLabel]),
      });
    }
  }
  const denominator = flatItems.length;

  return {
    nutrients: Object.fromEntries(nutrientEntries) as unknown as MealPlanNutritionAnalysis["nutrients"],
    meals: mealSummaries,
    foodGroups: [...groups.entries()]
      .map(([groupId, summary]) => ({
        groupId,
        group: summary.label,
        originalGroups: [...summary.originals].sort((left, right) => left.localeCompare(right, "pt-BR")),
        prescribedItemCount: summary.count,
        denominatorItemCount: denominator,
        percentageOfPrescribedItems: denominator ? rounded((summary.count / denominator) * 100) : 0,
      }))
      .sort((left, right) => right.prescribedItemCount - left.prescribedItemCount),
    prescribedItemCount: denominator,
  };
}
