import type { FoodNutrientForms } from "@/features/food-database/contracts";

export const RECIPE_NUTRIENT_KEYS = [
  "energyKcal",
  "energyKj",
  "carbohydratesGrams",
  "totalSugarsGrams",
  "addedSugarsGrams",
  "proteinGrams",
  "totalFatsGrams",
  "saturatedFatsGrams",
  "transFatsGrams",
  "cholesterolMg",
  "monounsaturatedFatsGrams",
  "polyunsaturatedFatsGrams",
  "fiberGrams",
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
] as const;

export type RecipeNutrientKey = (typeof RECIPE_NUTRIENT_KEYS)[number];
export type ScientificValueStatus =
  | "VALUE"
  | "PARTIAL"
  | "TRACE"
  | "NOT_ANALYZED"
  | "NOT_APPLICABLE"
  | "MISSING";

export type ScientificNutrientValue =
  | { readonly status: "VALUE" | "PARTIAL"; readonly value: number }
  | {
      readonly status: Exclude<ScientificValueStatus, "VALUE" | "PARTIAL">;
      readonly value: null;
    };

export type RecipeNutrientValues = Readonly<
  Record<RecipeNutrientKey, ScientificNutrientValue>
>;

export interface RecipeIngredientCalculationInput {
  readonly ingredientId: string;
  readonly foodId: string;
  readonly foodName: string;
  readonly source: {
    readonly kind: string;
    readonly name: string;
  };
  readonly nutrientReferenceUnit: "g" | "ml";
  readonly nutrientsPer100: RecipeNutrientValues;
  readonly nutrientForms?: FoodNutrientForms;
  readonly grossQuantity?: number;
  /** Quantidade em g/ml já resolvida e documentada pela origem. */
  readonly resolvedQuantity?: number;
  readonly quantityUnit: "g" | "ml";
  readonly netQuantity?: number;
  /** Convenção PB/PL: quantidade líquida = quantidade bruta / fator. */
  readonly correctionFactor?: number;
  /** Fator de rendimento físico; não é fator de retenção nutricional. */
  readonly cookingYieldFactor?: number;
}

export interface RecipeNutritionCalculationInput {
  readonly ingredients: readonly RecipeIngredientCalculationInput[];
  readonly finalYield?: {
    readonly amount: number;
    readonly unit: "g" | "ml";
  };
  readonly servingSize?: {
    readonly amount: number;
    readonly unit: "g" | "ml";
  };
  readonly servings?: number;
}

export interface RecipeNutritionPending {
  readonly code:
    | "MISSING_NET_QUANTITY"
    | "INVALID_QUANTITY"
    | "UNIT_MISMATCH"
    | "MISSING_NUTRIENT"
    | "MISSING_FINAL_YIELD"
    | "MISSING_SERVING"
    | "INCONSISTENT_SERVING"
    | "MISSING_MASS_VOLUME_EQUIVALENCE";
  readonly message: string;
  readonly blocking: boolean;
  readonly affects: readonly RecipeNutritionOutput[];
  readonly ingredientId?: string;
  readonly foodId?: string;
  readonly foodName?: string;
  readonly nutrient?: RecipeNutrientKey;
  readonly scientificSource?: string;
  readonly scientificStatus?: Exclude<ScientificValueStatus, "VALUE" | "PARTIAL">;
}

export type RecipeNutritionOutput =
  | "TOTAL"
  | "PER_SERVING"
  | "PER_100"
  | "CALCULATION_SNAPSHOT"
  | "PERSISTED_SNAPSHOT";

export type RecipeNutritionResultStatus =
  | "UNAVAILABLE"
  | "PARTIAL"
  | "COMPLETE";

export interface CalculatedRecipeIngredient {
  readonly ingredientId: string;
  readonly foodId: string;
  readonly foodName: string;
  readonly scientificSource: string;
  readonly sourceKind: string;
  readonly sourceName: string;
  readonly grossQuantity: number | null;
  readonly netQuantity: number | null;
  readonly quantityUnit: "g" | "ml";
  readonly correctionFactor: number | null;
  readonly cookingYieldFactor: number | null;
  readonly estimatedCookedYield: number | null;
  readonly nutrients: RecipeNutrientValues;
  readonly nutrientForms?: FoodNutrientForms;
}

