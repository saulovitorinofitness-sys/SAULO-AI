export type NutritionSourceKind =
  | "TACO"
  | "TBCA"
  | "IBGE"
  | "PHILIPS"
  | "USDA"
  | "CLINIC_SV";

export type FoodDataOrigin =
  | "OFFICIAL"
  | "PROFESSIONAL"
  | "DEMONSTRATIVE";

export type FoodStatus = "ACTIVE" | "INACTIVE";

export const HOUSEHOLD_MEASURE_REFERENCE_NAMES = [
  "grama",
  "unidade",
  "colher de sopa",
  "colher de chá",
  "colher de servir",
  "concha",
  "escumadeira",
  "xícara",
  "copo",
  "fatia",
  "pedaço",
  "prato",
  "porção",
] as const;

export const FOOD_CATEGORY_FILTER_OPTIONS = [
  "Cereais e tubérculos",
  "Frutas",
  "Carnes",
  "Ovos",
  "Laticínios",
  "Leguminosas",
  "Verduras e legumes",
  "Bebidas",
  "Oleaginosas",
] as const;

export interface FoodNutrientsPer100g {
  readonly energyKcal: number | null;
  readonly proteinGrams: number | null;
  readonly carbohydratesGrams: number | null;
  readonly fatsGrams: number | null;
  readonly fiberGrams: number | null;
  readonly sugarsGrams: number | null;
  readonly cholesterolMg: number | null;
  readonly saturatedFatsGrams: number | null;
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
}

export interface FoodHouseholdMeasure {
  readonly id: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly variation?: string;
  readonly quantity: number;
  readonly grams: number;
  readonly source: string;
  readonly isDefault: boolean;
  readonly active: boolean;
}

export interface FoodSource {
  readonly id: string;
  readonly kind: NutritionSourceKind;
  readonly name: string;
  readonly version?: string;
  readonly reference?: string;
  readonly origin: FoodDataOrigin;
  readonly editable: boolean;
}

export interface ProfessionalFood {
  readonly id: string;
  readonly officialName: string;
  readonly normalizedName: string;
  readonly description?: string;
  readonly category: string;
  readonly categoryId: string;
  readonly foodGroup: string;
  readonly source: FoodSource;
  readonly sourceCode?: string;
  readonly preparationState?: string;
  readonly presentation?: string;
  readonly referenceServingGrams: number;
  readonly status: FoodStatus;
  readonly nutrients: FoodNutrientsPer100g | null;
  readonly householdMeasures: readonly FoodHouseholdMeasure[];
  readonly synonyms: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FoodSearchInput {
  readonly query?: string;
  readonly category?: string;
  readonly source?: NutritionSourceKind | "ALL";
  readonly status?: FoodStatus;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface FoodSearchResult {
  readonly items: readonly ProfessionalFood[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface FoodDuplicateCandidate {
  readonly id: string;
  readonly officialName: string;
  readonly source: FoodSource;
  readonly sourceCode?: string;
  readonly preparationState?: string;
  readonly reason: string;
}

export interface ClinicFoodDraft {
  readonly officialName: string;
  readonly description?: string;
  readonly category: string;
  readonly foodGroup: string;
  readonly sourceCode?: string;
  readonly preparationState?: string;
  readonly presentation?: string;
  readonly referenceServingGrams: number;
  readonly nutrients: FoodNutrientsPer100g;
  readonly householdMeasures: readonly Omit<
    FoodHouseholdMeasure,
    "id" | "normalizedName" | "source"
  >[];
  readonly synonyms: readonly string[];
  readonly status: FoodStatus;
}
