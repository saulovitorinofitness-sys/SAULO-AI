import {
  normalizeFoodSearchText,
  type ProfessionalFood,
} from "@/features/food-database";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy";

import {
  calculateFoodNutrientsForGrams,
  normalizeFoodNutrients,
} from "./nutrition-calculations";
import type { MealPlanRecordFood, MealPlanRecordMeal } from "./record";
import {
  createNutritionalEquivalenceContext,
  isFoodCompatibleWithClinicalContext,
} from "./substitution-engine";

export type AssistedAssemblyResult =
  | { readonly success: true; readonly meals: readonly MealPlanRecordMeal[] }
  | { readonly success: false; readonly message: string };

function positive(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

function preferenceScore(food: ProfessionalFood, preferences: readonly string[]) {
  const foodText = normalizeFoodSearchText(
    [food.officialName, food.category, food.foodGroup, ...food.synonyms].join(" "),
  );
  return preferences.reduce((score, preference) => {
    const terms = normalizeFoodSearchText(preference)
      .split(/\s+/)
      .filter((term) => term.length >= 3);
    return score + (terms.some((term) => foodText.includes(term)) ? 1 : 0);
  }, 0);
}

function registeredMeasure(food: ProfessionalFood) {
  return (
    food.householdMeasures.find(
      (measure) =>
        measure.active && measure.isDefault && positive(measure.quantity) && positive(measure.grams),
    ) ??
    food.householdMeasures.find(
      (measure) => measure.active && positive(measure.quantity) && positive(measure.grams),
    )
  );
}

function completeFood(food: ProfessionalFood) {
  const nutrients = food.nutrients;
  return Boolean(
    food.status === "ACTIVE" &&
      food.source.origin !== "DEMONSTRATIVE" &&
      nutrients &&
      positive(nutrients.energyKcal) &&
      nutrients.proteinGrams !== null &&
      nutrients.carbohydratesGrams !== null &&
      nutrients.fatsGrams !== null &&
      nutrients.fiberGrams !== null &&
      registeredMeasure(food),
  );
}

function isCoffeePowderIngredient(food: ProfessionalFood) {
  const name = normalizeFoodSearchText(food.officialName);
  return name.includes("cafe") && name.includes("po") && name.includes("torrado");
}

function macroDensity(
  food: ProfessionalFood,
  macro: "proteinGrams" | "carbohydratesGrams" | "fatsGrams",
) {
  const nutrients = food.nutrients!;
  const multiplier = macro === "fatsGrams" ? 9 : 4;
  return ((nutrients[macro] ?? 0) * multiplier) / nutrients.energyKcal!;
}

function toPreviewFood(input: {
  readonly food: ProfessionalFood;
  readonly targetEnergyKcal: number;
  readonly createId: () => string;
}): MealPlanRecordFood {
  const { food, targetEnergyKcal, createId } = input;
  const measure = registeredMeasure(food)!;
  const nutrientsPer100g = normalizeFoodNutrients(food.nutrients!);
  const grams = Math.round((targetEnergyKcal / nutrientsPer100g.energyKcal) * 1000) / 10;
  return {
    id: createId(),
    catalogFoodId: food.id,
    description: food.officialName,
    foodGroup: food.foodGroup,
    source: food.source.kind,
    sourceName: food.source.name,
    sourceVersion: food.source.version,
    sourceCode: food.sourceCode,
    primaryHouseholdMeasure: measure.name,
    standardWeightGrams: food.referenceServingGrams,
    grams,
    prescribedAmount: grams,
    prescribedUnit: "g",
    householdMeasure: measure.name,
    measureOptions: food.householdMeasures
      .filter((item) => item.active && positive(item.quantity) && positive(item.grams))
      .map((item) => ({
        name: item.name,
        gramsPerUnit: item.grams / item.quantity,
      })),
    quantity: 1,
    nutrientsPer100g,
    nutrients: calculateFoodNutrientsForGrams(nutrientsPer100g, grams),
    substitutions: [],
  };
}

export function generateAssistedMealPlanPreview(input: {
  readonly strategy: MealPlanStrategyInheritance;
  readonly meals: readonly MealPlanRecordMeal[];
  readonly foods: readonly ProfessionalFood[];
  readonly allergies: readonly string[];
  readonly restrictions: readonly string[];
  readonly foodPreferences: readonly string[];
  readonly createId: () => string;
}): AssistedAssemblyResult {
  const requiredTargets = [
    ["VET", input.strategy.caloriesKcal],
    ["proteínas", input.strategy.proteinGrams],
    ["carboidratos", input.strategy.carbohydratesGrams],
    ["lipídios", input.strategy.fatsGrams],
  ] as const;
  const missingTarget = requiredTargets.find(([, value]) => !positive(value));
  if (missingTarget) {
    return { success: false, message: `${missingTarget[0]} não informado na Estratégia Nutricional.` };
  }
  if (!input.meals.length) {
    return { success: false, message: "Nenhuma refeição foi cadastrada na Estratégia Nutricional." };
  }
  const mealsWithoutTime = input.meals.filter((meal) => !meal.time?.trim());
  if (mealsWithoutTime.length) {
    return {
      success: false,
      message: `Horário não informado para: ${mealsWithoutTime.map((meal) => meal.name).join(", ")}.`,
    };
  }
  if (!input.foods.length) {
    return {
      success: false,
      message:
        "Nenhum alimento ativo está cadastrado nas bases reais. Importe TACO, IBGE, Philips ou outra base homologada antes de gerar a prévia.",
    };
  }

  const completeFoods = input.foods.filter(
    (food) => completeFood(food) && !isCoffeePowderIngredient(food),
  );
  if (!completeFoods.length) {
    return {
      success: false,
      message:
        "Os alimentos ativos não possuem composição nutricional e medida caseira completas para gerar a prévia.",
    };
  }
  const clinicalContext = createNutritionalEquivalenceContext({
    allergies: input.allergies,
    clinicalRestrictions: input.restrictions,
    foodPreferences: input.foodPreferences,
  });
  const compatibleFoods = completeFoods.filter((food) =>
    isFoodCompatibleWithClinicalContext(food, clinicalContext),
  );
  if (!compatibleFoods.length) {
    return {
      success: false,
      message:
        "Nenhum alimento real compatível com as alergias, restrições e recusas registradas foi encontrado.",
    };
  }

  const macroTargets = [
    { key: "proteinGrams" as const, kcal: input.strategy.proteinGrams * 4 },
    { key: "carbohydratesGrams" as const, kcal: input.strategy.carbohydratesGrams * 4 },
    { key: "fatsGrams" as const, kcal: input.strategy.fatsGrams * 9 },
  ];
  const macroEnergyTotal = macroTargets.reduce((total, target) => total + target.kcal, 0);

  return {
    success: true,
    meals: input.meals.map((meal) => {
      const plannedEnergyKcal = positive(meal.plannedEnergyKcal)
        ? meal.plannedEnergyKcal
        : input.strategy.caloriesKcal / input.meals.length;
      const selected = new Set<string>();
      const allocationByFood = new Map<
        string,
        { food: ProfessionalFood; energyKcal: number }
      >();
      for (const target of macroTargets) {
        const unusedFoods = compatibleFoods.filter((candidate) => !selected.has(candidate.id));
        const food = [...(unusedFoods.length ? unusedFoods : compatibleFoods)].sort(
          (left, right) =>
            preferenceScore(right, input.foodPreferences) -
              preferenceScore(left, input.foodPreferences) ||
            macroDensity(right, target.key) - macroDensity(left, target.key) ||
            left.officialName.localeCompare(right.officialName, "pt-BR"),
        )[0];
        if (!food) continue;
        selected.add(food.id);
        const energyKcal = plannedEnergyKcal * (target.kcal / macroEnergyTotal);
        const current = allocationByFood.get(food.id);
        allocationByFood.set(food.id, {
          food,
          energyKcal: (current?.energyKcal ?? 0) + energyKcal,
        });
      }
      return {
        ...meal,
        items: [...allocationByFood.values()].map((allocation) =>
          toPreviewFood({
            food: allocation.food,
            targetEnergyKcal: allocation.energyKcal,
            createId: input.createId,
          }),
        ),
      };
    }),
  };
}
