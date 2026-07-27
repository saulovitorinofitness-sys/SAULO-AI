import { z } from "zod";

import type {
  FoodNutrientsPer100g,
  NutritionSourceKind,
} from "@/features/food-database";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import type { NutritionAdequacyResult } from "./adequacy-engine";

export const MEAL_PLAN_RECORD_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

export type MealPlanRecordStatus =
  (typeof MEAL_PLAN_RECORD_STATUSES)[number];
export type MealPlanStrategyUpdateDecision = "UPDATE" | "KEEP";
export type MealPlanAiDecision =
  | "IDLE"
  | "SUGGESTION_GENERATED"
  | "APPROVED"
  | "REJECTED";

export interface MealPlanNutritionValues {
  readonly energyKcal: number;
  readonly proteinGrams: number;
  readonly carbohydratesGrams: number;
  readonly fatsGrams: number;
  readonly fiberGrams: number;
}

export type MealPlanFoodNutrients = MealPlanNutritionValues &
  Omit<FoodNutrientsPer100g, keyof MealPlanNutritionValues>;

export interface MealPlanFoodSubstitution {
  readonly id: string;
  readonly replacedFoodId: string;
  readonly replacedDescription: string;
  readonly replacementFoodId: string;
  readonly replacementDescription: string;
  readonly occurredAt: string;
}

export interface MealPlanFoodMeasureOption {
  readonly name: string;
  readonly gramsPerUnit: number;
}

export interface MealPlanRecordFood {
  readonly id: string;
  readonly catalogFoodId: string;
  readonly description: string;
  readonly foodGroup: string;
  readonly source: NutritionSourceKind;
  readonly sourceName: string;
  readonly sourceVersion?: string;
  readonly sourceCode?: string;
  readonly primaryHouseholdMeasure: string;
  readonly standardWeightGrams: number;
  readonly grams: number;
  readonly householdMeasure: string;
  readonly measureOptions: readonly MealPlanFoodMeasureOption[];
  readonly quantity: number;
  readonly nutrientsPer100g: MealPlanFoodNutrients;
  readonly nutrients: MealPlanFoodNutrients;
  readonly substitutions: readonly MealPlanFoodSubstitution[];
}

export interface MealPlanRecordMeal {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly time?: string;
  readonly observations?: string;
  readonly items: readonly MealPlanRecordFood[];
}

export interface MealPlanRecordDraft {
  readonly strategyEntryId: string;
  readonly status: MealPlanRecordStatus;
  readonly strategyUpdateDecision?: MealPlanStrategyUpdateDecision;
  readonly aiDecision: MealPlanAiDecision;
  readonly meals: readonly MealPlanRecordMeal[];
}

export interface StoredMealPlanPayload extends MealPlanRecordDraft {
  readonly schemaVersion: 5;
  readonly strategyApprovedAt: string;
  readonly strategySnapshot?: MealPlanStrategyInheritance;
  readonly totals: MealPlanNutritionValues;
  readonly comparison: Readonly<
    Record<keyof MealPlanNutritionValues, "COMPATIBLE" | "ABOVE" | "BELOW">
  >;
  readonly adequacy?: NutritionAdequacyResult;
}

const nutritionValuesSchema = z.object({
  energyKcal: z.number().finite().nonnegative(),
  proteinGrams: z.number().finite().nonnegative(),
  carbohydratesGrams: z.number().finite().nonnegative(),
  fatsGrams: z.number().finite().nonnegative(),
  fiberGrams: z.number().finite().nonnegative(),
});
const nullableNutrient = z.number().finite().nonnegative().nullable();
const foodNutrientsSchema = nutritionValuesSchema.extend({
  sugarsGrams: nullableNutrient,
  cholesterolMg: nullableNutrient,
  saturatedFatsGrams: nullableNutrient,
  monounsaturatedFatsGrams: nullableNutrient,
  polyunsaturatedFatsGrams: nullableNutrient,
  sodiumMg: nullableNutrient,
  calciumMg: nullableNutrient,
  ironMg: nullableNutrient,
  magnesiumMg: nullableNutrient,
  phosphorusMg: nullableNutrient,
  potassiumMg: nullableNutrient,
  zincMg: nullableNutrient,
  copperMg: nullableNutrient,
  manganeseMg: nullableNutrient,
  seleniumMcg: nullableNutrient,
  vitaminAMcg: nullableNutrient,
  vitaminCMg: nullableNutrient,
  vitaminDMcg: nullableNutrient,
  vitaminEMg: nullableNutrient,
  vitaminKMcg: nullableNutrient,
  thiamineMg: nullableNutrient,
  riboflavinMg: nullableNutrient,
  niacinMg: nullableNutrient,
  vitaminB6Mg: nullableNutrient,
  folateMcg: nullableNutrient,
  vitaminB12Mcg: nullableNutrient,
});
const optionalTrimmedText = z
  .string()
  .trim()
  .max(2_000)
  .optional()
  .transform((value) => value || undefined);
