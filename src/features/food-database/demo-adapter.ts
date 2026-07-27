import {
  assistedFoodProfiles,
  nutritionForGrams,
} from "@/features/meal-plan/assisted-preview-mock";
import { parseDemonstrativeMeasureAssociations } from "@/features/shared-data/household-measure-catalog";
import { sharedDataMockItems } from "@/features/shared-data/mock-data";

import type {
  FoodNutrientsPer100g,
  FoodSearchInput,
  FoodSearchResult,
  NutritionSourceKind,
  ProfessionalFood,
} from "./contracts";
import { normalizeFoodSearchText } from "./normalization";

const DEMO_TIMESTAMP = "2026-07-16T15:30:00-03:00";
const supportedSources = new Set<NutritionSourceKind>([
  "TACO",
  "TBCA",
  "IBGE",
  "PHILIPS",
  "USDA",
  "CLINIC_SV",
]);

function sourceKind(value: string): NutritionSourceKind {
  const candidate = value.split("·")[0]?.trim().toUpperCase();
  return supportedSources.has(candidate as NutritionSourceKind)
    ? (candidate as NutritionSourceKind)
    : "CLINIC_SV";
}

function nullable(value: number) {
  return value === 0 ? null : value;
}

function nutrientsFor(name: string): FoodNutrientsPer100g | null {
  const profile = assistedFoodProfiles.find((item) => item.name === name);
  if (!profile) return null;
  const nutrition = nutritionForGrams(profile, 100);

  return {
    energyKcal: nutrition.calories,
    proteinGrams: nutrition.proteinGrams,
    carbohydratesGrams: nutrition.carbohydratesGrams,
    fatsGrams: nutrition.fatsGrams,
    fiberGrams: nutrition.fiberGrams,
    sugarsGrams: null,
    cholesterolMg: null,
    saturatedFatsGrams: null,
    monounsaturatedFatsGrams: null,
    polyunsaturatedFatsGrams: null,
    sodiumMg: nullable(nutrition.micronutrients.sodiumMg),
    calciumMg: nullable(nutrition.micronutrients.calciumMg),
    ironMg: nullable(nutrition.micronutrients.ironMg),
    magnesiumMg: nullable(nutrition.micronutrients.magnesiumMg),
    phosphorusMg: null,
    potassiumMg: nullable(nutrition.micronutrients.potassiumMg),
    zincMg: nullable(nutrition.micronutrients.zincMg),
    copperMg: null,
    manganeseMg: null,
    seleniumMcg: null,
    vitaminAMcg: nullable(nutrition.micronutrients.vitaminAMcg),
    vitaminCMg: nullable(nutrition.micronutrients.vitaminCMg),
    vitaminDMcg: nullable(nutrition.micronutrients.vitaminDMcg),
    vitaminEMg: nullable(nutrition.micronutrients.vitaminEMg),
    vitaminKMcg: null,
    thiamineMg: nullable(nutrition.micronutrients.vitaminB1Mg),
    riboflavinMg: nullable(nutrition.micronutrients.vitaminB2Mg),
    niacinMg: null,
    vitaminB6Mg: nullable(nutrition.micronutrients.vitaminB6Mg),
    folateMcg: nullable(nutrition.micronutrients.folateMcg),
    vitaminB12Mcg: nullable(nutrition.micronutrients.vitaminB12Mcg),
  };
}

function inferredState(name: string) {
  const normalized = normalizeFoodSearchText(name);
  if (normalized.includes("cozid")) return "cozido";
  if (normalized.includes("integral")) return "integral";
  return undefined;
}

function approvedDemoSynonyms(name: string): readonly string[] {
  return name === "Mandioca cozida"
    ? ["macaxeira cozida", "aipim cozido"]
    : [];
}

export const demonstrativeProfessionalFoods: readonly ProfessionalFood[] =
  sharedDataMockItems
    .filter((item) => item.domain === "FOOD")
    .map((item) => {
      const sourceName = item.source ?? "Clínica SV · cenário demonstrativo";
      const measures = parseDemonstrativeMeasureAssociations(
        item.attributes.mockPortion,
      ).filter(
        (measure) =>
          measure.unit === "g" && measure.equivalentAmount !== null,
      );

      return {
        id: item.id,
        officialName: item.name,
        normalizedName: normalizeFoodSearchText(item.name),
        description: item.description,
        category: item.attributes.foodGroup,
        categoryId: item.categoryId ?? "food-other",
        foodGroup: item.attributes.foodGroup,
        source: {
          id: `demo-source-${sourceKind(sourceName).toLowerCase()}`,
          kind: sourceKind(sourceName),
          name: sourceName,
          origin: "DEMONSTRATIVE",
          editable: false,
        },
        sourceCode: item.code,
        preparationState: inferredState(item.name),
        presentation: item.attributes.defaultUnit,
        referenceServingGrams: 100,
        status: item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        nutrients: nutrientsFor(item.name),
        householdMeasures: measures.map((measure, index) => ({
          id: measure.id,
          name: measure.name,
          normalizedName: normalizeFoodSearchText(measure.name),
          quantity: 1,
          grams: measure.equivalentAmount ?? 0,
          source: sourceName,
          isDefault:
            index === 0 ||
            normalizeFoodSearchText(measure.name) ===
              normalizeFoodSearchText(item.attributes.householdMeasure),
          active: true,
        })),
        synonyms: approvedDemoSynonyms(item.name),
        createdAt: item.audit.createdAt,
        updatedAt: item.audit.updatedAt,
      } satisfies ProfessionalFood;
    });

export const demonstrativeFoodDatabase = {
  async search(input: FoodSearchInput = {}): Promise<FoodSearchResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
    const query = normalizeFoodSearchText(input.query ?? "");
    const filtered = demonstrativeProfessionalFoods.filter((food) => {
      const searchable = normalizeFoodSearchText(
        [
          food.officialName,
          food.description,
          food.category,
          food.foodGroup,
          food.source.name,
          food.source.kind,
          food.preparationState,
          food.presentation,
          ...food.synonyms,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return (
        (!query || searchable.includes(query)) &&
        (!input.category || food.category === input.category) &&
        (!input.source ||
          input.source === "ALL" ||
          food.source.kind === input.source) &&
        (!input.status || food.status === input.status)
      );
    });
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize),
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    };
  },

  async findById(id: string) {
    return demonstrativeProfessionalFoods.find((food) => food.id === id) ?? null;
  },
};

export const DEMONSTRATIVE_FOOD_DATABASE_UPDATED_AT = DEMO_TIMESTAMP;
