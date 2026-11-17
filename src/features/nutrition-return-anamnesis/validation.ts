import { z } from "zod";

import {
  QUICK_RETURN_CONDUCT_OPTIONS,
  QUICK_RETURN_DIFFICULTY_OPTIONS,
  type NutritionReturnAnamnesisData,
  type PreviousPlanAdherence,
  type QuickReturnAdherence,
  type QuickReturnConduct,
  type QuickReturnDifficulty,
  type ReturnFollowUpData,
  type ReturnRecallFood,
  type ReturnRecall24Hours,
  type ReturnRecallMeal,
} from "./contracts";

const shortText = z.string().trim().max(180);
const clinicalText = z.string().trim().max(4_000);

const nutrientSchema = z
  .object({
    energyKcal: z.number().finite().nonnegative().nullable(),
    proteinGrams: z.number().finite().nonnegative().nullable(),
    carbohydratesGrams: z.number().finite().nonnegative().nullable(),
    fatsGrams: z.number().finite().nonnegative().nullable(),
    fiberGrams: z.number().finite().nonnegative().nullable().default(null),
    sodiumMg: z.number().finite().nonnegative().nullable().default(null),
  })
  .strict();

const nullableNutrient = z.number().finite().nonnegative().nullable();
const recipeNutrientKeySchema = z.enum([
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
]);
const recipeNutrientsSchema = z
  .object({
    energyKcal: nullableNutrient,
    proteinGrams: nullableNutrient,
    carbohydratesGrams: nullableNutrient,
    fatsGrams: nullableNutrient,
    fiberGrams: nullableNutrient,
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
  })
  .strict();

const preparationSchema = z.enum([
  "",
  "NOT_APPLICABLE",
  "RAW",
  "COOKED",
  "ROASTED",
  "GRILLED",
  "FRIED",
  "SAUTEED",
  "STEAMED",
  "OTHER",
]);

const previousPlanComparisonSchema = z
  .object({
    sourcePlanEntryId: z.string().uuid(),
    sourceMealId: z.string().min(1).max(100).optional(),
    sourceFoodId: z.string().min(1).max(100).optional(),
    prescribedFoodName: shortText.optional(),
    prescribedQuantity: z.number().finite().nonnegative().max(100_000).optional(),
    prescribedMeasure: z.string().trim().max(120).optional(),
    prescribedAmount: z.number().finite().nonnegative().max(100_000).optional(),
    prescribedUnit: z.enum(["g", "ml"]).optional(),
    status: z.enum([
      "",
      "AS_PRESCRIBED",
      "DIFFERENT_QUANTITY",
      "SUBSTITUTED",
      "NOT_CONSUMED",
      "ADDED",
    ]),
  })
  .strict();

const foodBase = {
  id: z.string().min(1).max(100),
  name: shortText,
  quantity: z.number().finite().positive().max(100_000).optional(),
  unit: z.string().trim().max(100),
  preparation: z.string().trim().max(300),
  brand: z.string().trim().max(180),
  observations: z.string().trim().max(1_000),
  preparationOption: preparationSchema.optional(),
  previousPlanComparison: previousPlanComparisonSchema.optional(),
} as const;

const unselectedFoodSchema = z
  .object({
    ...foodBase,
    source: z.literal("UNSELECTED"),
    compositionStatus: z.literal("UNSELECTED"),
  })
  .strict();

const localFoodSchema = z
  .object({
    ...foodBase,
    source: z.literal("LOCAL_DATABASE"),
    catalogFoodId: z.string().uuid(),
    catalogSource: z.string().trim().max(180),
    catalogSourceKind: z.string().trim().max(80).optional(),
    catalogSourceCode: z.string().trim().max(100).optional(),
    householdMeasureId: z.string().uuid().optional(),
    gramsPerUnit: z.number().finite().positive().max(100_000).optional(),
    measureAmountPerUnit: z
      .number()
      .finite()
      .positive()
      .max(100_000)
      .optional(),
    measureUnit: z.enum(["g", "ml"]).optional(),
    measureSource: z.string().trim().max(180).optional(),
    nutritionReferenceAmount: z
      .number()
      .finite()
      .positive()
      .max(100_000)
      .optional(),
    nutritionReferenceUnit: z.enum(["g", "ml"]).optional(),
    officialPreparation: z.string().trim().max(300).optional(),
    compositionStatus: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    nutrientsPer100g: nutrientSchema.optional(),
  })
  .strict();

