import { analyzeMealPlanNutrition } from "./plan-nutrition-analysis";
import {
  FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT,
  type FinalNutritionTargetMetric,
  type FinalNutritionTargetValues,
} from "./adequacy-engine";
import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  type MealPlanFoodNutrients,
  type MealPlanRecordMeal,
} from "./record";

export interface MealPlanProfessionalReview {
  readonly reviewedByUserId: string;
  readonly reviewedByName: string;
  readonly reviewedAt: string;
  readonly planRevision: number;
  readonly contentFingerprint: string;
  readonly acknowledgedLimitations: readonly string[];
  readonly statement: string;
}

export interface MealPlanTargetDeviation {
  readonly metric: FinalNutritionTargetMetric;
  readonly target: number;
  readonly planned: number;
  readonly absoluteDifference: number;
  readonly percentageDifference: number;
  readonly outsideTolerance: boolean;
}

export interface MealPlanTargetDeviationAuthorization {
  readonly authorizedByUserId: string;
  readonly authorizedByName: string;
  readonly authorizedAt: string;
  readonly planRevision: number;
  readonly tolerancePercent: number;
  readonly deviationFingerprint: string;
  readonly deviations: readonly MealPlanTargetDeviation[];
  readonly statement?: string;
}

export interface MealPlanCompletionEligibility {
  readonly allowed: boolean;
  readonly blockingReasons: readonly string[];
  readonly limitations: readonly string[];
  readonly requiresProfessionalReview: boolean;
}

const requiredMacros = [
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
] as const satisfies readonly (keyof MealPlanFoodNutrients)[];

export function calculateMealPlanTargetDeviations(input: {
  readonly target: FinalNutritionTargetValues;
  readonly actual: FinalNutritionTargetValues;
}): readonly MealPlanTargetDeviation[] {
  return ([
    "energyKcal",
    "proteinGrams",
    "carbohydratesGrams",
    "fatsGrams",
  ] as const).map((metric) => {
    const target = input.target[metric];
    const planned = input.actual[metric];
    const difference = planned - target;
    const percentageDifference = target > 0
      ? (difference / target) * 100
      : Number.NaN;
    return {
      metric,
      target,
      planned,
      absoluteDifference: Math.abs(difference),
      percentageDifference,
      outsideTolerance:
        Number.isFinite(percentageDifference) &&
        Math.abs(percentageDifference) >
          FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT,
    };
  });
}

export function mealPlanTargetDeviationFingerprint(
  deviations: readonly MealPlanTargetDeviation[],
) {
  return JSON.stringify(deviations.map((deviation) => ({
    metric: deviation.metric,
    target: deviation.target,
    planned: deviation.planned,
    absoluteDifference: deviation.absoluteDifference,
    percentageDifference: deviation.percentageDifference,
    outsideTolerance: deviation.outsideTolerance,
  })));
}

export function targetDeviationAuthorizationMatches(input: {
  readonly authorization?: MealPlanTargetDeviationAuthorization;
  readonly deviations: readonly MealPlanTargetDeviation[];
}) {
  return Boolean(
    input.authorization &&
      input.authorization.tolerancePercent ===
        FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT &&
      input.authorization.deviationFingerprint ===
        mealPlanTargetDeviationFingerprint(input.deviations) &&
      JSON.stringify(input.authorization.deviations) ===
        JSON.stringify(input.deviations),
  );
}

export function mealPlanContentFingerprint(meals: readonly MealPlanRecordMeal[]) {
  // Não é assinatura criptográfica: é uma identidade determinística para invalidar
  // a revisão quando qualquer conteúdo nutricional prescrito muda.
  return JSON.stringify(meals.map((meal) => ({
    id: meal.id,
    name: meal.name,
    order: meal.order,
    time: meal.time,
    items: meal.items.map((item) =>
      isMealPlanRecipeItem(item)
        ? {
            type: "RECIPE",
            id: item.id,
            snapshotId: item.recipeNutritionSnapshotId,
            snapshotVersion: item.recipeNutritionSnapshotVersion,
            portion: item.portion,
            nutrients: item.prescribedNutrients,
            missing: item.missingNutrients,
            partial: item.partialNutrients ?? [],
          }
        : {
            type: "FOOD",
            id: item.id,
            catalogFoodId: item.catalogFoodId,
            quantity: item.quantity,
            grams: item.grams,
            prescribedAmount: item.prescribedAmount,
            prescribedUnit: item.prescribedUnit,
            measure: item.householdMeasure,
            nutrients: item.nutrients,
            substitutions: item.substitutions,
          },
    ),
  })));
}