export interface RecipeNutritionSnapshotDraft {
  readonly ingredientCount: number;
  readonly totalIngredientWeightGrams: number | null;
  readonly totalIngredientMassGrams: number | null;
  readonly totalIngredientVolumeMilliliters: number | null;
  readonly finalWeightGrams: number | null;
  readonly finalYieldAmount: number | null;
  readonly finalYieldUnit: "GRAM" | "MILLILITER";
  readonly servings: number;
  readonly servingWeightGrams: number | null;
  readonly servingSize: number | null;
  readonly servingSizeUnit: "GRAM" | "MILLILITER";
  readonly calculationBasisAmount: 100;
  readonly calculationBasisUnit: "GRAM" | "MILLILITER";
  readonly energyKcal: number | null;
  readonly proteinGrams: number | null;
  readonly carbohydratesGrams: number | null;
  readonly fatsGrams: number | null;
  readonly fiberGrams: number | null;
  readonly sugarsGrams: number | null;
  readonly addedSugarsGrams: number | null;
  readonly saturatedFatsGrams: number | null;
  readonly transFatsGrams: number | null;
  readonly cholesterolMg: number | null;
  readonly monounsaturatedFatsGrams: number | null;
  readonly polyunsaturatedFatsGrams: number | null;
  readonly sodiumMg: number | null;
  readonly calciumMg: number | null;
  readonly ironMg: number | null;
  readonly magnesiumMg: number | null;
  readonly phosphorusMg: number | null;
  readonly potassiumMg: number | null;
  readonly zincMg: number | null;
  readonly copperMg: number | null;
  readonly manganeseMg: number | null;
  readonly seleniumMcg: number | null;
  readonly vitaminAMcg: number | null;
  readonly vitaminCMg: number | null;
  readonly vitaminDMcg: number | null;
  readonly vitaminEMg: number | null;
  readonly vitaminKMcg: number | null;
  readonly thiamineMg: number | null;
  readonly riboflavinMg: number | null;
  readonly niacinMg: number | null;
  readonly vitaminB6Mg: number | null;
  readonly folateMcg: number | null;
  readonly vitaminB12Mcg: number | null;
  readonly additionalNutrients: {
    readonly energyKj: ScientificNutrientValue;
    readonly nutrientStates: Readonly<
      Record<RecipeNutrientKey, ScientificValueStatus>
    >;
    readonly nutrientForms: FoodNutrientForms;
  };
}

export interface RecipeNutritionCalculationSnapshot {
  readonly ingredientCount: number;
  readonly netIngredientQuantityByUnit: {
    readonly grams: number;
    readonly milliliters: number;
  };
  readonly finalYield: RecipeNutritionCalculationInput["finalYield"] | null;
  readonly servings: number;
  readonly servingSize: RecipeNutritionCalculationInput["servingSize"] | null;
  readonly per100Basis: {
    readonly amount: 100;
    readonly unit: "g" | "ml";
  } | null;
  readonly total: RecipeNutrientValues;
  readonly perServing: RecipeNutrientValues;
  readonly per100: RecipeNutrientValues | null;
}

export interface RecipeNutritionCalculationResult {
  readonly complete: boolean;
  readonly calculationStatus: Exclude<RecipeNutritionResultStatus, "UNAVAILABLE"> | "INCOMPLETE";
  readonly outputStatus: Readonly<
    Record<RecipeNutritionOutput, RecipeNutritionResultStatus>
  >;
  readonly ingredients: readonly CalculatedRecipeIngredient[];
  readonly total: RecipeNutrientValues;
  readonly perServing: RecipeNutrientValues | null;
  readonly per100: RecipeNutrientValues | null;
  readonly per100Basis: {
    readonly amount: 100;
    readonly unit: "g" | "ml";
  } | null;
  readonly totalNetIngredientQuantity: number | null;
  readonly netIngredientQuantityByUnit: {
    readonly grams: number;
    readonly milliliters: number;
  };
  readonly finalYield: RecipeNutritionCalculationInput["finalYield"] | null;
  readonly servingSize: RecipeNutritionCalculationInput["servingSize"] | null;
  readonly servings: number | null;
  readonly pendings: readonly RecipeNutritionPending[];
  readonly calculationSnapshot: RecipeNutritionCalculationSnapshot | null;
  readonly snapshotDraft: RecipeNutritionSnapshotDraft | null;
}