const manualFoodSchema = z
  .object({
    ...foodBase,
    source: z.literal("MANUAL"),
    compositionStatus: z.enum(["MANUAL", "MANUAL_WITH_COMPOSITION"]),
    consumedWeight: z
      .number()
      .finite()
      .positive()
      .max(100_000)
      .optional(),
    consumedWeightUnit: z.enum(["g", "ml"]).optional(),
    nutritionBasis: z.enum(["NONE", "PER_100", "PER_PORTION"]).optional(),
    nutrients: nutrientSchema.optional(),
  })
  .strict();

const recallFoodSchema = z.discriminatedUnion("source", [
  unselectedFoodSchema,
  localFoodSchema,
  manualFoodSchema,
]);

const recipeComparisonSchema = z
  .object({
    sourcePlanEntryId: z.string().uuid(),
    sourceMealId: z.string().min(1).max(100).optional(),
    sourceRecipeItemId: z.string().min(1).max(100),
    status: previousPlanComparisonSchema.shape.status,
  })
  .strict();

const recallRecipeSchema = z
  .object({
    id: z.string().min(1).max(100),
    itemType: z.literal("RECIPE"),
    source: z.literal("RECIPE"),
    recipeId: z.string().uuid(),
    recipeTitle: z.string().trim().min(1).max(300),
    recipeNutritionSnapshotId: z.string().uuid(),
    recipeNutritionSnapshotVersion: z.number().int().positive(),
    prescribedPortion: z
      .object({
        kind: z.literal("SERVINGS"),
        prescribedServings: z.number().finite().positive().max(1_000),
        recipeServings: z.number().finite().positive().max(100_000),
        description: z.string().trim().min(1).max(120),
        servingSize: z
          .object({
            amount: z.number().finite().positive().max(100_000),
            unit: z.enum(["g", "ml"]),
          })
          .strict()
          .optional(),
      })
      .strict(),
    consumedServings: z.number().finite().nonnegative().max(1_000).nullable(),
    nutritionCompleteness: z.enum(["COMPLETE", "PARTIAL"]),
    snapshotNutrients: recipeNutrientsSchema,
    prescribedNutrients: recipeNutrientsSchema,
    missingNutrients: z.array(recipeNutrientKeySchema).max(31),
    previousPlanComparison: recipeComparisonSchema,
    observations: z.string().trim().max(1_000),
  })
  .strict()
  .superRefine((recipe, context) => {
    const missing = new Set(recipe.missingNutrients);
    const actuallyMissing = recipeNutrientKeySchema.options.filter(
      (key) =>
        recipe.snapshotNutrients[key] === null ||
        recipe.prescribedNutrients[key] === null,
    );
    if (
      missing.size !== recipe.missingNutrients.length ||
      actuallyMissing.length !== missing.size ||
      !actuallyMissing.every((key) => missing.has(key))
    ) {
      context.addIssue({
        code: "custom",
        path: ["missingNutrients"],
        message:
          "Os nutrientes ausentes devem corresponder aos valores indisponíveis do snapshot congelado.",
      });
    }
    const expectedCompleteness = actuallyMissing.length
      ? "PARTIAL"
      : "COMPLETE";
    if (recipe.nutritionCompleteness !== expectedCompleteness) {
      context.addIssue({
        code: "custom",
        path: ["nutritionCompleteness"],
        message: "A completude deve refletir os nutrientes congelados disponíveis.",
      });
    }
    if (
      recipe.previousPlanComparison.status === "" &&
      recipe.consumedServings !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumedServings"],
        message: "Informe e confirme o consumo antes de registrar porções consumidas.",
      });
    }
    if (
      (recipe.previousPlanComparison.status === "AS_PRESCRIBED" ||
        recipe.previousPlanComparison.status === "DIFFERENT_QUANTITY" ||
        recipe.previousPlanComparison.status === "ADDED") &&
      recipe.consumedServings === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumedServings"],
        message: "A quantidade consumida deve ser informada para o consumo confirmado.",
      });
    }
    if (
      recipe.previousPlanComparison.status === "NOT_CONSUMED" &&
      recipe.consumedServings !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumedServings"],
        message: "O consumo não realizado deve preservar zero porções.",
      });
    }
    if (
      recipe.previousPlanComparison.status === "SUBSTITUTED" &&
      recipe.consumedServings !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumedServings"],
        message: "A receita substituída não deve registrar porções consumidas.",
      });
    }
  });

