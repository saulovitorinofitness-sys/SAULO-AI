import { nutritionStrategySelectionFingerprint, type NutritionStrategySelection } from "@/features/nutrition-strategy";
import type { ScientificLibraryItem } from "@/features/scientific-library";
import { calculateNutrientsForGrams } from "@/features/food-database/calculations";
import type { FoodNutrientsPer100g } from "@/features/food-database/contracts";
import type { AssistedMacronutrientValues, AssistedMealPreview, AssistedMicronutrientKey, AssistedNutritionValues, AssistedPreviewFood, AssistedPreviewMeal, MealPlanMeal } from "./contracts";

export interface DemonstrativeFoodProfile {
  readonly name: string;
  readonly role: "CARBOHYDRATE" | "PROTEIN" | "FAT" | "VEGETABLE" | "MIXED";
  readonly householdMeasure: string;
  readonly gramsPerMeasure: number;
  readonly defaultQuantity: number;
  readonly per100g: AssistedMacronutrientValues;
}

// Composição exclusivamente demonstrativa para validar a interação da Sprint 011.
export const assistedFoodProfiles: readonly DemonstrativeFoodProfile[] = [
  { name: "Arroz integral", role: "CARBOHYDRATE", householdMeasure: "colher de servir", gramsPerMeasure: 45, defaultQuantity: 3, per100g: { calories: 124, carbohydratesGrams: 25.8, proteinGrams: 2.6, fatsGrams: 1 } },
  { name: "Aveia em flocos", role: "CARBOHYDRATE", householdMeasure: "colher de sopa", gramsPerMeasure: 15, defaultQuantity: 3, per100g: { calories: 394, carbohydratesGrams: 66.6, proteinGrams: 13.9, fatsGrams: 8.5 } },
  { name: "Pão integral", role: "CARBOHYDRATE", householdMeasure: "fatia média", gramsPerMeasure: 28, defaultQuantity: 2, per100g: { calories: 253, carbohydratesGrams: 43.1, proteinGrams: 12.3, fatsGrams: 3.5 } },
  { name: "Batata-doce", role: "CARBOHYDRATE", householdMeasure: "unidade pequena", gramsPerMeasure: 90, defaultQuantity: 1, per100g: { calories: 86, carbohydratesGrams: 20.1, proteinGrams: 1.6, fatsGrams: 0.1 } },
  { name: "Banana", role: "CARBOHYDRATE", householdMeasure: "unidade média", gramsPerMeasure: 86, defaultQuantity: 1, per100g: { calories: 89, carbohydratesGrams: 22.8, proteinGrams: 1.1, fatsGrams: 0.3 } },
  { name: "Maçã", role: "CARBOHYDRATE", householdMeasure: "unidade média", gramsPerMeasure: 130, defaultQuantity: 1, per100g: { calories: 52, carbohydratesGrams: 13.8, proteinGrams: 0.3, fatsGrams: 0.2 } },
  { name: "Morango", role: "CARBOHYDRATE", householdMeasure: "meia xícara", gramsPerMeasure: 60, defaultQuantity: 1, per100g: { calories: 32, carbohydratesGrams: 7.7, proteinGrams: 0.7, fatsGrams: 0.3 } },
  { name: "Peito de frango", role: "PROTEIN", householdMeasure: "pedaço médio", gramsPerMeasure: 120, defaultQuantity: 1, per100g: { calories: 165, carbohydratesGrams: 0, proteinGrams: 31, fatsGrams: 3.6 } },
  { name: "Peixe branco", role: "PROTEIN", householdMeasure: "pedaço médio", gramsPerMeasure: 110, defaultQuantity: 1, per100g: { calories: 128, carbohydratesGrams: 0, proteinGrams: 26, fatsGrams: 2.7 } },
  { name: "Ovo de galinha", role: "PROTEIN", householdMeasure: "unidade média", gramsPerMeasure: 50, defaultQuantity: 2, per100g: { calories: 143, carbohydratesGrams: 0.7, proteinGrams: 12.6, fatsGrams: 9.5 } },
  { name: "Iogurte natural", role: "MIXED", householdMeasure: "copo médio", gramsPerMeasure: 170, defaultQuantity: 1, per100g: { calories: 63, carbohydratesGrams: 7, proteinGrams: 5.3, fatsGrams: 1.6 } },
  { name: "Feijão carioca cozido", role: "MIXED", householdMeasure: "concha média", gramsPerMeasure: 100, defaultQuantity: 1, per100g: { calories: 76, carbohydratesGrams: 13.6, proteinGrams: 4.8, fatsGrams: 0.5 } },
  { name: "Castanha-do-pará", role: "FAT", householdMeasure: "unidade média", gramsPerMeasure: 5, defaultQuantity: 3, per100g: { calories: 659, carbohydratesGrams: 11.7, proteinGrams: 14.3, fatsGrams: 67.1 } },
  { name: "Amendoim", role: "FAT", householdMeasure: "colher de sopa", gramsPerMeasure: 15, defaultQuantity: 1, per100g: { calories: 567, carbohydratesGrams: 16.1, proteinGrams: 25.8, fatsGrams: 49.2 } },
  { name: "Brócolis", role: "VEGETABLE", householdMeasure: "escumadeira", gramsPerMeasure: 55, defaultQuantity: 1, per100g: { calories: 35, carbohydratesGrams: 7.2, proteinGrams: 2.4, fatsGrams: 0.4 } },
  { name: "Cenoura", role: "VEGETABLE", householdMeasure: "colher de servir", gramsPerMeasure: 50, defaultQuantity: 1, per100g: { calories: 35, carbohydratesGrams: 8.2, proteinGrams: 0.8, fatsGrams: 0.2 } },
] as const;