function scientificSource(source: RecipeIngredientCalculationInput["source"]) {
  return source.kind === "EVONUT" ? source.name : source.kind;
}

function missingValue(
  status: Exclude<ScientificValueStatus, "VALUE" | "PARTIAL"> = "MISSING",
) {
  return { status, value: null } as const;
}

function scaleNutrients(
  nutrients: RecipeNutrientValues,
  factor: number,
): RecipeNutrientValues {
  return Object.fromEntries(
    RECIPE_NUTRIENT_KEYS.map((key) => {
      const nutrient = nutrients[key] ?? missingValue();
      return [
        key,
        nutrient.status === "VALUE" || nutrient.status === "PARTIAL"
          ? { status: nutrient.status, value: nutrient.value * factor }
          : nutrient,
      ];
    }),
  ) as unknown as RecipeNutrientValues;
}

function aggregateNutrients(
  ingredients: readonly CalculatedRecipeIngredient[],
): RecipeNutrientValues {
  return Object.fromEntries(
    RECIPE_NUTRIENT_KEYS.map((key) => {
      const values = ingredients.map(
        (ingredient) => ingredient.nutrients[key] ?? missingValue(),
      );
      const numeric = values.filter(
        (
          value,
        ): value is Extract<
          ScientificNutrientValue,
          { status: "VALUE" | "PARTIAL" }
        > => value.status === "VALUE" || value.status === "PARTIAL",
      );
      const hasUnavailable = values.some(
        (value) =>
          value.status !== "VALUE" &&
          value.status !== "PARTIAL" &&
          value.status !== "NOT_APPLICABLE",
      );
      if (!numeric.length) {
        return [
          key,
          hasUnavailable ? missingValue() : missingValue("NOT_APPLICABLE"),
        ];
      }
      return [
        key,
        {
          status:
            hasUnavailable || numeric.some((item) => item.status === "PARTIAL")
              ? "PARTIAL" as const
              : "VALUE" as const,
          value: numeric.reduce((total, item) => total + item.value, 0),
        },
      ];
    }),
  ) as unknown as RecipeNutrientValues;
}

function aggregateNutrientForms(
  ingredients: readonly CalculatedRecipeIngredient[],
): FoodNutrientForms {
  const commonForm = <Key extends keyof FoodNutrientForms>(key: Key) => {
    const contributingForms = ingredients
      .filter((ingredient) => {
        const nutrient = ingredient.nutrients[key];
        return nutrient.status === "VALUE" || nutrient.status === "PARTIAL";
      })
      .map((ingredient) => ingredient.nutrientForms?.[key] ?? "UNSPECIFIED");
    return contributingForms.length > 0 &&
      contributingForms.every((form) => form === contributingForms[0])
      ? contributingForms[0]
      : "UNSPECIFIED";
  };
  return {
    vitaminAMcg: commonForm("vitaminAMcg"),
    folateMcg: commonForm("folateMcg"),
  };
}

function knownSubtotalOrNull(value: ScientificNutrientValue) {
  return value.status === "VALUE" || value.status === "PARTIAL"
    ? value.value
    : null;
}

function persistedBasisUnit(unit: "g" | "ml"): "GRAM" | "MILLILITER" {
  return unit === "g" ? "GRAM" : "MILLILITER";
}

