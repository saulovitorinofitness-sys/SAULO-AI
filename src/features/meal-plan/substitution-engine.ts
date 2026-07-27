import {
  calculateNutrientsForGrams,
  normalizeFoodSearchText,
  type FoodNutrientsPer100g,
  type ProfessionalFood,
} from "@/features/food-database";

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
  readonly energy: number;
  readonly carbohydrates: number;
  readonly protein: number;
  readonly fats: number;
  readonly fiber: number;
}

export interface NutritionalEquivalent {
  readonly food: ProfessionalFood;
  readonly suggestedGrams: number;
  readonly nutrition: FoodNutrientsPer100g;
  readonly score: NutritionalEquivalenceScore;
  readonly adjustmentBasis: "ENERGY" | "GRAMS";
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
      nutrients.carbohydratesGrams !== null &&
      nutrients.proteinGrams !== null &&
      nutrients.fatsGrams !== null &&
      nutrients.fiberGrams !== null,
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
    definitions.some(
      (item) =>
        item.sourceFoodId === current.id &&
        item.targetFoodId === candidate.id,
    )
  );
}

/**
 * Classificação determinística de equivalentes.
 *
 * A gramagem candidata é ajustada primeiro para aproximar a energia da porção
 * atual. Depois, a proximidade dos cinco nutrientes gera uma nota de 0 a 100.
 * O contexto clínico é parte do contrato, mas seus filtros serão aplicados
 * somente quando as respectivas fontes clínicas forem homologadas.
 */
export function rankNutritionalEquivalents(input: {
  readonly currentFood: ProfessionalFood;
  readonly currentGrams: number;
  readonly candidates: readonly ProfessionalFood[];
  readonly definitions?: readonly FoodEquivalenceDefinition[];
  readonly context?: NutritionalEquivalenceContext;
  readonly limit?: number;
}): readonly NutritionalEquivalent[] {
  const {
    currentFood,
    currentGrams,
    candidates,
    definitions = foodEquivalenceDefinitions,
    limit = 8,
  } = input;
  if (
    !hasComparableNutrition(currentFood) ||
    currentFood.source.origin === "DEMONSTRATIVE" ||
    currentGrams <= 0
  ) {
    return [];
  }

  const currentNutrition = calculateNutrientsForGrams(
    currentFood.nutrients!,
    currentGrams,
  );
  const currentEnergy = currentNutrition.energyKcal ?? 0;

  return candidates
    .filter(
      (candidate) =>
        candidate.id !== currentFood.id &&
        candidate.status === "ACTIVE" &&
        candidate.source.origin !== "DEMONSTRATIVE" &&
        hasComparableNutrition(candidate) &&
        equivalentGroup(currentFood, candidate, definitions),
    )
    .map((food): NutritionalEquivalent => {
      const candidateEnergy = food.nutrients!.energyKcal!;
      const energyAdjustedGrams =
        currentEnergy > 0 && candidateEnergy > 0
          ? (currentEnergy / candidateEnergy) * 100
          : currentGrams;
      const suggestedGrams = rounded(
        Math.min(2_000, Math.max(1, energyAdjustedGrams)),
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
      return {
        food,
        suggestedGrams,
        nutrition,
        adjustmentBasis: currentEnergy > 0 ? "ENERGY" : "GRAMS",
        score: {
          total: rounded(
            100 *
              (energy * equivalenceWeights.energyKcal +
                carbohydrates * equivalenceWeights.carbohydratesGrams +
                protein * equivalenceWeights.proteinGrams +
                fats * equivalenceWeights.fatsGrams +
                fiber * equivalenceWeights.fiberGrams),
          ),
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
