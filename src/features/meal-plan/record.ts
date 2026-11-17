import { z } from "zod";

import type {
  FoodNutrientForms,
  FoodNutrientsPer100g,
  NutritionSourceKind,
} from "@/features/food-database/contracts";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import {
  recipeContentSnapshotSchema,
  type RecipeContentSnapshot,
} from "@/features/recipes/recipe-content-snapshot";
import type { NutritionAdequacyResult } from "./adequacy-engine";
import type {
  MealPlanProfessionalReview,
  MealPlanTargetDeviationAuthorization,
} from "./completion-policy";
import type { DietaryReferenceNutrient, DietaryReferenceProfile, DietaryReferenceValue } from "./dietary-reference";

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
export type MealPlanReuseMode = "KEEP_PREVIOUS" | "ADJUSTED_COPY";

export interface MealPlanNutritionValues {
  readonly energyKcal: number;
  readonly proteinGrams: number;
  readonly carbohydratesGrams: number;
  readonly fatsGrams: number;
  readonly fiberGrams: number;
}

export type MealPlanFoodNutrients = MealPlanNutritionValues &
  Omit<FoodNutrientsPer100g, keyof MealPlanNutritionValues | "transFatsGrams"> & {
    readonly transFatsGrams: number | null;
  };

export type MealPlanRecipeNutrients = Readonly<{
  [Key in keyof MealPlanFoodNutrients]: number | null;
}>;

export function mapMealPlanRecipeNutrients(
  valueFor: (key: keyof MealPlanFoodNutrients) => number | null,
): MealPlanRecipeNutrients {
  return {
    energyKcal: valueFor("energyKcal"),
    proteinGrams: valueFor("proteinGrams"),
    carbohydratesGrams: valueFor("carbohydratesGrams"),
    fatsGrams: valueFor("fatsGrams"),
    fiberGrams: valueFor("fiberGrams"),
    sugarsGrams: valueFor("sugarsGrams"),
    cholesterolMg: valueFor("cholesterolMg"),
    saturatedFatsGrams: valueFor("saturatedFatsGrams"),
    transFatsGrams: valueFor("transFatsGrams"),
    monounsaturatedFatsGrams: valueFor("monounsaturatedFatsGrams"),
    polyunsaturatedFatsGrams: valueFor("polyunsaturatedFatsGrams"),
    sodiumMg: valueFor("sodiumMg"),
    calciumMg: valueFor("calciumMg"),
    ironMg: valueFor("ironMg"),
    magnesiumMg: valueFor("magnesiumMg"),
    phosphorusMg: valueFor("phosphorusMg"),
    potassiumMg: valueFor("potassiumMg"),
    zincMg: valueFor("zincMg"),
    copperMg: valueFor("copperMg"),
    manganeseMg: valueFor("manganeseMg"),
    seleniumMcg: valueFor("seleniumMcg"),
    vitaminAMcg: valueFor("vitaminAMcg"),
    vitaminCMg: valueFor("vitaminCMg"),
    vitaminDMcg: valueFor("vitaminDMcg"),
    vitaminEMg: valueFor("vitaminEMg"),
    vitaminKMcg: valueFor("vitaminKMcg"),
    thiamineMg: valueFor("thiamineMg"),
    riboflavinMg: valueFor("riboflavinMg"),
    niacinMg: valueFor("niacinMg"),
    vitaminB6Mg: valueFor("vitaminB6Mg"),
    folateMcg: valueFor("folateMcg"),
    vitaminB12Mcg: valueFor("vitaminB12Mcg"),
  };
}

export type MealPlanRecipeNutritionCompleteness = "COMPLETE" | "PARTIAL";

export interface MealPlanFoodSubstitution {
  readonly id: string;
  readonly replacedFoodId: string;
  readonly replacedDescription: string;
  readonly replacementFoodId: string;
  readonly replacementDescription: string;
  readonly occurredAt: string;
  readonly responsibleUser?: string;
  readonly suggestionReason?: string;
  readonly equivalenceCriterion?: "ENERGY_AND_MACRONUTRIENTS";
  readonly originalPrescribedAmount?: number;
  readonly originalPrescribedUnit?: "g" | "ml";
  readonly replacementQuantity?: number;
  readonly replacementPrescribedAmount?: number;
  readonly replacementPrescribedUnit?: "g" | "ml";
  readonly replacementHouseholdMeasure?: string;
  readonly needsProfessionalReview?: boolean;
}