export const assistedMicronutrientKeys: readonly AssistedMicronutrientKey[] = [
  "calciumMg", "ironMg", "magnesiumMg", "zincMg", "sodiumMg", "potassiumMg", "vitaminAMcg", "vitaminCMg", "vitaminDMcg", "vitaminEMg", "vitaminB1Mg", "vitaminB2Mg", "vitaminB6Mg", "vitaminB12Mcg", "folateMcg",
] as const;

const fiberPer100gByFood: Readonly<Record<string, number>> = {
  "Arroz integral": 1.6, "Aveia em flocos": 10.1, "Pão integral": 6.8, "Batata-doce": 3, Banana: 2.6, Maçã: 2.4, Morango: 2, "Peito de frango": 0, "Peixe branco": 0, "Ovo de galinha": 0, "Iogurte natural": 0, "Feijão carioca cozido": 8.5, "Castanha-do-pará": 7.5, Amendoim: 8.5, Brócolis: 3.3, Cenoura: 2.8,
};

// Valores por 100 g exclusivamente demonstrativos e rastreáveis neste adaptador local.
const micronutrientsPer100gByFood: Readonly<Record<string, Partial<Record<AssistedMicronutrientKey, number>>>> = {
  "Arroz integral": { calciumMg: 3, ironMg: 0.5, magnesiumMg: 44, zincMg: 0.6, sodiumMg: 1, potassiumMg: 86, vitaminEMg: 0.1, vitaminB1Mg: 0.1, vitaminB2Mg: 0.02, vitaminB6Mg: 0.15, folateMcg: 9 },
  "Aveia em flocos": { calciumMg: 54, ironMg: 4.7, magnesiumMg: 177, zincMg: 4, sodiumMg: 2, potassiumMg: 429, vitaminEMg: 0.4, vitaminB1Mg: 0.76, vitaminB2Mg: 0.14, vitaminB6Mg: 0.12, folateMcg: 56 },
  "Pão integral": { calciumMg: 107, ironMg: 2.4, magnesiumMg: 82, zincMg: 1.7, sodiumMg: 400, potassiumMg: 230, vitaminEMg: 0.6, vitaminB1Mg: 0.35, vitaminB2Mg: 0.12, vitaminB6Mg: 0.09, folateMcg: 44 },
  "Batata-doce": { calciumMg: 30, ironMg: 0.6, magnesiumMg: 25, zincMg: 0.3, sodiumMg: 55, potassiumMg: 337, vitaminAMcg: 709, vitaminCMg: 2.4, vitaminEMg: 0.3, vitaminB1Mg: 0.08, vitaminB2Mg: 0.06, vitaminB6Mg: 0.21, folateMcg: 11 },
  Banana: { calciumMg: 5, ironMg: 0.3, magnesiumMg: 27, zincMg: 0.2, sodiumMg: 1, potassiumMg: 358, vitaminAMcg: 3, vitaminCMg: 8.7, vitaminEMg: 0.1, vitaminB1Mg: 0.03, vitaminB2Mg: 0.07, vitaminB6Mg: 0.37, folateMcg: 20 },
  Maçã: { calciumMg: 6, ironMg: 0.1, magnesiumMg: 5, zincMg: 0.04, sodiumMg: 1, potassiumMg: 107, vitaminAMcg: 3, vitaminCMg: 4.6, vitaminEMg: 0.2, vitaminB1Mg: 0.02, vitaminB2Mg: 0.03, vitaminB6Mg: 0.04, folateMcg: 3 },
  Morango: { calciumMg: 16, ironMg: 0.4, magnesiumMg: 13, zincMg: 0.1, sodiumMg: 1, potassiumMg: 153, vitaminAMcg: 1, vitaminCMg: 58.8, vitaminEMg: 0.3, vitaminB1Mg: 0.02, vitaminB2Mg: 0.02, vitaminB6Mg: 0.05, folateMcg: 24 },
  "Peito de frango": { calciumMg: 15, ironMg: 1, magnesiumMg: 29, zincMg: 1, sodiumMg: 74, potassiumMg: 256, vitaminAMcg: 6, vitaminEMg: 0.3, vitaminB1Mg: 0.07, vitaminB2Mg: 0.11, vitaminB6Mg: 0.6, vitaminB12Mcg: 0.3, folateMcg: 4 },
  "Peixe branco": { calciumMg: 14, ironMg: 0.4, magnesiumMg: 30, zincMg: 0.5, sodiumMg: 56, potassiumMg: 380, vitaminAMcg: 10, vitaminDMcg: 3.1, vitaminEMg: 0.6, vitaminB1Mg: 0.08, vitaminB2Mg: 0.07, vitaminB6Mg: 0.2, vitaminB12Mcg: 1.6, folateMcg: 7 },
  "Ovo de galinha": { calciumMg: 56, ironMg: 1.8, magnesiumMg: 12, zincMg: 1.3, sodiumMg: 142, potassiumMg: 138, vitaminAMcg: 160, vitaminDMcg: 2, vitaminEMg: 1.1, vitaminB1Mg: 0.04, vitaminB2Mg: 0.46, vitaminB6Mg: 0.17, vitaminB12Mcg: 0.9, folateMcg: 47 },
  "Iogurte natural": { calciumMg: 183, ironMg: 0.1, magnesiumMg: 17, zincMg: 0.9, sodiumMg: 70, potassiumMg: 234, vitaminAMcg: 27, vitaminDMcg: 0.1, vitaminEMg: 0.1, vitaminB1Mg: 0.04, vitaminB2Mg: 0.24, vitaminB6Mg: 0.05, vitaminB12Mcg: 0.6, folateMcg: 7 },
  "Feijão carioca cozido": { calciumMg: 27, ironMg: 1.3, magnesiumMg: 42, zincMg: 0.9, sodiumMg: 2, potassiumMg: 255, vitaminEMg: 0.2, vitaminB1Mg: 0.16, vitaminB2Mg: 0.06, vitaminB6Mg: 0.12, folateMcg: 130 },
  "Castanha-do-pará": { calciumMg: 160, ironMg: 2.4, magnesiumMg: 376, zincMg: 4.1, sodiumMg: 3, potassiumMg: 659, vitaminEMg: 5.7, vitaminB1Mg: 0.62, vitaminB2Mg: 0.04, vitaminB6Mg: 0.1, folateMcg: 22 },
  Amendoim: { calciumMg: 92, ironMg: 4.6, magnesiumMg: 168, zincMg: 3.3, sodiumMg: 18, potassiumMg: 705, vitaminEMg: 8.3, vitaminB1Mg: 0.64, vitaminB2Mg: 0.14, vitaminB6Mg: 0.35, folateMcg: 240 },
  Brócolis: { calciumMg: 47, ironMg: 0.7, magnesiumMg: 21, zincMg: 0.4, sodiumMg: 33, potassiumMg: 316, vitaminAMcg: 31, vitaminCMg: 89.2, vitaminEMg: 0.8, vitaminB1Mg: 0.07, vitaminB2Mg: 0.12, vitaminB6Mg: 0.18, folateMcg: 63 },
  Cenoura: { calciumMg: 33, ironMg: 0.3, magnesiumMg: 12, zincMg: 0.2, sodiumMg: 69, potassiumMg: 320, vitaminAMcg: 835, vitaminCMg: 5.9, vitaminEMg: 0.7, vitaminB1Mg: 0.07, vitaminB2Mg: 0.06, vitaminB6Mg: 0.14, folateMcg: 19 },
};