export function professionalReviewMatches(input: {
  readonly review?: MealPlanProfessionalReview;
  readonly meals: readonly MealPlanRecordMeal[];
  readonly planRevision: number;
}) {
  return Boolean(
    input.review &&
      input.review.planRevision === input.planRevision &&
      input.review.contentFingerprint === mealPlanContentFingerprint(input.meals),
  );
}

export function evaluateMealPlanCompletion(input: {
  readonly meals: readonly MealPlanRecordMeal[];
  readonly planRevision: number;
  readonly review?: MealPlanProfessionalReview;
  readonly targetDeviations?: readonly MealPlanTargetDeviation[];
  readonly targetDeviationAuthorization?: MealPlanTargetDeviationAuthorization;
  readonly additionalBlockingReasons?: readonly string[];
}): MealPlanCompletionEligibility {
  const blockingReasons = [...(input.additionalBlockingReasons ?? [])];
  const itemCount = input.meals.reduce((sum, meal) => sum + meal.items.length, 0);
  if (!itemCount) blockingReasons.push("Adicione ao menos um alimento ou receita antes de concluir.");

  for (const meal of input.meals) {
    for (const item of meal.items) {
      if (isMealPlanFoodItem(item)) {
        if (
          !Number.isFinite(item.quantity) || item.quantity <= 0 ||
          !Number.isFinite(item.grams) || item.grams <= 0 ||
          !item.householdMeasure.trim()
        ) blockingReasons.push(`Revise quantidade, conversão e medida de ${item.description}.`);
        if (item.substitutions.some((substitution) => substitution.needsProfessionalReview)) {
          blockingReasons.push(`Confira novamente as alternativas de ${item.description} após a alteração da quantidade prescrita.`);
        }
      } else if (
        !item.recipeNutritionSnapshotId ||
        !Number.isInteger(item.recipeNutritionSnapshotVersion) ||
        item.recipeNutritionSnapshotVersion <= 0 ||
        !Number.isFinite(item.portion.prescribedServings) ||
        item.portion.prescribedServings <= 0 ||
        !Number.isFinite(item.portion.recipeServings) ||
        item.portion.recipeServings <= 0
      ) {
        blockingReasons.push(`Revise a quantidade, conversão e integridade do snapshot de ${item.recipeTitle}.`);
      }
    }
  }

  const analysis = analyzeMealPlanNutrition(input.meals);
  for (const nutrient of requiredMacros) {
    if (analysis.nutrients[nutrient].coverage !== "COMPLETE") {
      blockingReasons.push(`${nutrient === "energyKcal" ? "Energia" : nutrient === "proteinGrams" ? "Proteínas" : nutrient === "carbohydratesGrams" ? "Carboidratos" : "Gorduras"} deve estar completa em todos os itens.`);
    }
  }

  const invalidTargetComparison = (input.targetDeviations ?? []).some(
    (deviation) =>
      !Number.isFinite(deviation.target) ||
      deviation.target <= 0 ||
      !Number.isFinite(deviation.planned) ||
      deviation.planned < 0 ||
      !Number.isFinite(deviation.absoluteDifference) ||
      !Number.isFinite(deviation.percentageDifference),
  );
  if (invalidTargetComparison) {
    blockingReasons.push(
      "Revise as metas e os totais nutricionais: a comparação técnica não pôde ser calculada com valores válidos.",
    );
  }
  const deviationsOutsideTolerance = (input.targetDeviations ?? []).filter(
    (deviation) => deviation.outsideTolerance,
  );
  if (
    !invalidTargetComparison &&
    deviationsOutsideTolerance.length > 0 &&
    !targetDeviationAuthorizationMatches({
      authorization: input.targetDeviationAuthorization,
      deviations: input.targetDeviations ?? [],
    })
  ) {
    blockingReasons.push(
      "Escolha ajustar o plano ou autorize explicitamente a continuidade com os valores fora da meta.",
    );
  }

  const limitations = Object.values(analysis.nutrients)
    .filter((nutrient) => !requiredMacros.includes(nutrient.nutrient as typeof requiredMacros[number]) && nutrient.coverage !== "COMPLETE")
    .map((nutrient) => `${nutrient.nutrient}: composição ${nutrient.coverage === "PARTIAL" ? "parcial" : "ausente"}`);
  const requiresProfessionalReview = itemCount > 0;
  if (
    requiresProfessionalReview &&
    !professionalReviewMatches({ review: input.review, meals: input.meals, planRevision: input.planRevision })
  ) {
    blockingReasons.push(limitations.length
      ? "Registre a revisão profissional explícita das limitações nutricionais antes de concluir."
      : "Registre a revisão profissional explícita do plano antes de concluir.");
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
    limitations,
    requiresProfessionalReview,
  };
}
