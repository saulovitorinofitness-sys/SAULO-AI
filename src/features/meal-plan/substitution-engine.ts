import {
  calculateNutrientsForGrams,
} from "@/features/food-database/calculations";
import type {
  FoodNutrientsPer100g,
  ProfessionalFood,
} from "@/features/food-database/contracts";
import {
  normalizeFoodSearchText,
} from "@/features/food-database/normalization";
import {
  isMealPlanFoodItem,
  type MealPlanIbgeMeasureOption,
  type MealPlanNutritionValues,
  type MealPlanRecordFood,
  type MealPlanRecordMeal,
} from "./record";
import {
  calculateFoodNutrientsForGrams,
} from "./nutrition-calculations";
import {
  createMealPlanFoodFromMaster,
  selectIbgeMeasureForDisplay,
} from "./food-snapshot";

export function chooseReplacementMeasure(
  options: readonly MealPlanIbgeMeasureOption[],
  currentMeasureName?: string,
  suggestedMeasureName?: string,
  suggestedGrams?: number,
  preservedQuantity = 1,
) {
  const findByName = (name?: string) =>
    name
      ? options.find(
          (option) =>
            normalizeFoodSearchText(option.measureName) ===
            normalizeFoodSearchText(name),
        )
      : undefined;
  const currentMeasure = findByName(currentMeasureName);
  if (currentMeasure) return currentMeasure;
  const suggestedMeasure = findByName(suggestedMeasureName);
  if (suggestedMeasure) return suggestedMeasure;
  if (suggestedGrams && suggestedGrams > 0) {
    return [...options].sort(
      (left, right) =>
        Math.abs(left.amountPerMeasure * preservedQuantity - suggestedGrams) -
          Math.abs(right.amountPerMeasure * preservedQuantity - suggestedGrams) ||
        left.measureName.localeCompare(right.measureName, "pt-BR"),
    )[0];
  }
  return options[0];
}

export type SubstitutionAdjustmentMode =
  | "KEEP_GRAMS"
  | "AUTO_ADJUST";

export interface FoodEquivalenceDefinition {
  readonly sourceFoodId: string;
  readonly targetFoodId: string;
  readonly priority: number;
  readonly category?: string;
  readonly restrictions: readonly string[];
  readonly score: number;
}

export interface NutritionalEquivalenceContext {
  readonly foodPreferences: readonly string[];
  readonly clinicalRestrictions: readonly string[];
  readonly intolerances: readonly string[];
  readonly allergies: readonly string[];
  readonly dietaryPattern?:
    | "OMNIVORE"
    | "VEGETARIAN"
    | "VEGAN";
  readonly religiousRestrictions: readonly string[];
  readonly maximumEstimatedCost?: number;
}

export interface NutritionalEquivalenceScore {
  readonly total: number;
  readonly group: number;
  readonly nutritionalFunction: number;
  readonly strategy: number;
  readonly objective: number;
  readonly energy: number;
  readonly carbohydrates: number;
  readonly protein: number;
  readonly fats: number;
  readonly fiber: number;
}

export interface NutritionalEquivalent {
  readonly food: ProfessionalFood;
  readonly suggestedGrams: number;
  readonly suggestedQuantity: number;
  readonly suggestedHouseholdMeasure: string;
  readonly nutrition: FoodNutrientsPer100g;
  readonly score: NutritionalEquivalenceScore;
  readonly adjustmentBasis: "REGISTERED_MEASURE" | "NUTRITIONAL_MATCH";
  readonly suggestionReason: string;
}

export interface NutritionalEquivalencePlanContext {
  readonly target: MealPlanNutritionValues;
  readonly currentTotals: MealPlanNutritionValues;
  readonly objective?: string;
}