const recallItemSchema = z.union([recallRecipeSchema, recallFoodSchema]);
const recallMealBase = {
  id: z.string().min(1).max(100),
  time: z.string().trim().max(20),
  name: shortText,
  observations: z.string().trim().max(1_000),
} as const;
const recallMealSchema = z.union([
  z.object({
    ...recallMealBase,
    items: z.array(recallItemSchema).max(100),
    foods: z.array(recallFoodSchema).max(100).optional(),
  })
    .strict(),
  z.object({
    ...recallMealBase,
    foods: z.array(recallFoodSchema).max(100),
  })
    .strict(),
]);

const recall24hSchema = z
  .object({
    dayType: z.enum(["HABITUAL", "ATYPICAL", "NOT_INFORMED"]),
    representativeConfirmed: z.boolean().default(false),
    referenceDate: z.union([
      z.literal(""),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ]),
    meals: z.array(recallMealSchema).max(30),
    water: clinicalText,
    beverages: clinicalText,
    alcohol: clinicalText,
    supplements: clinicalText,
  })
  .strict()
  .refine(
    (recall) => !recall.representativeConfirmed || recall.dayType === "HABITUAL",
    {
      message: "Somente um dia habitual pode ser confirmado como representativo.",
      path: ["representativeConfirmed"],
    },
  );

const legacyFollowUpSchema = z
  .object({
    evolutionSinceLastVisit: clinicalText,
    perceivedPlanAdherence: clinicalText,
    difficulties: clinicalText,
    intercurrences: clinicalText,
    currentSymptoms: clinicalText,
    medicationSupplementChanges: clinicalText,
    newExams: clinicalText,
    routineChanges: clinicalText,
    currentSleepStress: clinicalText,
    currentPhysicalActivity: clinicalText,
    waterIntake: clinicalText,
    alcoholConsumption: clinicalText,
    perceivedResult: clinicalText,
    professionalObservations: clinicalText,
    initialReturnPlan: clinicalText,
  })
  .strict();

const legacyAdherenceSchema = z
  .object({
    level: z.enum(["FULL", "PARTIAL", "NONE", "NOT_ASSESSABLE"]),
    followedMeals: clinicalText,
    omittedMeals: clinicalText,
    substitutions: clinicalText,
    difficultyReasons: clinicalText,
    hungerSatietyTolerance: clinicalText,
    professionalObservation: clinicalText,
  })
  .strict();