const substitutionSchema = z.object({
  id: z.string().uuid(),
  replacedFoodId: z.string().min(1).max(200),
  replacedDescription: z.string().trim().min(1).max(300),
  replacementFoodId: z.string().min(1).max(200),
  replacementDescription: z.string().trim().min(1).max(300),
  occurredAt: z.string().datetime(),
});
const foodSchema = z.object({
  id: z.string().uuid(),
  catalogFoodId: z.string().min(1).max(200),
  description: z.string().trim().min(1).max(300),
  foodGroup: z.string().trim().min(1).max(120),
  source: z.enum(["TACO", "TBCA", "IBGE", "PHILIPS", "USDA", "CLINIC_SV"]),
  sourceName: z.string().trim().min(1).max(200),
  sourceVersion: z.string().trim().max(100).optional(),
  sourceCode: z.string().trim().max(100).optional(),
  primaryHouseholdMeasure: z.string().trim().min(1).max(120),
  standardWeightGrams: z.number().finite().positive().max(10_000),
  grams: z.number().finite().positive().max(10_000),
  householdMeasure: z.string().trim().min(1).max(120),
  measureOptions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        gramsPerUnit: z.number().finite().positive().max(10_000),
      }),
    )
    .max(50)
    .default([]),
  quantity: z.number().finite().positive().max(1_000),
  nutrientsPer100g: foodNutrientsSchema,
  nutrients: foodNutrientsSchema,
  substitutions: z.array(substitutionSchema).max(100).default([]),
});
const mealPlanRecordMealSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  order: z.number().int().positive(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  observations: optionalTrimmedText,
  items: z.array(foodSchema).max(100),
});

export const mealPlanRecordDraftSchema = z.object({
  strategyEntryId: z.string().uuid(),
  status: z.enum(MEAL_PLAN_RECORD_STATUSES),
  strategyUpdateDecision: z.enum(["UPDATE", "KEEP"]).optional(),
  aiDecision: z
    .enum(["IDLE", "SUGGESTION_GENERATED", "APPROVED", "REJECTED"])
    .default("IDLE"),
  meals: z
    .array(mealPlanRecordMealSchema)
    .min(1)
    .max(20)
    .refine(
      (meals) => new Set(meals.map((meal) => meal.order)).size === meals.length,
      "A ordem das refeições deve ser única.",
    ),
});

export function parseMealPlanRecordDraft(
  value: unknown,
): MealPlanRecordDraft | null {
  const result = mealPlanRecordDraftSchema.safeParse(value);
  return result.success ? result.data : null;
}

const comparisonSchema = z.object({
  energyKcal: z.enum(["COMPATIBLE", "ABOVE", "BELOW"]),
  proteinGrams: z.enum(["COMPATIBLE", "ABOVE", "BELOW"]),
  carbohydratesGrams: z.enum(["COMPATIBLE", "ABOVE", "BELOW"]),
  fatsGrams: z.enum(["COMPATIBLE", "ABOVE", "BELOW"]),
  fiberGrams: z.enum(["COMPATIBLE", "ABOVE", "BELOW"]),
});
const adequacyMetricStatusSchema = z.enum([
  "ADEQUATE",
  "NEAR_TARGET",
  "OUTSIDE_TARGET",
]);
const adequacyMetricSchema = z.object({
  target: z.number().finite().nonnegative(),
  actual: z.number().finite().nonnegative(),
  absoluteDifference: z.number().finite().nonnegative(),
  percentageDifference: z.number().finite(),
  adherencePercent: z.number().finite().min(0).max(100),
  status: adequacyMetricStatusSchema,
});
const adequacyThresholdSchema = z.object({
  adequateMaximumDeviationPercent: z.number().finite().nonnegative(),
  nearTargetMaximumDeviationPercent: z.number().finite().nonnegative(),
});
const adequacyMetricsSchema = z.object({
  energyKcal: adequacyMetricSchema,
  proteinGrams: adequacyMetricSchema,
  carbohydratesGrams: adequacyMetricSchema,
  fatsGrams: adequacyMetricSchema,
  fiberGrams: adequacyMetricSchema,
  waterMl: adequacyMetricSchema,
});
const adequacyThresholdsSchema = z.object({
  energyKcal: adequacyThresholdSchema,
  proteinGrams: adequacyThresholdSchema,
  carbohydratesGrams: adequacyThresholdSchema,
  fatsGrams: adequacyThresholdSchema,
  fiberGrams: adequacyThresholdSchema,
  waterMl: adequacyThresholdSchema,
});
const adequacySchema = z.object({
  overallAdherencePercent: z.number().finite().min(0).max(100),
  overallStatus: adequacyMetricStatusSchema,
  metrics: adequacyMetricsSchema,
  needsAdjustment: z.array(
    z.enum([
      "energyKcal",
      "proteinGrams",
      "carbohydratesGrams",
      "fatsGrams",
      "fiberGrams",
      "waterMl",
    ]),
  ),
  thresholds: adequacyThresholdsSchema,
  updatedAt: z.string().datetime(),
  calculationVersion: z.literal(1),
});