export function createMealPlanSubstitutionReplacement(input: {
  readonly current: MealPlanRecordFood;
  readonly candidate: ProfessionalFood;
  readonly equivalent: NutritionalEquivalent;
  readonly measureOptions: readonly MealPlanIbgeMeasureOption[];
  readonly replacementId: string;
}) {
  const base = createMealPlanFoodFromMaster(
    input.candidate,
    input.replacementId,
    { allowAnyActiveMasterFood: true },
  );
  if (!base) return null;
  const currentMeasureName = input.current.selectedIbgeMeasureId
    ? input.current.ibgeMeasureOptions?.find(
        (option) => option.id === input.current.selectedIbgeMeasureId,
      )?.measureName
    : input.current.householdMeasure;
  const preservedQuantity = input.current.quantity > 0
    ? input.current.quantity
    : 1;
  const prescribedUnit =
    input.candidate.referenceServingUnit === "ml" ? "ml" as const : "g" as const;
  const compatibleMeasureOptions = input.measureOptions.filter(
    (option) => option.unit === prescribedUnit,
  );
  const selectedMeasure = chooseReplacementMeasure(
    compatibleMeasureOptions,
    currentMeasureName,
    input.equivalent.suggestedHouseholdMeasure,
    input.equivalent.suggestedGrams,
    preservedQuantity,
  );
  const selected = { ...base, ibgeMeasureOptions: compatibleMeasureOptions };
  const equivalentMeasureQuantity = selectedMeasure
    ? input.equivalent.suggestedGrams / selectedMeasure.amountPerMeasure
    : null;
  const measured = selectedMeasure
    ? selectIbgeMeasureForDisplay(
        {
          ...selected,
          quantity:
            equivalentMeasureQuantity !== null &&
            Number.isFinite(equivalentMeasureQuantity) &&
            equivalentMeasureQuantity > 0
              ? equivalentMeasureQuantity
              : preservedQuantity,
        },
        selectedMeasure.id,
      )
    : null;
  if (measured) {
    const calculationAmount = measured.prescribedAmount ?? measured.grams;
    return input.candidate.referenceServingUnit === "ml"
      ? {
          ...measured,
          grams: calculationAmount,
          nutrients: calculateFoodNutrientsForGrams(
            measured.nutrientsPer100g,
            calculationAmount,
          ),
        }
      : measured;
  }
  return {
    ...selected,
    quantity: 1,
    grams: input.equivalent.suggestedGrams,
    prescribedAmount: input.equivalent.suggestedGrams,
    prescribedUnit,
    nutrients: calculateFoodNutrientsForGrams(
      selected.nutrientsPer100g,
      input.equivalent.suggestedGrams,
    ),
  };
}

export function createNutritionalEquivalenceContext(input: {
  readonly foodPreferences: readonly string[];
  readonly clinicalRestrictions: readonly string[];
  readonly allergies: readonly string[];
}): NutritionalEquivalenceContext {
  return {
    foodPreferences: input.foodPreferences,
    clinicalRestrictions: input.clinicalRestrictions,
    allergies: input.allergies,
    intolerances: [],
    religiousRestrictions: [],
  };
}

export interface SubstitutionNutritionSnapshot {
  readonly grams: number;
  readonly energyKcal: number;
  readonly proteinGrams: number;
  readonly carbohydratesGrams: number;
  readonly fatsGrams: number;
  readonly fiberGrams: number;
}

export interface SubstitutionProposal {
  readonly food: ProfessionalFood;
  readonly grams: number;
  readonly measureName: string;
  readonly measureGrams: number;
  readonly nutrition: FoodNutrientsPer100g;
  readonly adjustmentBasis: "GRAMS" | "PROTEIN" | "ENERGY";
}

// Estrutura preparada para equivalências profissionais futuras.
// Nenhuma equivalência clínica é presumida nesta Sprint.
export const foodEquivalenceDefinitions:
  readonly FoodEquivalenceDefinition[] = [];