export interface MealPlanFoodMeasureOption {
  readonly name: string;
  readonly gramsPerUnit: number;
}

export interface MealPlanIbgeMeasureOption {
  readonly id: string;
  readonly label: string;
  readonly measureName: string;
  readonly preparationCode: string;
  readonly preparationName: string;
  readonly amountPerMeasure: number;
  readonly unit: "g" | "ml";
}

export interface MealPlanRecordFood {
  /** Ausente somente em planos legados; nesses casos o item continua sendo alimento. */
  readonly itemType?: "FOOD";
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
  /** Unidade da base de composição da fonte; opcional em snapshots históricos. */
  readonly nutritionBasisUnit?: "g" | "ml";
  readonly grams: number;
  readonly prescribedAmount?: number;
  readonly prescribedUnit?: "g" | "ml";
  readonly householdMeasure: string;
  readonly measureOptions: readonly MealPlanFoodMeasureOption[];
  readonly selectedIbgeMeasureId?: string;
  readonly ibgeMeasureOptions?: readonly MealPlanIbgeMeasureOption[];
  readonly quantity: number;
  readonly nutrientsPer100g: MealPlanFoodNutrients;
  readonly nutrients: MealPlanFoodNutrients;
  readonly nutrientForms?: FoodNutrientForms;
  readonly substitutions: readonly MealPlanFoodSubstitution[];
}

export interface MealPlanRecordRecipe {
  readonly itemType: "RECIPE";
  readonly id: string;
  readonly recipeId: string;
  /** Nome congelado no momento da seleção; não é relido do estado atual da receita. */
  readonly recipeTitle: string;
  readonly recipeNutritionSnapshotId: string;
  readonly recipeNutritionSnapshotVersion: number;
  /** Conteúdo completo congelado no snapshot; ausente em planos legados. */
  readonly recipeContentSnapshot?: RecipeContentSnapshot;
  readonly portion: {
    readonly kind: "SERVINGS";
    readonly prescribedServings: number;
    readonly recipeServings: number;
    readonly description: string;
    /** Opcional: prescrever porções iguais não depende de peso ou volume. */
    readonly servingSize?: {
      readonly amount: number;
      readonly unit: "g" | "ml";
    };
  };
  readonly nutritionCompleteness: MealPlanRecipeNutritionCompleteness;
  /** Valores totais do snapshot versionado, nunca da versão corrente da receita. */
  readonly snapshotNutrients: MealPlanRecipeNutrients;
  /** Valores da quantidade prescrita; ausências permanecem null. */
  readonly prescribedNutrients: MealPlanRecipeNutrients;
  readonly missingNutrients: readonly (keyof MealPlanFoodNutrients)[];
  /** Subtotais conhecidos cujo snapshot informa cobertura incompleta. */
  readonly partialNutrients?: readonly (keyof MealPlanFoodNutrients)[];
  readonly nutrientForms?: FoodNutrientForms;
}

export type MealPlanRecordItem = MealPlanRecordFood | MealPlanRecordRecipe;

export function isMealPlanRecipeItem(
  item: MealPlanRecordItem,
): item is MealPlanRecordRecipe {
  return item.itemType === "RECIPE";
}

export function isMealPlanFoodItem(
  item: MealPlanRecordItem,
): item is MealPlanRecordFood {
  return !isMealPlanRecipeItem(item);
}

export interface MealPlanRecordMeal {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly time?: string;
  readonly vetPercentage?: number;
  readonly plannedEnergyKcal?: number;
  readonly observations?: string;
  readonly items: readonly MealPlanRecordItem[];
}

export interface MealPlanRecordSupplement {
  readonly id: string;
  readonly description: string;
}

export interface MealPlanRecordDraft {
  readonly strategyEntryId?: string;
  readonly status: MealPlanRecordStatus;
  readonly strategyUpdateDecision?: MealPlanStrategyUpdateDecision;
  readonly aiDecision: MealPlanAiDecision;
  readonly smartGenerationVersion?: number;
  readonly meals: readonly MealPlanRecordMeal[];
  readonly supplements: readonly MealPlanRecordSupplement[];
  readonly sourcePlanEntryId?: string;
  readonly sourcePlanAttendanceId?: string;
  readonly sourcePlanRevision?: number;
  readonly reuseMode?: MealPlanReuseMode;
  readonly dietaryReferenceProfile?: DietaryReferenceProfile;
  readonly dietaryReferences?: readonly DietaryReferenceValue[];
  readonly professionalReview?: MealPlanProfessionalReview;
  readonly targetDeviationAuthorization?: MealPlanTargetDeviationAuthorization;
}