export function calculateRecipeNutrition(
  input: RecipeNutritionCalculationInput,
): RecipeNutritionCalculationResult {
  const pendings: RecipeNutritionPending[] = [];
  const ingredients: CalculatedRecipeIngredient[] = input.ingredients.map(
    (ingredient) => {
      const source = scientificSource(ingredient.source);
      const grossQuantityIsValid =
        ingredient.grossQuantity !== undefined &&
        Number.isFinite(ingredient.grossQuantity) &&
        ingredient.grossQuantity > 0;
      const resolvedQuantityIsValid =
        ingredient.resolvedQuantity !== undefined &&
        Number.isFinite(ingredient.resolvedQuantity) &&
        ingredient.resolvedQuantity > 0;
      const suppliedNetIsValid =
        ingredient.netQuantity !== undefined &&
        Number.isFinite(ingredient.netQuantity) &&
        ingredient.netQuantity > 0;
      const factorIsValid =
        ingredient.correctionFactor !== undefined &&
        Number.isFinite(ingredient.correctionFactor) &&
        ingredient.correctionFactor > 0;

      if (!grossQuantityIsValid && !resolvedQuantityIsValid) {
        pendings.push({
          code: "INVALID_QUANTITY",
          message: `Quantidade não resolvida para ${ingredient.foodName}.`,
          blocking: true,
          affects: ["TOTAL", "PER_SERVING", "PER_100", "CALCULATION_SNAPSHOT", "PERSISTED_SNAPSHOT"],
          ingredientId: ingredient.ingredientId,
          foodId: ingredient.foodId,
          foodName: ingredient.foodName,
          scientificSource: source,
        });
      }

      const netQuantity = suppliedNetIsValid
        ? ingredient.netQuantity!
        : resolvedQuantityIsValid
          ? ingredient.resolvedQuantity!
          : grossQuantityIsValid && factorIsValid
            ? ingredient.grossQuantity! / ingredient.correctionFactor!
            : null;
      if (grossQuantityIsValid && netQuantity === null) {
        pendings.push({
          code: "MISSING_NET_QUANTITY",
          message: `Informe a quantidade líquida ou o fator de correção de ${ingredient.foodName}.`,
          blocking: true,
          affects: ["TOTAL", "PER_SERVING", "PER_100", "CALCULATION_SNAPSHOT", "PERSISTED_SNAPSHOT"],
          ingredientId: ingredient.ingredientId,
          foodId: ingredient.foodId,
          foodName: ingredient.foodName,
          scientificSource: source,
        });
      }
      if (ingredient.quantityUnit !== ingredient.nutrientReferenceUnit) {
        pendings.push({
          code: "UNIT_MISMATCH",
          message: `${ingredient.foodName} usa ${ingredient.quantityUnit}, mas sua referência nutricional está em ${ingredient.nutrientReferenceUnit}; densidade não foi presumida.`,
          blocking: true,
          affects: ["TOTAL", "PER_SERVING", "PER_100", "CALCULATION_SNAPSHOT", "PERSISTED_SNAPSHOT"],
          ingredientId: ingredient.ingredientId,
          foodId: ingredient.foodId,
          foodName: ingredient.foodName,
          scientificSource: source,
        });
      }

      for (const nutrient of RECIPE_NUTRIENT_KEYS) {
        const datum = ingredient.nutrientsPer100[nutrient] ?? missingValue();
        if (datum.status !== "VALUE" && datum.status !== "NOT_APPLICABLE") {
          pendings.push({
            code: "MISSING_NUTRIENT",
            message: `${nutrient} está ${datum.status.toLowerCase()} para ${ingredient.foodName} (${source}).`,
            blocking: true,
            affects: ["TOTAL", "PER_SERVING", "PER_100", "CALCULATION_SNAPSHOT", "PERSISTED_SNAPSHOT"],
            ingredientId: ingredient.ingredientId,
            foodId: ingredient.foodId,
            foodName: ingredient.foodName,
            nutrient,
            scientificSource: source,
            ...(datum.status === "PARTIAL"
              ? {}
              : { scientificStatus: datum.status }),
          });
        }
      }

      const canScale =
        netQuantity !== null &&
        ingredient.quantityUnit === ingredient.nutrientReferenceUnit;
      const cookingYieldFactor =
        ingredient.cookingYieldFactor !== undefined &&
        Number.isFinite(ingredient.cookingYieldFactor) &&
        ingredient.cookingYieldFactor > 0
          ? ingredient.cookingYieldFactor
          : null;
      return {
        ingredientId: ingredient.ingredientId,
        foodId: ingredient.foodId,
        foodName: ingredient.foodName,
        scientificSource: source,
        sourceKind: ingredient.source.kind,
        sourceName: ingredient.source.name,
        grossQuantity: grossQuantityIsValid ? ingredient.grossQuantity! : null,
        netQuantity,
        quantityUnit: ingredient.quantityUnit,
        correctionFactor: ingredient.correctionFactor ?? null,
        cookingYieldFactor,
        estimatedCookedYield:
          netQuantity !== null && cookingYieldFactor !== null
            ? netQuantity * cookingYieldFactor
            : null,
        nutrients: canScale
          ? scaleNutrients(ingredient.nutrientsPer100, netQuantity / 100)
          : (Object.fromEntries(
              RECIPE_NUTRIENT_KEYS.map((key) => [key, missingValue()]),
            ) as unknown as RecipeNutrientValues),
        nutrientForms: ingredient.nutrientForms,
      };
    },
  );

  const finalYield = input.finalYield ?? null;
  if (
    !finalYield ||
    !Number.isFinite(finalYield.amount) ||
    finalYield.amount <= 0
  ) {
    pendings.push({
      code: "MISSING_FINAL_YIELD",
      message:
        "Informe o peso ou volume final apenas para calcular valores por 100 g ou 100 ml.",
      blocking: true,
      affects: ["PER_100"],
    });
  }

  let servingSize = input.servingSize ?? null;
  let servings = input.servings ?? null;
  const suppliedServingSizeValid =
    servingSize !== null &&
    Number.isFinite(servingSize.amount) &&
    servingSize.amount > 0;
  const suppliedServingsValid =
    servings !== null && Number.isFinite(servings) && servings > 0;
  if (
    finalYield &&
    finalYield.amount > 0 &&
    servingSize !== null &&
    suppliedServingSizeValid &&
    !suppliedServingsValid
  ) {
    if (servingSize.unit === finalYield.unit) {
      servings = finalYield.amount / servingSize.amount;
    }
  } else if (
    finalYield &&
    finalYield.amount > 0 &&
    suppliedServingsValid &&
    !suppliedServingSizeValid
  ) {
    servingSize = {
      amount: finalYield.amount / servings!,
      unit: finalYield.unit,
    };
  }
  const validServings =
    servings !== null && Number.isFinite(servings) && servings > 0;
  if (!validServings) {
    pendings.push({
      code: "MISSING_SERVING",
      message: "Informe o tamanho da porção ou o número de porções.",
      blocking: true,
      affects: ["PER_SERVING", "CALCULATION_SNAPSHOT", "PERSISTED_SNAPSHOT"],
    });
  }
  if (
    finalYield &&
    servingSize &&
    servingSize.unit !== finalYield.unit
  ) {
    pendings.push({
      code: "INCONSISTENT_SERVING",
      message: "A unidade da porção deve ser igual à unidade do rendimento final.",
      blocking: true,
      affects: ["PER_SERVING", "CALCULATION_SNAPSHOT", "PERSISTED_SNAPSHOT"],
    });
  }
  if (
    finalYield &&
    servingSize &&
    validServings &&
    servingSize.unit === finalYield.unit &&
    Math.abs(servingSize.amount * servings! - finalYield.amount) > 1e-9
  ) {
    pendings.push({
      code: "INCONSISTENT_SERVING",
      message:
        "O tamanho da porção multiplicado pelo número de porções deve corresponder ao rendimento final.",
      blocking: true,
      affects: ["PER_SERVING", "CALCULATION_SNAPSHOT", "PERSISTED_SNAPSHOT"],
    });
  }

  const total = aggregateNutrients(ingredients);
  const nutrientForms = aggregateNutrientForms(ingredients);
  const validFinalYield =
    finalYield !== null && Number.isFinite(finalYield.amount) && finalYield.amount > 0;
  const perServing = validServings ? scaleNutrients(total, 1 / servings!) : null;
  const per100 = validFinalYield
    ? scaleNutrients(total, 100 / finalYield.amount)
    : null;
  const per100Basis = validFinalYield
    ? { amount: 100 as const, unit: finalYield.unit }
    : null;
  const netQuantities = ingredients.map((ingredient) => ingredient.netQuantity);
  const netIngredientQuantityByUnit = ingredients.reduce(
    (quantities, ingredient) => {
      if (ingredient.netQuantity !== null) {
        if (ingredient.quantityUnit === "g") {
          quantities.grams += ingredient.netQuantity;
        } else {
          quantities.milliliters += ingredient.netQuantity;
        }
      }
      return quantities;
    },
    { grams: 0, milliliters: 0 },
  );
  const ingredientUnits = new Set(
    ingredients
      .filter((ingredient) => ingredient.netQuantity !== null)
      .map((ingredient) => ingredient.quantityUnit),
  );
  const totalNetIngredientQuantity = netQuantities.every(
    (quantity): quantity is number => quantity !== null,
  ) && ingredientUnits.size <= 1
    ? netQuantities.reduce((total, quantity) => total + quantity, 0)
    : null;

  const hasSnapshotStructuralBlocking = pendings.some(
    (pending) =>
      pending.blocking &&
      pending.code !== "MISSING_NUTRIENT" &&
      pending.affects.includes("PERSISTED_SNAPSHOT"),
  );
  const hasNutrientBlocking = pendings.some(
    (pending) => pending.blocking && pending.code === "MISSING_NUTRIENT",
  );
  const calculationStatus = hasSnapshotStructuralBlocking
    ? "INCOMPLETE" as const
    : hasNutrientBlocking
      ? "PARTIAL" as const
      : "COMPLETE" as const;
  const complete = calculationStatus === "COMPLETE";
  const calculationSnapshot =
    !hasSnapshotStructuralBlocking &&
    perServing &&
    validServings
      ? {
          ingredientCount: ingredients.length,
          netIngredientQuantityByUnit,
          finalYield,
          servings: servings!,
          servingSize,
          per100Basis,
          total,
          perServing,
          per100,
        }
      : null;

  let snapshotDraft: RecipeNutritionSnapshotDraft | null = null;
  if (calculationSnapshot) {
    const totalIngredientMassGrams =
      netIngredientQuantityByUnit.grams > 0
        ? netIngredientQuantityByUnit.grams
        : null;
    const totalIngredientVolumeMilliliters =
      netIngredientQuantityByUnit.milliliters > 0
        ? netIngredientQuantityByUnit.milliliters
        : null;
    const availableUnit =
      calculationSnapshot.finalYield?.unit ??
      calculationSnapshot.servingSize?.unit ??
      "g";
    const finalYieldUnit = persistedBasisUnit(availableUnit);
    const servingSizeUnit = persistedBasisUnit(
      calculationSnapshot.servingSize?.unit ?? availableUnit,
    );

    snapshotDraft = {
      ingredientCount: ingredients.length,
      totalIngredientWeightGrams: totalIngredientMassGrams,
      totalIngredientMassGrams,
      totalIngredientVolumeMilliliters,
      finalWeightGrams:
        calculationSnapshot.finalYield?.unit === "g"
          ? calculationSnapshot.finalYield.amount
          : null,
      finalYieldAmount: calculationSnapshot.finalYield?.amount ?? null,
      finalYieldUnit,
      servings: calculationSnapshot.servings,
      servingWeightGrams:
        calculationSnapshot.servingSize?.unit === "g"
          ? calculationSnapshot.servingSize.amount
          : null,
      servingSize: calculationSnapshot.servingSize?.amount ?? null,
      servingSizeUnit,
      calculationBasisAmount: calculationSnapshot.per100Basis?.amount ?? 100,
      calculationBasisUnit: persistedBasisUnit(
        calculationSnapshot.per100Basis?.unit ?? availableUnit,
      ),
      energyKcal: knownSubtotalOrNull(total.energyKcal),
      proteinGrams: knownSubtotalOrNull(total.proteinGrams),
      carbohydratesGrams: knownSubtotalOrNull(total.carbohydratesGrams),
      fatsGrams: knownSubtotalOrNull(total.totalFatsGrams),
      fiberGrams: knownSubtotalOrNull(total.fiberGrams),
      sugarsGrams: knownSubtotalOrNull(total.totalSugarsGrams),
      addedSugarsGrams: knownSubtotalOrNull(total.addedSugarsGrams),
      saturatedFatsGrams: knownSubtotalOrNull(total.saturatedFatsGrams),
      transFatsGrams: knownSubtotalOrNull(total.transFatsGrams),
      cholesterolMg: knownSubtotalOrNull(total.cholesterolMg),
      monounsaturatedFatsGrams: knownSubtotalOrNull(
        total.monounsaturatedFatsGrams,
      ),
      polyunsaturatedFatsGrams: knownSubtotalOrNull(
        total.polyunsaturatedFatsGrams,
      ),
      sodiumMg: knownSubtotalOrNull(total.sodiumMg),
      calciumMg: knownSubtotalOrNull(total.calciumMg),
      ironMg: knownSubtotalOrNull(total.ironMg),
      magnesiumMg: knownSubtotalOrNull(total.magnesiumMg),
      phosphorusMg: knownSubtotalOrNull(total.phosphorusMg),
      potassiumMg: knownSubtotalOrNull(total.potassiumMg),
      zincMg: knownSubtotalOrNull(total.zincMg),
      copperMg: knownSubtotalOrNull(total.copperMg),
      manganeseMg: knownSubtotalOrNull(total.manganeseMg),
      seleniumMcg: knownSubtotalOrNull(total.seleniumMcg),
      vitaminAMcg: knownSubtotalOrNull(total.vitaminAMcg),
      vitaminCMg: knownSubtotalOrNull(total.vitaminCMg),
      vitaminDMcg: knownSubtotalOrNull(total.vitaminDMcg),
      vitaminEMg: knownSubtotalOrNull(total.vitaminEMg),
      vitaminKMcg: knownSubtotalOrNull(total.vitaminKMcg),
      thiamineMg: knownSubtotalOrNull(total.thiamineMg),
      riboflavinMg: knownSubtotalOrNull(total.riboflavinMg),
      niacinMg: knownSubtotalOrNull(total.niacinMg),
      vitaminB6Mg: knownSubtotalOrNull(total.vitaminB6Mg),
      folateMcg: knownSubtotalOrNull(total.folateMcg),
      vitaminB12Mcg: knownSubtotalOrNull(total.vitaminB12Mcg),
      additionalNutrients: {
        energyKj: total.energyKj,
        nutrientForms,
        nutrientStates: Object.fromEntries(
          RECIPE_NUTRIENT_KEYS.map((key) => [key, total[key].status]),
        ) as Readonly<Record<RecipeNutrientKey, ScientificValueStatus>>,
      },
    };
  }

  const resultStatus = (
    output: RecipeNutritionOutput,
    available: boolean,
  ): RecipeNutritionResultStatus => {
    if (!available) return "UNAVAILABLE";
    return pendings.some(
      (pending) => pending.blocking && pending.affects.includes(output),
    )
      ? "PARTIAL"
      : "COMPLETE";
  };
  const outputStatus: Readonly<
    Record<RecipeNutritionOutput, RecipeNutritionResultStatus>
  > = {
    TOTAL: resultStatus("TOTAL", true),
    PER_SERVING: resultStatus("PER_SERVING", Boolean(perServing)),
    PER_100: resultStatus("PER_100", Boolean(per100)),
    CALCULATION_SNAPSHOT: resultStatus(
      "CALCULATION_SNAPSHOT",
      Boolean(calculationSnapshot),
    ),
    PERSISTED_SNAPSHOT: resultStatus(
      "PERSISTED_SNAPSHOT",
      Boolean(snapshotDraft),
    ),
  };

  return {
    complete,
    calculationStatus,
    outputStatus,
    ingredients,
    total,
    perServing,
    per100,
    per100Basis,
    totalNetIngredientQuantity,
    netIngredientQuantityByUnit,
    finalYield,
    servingSize,
    servings: validServings ? servings : null,
    pendings,
    calculationSnapshot,
    snapshotDraft,
  };
}

export function roundRecipeNutritionForPresentation(
  values: RecipeNutrientValues,
  decimalPlaces = 2,
): RecipeNutrientValues {
  const factor = 10 ** decimalPlaces;
  return Object.fromEntries(
    RECIPE_NUTRIENT_KEYS.map((key) => {
      const nutrient = values[key] ?? missingValue();
      return [
        key,
        nutrient.status === "VALUE" || nutrient.status === "PARTIAL"
          ? {
              status: nutrient.status,
              value: Math.round(nutrient.value * factor) / factor,
            }
          : nutrient,
      ];
    }),
  ) as unknown as RecipeNutrientValues;
}