const emptyMicronutrients = {
  sugarsGrams: null,
  cholesterolMg: null,
  saturatedFatsGrams: null,
  monounsaturatedFatsGrams: null,
  polyunsaturatedFatsGrams: null,
  sodiumMg: null,
  calciumMg: null,
  ironMg: null,
  magnesiumMg: null,
  phosphorusMg: null,
  potassiumMg: null,
  zincMg: null,
  copperMg: null,
  manganeseMg: null,
  seleniumMcg: null,
  vitaminAMcg: null,
  vitaminCMg: null,
  vitaminDMcg: null,
  vitaminEMg: null,
  vitaminKMcg: null,
  thiamineMg: null,
  riboflavinMg: null,
  niacinMg: null,
  vitaminB6Mg: null,
  folateMcg: null,
  vitaminB12Mcg: null,
} as const;

function upgradeVersionThree(source: Record<string, unknown>) {
  const meals = Array.isArray(source.meals)
    ? source.meals.map((meal) => {
        if (!meal || typeof meal !== "object" || Array.isArray(meal)) return meal;
        const record = meal as Record<string, unknown>;
        const items = Array.isArray(record.items)
          ? record.items.map((food) => {
              if (!food || typeof food !== "object" || Array.isArray(food)) {
                return food;
              }
              const item = food as Record<string, unknown>;
              const per100g =
                item.nutrientsPer100g &&
                typeof item.nutrientsPer100g === "object"
                  ? item.nutrientsPer100g
                  : {};
              const nutrients =
                item.nutrients && typeof item.nutrients === "object"
                  ? item.nutrients
                  : {};
              return {
                ...item,
                sourceName: String(item.source ?? "Fonte não identificada"),
                primaryHouseholdMeasure: String(
                  item.householdMeasure ?? "porção",
                ),
                standardWeightGrams: Number(item.grams ?? 100),
                nutrientsPer100g: {
                  ...emptyMicronutrients,
                  ...per100g,
                },
                nutrients: {
                  ...emptyMicronutrients,
                  ...nutrients,
                },
              };
            })
          : record.items;
        return { ...record, items };
      })
    : source.meals;
  return { ...source, schemaVersion: 4, meals };
}

export function parseStoredMealPlanPayload(
  value: unknown,
): StoredMealPlanPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.schemaVersion === 2) {
    const legacy = z
      .object({
        strategyEntryId: z.string().uuid(),
        status: z.enum(MEAL_PLAN_RECORD_STATUSES),
        meals: z.array(
          z.object({
            id: z.string().uuid(),
            name: z.string().trim().min(1).max(120),
            order: z.number().int().positive(),
            time: z.string().optional(),
            observations: z.string().optional(),
            items: z.array(z.never()),
          }),
        ),
      })
      .safeParse(source);
    if (!legacy.success) return null;
    return {
      ...legacy.data,
      schemaVersion: 5,
      strategyApprovedAt: "",
      aiDecision: "IDLE",
      totals: {
        energyKcal: 0,
        proteinGrams: 0,
        carbohydratesGrams: 0,
        fatsGrams: 0,
        fiberGrams: 0,
      },
      comparison: {
        energyKcal: "BELOW",
        proteinGrams: "BELOW",
        carbohydratesGrams: "BELOW",
        fatsGrams: "BELOW",
        fiberGrams: "BELOW",
      },
    };
  }
  const versionFour =
    source.schemaVersion === 3 ? upgradeVersionThree(source) : source;
  const candidate =
    versionFour.schemaVersion === 4
      ? { ...versionFour, schemaVersion: 5 }
      : versionFour;
  if (candidate.schemaVersion !== 5) return null;
  const draft = parseMealPlanRecordDraft(candidate);
  const meta = z
    .object({
      strategyApprovedAt: z.string().datetime(),
      strategySnapshot: z
        .custom<MealPlanStrategyInheritance>(
          (candidate) =>
            Boolean(
              candidate &&
                typeof candidate === "object" &&
                (candidate as MealPlanStrategyInheritance).status ===
                  "APPROVED" &&
                (candidate as MealPlanStrategyInheritance).sourceStrategyId,
            ),
        )
        .optional(),
      totals: nutritionValuesSchema,
      comparison: comparisonSchema,
      adequacy: adequacySchema.optional(),
    })
    .safeParse(candidate);
  return draft && meta.success
    ? { ...draft, ...meta.data, schemaVersion: 5 }
    : null;
}