export interface StoredMealPlanPayload extends MealPlanRecordDraft {
  readonly schemaVersion: 6 | 7 | 8 | 9;
  readonly strategyApprovedAt?: string;
  readonly strategySnapshot?: MealPlanStrategyInheritance;
  readonly totals: MealPlanNutritionValues;
  readonly comparison?: Readonly<
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
const nutrientFormsSchema = z.object({
  vitaminAMcg: z.enum(["RAE", "RE", "RETINOL", "UNSPECIFIED"]),
  folateMcg: z.enum(["DFE", "FOOD_FOLATE", "FOLIC_ACID", "UNSPECIFIED"]),
});
const foodNutrientsSchema = nutritionValuesSchema.extend({
  sugarsGrams: nullableNutrient,
  cholesterolMg: nullableNutrient,
  saturatedFatsGrams: nullableNutrient,
  transFatsGrams: nullableNutrient,
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
const recipeNutrientsSchema = foodNutrientsSchema.extend({
  energyKcal: nullableNutrient,
  proteinGrams: nullableNutrient,
  carbohydratesGrams: nullableNutrient,
  fatsGrams: nullableNutrient,
  fiberGrams: nullableNutrient,
});
const mealPlanNutrientKeySchema = z.enum([
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
  "fiberGrams",
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
]);
const dietaryReferenceNutrientKeySchema = z.enum([
  "fiberGrams", "sodiumMg", "calciumMg", "ironMg", "magnesiumMg",
  "phosphorusMg", "potassiumMg", "zincMg", "copperMg", "manganeseMg",
  "seleniumMcg", "vitaminAMcg", "vitaminCMg", "vitaminDMcg", "vitaminEMg",
  "vitaminKMcg", "thiamineMg", "riboflavinMg", "niacinMg", "vitaminB6Mg",
  "folateMcg", "vitaminB12Mcg",
] satisfies readonly [DietaryReferenceNutrient, ...DietaryReferenceNutrient[]]);
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
  responsibleUser: z.string().trim().min(1).max(200).optional(),
  suggestionReason: z.string().trim().min(1).max(1_000).optional(),
  equivalenceCriterion: z.literal("ENERGY_AND_MACRONUTRIENTS").optional(),
  originalPrescribedAmount: z.number().finite().positive().max(100_000).optional(),
  originalPrescribedUnit: z.enum(["g", "ml"]).optional(),
  replacementQuantity: z.number().finite().positive().max(1_000).optional(),
  replacementPrescribedAmount: z.number().finite().positive().max(100_000).optional(),
  replacementPrescribedUnit: z.enum(["g", "ml"]).optional(),
  replacementHouseholdMeasure: z.string().trim().min(1).max(120).optional(),
  needsProfessionalReview: z.boolean().optional(),
});
const foodSchema = z.object({
  itemType: z.literal("FOOD").optional(),
  id: z.string().uuid(),
  catalogFoodId: z.string().min(1).max(200),
  description: z.string().trim().min(1).max(300),
  foodGroup: z.string().trim().min(1).max(120),
  source: z.enum([
    "TACO",
    "TBCA",
    "IBGE",
    "PHILIPS",
    "USDA",
    "CLINIC_SV",
    "EVONUT",
  ]),
  sourceName: z.string().trim().min(1).max(200),
  sourceVersion: z.string().trim().max(100).optional(),
  sourceCode: z.string().trim().max(100).optional(),
  primaryHouseholdMeasure: z.string().trim().min(1).max(120),
  standardWeightGrams: z.number().finite().positive().max(10_000),
  nutritionBasisUnit: z.enum(["g", "ml"]).optional(),
  grams: z.number().finite().nonnegative().max(10_000),
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
  selectedIbgeMeasureId: z.string().uuid().optional(),
  ibgeMeasureOptions: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(240),
        measureName: z.string().trim().min(1).max(120),
        preparationCode: z.string().trim().max(20),
        preparationName: z.string().trim().max(120),
        amountPerMeasure: z.number().finite().positive().max(100_000),
        unit: z.enum(["g", "ml"]),
      }),
    )
    .max(200)
    .optional(),
  prescribedAmount: z.number().finite().nonnegative().max(100_000).optional(),
  prescribedUnit: z.enum(["g", "ml"]).optional(),
  quantity: z.number().finite().nonnegative().max(1_000),
  nutrientsPer100g: foodNutrientsSchema,
  nutrients: foodNutrientsSchema,
  nutrientForms: nutrientFormsSchema.optional(),
  substitutions: z.array(substitutionSchema).max(100).default([]),
});
const recipeSchema = z
  .object({
    itemType: z.literal("RECIPE"),
    id: z.string().uuid(),
    recipeId: z.string().uuid(),
    recipeTitle: z.string().trim().min(1).max(300),
    recipeNutritionSnapshotId: z.string().uuid(),
    recipeNutritionSnapshotVersion: z.number().int().positive(),
    recipeContentSnapshot: recipeContentSnapshotSchema.optional(),
    portion: z.object({
      kind: z.literal("SERVINGS"),
      prescribedServings: z.number().finite().positive().max(1_000),
      recipeServings: z.number().finite().positive().max(100_000),
      description: z.string().trim().min(1).max(120),
      servingSize: z
        .object({
          amount: z.number().finite().positive().max(100_000),
          unit: z.enum(["g", "ml"]),
        })
        .optional(),
    }),
    nutritionCompleteness: z.enum(["COMPLETE", "PARTIAL"]),
    snapshotNutrients: recipeNutrientsSchema,
    prescribedNutrients: recipeNutrientsSchema,
    missingNutrients: z.array(mealPlanNutrientKeySchema).max(32),
    partialNutrients: z.array(mealPlanNutrientKeySchema).max(32).default([]),
    nutrientForms: nutrientFormsSchema.optional(),
  })
  .superRefine((recipe, context) => {
    const missing = new Set(recipe.missingNutrients);
    const partial = new Set(recipe.partialNutrients);
    const actuallyMissing = mealPlanNutrientKeySchema.options.filter(
      (key) =>
        recipe.snapshotNutrients[key] === null ||
        recipe.prescribedNutrients[key] === null,
    );
    const exactMissingList =
      missing.size === recipe.missingNutrients.length &&
      actuallyMissing.length === missing.size &&
      actuallyMissing.every((key) => missing.has(key));
    if (!exactMissingList) {
      context.addIssue({
        code: "custom",
        path: ["missingNutrients"],
        message:
          "A lista de nutrientes ausentes deve corresponder aos valores null do snapshot e da porção prescrita.",
      });
    }
    if (
      partial.size !== recipe.partialNutrients.length ||
      recipe.partialNutrients.some(
        (key) => missing.has(key) || recipe.snapshotNutrients[key] === null,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["partialNutrients"],
        message:
          "Nutrientes parciais devem ter subtotal numérico e não podem estar marcados como ausentes.",
      });
    }
    const expectedCompleteness = actuallyMissing.length || partial.size
      ? "PARTIAL"
      : "COMPLETE";
    if (recipe.nutritionCompleteness !== expectedCompleteness) {
      context.addIssue({
        code: "custom",
        path: ["nutritionCompleteness"],
        message:
          "A completude nutricional deve refletir os nutrientes ausentes.",
      });
    }
  });