function completeMicronutrients(values: Partial<Record<AssistedMicronutrientKey, number>> = {}) {
  return Object.fromEntries(assistedMicronutrientKeys.map((key) => [key, values[key] ?? 0])) as Record<AssistedMicronutrientKey, number>;
}

const previewTemplates = [
  [["Aveia em flocos", "Banana", "Iogurte natural"], ["Pão integral", "Ovo de galinha", "Maçã"], ["Arroz integral", "Feijão carioca cozido", "Peito de frango", "Brócolis"], ["Iogurte natural", "Morango", "Castanha-do-pará"], ["Batata-doce", "Peixe branco", "Cenoura"], ["Iogurte natural", "Aveia em flocos"]],
  [["Pão integral", "Ovo de galinha", "Banana"], ["Iogurte natural", "Maçã", "Castanha-do-pará"], ["Arroz integral", "Feijão carioca cozido", "Peixe branco", "Cenoura"], ["Aveia em flocos", "Morango", "Iogurte natural"], ["Batata-doce", "Peito de frango", "Brócolis"], ["Iogurte natural", "Amendoim"]],
] as const;

function round(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function nutritionForGrams(profile: DemonstrativeFoodProfile, grams: number): AssistedNutritionValues {
  const micronutrients = micronutrientsPer100gByFood[profile.name] ?? {};
  const calculated = calculateNutrientsForGrams(
    {
      energyKcal: profile.per100g.calories,
      proteinGrams: profile.per100g.proteinGrams,
      carbohydratesGrams: profile.per100g.carbohydratesGrams,
      fatsGrams: profile.per100g.fatsGrams,
      fiberGrams: fiberPer100gByFood[profile.name] ?? null,
      sugarsGrams: null,
      cholesterolMg: null,
      saturatedFatsGrams: null,
      monounsaturatedFatsGrams: null,
      polyunsaturatedFatsGrams: null,
      sodiumMg: micronutrients.sodiumMg ?? null,
      calciumMg: micronutrients.calciumMg ?? null,
      ironMg: micronutrients.ironMg ?? null,
      magnesiumMg: micronutrients.magnesiumMg ?? null,
      phosphorusMg: null,
      potassiumMg: micronutrients.potassiumMg ?? null,
      zincMg: micronutrients.zincMg ?? null,
      copperMg: null,
      manganeseMg: null,
      seleniumMcg: null,
      vitaminAMcg: micronutrients.vitaminAMcg ?? null,
      vitaminCMg: micronutrients.vitaminCMg ?? null,
      vitaminDMcg: micronutrients.vitaminDMcg ?? null,
      vitaminEMg: micronutrients.vitaminEMg ?? null,
      vitaminKMcg: null,
      thiamineMg: micronutrients.vitaminB1Mg ?? null,
      riboflavinMg: micronutrients.vitaminB2Mg ?? null,
      niacinMg: null,
      vitaminB6Mg: micronutrients.vitaminB6Mg ?? null,
      folateMcg: micronutrients.folateMcg ?? null,
      vitaminB12Mcg: micronutrients.vitaminB12Mcg ?? null,
    } satisfies FoodNutrientsPer100g,
    grams,
  );

  return {
    calories: calculated.energyKcal ?? 0,
    carbohydratesGrams: calculated.carbohydratesGrams ?? 0,
    proteinGrams: calculated.proteinGrams ?? 0,
    fatsGrams: calculated.fatsGrams ?? 0,
    fiberGrams: calculated.fiberGrams ?? 0,
    micronutrients: completeMicronutrients({
      calciumMg: calculated.calciumMg ?? 0,
      ironMg: calculated.ironMg ?? 0,
      magnesiumMg: calculated.magnesiumMg ?? 0,
      zincMg: calculated.zincMg ?? 0,
      sodiumMg: calculated.sodiumMg ?? 0,
      potassiumMg: calculated.potassiumMg ?? 0,
      vitaminAMcg: calculated.vitaminAMcg ?? 0,
      vitaminCMg: calculated.vitaminCMg ?? 0,
      vitaminDMcg: calculated.vitaminDMcg ?? 0,
      vitaminEMg: calculated.vitaminEMg ?? 0,
      vitaminB1Mg: calculated.thiamineMg ?? 0,
      vitaminB2Mg: calculated.riboflavinMg ?? 0,
      vitaminB6Mg: calculated.vitaminB6Mg ?? 0,
      vitaminB12Mcg: calculated.vitaminB12Mcg ?? 0,
      folateMcg: calculated.folateMcg ?? 0,
    }),
  };
}

export function findAssistedFoodProfile(name: string) {
  return assistedFoodProfiles.find((profile) => profile.name === name);
}

function baseFood(name: string, mealIndex: number, itemIndex: number, library: readonly ScientificLibraryItem[]): AssistedPreviewFood | null {
  const profile = findAssistedFoodProfile(name);
  const libraryItem = library.find((item) => item.name === name);
  if (!profile || !libraryItem) return null;
  // O método orienta a decisão profissional, mas nunca altera ou gera
  // automaticamente porções do Plano Alimentar.
  const quantity = round(profile.defaultQuantity, 2);
  const grams = round(quantity * profile.gramsPerMeasure);
  return {
    id: `assisted-${mealIndex + 1}-${itemIndex + 1}-${libraryItem.id}`,
    scientificLibraryItemId: libraryItem.id,
    name: profile.name,
    category: libraryItem.category,
    householdMeasure: profile.householdMeasure,
    quantity,
    gramsPerMeasure: profile.gramsPerMeasure,
    grams,
    nutrition: nutritionForGrams(profile, grams),
    source: `${libraryItem.source} · composição nutricional demonstrativa local`,
    demonstrative: true,
  };
}

export function sumNutrition(values: readonly AssistedNutritionValues[]): AssistedNutritionValues {
  return values.reduce<AssistedNutritionValues>((total, value) => ({
    calories: total.calories + value.calories,
    carbohydratesGrams: total.carbohydratesGrams + value.carbohydratesGrams,
    proteinGrams: total.proteinGrams + value.proteinGrams,
    fatsGrams: total.fatsGrams + value.fatsGrams,
    fiberGrams: total.fiberGrams + value.fiberGrams,
    micronutrients: completeMicronutrients(Object.fromEntries(assistedMicronutrientKeys.map((key) => [key, total.micronutrients[key] + value.micronutrients[key]]))),
  }), { calories: 0, carbohydratesGrams: 0, proteinGrams: 0, fatsGrams: 0, fiberGrams: 0, micronutrients: completeMicronutrients() });
}

export function mealNutrition(meal: AssistedPreviewMeal) {
  return sumNutrition(meal.foods.map((food) => food.nutrition));
}

export function previewNutrition(preview: AssistedMealPreview) {
  return sumNutrition(preview.meals.map(mealNutrition));
}

export function createAssistedMealReferences(strategy: NutritionStrategySelection, planMeals: readonly MealPlanMeal[]) {
  return Array.from({ length: Math.max(1, strategy.mealCount) }, (_, index) => ({
    id: planMeals[index]?.id ?? `assisted-meal-${index + 1}`,
    name: planMeals[index]?.name ?? `Refeição ${index + 1}`,
    time: strategy.mealTimes[index] ?? planMeals[index]?.time ?? "--:--",
  }));
}

export function createAssistedMealPreview(strategy: NutritionStrategySelection, mealNames: readonly { readonly id: string; readonly name: string; readonly time: string }[], library: readonly ScientificLibraryItem[], revision = 1): AssistedMealPreview {
  const template = previewTemplates[(revision - 1) % previewTemplates.length];
  const unscaledMeals = mealNames.map((meal, mealIndex) => ({
    ...meal,
    foods: (template[mealIndex % template.length] ?? template[0]).map((name, itemIndex) => baseFood(name, mealIndex, itemIndex, library)).filter((food): food is AssistedPreviewFood => Boolean(food)),
  }));
  const unscaledCalories = sumNutrition(unscaledMeals.flatMap((meal) => meal.foods.map((food) => food.nutrition))).calories;
  const scale = unscaledCalories > 0 ? strategy.targetCalories / unscaledCalories : 1;
  const meals = unscaledMeals.map((meal) => ({ ...meal, foods: meal.foods.map((food) => {
    const profile = findAssistedFoodProfile(food.name);
    const grams = round(food.grams * scale);
    return profile ? { ...food, quantity: round(grams / food.gramsPerMeasure, 2), grams, nutrition: nutritionForGrams(profile, grams) } : food;
  }) }));
  return {
    id: `assisted-preview-${revision}`,
    nutritionDataVersion: 1,
    patientId: strategy.patientId,
    masterRecordId: strategy.masterRecordId,
    scenario: strategy.scenario,
    strategyFingerprint: nutritionStrategySelectionFingerprint(strategy),
    revision,
    status: "PENDING_REVIEW",
    meals,
    createdAt: strategy.updatedAt,
    notice: "Sugestão assistida por regras locais. Requer revisão e validação do nutricionista.",
    demonstrative: true,
  };
}