function searchableText(food: ProfessionalFood) {
  return normalizeFoodSearchText(
    [
      food.officialName,
      ...food.synonyms,
      food.category,
      food.foodGroup,
      food.source.name,
      food.source.kind,
      food.preparationState,
      food.presentation,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function searchSubstitutionFoods(
  foods: readonly ProfessionalFood[],
  query: string,
  currentFoodId?: string,
) {
  const normalizedQuery = normalizeFoodSearchText(query);
  return foods.filter(
    (food) =>
      food.status === "ACTIVE" &&
      food.id !== currentFoodId &&
      (!normalizedQuery || searchableText(food).includes(normalizedQuery)),
  );
}

function recommendationScore(
  current: ProfessionalFood,
  candidate: ProfessionalFood,
  equivalences: readonly FoodEquivalenceDefinition[],
) {
  const equivalence = equivalences.find(
    (item) =>
      item.sourceFoodId === current.id &&
      item.targetFoodId === candidate.id,
  );
  let score = equivalence
    ? 1000 + equivalence.priority * 10 + equivalence.score
    : 0;

  if (candidate.foodGroup === current.foodGroup) score += 100;
  if (candidate.category === current.category) score += 60;
  if (candidate.nutrients) score += 20;
  if (
    current.preparationState &&
    candidate.preparationState === current.preparationState
  ) {
    score += 10;
  }

  if (current.nutrients && candidate.nutrients) {
    const proteinDifference = Math.abs(
      (current.nutrients.proteinGrams ?? 0) -
        (candidate.nutrients.proteinGrams ?? 0),
    );
    const energyDifference = Math.abs(
      (current.nutrients.energyKcal ?? 0) -
        (candidate.nutrients.energyKcal ?? 0),
    );
    score += Math.max(0, 30 - proteinDifference);
    score += Math.max(0, 20 - energyDifference / 10);
  }

  return score;
}

const equivalenceWeights = {
  energyKcal: 0.35,
  carbohydratesGrams: 0.25,
  proteinGrams: 0.18,
  fatsGrams: 0.12,
  fiberGrams: 0.1,
} as const;

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function proximity(target: number, candidate: number) {
  const reference = Math.max(Math.abs(target), 1);
  return Math.max(0, 1 - Math.min(1, Math.abs(candidate - target) / reference));
}

function hasComparableNutrition(food: ProfessionalFood) {
  const nutrients = food.nutrients;
  return Boolean(
    nutrients &&
      nutrients.energyKcal !== null &&
      nutrients.energyKcal > 0 &&
      [
        nutrients.carbohydratesGrams,
        nutrients.proteinGrams,
        nutrients.fatsGrams,
      ].some((value) => value !== null),
  );
}

function equivalentGroup(
  current: ProfessionalFood,
  candidate: ProfessionalFood,
  definitions: readonly FoodEquivalenceDefinition[],
) {
  return (
    candidate.foodGroup === current.foodGroup ||
    candidate.category === current.category ||
    inferNutritionalFunction(candidate) === inferNutritionalFunction(current) ||
    definitions.some(
      (item) =>
        item.sourceFoodId === current.id &&
        item.targetFoodId === candidate.id,
    )
  );
}

export type NutritionalFunction =
  | "FRUIT"
  | "STARCH"
  | "ANIMAL_PROTEIN"
  | "MILK_OR_ALTERNATIVE"
  | "VEGETABLE"
  | "FAT"
  | "OTHER";

/** Usa somente o cadastro e a composição para identificar a função nutricional. */
export function inferNutritionalFunction(food: ProfessionalFood): NutritionalFunction {
  const text = searchableText(food);
  if (/\b(fruta|frutas)\b/.test(text)) return "FRUIT";
  if (/\bqueijo\b/.test(text)) return "ANIMAL_PROTEIN";
  if (
    /\b(leite|lactea|lacteo|iogurte|bebida vegetal)\b/.test(text) ||
    /\bbebida (de|a base de) (soja|aveia|amendoa|arroz|coco)\b/.test(text)
  ) return "MILK_OR_ALTERNATIVE";
  if (/\b(carne|carnes|frango|galinha|peixe|pescado|ovo|ovos)\b/.test(text)) {
    return "ANIMAL_PROTEIN";
  }
  if (/\b(hortalica|hortalicas|verdura|verduras|legume|legumes)\b/.test(text)) {
    return "VEGETABLE";
  }
  if (/\b(oleo|azeite|gordura|manteiga)\b/.test(text)) return "FAT";
  if (/\b(cereal|cereais|arroz|massa|massas|macarrao|farinha|tuberculo|tuberculos)\b/.test(text)) {
    return "STARCH";
  }
  const nutrients = food.nutrients;
  if (nutrients) {
    const proteinEnergy = (nutrients.proteinGrams ?? 0) * 4;
    const carbohydrateEnergy = (nutrients.carbohydratesGrams ?? 0) * 4;
    const fatEnergy = (nutrients.fatsGrams ?? 0) * 9;
    if (proteinEnergy >= carbohydrateEnergy && proteinEnergy >= fatEnergy) {
      return "ANIMAL_PROTEIN";
    }
    if (carbohydrateEnergy >= proteinEnergy && carbohydrateEnergy >= fatEnergy) {
      return "STARCH";
    }
    if (fatEnergy > 0) return "FAT";
  }
  return "OTHER";
}

function preparationClass(food: ProfessionalFood) {
  const text = searchableText(food);
  if (/\b(cru|crua|in natura)\b/.test(text)) return "RAW";
  if (/\b(cozido|cozida)\b/.test(text)) return "COOKED";
  if (/\b(grelhado|grelhada)\b/.test(text)) return "GRILLED";
  if (/\b(assado|assada)\b/.test(text)) return "ROASTED";
  if (/\b(frito|frita)\b/.test(text)) return "FRIED";
  return undefined;
}

function hasCompatiblePreparation(current: ProfessionalFood, candidate: ProfessionalFood) {
  const currentPreparation = preparationClass(current);
  const candidatePreparation = preparationClass(candidate);
  return !currentPreparation || !candidatePreparation || currentPreparation === candidatePreparation;
}

const clinicalTermStopWords = new Set([
  "a",
  "ao",
  "aos",
  "alergia",
  "alergico",
  "com",
  "de",
  "do",
  "dos",
  "e",
  "evita",
  "evitar",
  "gosta",
  "intolerancia",
  "intolerante",
  "nao",
  "prefere",
  "preferencia",
  "paciente",
  "recusa",
  "recusou",
  "recusado",
  "restricao",
  "sem",
]);

function clinicalTerms(values: readonly string[]) {
  return values
    .flatMap((value) => value.split(/[\n,;.!]+/))
    .map((value) =>
      normalizeFoodSearchText(value)
        .split(/\s+/)
        .filter(
          (token) =>
            token.length >= 3 && !clinicalTermStopWords.has(token),
        ),
    )
    .filter((tokens) => tokens.length > 0);
}

function preferenceContext(values: readonly string[]) {
  const refusalMarkers = [
    "nao",
    "recusa",
    "recusou",
    "recusado",
    "evita",
    "evitou",
    "sem",
  ];
  const preferred: string[] = [];
  const refused: string[] = [];
  for (const part of values.flatMap((value) => value.split(/[\n,;.!]+/))) {
    const normalized = normalizeFoodSearchText(part);
    const words = normalized.split(/\s+/);
    (refusalMarkers.some((marker) => words.includes(marker))
      ? refused
      : preferred
    ).push(part);
  }
  return { preferred: clinicalTerms(preferred), refused: clinicalTerms(refused) };
}

function matchesClinicalTerms(food: ProfessionalFood, terms: readonly string[][]) {
  const text = searchableText(food);
  return terms.some((tokens) => tokens.some((token) => text.includes(token)));
}

export function isFoodCompatibleWithClinicalContext(
  food: ProfessionalFood,
  context: NutritionalEquivalenceContext,
) {
  const preferences = preferenceContext(context.foodPreferences);
  const exclusions = [
    ...clinicalTerms(context.allergies),
    ...clinicalTerms(context.intolerances),
    ...clinicalTerms(context.clinicalRestrictions),
    ...clinicalTerms(context.religiousRestrictions),
    ...preferences.refused,
  ];
  return !matchesClinicalTerms(food, exclusions);
}

function registeredMeasure(food: ProfessionalFood) {
  return (
    food.householdMeasures.find(
      (measure) =>
        measure.active &&
        measure.isDefault &&
        measure.quantity > 0 &&
        measure.grams > 0,
    ) ??
    food.householdMeasures.find(
      (measure) => measure.active && measure.quantity > 0 && measure.grams > 0,
    )
  );
}

function nutritionProximity(
  target: MealPlanNutritionValues,
  actual: MealPlanNutritionValues,
) {
  return (
    proximity(target.energyKcal, actual.energyKcal) *
      equivalenceWeights.energyKcal +
    proximity(target.carbohydratesGrams, actual.carbohydratesGrams) *
      equivalenceWeights.carbohydratesGrams +
    proximity(target.proteinGrams, actual.proteinGrams) *
      equivalenceWeights.proteinGrams +
    proximity(target.fatsGrams, actual.fatsGrams) *
      equivalenceWeights.fatsGrams +
    proximity(target.fiberGrams, actual.fiberGrams) *
      equivalenceWeights.fiberGrams
  );
}

function comparableNutritionValues(
  nutrition: FoodNutrientsPer100g,
): MealPlanNutritionValues {
  return {
    energyKcal: nutrition.energyKcal ?? 0,
    proteinGrams: nutrition.proteinGrams ?? 0,
    carbohydratesGrams: nutrition.carbohydratesGrams ?? 0,
    fatsGrams: nutrition.fatsGrams ?? 0,
    fiberGrams: nutrition.fiberGrams ?? 0,
  };
}

function nutritionallyMatchedGrams(
  target: MealPlanNutritionValues,
  candidate: ProfessionalFood,
  fallbackGrams: number,
) {
  const nutrients = candidate.nutrients!;
  const portions = [fallbackGrams];
  for (const key of Object.keys(equivalenceWeights) as (keyof typeof equivalenceWeights)[]) {
    const targetValue = target[key];
    const per100 = nutrients[key] ?? 0;
    if (targetValue > 0 && per100 > 0) portions.push((targetValue / per100) * 100);
  }
  return portions
    .map((grams) => Math.min(5_000, Math.max(1, grams)))
    .map((grams) => ({
      grams,
      score: nutritionProximity(
        target,
        comparableNutritionValues(calculateNutrientsForGrams(nutrients, grams)),
      ),
    }))
    .sort((left, right) => right.score - left.score || left.grams - right.grams)[0]!.grams;
}

function objectiveCompatibility(
  objective: string | undefined,
  scores: {
    readonly equivalence: number;
    readonly energy: number;
    readonly protein: number;
    readonly fiber: number;
  },
) {
  switch (objective) {
    case "WEIGHT_LOSS":
      return scores.energy * 0.6 + scores.fiber * 0.4;
    case "HYPERTROPHY":
    case "PERFORMANCE":
    case "WEIGHT_GAIN":
      return scores.protein * 0.65 + scores.energy * 0.35;
    case "HEALTH":
    case "FOOD_REEDUCATION":
      return scores.equivalence * 0.6 + scores.fiber * 0.4;
    default:
      return scores.equivalence;
  }
}

function objectiveReason(objective: string) {
  const labels: Readonly<Record<string, string>> = {
    WEIGHT_LOSS: "Compatível com a estratégia de emagrecimento.",
    HYPERTROPHY: "Compatível com a estratégia de hipertrofia.",
    PERFORMANCE: "Compatível com o objetivo de performance.",
    WEIGHT_GAIN: "Compatível com a estratégia de ganho de peso.",
    FOOD_REEDUCATION: "Compatível com a reeducação alimentar.",
    MAINTENANCE: "Compatível com o objetivo de manutenção.",
    HEALTH: "Compatível com o objetivo de saúde.",
  };
  return labels[objective] ?? "Compatível com o objetivo e a Estratégia Nutricional.";
}

function suggestionReason(input: {
  readonly currentFood: ProfessionalFood;
  readonly candidate: ProfessionalFood;
  readonly currentNutrition: MealPlanNutritionValues;
  readonly candidateNutrition: FoodNutrientsPer100g;
  readonly context?: NutritionalEquivalenceContext;
  readonly planContext?: NutritionalEquivalencePlanContext;
}) {
  const reasons: string[] = [];
  const preferences = preferenceContext(input.context?.foodPreferences ?? []);
  if (matchesClinicalTerms(input.currentFood, preferences.refused)) {
    reasons.push(`Paciente recusou ${input.currentFood.officialName}.`);
  }
  if (input.candidate.foodGroup === input.currentFood.foodGroup) {
    reasons.push("Mesmo grupo alimentar.");
  } else if (input.candidate.category === input.currentFood.category) {
    reasons.push("Mesma categoria alimentar.");
  } else {
    reasons.push("Mesma função nutricional.");
  }
  if (input.planContext?.objective) {
    reasons.push(objectiveReason(input.planContext.objective));
  }
  const proteinDeficit = input.planContext
    ? input.planContext.target.proteinGrams -
      input.planContext.currentTotals.proteinGrams
    : 0;
  if (
    proteinDeficit > 0 &&
    (input.candidateNutrition.proteinGrams ?? 0) >
      input.currentNutrition.proteinGrams
  ) {
    reasons.push("Melhor distribuição proteica.");
  }
  if (
    (input.candidateNutrition.fiberGrams ?? 0) >
    input.currentNutrition.fiberGrams
  ) {
    reasons.push("Maior teor de fibras.");
  }
  return reasons.join(" ");
}

/**
 * Classificação determinística de equivalentes.
 *
 * Cada candidato usa uma medida caseira ativa registrada no catálogo. A
 * proximidade nutricional considera a porção atual e, quando disponível, o
 * efeito projetado sobre as metas da Estratégia Nutricional.
 */
export function rankNutritionalEquivalents(input: {
  readonly currentFood: ProfessionalFood;
  readonly currentGrams: number;
  readonly candidates: readonly ProfessionalFood[];
  readonly definitions?: readonly FoodEquivalenceDefinition[];
  readonly context?: NutritionalEquivalenceContext;
  readonly planContext?: NutritionalEquivalencePlanContext;
  readonly limit?: number;
}): readonly NutritionalEquivalent[] {
  const {
    currentFood,
    currentGrams,
    candidates,
    definitions = foodEquivalenceDefinitions,
    context,
    planContext,
    limit = 8,
  } = input;
  if (
    !hasComparableNutrition(currentFood) ||
    currentFood.source.origin === "DEMONSTRATIVE" ||
    currentGrams <= 0
  ) {
    return [];
  }

  const currentNutrition = comparableNutritionValues(
    calculateNutrientsForGrams(currentFood.nutrients!, currentGrams),
  );
  const preferences = preferenceContext(context?.foodPreferences ?? []);

  return candidates
    .filter(
      (candidate) =>
        candidate.id !== currentFood.id &&
        candidate.status === "ACTIVE" &&
        candidate.source.origin !== "DEMONSTRATIVE" &&
        hasComparableNutrition(candidate) &&
        (!context || isFoodCompatibleWithClinicalContext(candidate, context)) &&
        equivalentGroup(currentFood, candidate, definitions) &&
        hasCompatiblePreparation(currentFood, candidate),
    )
    .map((food): NutritionalEquivalent => {
      const measure = registeredMeasure(food);
      const suggestedGrams = rounded(
        nutritionallyMatchedGrams(currentNutrition, food, currentGrams),
      );
      const nutrition = calculateNutrientsForGrams(
        food.nutrients!,
        suggestedGrams,
      );
      const energy = proximity(
        currentNutrition.energyKcal ?? 0,
        nutrition.energyKcal ?? 0,
      );
      const carbohydrates = proximity(
        currentNutrition.carbohydratesGrams ?? 0,
        nutrition.carbohydratesGrams ?? 0,
      );
      const protein = proximity(
        currentNutrition.proteinGrams ?? 0,
        nutrition.proteinGrams ?? 0,
      );
      const fats = proximity(
        currentNutrition.fatsGrams ?? 0,
        nutrition.fatsGrams ?? 0,
      );
      const fiber = proximity(
        currentNutrition.fiberGrams ?? 0,
        nutrition.fiberGrams ?? 0,
      );
      const equivalenceScore =
        energy * equivalenceWeights.energyKcal +
        carbohydrates * equivalenceWeights.carbohydratesGrams +
        protein * equivalenceWeights.proteinGrams +
        fats * equivalenceWeights.fatsGrams +
        fiber * equivalenceWeights.fiberGrams;
      const projectedScore = planContext
        ? nutritionProximity(planContext.target, {
            energyKcal:
              Math.max(
                0,
                planContext.currentTotals.energyKcal -
                  (currentNutrition.energyKcal ?? 0),
              ) + (nutrition.energyKcal ?? 0),
            proteinGrams:
              Math.max(
                0,
                planContext.currentTotals.proteinGrams -
                  (currentNutrition.proteinGrams ?? 0),
              ) + (nutrition.proteinGrams ?? 0),
            carbohydratesGrams:
              Math.max(
                0,
                planContext.currentTotals.carbohydratesGrams -
                  (currentNutrition.carbohydratesGrams ?? 0),
              ) + (nutrition.carbohydratesGrams ?? 0),
            fatsGrams:
              Math.max(
                0,
                planContext.currentTotals.fatsGrams -
                  (currentNutrition.fatsGrams ?? 0),
              ) + (nutrition.fatsGrams ?? 0),
            fiberGrams:
              Math.max(
                0,
                planContext.currentTotals.fiberGrams -
                  (currentNutrition.fiberGrams ?? 0),
              ) + (nutrition.fiberGrams ?? 0),
          })
        : equivalenceScore;
      const preferenceBonus = matchesClinicalTerms(
        food,
        preferences.preferred,
      )
        ? 5
        : 0;
      const group = food.foodGroup === currentFood.foodGroup
        ? 1
        : food.category === currentFood.category
          ? 0.85
          : 0;
      const nutritionalFunction =
        inferNutritionalFunction(food) === inferNutritionalFunction(currentFood)
          ? 1
          : 0;
      const structuralScore = group * 0.55 + nutritionalFunction * 0.45;
      const objectiveScore = objectiveCompatibility(planContext?.objective, {
        equivalence: equivalenceScore,
        energy,
        protein,
        fiber,
      });
      return {
        food,
        suggestedGrams,
        suggestedQuantity: measure
          ? rounded(suggestedGrams / (measure.grams / measure.quantity), 2)
          : 1,
        suggestedHouseholdMeasure: measure?.name ?? "gramas",
        nutrition,
        adjustmentBasis: measure ? "REGISTERED_MEASURE" : "NUTRITIONAL_MATCH",
        suggestionReason: suggestionReason({
          currentFood,
          candidate: food,
          currentNutrition,
          candidateNutrition: nutrition,
          context,
          planContext,
        }),
        score: {
          total: rounded(
            Math.min(
              100,
              100 * (
                equivalenceScore * 0.5 +
                projectedScore * 0.25 +
                structuralScore * 0.15 +
                objectiveScore * 0.1
              ) +
                preferenceBonus,
            ),
          ),
          group: rounded(group * 100),
          nutritionalFunction: rounded(nutritionalFunction * 100),
          strategy: rounded(projectedScore * 100),
          objective: rounded(objectiveScore * 100),
          energy: rounded(energy * 100),
          carbohydrates: rounded(carbohydrates * 100),
          protein: rounded(protein * 100),
          fats: rounded(fats * 100),
          fiber: rounded(fiber * 100),
        },
      };
    })
    .sort(
      (left, right) =>
        right.score.total - left.score.total ||
        left.food.officialName.localeCompare(
          right.food.officialName,
          "pt-BR",
        ),
    )
    .slice(0, Math.max(1, limit));
}

export function replaceMealPlanFood(input: {
  readonly meals: readonly MealPlanRecordMeal[];
  readonly mealId: string;
  readonly foodId: string;
  readonly replacement: MealPlanRecordFood;
  readonly substitutionId: string;
  readonly occurredAt: string;
  readonly responsibleUser?: string;
  readonly suggestionReason?: string;
}): readonly MealPlanRecordMeal[] {
  return input.meals.map((meal) => {
    if (meal.id !== input.mealId) return meal;
    return {
      ...meal,
      items: meal.items.map((item) =>
        item.id !== input.foodId || !isMealPlanFoodItem(item)
          ? item
          : {
              ...input.replacement,
              id: item.id,
              substitutions: [
                ...item.substitutions,
                {
                  id: input.substitutionId,
                  replacedFoodId: item.catalogFoodId,
                  replacedDescription: item.description,
                  replacementFoodId: input.replacement.catalogFoodId,
                  replacementDescription: input.replacement.description,
                  occurredAt: input.occurredAt,
                  responsibleUser: input.responsibleUser,
                  suggestionReason: input.suggestionReason,
                },
              ],
            },
      ),
    };
  });
}

export function attachMealPlanFoodSubstitution(input: {
  readonly meals: readonly MealPlanRecordMeal[];
  readonly mealId: string;
  readonly foodId: string;
  readonly replacement: MealPlanRecordFood;
  readonly substitutionId: string;
  readonly occurredAt: string;
  readonly responsibleUser?: string;
  readonly suggestionReason?: string;
}): readonly MealPlanRecordMeal[] {
  const replacementMeasure = input.replacement.selectedIbgeMeasureId
    ? input.replacement.ibgeMeasureOptions?.find(
        (option) => option.id === input.replacement.selectedIbgeMeasureId,
      )
    : undefined;
  return input.meals.map((meal) => meal.id !== input.mealId ? meal : ({
    ...meal,
    items: meal.items.map((item) => {
      if (item.id !== input.foodId || !isMealPlanFoodItem(item)) return item;
      return {
        ...item,
        substitutions: [...item.substitutions, {
          id: input.substitutionId,
          replacedFoodId: item.catalogFoodId,
          replacedDescription: item.description,
          replacementFoodId: input.replacement.catalogFoodId,
          replacementDescription: input.replacement.description,
          occurredAt: input.occurredAt,
          responsibleUser: input.responsibleUser,
          suggestionReason: input.suggestionReason,
          equivalenceCriterion: "ENERGY_AND_MACRONUTRIENTS" as const,
          originalPrescribedAmount: item.prescribedAmount ?? item.grams,
          originalPrescribedUnit: item.prescribedUnit ?? "g",
          replacementQuantity: input.replacement.quantity,
          replacementPrescribedAmount: input.replacement.prescribedAmount ?? input.replacement.grams,
          replacementPrescribedUnit: input.replacement.prescribedUnit ?? "g",
          replacementHouseholdMeasure:
            replacementMeasure?.label ?? input.replacement.householdMeasure,
          needsProfessionalReview: false,
        }],
      };
    }),
  }));
}

export function recalculateMealPlanSubstitutions(
  previous: MealPlanRecordFood,
  next: MealPlanRecordFood,
): MealPlanRecordFood {
  const previousAmount = previous.prescribedAmount ?? previous.grams;
  const nextAmount = next.prescribedAmount ?? next.grams;
  return {
    ...next,
    substitutions: next.substitutions.map((substitution) => {
      if (
        !substitution.originalPrescribedAmount ||
        !substitution.replacementPrescribedAmount ||
        !Number.isFinite(previousAmount) || previousAmount <= 0 ||
        (previous.prescribedUnit ?? "g") !== (next.prescribedUnit ?? "g")
      ) return { ...substitution, needsProfessionalReview: true };
      const factor = nextAmount / substitution.originalPrescribedAmount;
      return {
        ...substitution,
        originalPrescribedAmount: nextAmount,
        replacementPrescribedAmount: Math.round(substitution.replacementPrescribedAmount * factor * 100) / 100,
        replacementQuantity: substitution.replacementQuantity === undefined
          ? undefined
          : Math.round(substitution.replacementQuantity * factor * 100) / 100,
        needsProfessionalReview: true,
      };
    }),
  };
}

export function recommendSubstitutionFoods(
  current: ProfessionalFood,
  foods: readonly ProfessionalFood[],
  equivalences = foodEquivalenceDefinitions,
  limit = 6,
) {
  return foods
    .filter(
      (candidate) =>
        candidate.id !== current.id &&
        candidate.status === "ACTIVE" &&
        (candidate.foodGroup === current.foodGroup ||
          candidate.category === current.category ||
          equivalences.some(
            (item) =>
              item.sourceFoodId === current.id &&
              item.targetFoodId === candidate.id,
          )),
    )
    .map((food) => ({
      food,
      score: recommendationScore(current, food, equivalences),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.food.officialName.localeCompare(
          right.food.officialName,
          "pt-BR",
        ),
    )
    .slice(0, limit)
    .map((item) => item.food);
}

function automaticGrams(
  current: SubstitutionNutritionSnapshot,
  candidate: ProfessionalFood,
) {
  const energyPer100g = candidate.nutrients?.energyKcal;
  if (energyPer100g !== null && energyPer100g !== undefined && energyPer100g > 0) {
    return {
      grams: (current.energyKcal / energyPer100g) * 100,
      basis: "ENERGY" as const,
    };
  }

  const proteinPer100g = candidate.nutrients?.proteinGrams;
  if (
    current.proteinGrams > 0 &&
    proteinPer100g !== null &&
    proteinPer100g !== undefined &&
    proteinPer100g > 0
  ) {
    return {
      grams: (current.proteinGrams / proteinPer100g) * 100,
      basis: "PROTEIN" as const,
    };
  }

  return { grams: current.grams, basis: "GRAMS" as const };
}

export function createSubstitutionProposal(
  current: SubstitutionNutritionSnapshot,
  candidate: ProfessionalFood,
  mode: SubstitutionAdjustmentMode,
): SubstitutionProposal | null {
  if (!candidate.nutrients) return null;

  const adjusted =
    mode === "AUTO_ADJUST"
      ? automaticGrams(current, candidate)
      : { grams: current.grams, basis: "GRAMS" as const };
  const grams = Math.max(0, adjusted.grams);
  const primaryMeasure =
    candidate.householdMeasures.find((measure) => measure.isDefault) ??
    candidate.householdMeasures[0];

  return {
    food: candidate,
    grams,
    measureName: primaryMeasure?.name ?? "gramas",
    measureGrams: primaryMeasure?.grams ?? grams,
    nutrition: calculateNutrientsForGrams(candidate.nutrients, grams),
    adjustmentBasis: adjusted.basis,
  };
}

/**
 * Fachada única do fluxo de substituição, reutilizável pelos consumidores
 * atuais e futuros sem duplicar regras clínicas, cálculo ou auditoria.
 */
export const foodSubstitutionService = {
  search: searchSubstitutionFoods,
  rank: rankNutritionalEquivalents,
  isCompatible: isFoodCompatibleWithClinicalContext,
  chooseMeasure: chooseReplacementMeasure,
  createReplacement: createMealPlanSubstitutionReplacement,
  replace: replaceMealPlanFood,
} as const;