const mealPlanRecordItemSchema = z.union([recipeSchema, foodSchema]);
const mealPlanRecordMealSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  order: z.number().int().positive(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  vetPercentage: z.number().finite().positive().max(100).optional(),
  plannedEnergyKcal: z.number().finite().positive().optional(),
  observations: optionalTrimmedText,
  items: z.array(mealPlanRecordItemSchema).max(100),
});
const mealPlanRecordSupplementSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(2_000),
});

export const mealPlanRecordDraftSchema = z.object({
  strategyEntryId: z.string().uuid().optional(),
  status: z.enum(MEAL_PLAN_RECORD_STATUSES),
  strategyUpdateDecision: z.enum(["UPDATE", "KEEP"]).optional(),
  aiDecision: z
    .enum(["IDLE", "SUGGESTION_GENERATED", "APPROVED", "REJECTED"])
    .default("IDLE"),
  smartGenerationVersion: z.number().int().positive().max(100).optional(),
  meals: z
    .array(mealPlanRecordMealSchema)
    .min(1)
    .max(20)
    .refine(
      (meals) => new Set(meals.map((meal) => meal.order)).size === meals.length,
      "A ordem das refeições deve ser única.",
    ),
  supplements: z.array(mealPlanRecordSupplementSchema).max(100).default([]),
  sourcePlanEntryId: z.string().uuid().optional(),
  sourcePlanAttendanceId: z.string().uuid().optional(),
  sourcePlanRevision: z.number().int().positive().optional(),
  reuseMode: z.enum(["KEEP_PREVIOUS", "ADJUSTED_COPY"]).optional(),
  dietaryReferenceProfile: z.object({
    sex: z.enum(["FEMALE", "MALE"]),
    ageYears: z.number().int().min(1).max(130),
    ageAt: z.string().datetime(),
    birthDate: z.iso.date(),
    lifeStage: z.enum(["UNKNOWN", "NONE", "PREGNANCY", "LACTATION"]),
    origin: z.enum(["MASTER_RECORD_AND_ATTENDANCE", "PROFESSIONAL_CONFIRMATION", "PROFESSIONAL_ADJUSTMENT"]),
    adjustmentReason: z.string().trim().min(1).max(2_000).optional(),
    adjustedByUserId: z.string().uuid().optional(),
    adjustedAt: z.string().datetime().optional(),
  }).superRefine((profile, context) => {
    if (profile.origin === "PROFESSIONAL_ADJUSTMENT" && !profile.adjustmentReason) {
      context.addIssue({ code: "custom", path: ["adjustmentReason"], message: "Ajustes profissionais exigem justificativa." });
    }
  }).optional(),
  dietaryReferences: z.array(z.object({
    nutrient: dietaryReferenceNutrientKeySchema,
    label: z.string().trim().min(1).max(120),
    unit: z.enum(["g", "mg", "mcg RAE", "mcg DFE", "mcg"]),
    referenceType: z.enum(["RDA", "AI", "CDRR"]),
    referenceValue: z.number().finite().positive(),
    referenceRequiredForm: z.enum(["RAE", "DFE"]).optional(),
    ul: z.number().finite().positive().optional(),
    upperType: z.enum(["UL", "CDRR"]).optional(),
    ulScope: z.enum(["TOTAL_INTAKE", "SUPPLEMENTS_AND_FORTIFIED_FOODS", "SUPPLEMENTS_ONLY", "PREFORMED_VITAMIN_A", "SPECIFIC_FORM_NOT_DISTINGUISHED"]).optional(),
    ulComparison: z.enum(["APPLICABLE", "NOT_ESTABLISHED", "NOT_DETERMINABLE"]),
    ulRequiredForm: z.enum(["RETINOL", "FOLIC_ACID"]).optional(),
    note: z.string().trim().max(2_000).optional(),
    source: z.object({
      organization: z.literal("NASEM / Health Canada"),
      edition: z.string().trim().min(1).max(300),
      url: z.url(),
    }),
  })).max(40).optional(),
  professionalReview: z.object({
    reviewedByUserId: z.string().uuid(),
    reviewedByName: z.string().trim().min(1).max(200),
    reviewedAt: z.string().datetime(),
    planRevision: z.number().int().positive(),
    contentFingerprint: z.string().min(1).max(200_000),
    acknowledgedLimitations: z.array(z.string().trim().min(1).max(500)).max(100),
    statement: z.string().trim().min(1).max(2_000),
  }).optional(),
  targetDeviationAuthorization: z.object({
    authorizedByUserId: z.string().uuid(),
    authorizedByName: z.string().trim().min(1).max(200),
    authorizedAt: z.string().datetime(),
    planRevision: z.number().int().positive(),
    tolerancePercent: z.number().finite().positive(),
    deviationFingerprint: z.string().min(1).max(10_000),
    deviations: z.array(z.object({
      metric: z.enum([
        "energyKcal",
        "proteinGrams",
        "carbohydratesGrams",
        "fatsGrams",
      ]),
      target: z.number().finite().positive(),
      planned: z.number().finite().nonnegative(),
      absoluteDifference: z.number().finite().nonnegative(),
      percentageDifference: z.number().finite(),
      outsideTolerance: z.boolean(),
    })).length(4),
    statement: z.string().trim().max(2_000).optional(),
  }).optional(),
});

