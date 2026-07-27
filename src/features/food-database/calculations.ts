import type { FoodNutrientsPer100g } from "./contracts";

export function calculateNutrientsForGrams(
  nutrientsPer100g: FoodNutrientsPer100g,
  grams: number,
): FoodNutrientsPer100g {
  const factor = Math.max(0, grams) / 100;

  return Object.fromEntries(
    Object.entries(nutrientsPer100g).map(([key, value]) => [
      key,
      value === null ? null : value * factor,
    ]),
  ) as unknown as FoodNutrientsPer100g;
}