export const nutritionReturnAnamnesisDataSchema = z
  .object({
    schemaVersion: z.literal(2),
    quickReturn: z
      .object({
        evolutionSinceLastVisit: clinicalText,
        adherence: z.enum(["", "GOOD", "PARTIAL", "LOW", "NOT_ASSESSABLE"]),
        mainDifficulty: z.enum([
          "",
          "ROUTINE_ORGANIZATION",
          "HUNGER_SATIETY",
          "FOOD_PREFERENCES",
          "COST_ACCESS",
          "SOCIAL_EVENTS",
          "ALCOHOL",
          "SYMPTOMS_INTOLERANCE",
          "NO_DIFFICULTY",
          "OTHER",
        ]),
        otherDifficulty: clinicalText,
        hadIntercurrence: z.enum(["", "NO", "YES"]),
        intercurrenceDetails: clinicalText,
        conduct: z.enum([
          "",
          "KEEP_CURRENT_STRATEGY",
          "ADJUST_MEAL_PLAN",
          "REPLACE_STRATEGY",
          "REQUEST_ASSESSMENT_EXAMS",
          "OTHER",
        ]),
        professionalObservation: clinicalText,
      })
      .strict(),
    recall24h: recall24hSchema.optional(),
    detailedAdherence: z
      .object({
        followedMeals: clinicalText,
        omittedMeals: clinicalText,
        substitutions: clinicalText,
        hungerSatietyTolerance: clinicalText,
        professionalObservation: clinicalText,
      })
      .strict()
      .optional(),
    legacy: z
      .object({
        followUp: legacyFollowUpSchema,
        previousPlanAdherence: legacyAdherenceSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

const legacyVersionOneSchema = z
  .object({
    schemaVersion: z.literal(1),
    followUp: legacyFollowUpSchema,
    recall24h: recall24hSchema,
    previousPlanAdherence: legacyAdherenceSchema,
  })
  .strict();

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function uniqueTexts(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function optionFromText<T extends string>(
  value: string,
  options: readonly (readonly [T, string])[],
): T | undefined {
  const candidate = normalized(value);
  return options.find(
    ([key, label]) =>
      normalized(key) === candidate || normalized(label) === candidate,
  )?.[0];
}

function legacyAdherence(
  followUp: ReturnFollowUpData,
  adherence: PreviousPlanAdherence,
): QuickReturnAdherence {
  const perceived = normalized(followUp.perceivedPlanAdherence);
  if (/boa|integral|completa/.test(perceived)) return "GOOD";
  if (/parcial/.test(perceived)) return "PARTIAL";
  if (/baixa|nao seguiu|não seguiu/.test(perceived)) return "LOW";
  if (/nao foi possivel|não foi possível|avaliar/.test(perceived)) {
    return "NOT_ASSESSABLE";
  }
  if (adherence.level === "FULL") return "GOOD";
  if (adherence.level === "PARTIAL") return "PARTIAL";
  if (adherence.level === "NONE") return "LOW";
  return "NOT_ASSESSABLE";
}

function legacyDifficulty(
  followUp: ReturnFollowUpData,
  adherence: PreviousPlanAdherence,
) {
  const texts = uniqueTexts([
    followUp.difficulties,
    adherence.difficultyReasons,
  ]);
  const mapped = texts
    .map((value) => optionFromText(value, QUICK_RETURN_DIFFICULTY_OPTIONS))
    .find((value): value is Exclude<QuickReturnDifficulty, ""> => Boolean(value));
  return {
    mainDifficulty: (mapped ?? (texts.length ? "OTHER" : "")) as QuickReturnDifficulty,
    otherDifficulty: mapped ? "" : texts.join(" · "),
  };
}

function legacyIntercurrence(followUp: ReturnFollowUpData) {
  const direct = followUp.intercurrences.trim();
  const detailParts = uniqueTexts([
    direct && !/^(nao|não|nenhuma?|sem intercorrencias?)$/i.test(direct)
      ? direct
      : "",
    followUp.medicationSupplementChanges
      ? `Medicamentos ou suplementos: ${followUp.medicationSupplementChanges}`
      : "",
    followUp.currentSymptoms
      ? `Sintomas: ${followUp.currentSymptoms}`
      : "",
    followUp.newExams ? `Exames: ${followUp.newExams}` : "",
    followUp.routineChanges
      ? `Rotina: ${followUp.routineChanges}`
      : "",
  ]);
  const explicitNo = /^(nao|não|nenhuma?|sem intercorrencias?)$/i.test(direct);
  return {
    hadIntercurrence: detailParts.length ? "YES" : explicitNo ? "NO" : "",
    intercurrenceDetails: detailParts.join("\n"),
  } as const;
}

function legacyConduct(followUp: ReturnFollowUpData) {
  const conduct = optionFromText(
    followUp.initialReturnPlan,
    QUICK_RETURN_CONDUCT_OPTIONS,
  );
  return (conduct ?? (followUp.initialReturnPlan.trim() ? "OTHER" : "")) as QuickReturnConduct;
}

export function hasReturnRecallContent(recall: ReturnRecall24Hours) {
  return (
    recall.dayType !== "NOT_INFORMED" ||
    Boolean(recall.referenceDate) ||
    recall.meals.length > 0 ||
    Boolean(recall.water.trim()) ||
    Boolean(recall.beverages.trim()) ||
    Boolean(recall.alcohol.trim()) ||
    Boolean(recall.supplements.trim())
  );
}

function recallMealItems(meal: ReturnRecallMeal) {
  return meal.items ?? meal.foods;
}

function keepRecallFood(food: ReturnRecallFood) {
  return (
    food.source !== "UNSELECTED" ||
    Boolean(food.previousPlanComparison?.sourceFoodId)
  );
}

function pruneRecallMeal(meal: ReturnRecallMeal): ReturnRecallMeal {
  if (meal.items) {
    return {
      ...meal,
      items: meal.items.filter(
        (item) => item.source === "RECIPE" || keepRecallFood(item),
      ),
      ...(meal.foods
        ? { foods: meal.foods.filter((food) => keepRecallFood(food)) }
        : {}),
    };
  }
  return {
    ...meal,
    foods: meal.foods.filter((food) => keepRecallFood(food)),
  };
}

export function hasUnconfirmedPreviousPlanFoods(
  data: NutritionReturnAnamnesisData,
) {
  return Boolean(
    data.recall24h?.meals.some((meal) =>
      recallMealItems(meal).some((item) => {
        if (item.source === "RECIPE") {
          return !item.previousPlanComparison.status;
        }
        return Boolean(
          item.previousPlanComparison?.sourceFoodId &&
            !item.previousPlanComparison.status,
        );
      }),
    ),
  );
}

export function hasDetailedAdherenceContent(
  detailed: NonNullable<NutritionReturnAnamnesisData["detailedAdherence"]>,
) {
  return Object.values(detailed).some((value) => value.trim().length > 0);
}

export function pruneEmptyOptionalReturnBlocks(
  data: NutritionReturnAnamnesisData,
): NutritionReturnAnamnesisData {
  const { recall24h: rawRecall, detailedAdherence, ...required } = data;
  const recall24h = rawRecall
    ? {
        ...rawRecall,
        meals: rawRecall.meals
          .map(pruneRecallMeal)
          .filter(
            (meal) =>
              Boolean(meal.time.trim()) ||
              Boolean(meal.name.trim()) ||
              Boolean(meal.observations.trim()) ||
              recallMealItems(meal).length > 0,
          ),
      }
    : undefined;
  return {
    ...required,
    ...(recall24h && hasReturnRecallContent(recall24h)
      ? { recall24h }
      : {}),
    ...(detailedAdherence && hasDetailedAdherenceContent(detailedAdherence)
      ? { detailedAdherence }
      : {}),
  };
}

function upgradeLegacyVersionOne(
  legacy: z.infer<typeof legacyVersionOneSchema>,
): NutritionReturnAnamnesisData {
  const difficulty = legacyDifficulty(
    legacy.followUp,
    legacy.previousPlanAdherence,
  );
  const intercurrence = legacyIntercurrence(legacy.followUp);
  const detailedAdherence = {
    followedMeals: legacy.previousPlanAdherence.followedMeals,
    omittedMeals: legacy.previousPlanAdherence.omittedMeals,
    substitutions: legacy.previousPlanAdherence.substitutions,
    hungerSatietyTolerance:
      legacy.previousPlanAdherence.hungerSatietyTolerance,
    professionalObservation:
      legacy.previousPlanAdherence.professionalObservation,
  };

  return pruneEmptyOptionalReturnBlocks({
    schemaVersion: 2,
    quickReturn: {
      evolutionSinceLastVisit: legacy.followUp.evolutionSinceLastVisit,
      adherence: legacyAdherence(
        legacy.followUp,
        legacy.previousPlanAdherence,
      ),
      ...difficulty,
      ...intercurrence,
      conduct: legacyConduct(legacy.followUp),
      professionalObservation: legacy.followUp.professionalObservations,
    },
    recall24h: legacy.recall24h,
    detailedAdherence,
    legacy: {
      followUp: legacy.followUp,
      previousPlanAdherence: legacy.previousPlanAdherence,
    },
  });
}

export function parseNutritionReturnAnamnesisData(
  value: unknown,
): NutritionReturnAnamnesisData | null {
  const parsed = nutritionReturnAnamnesisDataSchema.safeParse(value);
  if (parsed.success) {
    return pruneEmptyOptionalReturnBlocks(parsed.data);
  }
  const legacy = legacyVersionOneSchema.safeParse(value);
  return legacy.success ? upgradeLegacyVersionOne(legacy.data) : null;
}