export const mealPlanClinicalJustificationSchema = z
  .string()
  .trim()
  .max(10_000)
  .optional()
  .transform((value) => value || undefined);

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
  transFatsGrams: null,
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

function withHistoricalTransFat(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const sourceItem = item as Record<string, unknown>;
  if (sourceItem.itemType === "RECIPE") {
    const snapshot = sourceItem.snapshotNutrients;
    const prescribed = sourceItem.prescribedNutrients;
    const snapshotRecord = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? snapshot as Record<string, unknown>
      : {};
    const prescribedRecord = prescribed && typeof prescribed === "object" && !Array.isArray(prescribed)
      ? prescribed as Record<string, unknown>
      : {};
    if (Object.hasOwn(snapshotRecord, "transFatsGrams") && Object.hasOwn(prescribedRecord, "transFatsGrams")) {
      return item;
    }
    const missing = Array.isArray(sourceItem.missingNutrients)
      ? sourceItem.missingNutrients.filter((key): key is string => typeof key === "string")
      : [];
    return {
      ...sourceItem,
      nutritionCompleteness: "PARTIAL",
      snapshotNutrients: { ...snapshotRecord, transFatsGrams: null },
      prescribedNutrients: { ...prescribedRecord, transFatsGrams: null },
      missingNutrients: [...new Set([...missing, "transFatsGrams"])],
    };
  }
  const per100g = sourceItem.nutrientsPer100g;
  const nutrients = sourceItem.nutrients;
  return {
    ...sourceItem,
    nutrientsPer100g: {
      ...(per100g && typeof per100g === "object" && !Array.isArray(per100g) ? per100g : {}),
      ...(!per100g || typeof per100g !== "object" || Array.isArray(per100g) || !Object.hasOwn(per100g, "transFatsGrams")
        ? { transFatsGrams: null }
        : {}),
    },
    nutrients: {
      ...(nutrients && typeof nutrients === "object" && !Array.isArray(nutrients) ? nutrients : {}),
      ...(!nutrients || typeof nutrients !== "object" || Array.isArray(nutrients) || !Object.hasOwn(nutrients, "transFatsGrams")
        ? { transFatsGrams: null }
        : {}),
    },
  };
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
      schemaVersion: 6,
      strategyApprovedAt: "",
      aiDecision: "IDLE",
      supplements: [],
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
  const versionSix =
    candidate.schemaVersion === 5
      ? { ...candidate, schemaVersion: 6, supplements: [] }
      : candidate;
  if (
    versionSix.schemaVersion !== 6 &&
    versionSix.schemaVersion !== 7 &&
    versionSix.schemaVersion !== 8 &&
    versionSix.schemaVersion !== 9
  ) {
    return null;
  }
  // Compatibilidade com planos criados a partir de estratégias que ainda
  // não tinham nome/horário das refeições. Esses campos pertencem à
  // organização do Plano: normalizamos somente o rótulo estrutural e
  // mantemos o horário efetivamente ausente, sem presumir dado clínico.
  const normalized = {
    ...versionSix,
    meals: Array.isArray(versionSix.meals)
      ? versionSix.meals.map((meal, index) => {
          if (!meal || typeof meal !== "object" || Array.isArray(meal)) {
            return meal;
          }
          const sourceMeal = meal as Record<string, unknown>;
          const order =
            typeof sourceMeal.order === "number" &&
            Number.isInteger(sourceMeal.order) &&
            sourceMeal.order > 0
              ? sourceMeal.order
              : index + 1;
          const name =
            typeof sourceMeal.name === "string" && sourceMeal.name.trim()
              ? sourceMeal.name
              : `Refeição ${order}`;
          return {
            ...sourceMeal,
            name,
            items: Array.isArray(sourceMeal.items)
              ? sourceMeal.items.map(withHistoricalTransFat)
              : sourceMeal.items,
            ...(sourceMeal.time === "" ? { time: undefined } : {}),
          };
        })
      : versionSix.meals,
  };
  const draft = parseMealPlanRecordDraft(normalized);
  if (
    draft &&
    versionSix.schemaVersion !== 8 &&
    versionSix.schemaVersion !== 9 &&
    draft.meals.some((meal) => meal.items.some(isMealPlanRecipeItem))
  ) {
    return null;
  }
  const meta = z
    .object({
      strategyApprovedAt: z.string().datetime().optional(),
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
      comparison: comparisonSchema.optional(),
      adequacy: adequacySchema.optional(),
    })
    .safeParse(normalized);
  return draft && meta.success
    ? {
        ...draft,
        ...meta.data,
        schemaVersion: versionSix.schemaVersion as 6 | 7 | 8 | 9,
      }
    : null;
}
