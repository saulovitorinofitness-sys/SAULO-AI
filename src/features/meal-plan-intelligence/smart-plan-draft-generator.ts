import { randomUUID } from "node:crypto";

import {
  normalizeFoodSearchText,
  type ProfessionalFood,
} from "@/features/food-database";
import {
  calculateFoodNutrientsForGrams,
  normalizeFoodNutrients,
} from "@/features/meal-plan/nutrition-calculations";
import {
  compareMealPlanTarget,
  type MealPlanTargetComparison,
} from "@/features/meal-plan/config";

import type { EligibleFood } from "./nutritional-decision-engine";
import {
  optionalPatientContextFields,
  type PatientContext,
  type PatientContextOptionalField,
} from "./patient-context-service";
import { inferMealRole } from "./assisted-clinical-decision-engine";
import {
  classifyFoodSemantics,
  MEAL_STRUCTURE,
  type FoodMealFunction,
  type FoodSemanticProfile,
  type SemanticMealRole,
} from "./food-semantic-profile";

const NOT_INFORMED = "Não informado." as const;

export const SMART_PLAN_TOLERANCES = {
  energyKcal: 0.05,
  proteinGrams: 0.05,
  carbohydratesGrams: 0.05,
  fatsGrams: 0.05,
} as const;

export interface SmartPlanNutritionTotals {
  readonly energyKcal: number;
  readonly proteinGrams: number;
  readonly carbohydratesGrams: number;
  readonly fatsGrams: number;
}

export interface SmartPlanDraftItem extends SmartPlanNutritionTotals {
  readonly foodId: string;
  readonly name: string;
  readonly source: string;
  readonly group: string;
  readonly prescribedAmount: number;
  readonly unit: "g" | "ml";
  readonly householdMeasure: string;
  readonly selectionReason: string;
}

export interface SmartPlanDraftMeal {
  readonly id: string;
  readonly name: string;
  readonly time: string;
  readonly targetPercentage?: number;
  readonly targetEnergyKcal?: number;
  readonly items: readonly SmartPlanDraftItem[];
  readonly totals: SmartPlanNutritionTotals;
  readonly internalJustification: string;
}

export interface SmartPlanTargetComparison extends MealPlanTargetComparison {
  readonly withinTolerance: boolean;
  readonly tolerancePercentage: number;
}

export interface SmartPlanDraft {
  readonly semanticVersion: 2;
  readonly patientId: string;
  readonly attendanceId: string;
  readonly nutritionStrategyId: string;
  readonly generationStatus: "PREVIEW_NOT_APPROVED";
  readonly approvalLabel: "Prévia não aprovada.";
  readonly generatedAt: string;
  readonly requiresProfessionalAdjustment: boolean;
  readonly warnings: readonly string[];
  readonly optionalDataNotProvided: readonly PatientContextOptionalField[];
  readonly inputSummary: {
    readonly objective: string;
    readonly routine: readonly string[] | typeof NOT_INFORMED;
    readonly preferences: readonly string[] | typeof NOT_INFORMED;
    readonly schedules: readonly string[] | typeof NOT_INFORMED;
    readonly habitualIntakeBasis:
      | "CONFIRMED_REPRESENTATIVE"
      | "UNCONFIRMED_OR_TEST"
      | "NOT_INFORMED";
  };
  readonly meals: readonly SmartPlanDraftMeal[];
  readonly dailyTotals: SmartPlanNutritionTotals;
  readonly targetComparison: Readonly<
    Record<keyof SmartPlanNutritionTotals, SmartPlanTargetComparison>
  >;
  readonly sourceFoods: readonly {
    readonly foodId: string;
    readonly name: string;
    readonly source: string;
    readonly sourceCode?: string;
  }[];
}

export interface SmartPlanGenerationPendingField {
  readonly field: string;
  readonly expectedSource: string;
  readonly reason: string;
  readonly message: string;
}

export type SmartPlanGenerationResult =
  | { readonly success: true; readonly smartPlanDraft: SmartPlanDraft }
  | { readonly success: false; readonly pending: readonly SmartPlanGenerationPendingField[] };

export type SmartPlanMealGenerationResult =
  | { readonly success: true; readonly smartPlanMeal: SmartPlanDraftMeal }
  | { readonly success: false; readonly pending: readonly SmartPlanGenerationPendingField[] };

export interface SmartPlanGeneratorOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export type SmartPlanFoodComposition = readonly (readonly string[])[];

interface Candidate {
  readonly food: ProfessionalFood;
  readonly eligibility: EligibleFood;
}

interface PortionSlot extends Candidate {
  readonly mealIndex: number;
  readonly mealFunction: FoodMealFunction;
  readonly selectionReason: string;
  readonly semantic: FoodSemanticProfile;
}

interface FoodCoherenceProfile {
  readonly protein: number;
  readonly carbohydrate: number;
  readonly produce: number;
  readonly fruit: number;
  readonly vegetable: number;
  readonly stapleCarbohydrate: number;
  readonly breakfastAffinity: number;
  readonly healthyFat: number;
  readonly fiber: number;
  readonly practicality: number;
  readonly energyDensity: number;
  readonly sodiumDensity: number;
  readonly treatLikelihood: number;
  readonly concentratedDairy: number;
  readonly processingPenalty: number;
}

interface MealCoherenceNeed {
  readonly protein: number;
  readonly carbohydrate: number;
  readonly produce: number;
  readonly healthyFat: number;
}

interface ClinicalCoherenceContext {
  readonly weightLoss: boolean;
  readonly hypertrophy: boolean;
  readonly athlete: boolean;
  readonly glycemicAttention: boolean;
  readonly hypertension: boolean;
  readonly endometriosis: boolean;
  readonly olderAdult: boolean;
}

function positive(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

function pending(
  field: string,
  expectedSource: string,
  reason: string,
  message: string,
): SmartPlanGenerationPendingField {
  return { field, expectedSource, reason, message };
}

export function validateSmartPlanGeneration(
  patientContext: PatientContext | null | undefined,
  eligibleFoods: readonly EligibleFood[],
) {
  const issues: SmartPlanGenerationPendingField[] = [];
  if (!patientContext?.patient.patientId || !patientContext.patient.attendanceId) {
    issues.push(
      pending(
        "patientContext",
        "Prontuário Mestre",
        "Contexto válido do paciente não foi fornecido.",
        "patientContext válido não encontrado no Prontuário Mestre.",
      ),
    );
    return issues;
  }

  const strategy = patientContext.nutritionStrategy;
  if (!strategy?.sourceStrategyId || strategy.source !== "NUTRITION_STRATEGY") {
    issues.push(
      pending(
        "nutritionStrategy",
        "Estratégia Nutricional",
        "Estratégia aprovada não foi herdada pelo patientContext.",
        "Estratégia Nutricional aprovada não encontrada.",
      ),
    );
    return issues;
  }
  if (!positive(strategy.caloriesKcal)) {
    issues.push(pending("VET", "Estratégia Nutricional", "VET válido ausente.", "VET não encontrado na Estratégia Nutricional."));
  }
  if (!positive(strategy.protein.grams)) {
    issues.push(pending("proteinGrams", "Estratégia Nutricional", "Meta válida de proteínas ausente.", "Meta de proteínas não encontrada na Estratégia Nutricional."));
  }
  if (!positive(strategy.carbohydrates.grams)) {
    issues.push(pending("carbohydratesGrams", "Estratégia Nutricional", "Meta válida de carboidratos ausente.", "Meta de carboidratos não encontrada na Estratégia Nutricional."));
  }
  if (!positive(strategy.fats.grams)) {
    issues.push(pending("fatsGrams", "Estratégia Nutricional", "Meta válida de lipídios ausente.", "Meta de lipídios não encontrada na Estratégia Nutricional."));
  }
  if (!strategy.dailyDistribution?.length) {
    issues.push(pending("mealCount", "Estratégia Nutricional", "Quantidade válida de refeições ausente.", "Quantidade de refeições não encontrada na Estratégia Nutricional."));
  }
  for (const meal of strategy.dailyDistribution ?? []) {
    if (!meal.time.trim()) {
      issues.push(
        pending(
          `mealTime:${meal.mealNumber}`,
          "Estratégia Nutricional ou último Plano Alimentar válido",
          `Horário ausente em ${meal.name || `Refeição ${meal.mealNumber}`}.`,
          `Informe ou herde o horário de ${meal.name || `Refeição ${meal.mealNumber}`} antes de gerar a prévia.`,
        ),
      );
    }
  }
  if (!patientContext.foodCatalog?.foods.length) {
    issues.push(pending("foodCatalog", "Banco Mestre de Alimentos", "Catálogo real indisponível.", "Banco Mestre de Alimentos não disponível."));
  }
  if (!eligibleFoods.length) {
    issues.push(pending("eligibleFoods", "Motor de Decisão Nutricional", "Nenhuma classificação alimentar foi fornecida.", "Alimentos elegíveis não encontrados no Motor de Decisão Nutricional."));
  }
  return issues;
}

function completeComposition(food: ProfessionalFood) {
  const nutrients = food.nutrients;
  return Boolean(
    food.status === "ACTIVE" &&
      food.source.origin !== "DEMONSTRATIVE" &&
      nutrients &&
      positive(nutrients.energyKcal) &&
      nutrients.proteinGrams !== null &&
      nutrients.carbohydratesGrams !== null &&
      nutrients.fatsGrams !== null,
  );
}

function unsuitableIngredient(food: ProfessionalFood) {
  const name = normalizeFoodSearchText(food.officialName);
  const group = normalizeFoodSearchText(food.foodGroup);
  if (includesAny(name, ["desidratad", "liofilizad", "em po"])) return true;
  if (includesAny(name, ["miso", "tamarindo", "coracao"])) return true;
  if (/(^|, | )(po|farinha|fecula|polvilho|amido)(,| |$)/.test(name)) return true;
  if (
    includesAny(name, [
      "coentro",
      "oregano",
      "oregao",
      "salsa",
      "salsinha",
      "cominho",
      "canela",
      "pimenta",
      "tempero",
    ]) &&
    includesAny(name, ["desidratad", "po", "semente", "folha"])
  ) return true;
  if (
    /(^|, | )(cru|crua)(,|$)/.test(name) &&
    includesAny(name, ["batata", "mandioca", "cara", "inhame", "cará"])
  ) return true;
  const rawIngredientGroup = includesAny(group, [
    "carnes",
    "cereais",
    "leguminosas",
    "ovos",
    "pescados",
  ]);
  return (
    rawIngredientGroup &&
    includesAny(name, ["cru", "crua", "seco", "seca"]) &&
    !includesAny(name, ["fruta", "verdura", "hortalica"])
  );
}

function approvedCandidates(
  context: PatientContext,
  eligibleFoods: readonly EligibleFood[],
) {
  const eligibilityById = new Map(eligibleFoods.map((item) => [item.foodId, item]));
  return context.foodCatalog.foods.flatMap((food): Candidate[] => {
    const eligibility = eligibilityById.get(food.id);
    return eligibility?.status === "APROVADO" && completeComposition(food) && !unsuitableIngredient(food)
      ? [{ food, eligibility }]
      : [];
  });
}

function standardMealNames(count: number) {
  const namesByCount: Readonly<Record<number, readonly string[]>> = {
    1: ["Refeição"],
    2: ["Desjejum", "Jantar"],
    3: ["Desjejum", "Almoço", "Jantar"],
    4: ["Desjejum", "Almoço", "Lanche da tarde", "Jantar"],
    5: ["Desjejum", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar"],
    6: ["Desjejum", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"],
  };
  return namesByCount[count] ?? Array.from({ length: count }, (_, index) => `Refeição ${index + 1}`);
}

const DEFAULT_SIX_MEAL_PERCENTAGES = [20, 10, 30, 10, 25, 5] as const;

export function resolveSmartMealPercentages(
  distribution: readonly {
    readonly name: string;
    readonly time: string;
    readonly vetPercentage: number;
  }[],
) {
  const stored = distribution.map((meal) => meal.vetPercentage);
  const storedTotal = stored.reduce((sum, percentage) => sum + percentage, 0);
  const validStored =
    stored.length > 0 &&
    stored.every(positive) &&
    Math.abs(storedTotal - 100) <= 0.1;
  const uniformStored = validStored &&
    Math.max(...stored) - Math.min(...stored) <= 0.1;
  if (validStored && !uniformStored) return stored;
  if (distribution.length === 6) return [...DEFAULT_SIX_MEAL_PERCENTAGES];

  const functionalWeights = distribution.map((meal) => {
    const normalizedName = normalizeFoodSearchText(meal.name);
    if (normalizedName.includes("ceia")) return 5;
    const role = inferMealRole(meal.name, meal.time);
    if (role === "BREAKFAST") return 20;
    if (role === "LUNCH") return 30;
    if (role === "DINNER") return 25;
    if (role === "SNACK") return 10;
    return 20;
  });
  const total = functionalWeights.reduce((sum, weight) => sum + weight, 0);
  return functionalWeights.map((weight) => (weight / total) * 100);
}

export function mealFunctionsFor(name: string, time: string) {
  const normalizedName = normalizeFoodSearchText(name);
  if (normalizedName.includes("ceia")) return ["DAIRY"] as const;
  if (normalizedName.includes("lanche da tarde")) {
    return ["STAPLE", "PROTEIN"] as const;
  }
  const role = inferMealRole(name, time) as SemanticMealRole;
  if (role === "BREAKFAST") return ["REGIONAL_BASE", "PROTEIN", "FRUIT"] as const;
  if (role === "SNACK") return ["FRUIT", "PROTEIN"] as const;
  if (role === "DINNER") {
    return ["STAPLE", "LEGUME", "PROTEIN", "VEGETABLE"] as const;
  }
  return MEAL_STRUCTURE[role] ?? MEAL_STRUCTURE.MEAL;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function includesAny(value: string, markers: readonly string[]) {
  return markers.some((marker) => value.includes(marker));
}

const repetitionFamilyCache = new WeakMap<ProfessionalFood, string>();

function foodRepetitionFamily(food: ProfessionalFood) {
  const cached = repetitionFamilyCache.get(food);
  if (cached) return cached;
  const normalizedName = normalizeFoodSearchText(food.officialName);
  const family = includesAny(normalizedName, ["ovo", "omelete"])
    ? "ovo"
    : [
    "banana", "mamao", "manga", "goiaba", "melancia", "melao", "laranja", "abacaxi",
    "iogurte", "leite", "cuscuz", "tapioca", "arroz", "feijao", "frango", "peixe", "carne",
      ].find((marker) => normalizedName.includes(marker)) ??
      normalizedName.split(/[^\p{L}\p{N}]+/u)[0];
  repetitionFamilyCache.set(food, family);
  return family;
}

function foodCoherenceProfile(food: ProfessionalFood): FoodCoherenceProfile {
  const nutrients = food.nutrients!;
  const group = normalizeFoodSearchText(food.foodGroup);
  const name = normalizeFoodSearchText(
    `${food.officialName} ${food.category} ${food.preparationState ?? ""}`,
  );
  const proteinDensity = clamp((nutrients.proteinGrams ?? 0) / 25);
  const carbohydrateDensity = clamp((nutrients.carbohydratesGrams ?? 0) / 45);
  const fiber = clamp((nutrients.fiberGrams ?? 0) / 8);
  const sugarDensity = clamp((nutrients.sugarsGrams ?? 0) / 20);
  const totalFat = nutrients.fatsGrams ?? 0;
  const unsaturatedFat =
    (nutrients.monounsaturatedFatsGrams ?? 0) +
    (nutrients.polyunsaturatedFatsGrams ?? 0);
  const proteinGroup = includesAny(group, [
    "carnes",
    "pescados",
    "ovos",
    "leguminosas",
    "leite e derivados",
  ]);
  const highQualityProteinGroup = includesAny(group, [
    "carnes",
    "pescados",
    "ovos",
  ]);
  const plantProteinGroup = group.includes("leguminosas");
  const dairyProteinGroup = group === "leite e derivados";
  const carbohydrateGroup = includesAny(group, [
    "cereais",
    "tuberculos",
    "frutas",
    "leguminosas",
  ]);
  const produceGroup = includesAny(group, [
    "frutas",
    "verduras",
    "hortalicas",
  ]);
  const fruitGroup = group.includes("frutas");
  const vegetableGroup = includesAny(group, ["verduras", "hortalicas"]);
  const stapleByDescription = includesAny(name, [
    "arroz",
    "batata",
    "mandioca",
    "macarrao",
    "massa",
    "pao",
    "cuscuz",
    "milho",
    "aveia",
    "inhame",
  ]);
  const healthyFatGroup = includesAny(group, [
    "nozes",
    "sementes",
    "pescados",
    "gorduras e oleos",
  ]);
  const treatByDescription = includesAny(name, [
    "bolo",
    "biscoito",
    "bolacha",
    "chocolate",
    "doce",
    "acucarado",
    "sobremesa",
    "pacoca",
    "pe de moleque",
  ]);
  const concentratedDairy =
    includesAny(name, ["parmesao", "queijo curado", "queijo processado"]) ||
    (group === "leite e derivados" &&
      (nutrients.sodiumMg ?? 0) >= 500 &&
      (nutrients.energyKcal ?? 0) >= 280);
  const processingPenalty = clamp(
    (includesAny(name, ["industrializad", "chips", "frit", "embutido"]) ? 0.7 : 0) +
      (name.includes("milanesa") ? 0.4 : 0) +
      (includesAny(name, ["salgad", "temperada"]) ? 0.2 : 0),
  );

  return {
    protein: clamp(
      proteinDensity *
        (highQualityProteinGroup
          ? 0.95
          : dairyProteinGroup
            ? 0.85
            : plantProteinGroup
              ? 0.72
              : 0.62) +
        (proteinGroup ? 0.08 : 0),
    ),
    carbohydrate: clamp(
      carbohydrateDensity * (0.65 + fiber * 0.35) +
        (carbohydrateGroup ? 0.2 : 0) -
        sugarDensity * 0.2,
    ),
    produce: clamp(
      ((produceGroup ? 0.75 : 0) +
        fiber * 0.15 +
        clamp((nutrients.vitaminCMg ?? 0) / 45) * 0.1) *
        (1 - processingPenalty * 0.75) *
        (1 - clamp((nutrients.energyKcal ?? 0) / 650) * 0.25),
    ),
    fruit: clamp(
      (fruitGroup ? 0.9 : 0) *
        (1 - processingPenalty * 0.8),
    ),
    vegetable: clamp(
      (vegetableGroup ? 0.9 : 0) *
        ((nutrients.carbohydratesGrams ?? 0) <= 15
          ? 1
          : (nutrients.carbohydratesGrams ?? 0) <= 25
            ? 0.5
            : 0.15) *
        (1 - processingPenalty * 0.9) *
        (1 - clamp((nutrients.energyKcal ?? 0) / 400) * 0.5),
    ),
    stapleCarbohydrate: clamp(
      (stapleByDescription ? 0.75 : 0) +
        (group.includes("cereais") ? 0.35 : 0) +
        (group.includes("leguminosas") ? 0.2 : 0) -
        processingPenalty * 0.45,
    ),
    breakfastAffinity: clamp(
      (fruitGroup ? 0.5 : 0) +
        (group === "leite e derivados" ? 0.5 : 0) +
        (group.includes("ovos") ? 0.45 : 0) +
        (group.includes("cereais") ? 0.35 : 0) +
        (includesAny(name, ["pao", "aveia", "iogurte", "leite", "queijo"]) ? 0.35 : 0) -
        processingPenalty * 0.4,
    ),
    healthyFat: clamp(
      (totalFat > 0 ? unsaturatedFat / totalFat : 0) * 0.65 +
        (healthyFatGroup ? 0.35 : 0),
    ),
    fiber,
    practicality: clamp(
      0.35 +
        (produceGroup || group === "leite e derivados" ? 0.3 : 0) +
        (includesAny(name, ["cozido", "assado", "grelhado", "in natura"]) ? 0.25 : 0),
    ),
    energyDensity: clamp((nutrients.energyKcal ?? 0) / 500),
    sodiumDensity: clamp((nutrients.sodiumMg ?? 0) / 700),
    treatLikelihood: clamp(
      (treatByDescription ? 0.75 : 0) +
        sugarDensity * 0.2 +
        (fiber < 0.15 && carbohydrateDensity > 0.6 ? 0.1 : 0),
    ),
    concentratedDairy: concentratedDairy ? 1 : 0,
    processingPenalty,
  };
}

const semanticProfileCache = new WeakMap<ProfessionalFood, FoodSemanticProfile>();
const coherenceProfileCache = new WeakMap<ProfessionalFood, FoodCoherenceProfile>();

function cachedFoodSemanticProfile(food: ProfessionalFood) {
  const cached = semanticProfileCache.get(food);
  if (cached) return cached;
  const profile = classifyFoodSemantics(food);
  semanticProfileCache.set(food, profile);
  return profile;
}

function cachedFoodCoherenceProfile(food: ProfessionalFood) {
  const cached = coherenceProfileCache.get(food);
  if (cached) return cached;
  const profile = foodCoherenceProfile(food);
  coherenceProfileCache.set(food, profile);
  return profile;
}

function mealNeed(role: ReturnType<typeof inferMealRole>): MealCoherenceNeed {
  if (role === "LUNCH" || role === "DINNER") {
    return { protein: 0.9, carbohydrate: 0.8, produce: 0.85, healthyFat: 0.25 };
  }
  if (role === "BREAKFAST") {
    return { protein: 0.55, carbohydrate: 0.8, produce: 0.55, healthyFat: 0.25 };
  }
  if (role === "SNACK") {
    return { protein: 0.4, carbohydrate: 0.65, produce: 0.65, healthyFat: 0.25 };
  }
  return { protein: 0.65, carbohydrate: 0.7, produce: 0.65, healthyFat: 0.25 };
}

function supportsMealFunction(
  candidate: Candidate,
  profile: FoodCoherenceProfile,
  role: ReturnType<typeof inferMealRole>,
  focus: keyof MealCoherenceNeed,
) {
  const group = normalizeFoodSearchText(candidate.food.foodGroup);
  const name = normalizeFoodSearchText(candidate.food.officialName);
  const mainMeal = role === "LUNCH" || role === "DINNER";
  if (mainMeal) {
    if (focus === "protein") return profile.protein >= 0.25;
    if (focus === "carbohydrate") return profile.stapleCarbohydrate >= 0.45;
    if (focus === "produce") return profile.vegetable >= 0.45;
    return profile.healthyFat >= 0.45;
  }
  if (role === "BREAKFAST") {
    if (focus === "protein") {
      return (
        profile.protein >= 0.2 &&
        !includesAny(group, ["carnes", "pescados", "leguminosas"])
      );
    }
    if (focus === "carbohydrate") {
      return profile.breakfastAffinity >= 0.35 && profile.carbohydrate >= 0.2;
    }
    if (focus === "produce") return profile.fruit >= 0.55;
    return false;
  }
  if (role === "SNACK") {
    if (focus === "produce") return profile.fruit >= 0.55;
    if (focus === "protein") {
      return (
        group === "leite e derivados" ||
        includesAny(name, ["iogurte", "leite", "queijo"])
      );
    }
    if (focus === "carbohydrate") {
      return profile.breakfastAffinity >= 0.35;
    }
    return false;
  }
  return profile[focus] >= 0.3;
}

function mealFunctionFocus(
  mealFunction: FoodMealFunction,
): keyof MealCoherenceNeed {
  if (mealFunction === "PROTEIN" || mealFunction === "DAIRY" || mealFunction === "LEGUME") {
    return "protein";
  }
  if (mealFunction === "FRUIT" || mealFunction === "VEGETABLE") {
    return "produce";
  }
  if (mealFunction === "STAPLE" || mealFunction === "REGIONAL_BASE") {
    return "carbohydrate";
  }
  return "healthyFat";
}

function concentratedFatFood(food: ProfessionalFood) {
  const nutrients = food.nutrients;
  if (!nutrients || !positive(nutrients.energyKcal)) return false;
  const name = normalizeFoodSearchText(food.officialName);
  const fats = nutrients.fatsGrams ?? 0;
  return (
    includesAny(name, ["costela", "com gordura", "pele", "frit", "maionese", "charque"]) ||
    (fats >= 15 && (fats * 9) / nutrients.energyKcal >= 0.45)
  );
}

const LOW_HABITUALITY_MARKERS = [
  "cuscuz paulista",
  "alcachofra",
  "leite de cabra",
  "leite, cabra",
  "pe de galinha",
  "pe de frango",
  "serralha",
  "acai",
  "feijao branco",
  "conserva",
  "com castanha",
] as const;

const INDUSTRIAL_PROTEIN_MARKERS = [
  "steak",
  "empanad",
  "nugget",
  "hamburguer",
  "linguica",
  "salsicha",
  "presunto",
] as const;

const COMMON_AUTOMATIC_FRUIT_MARKERS = [
  "banana",
  "mamao",
  "manga",
  "goiaba",
  "laranja",
  "melancia",
  "melao",
  "abacaxi",
  "acerola",
  "caju",
  "pinha",
  "abacate",
] as const;

const COMMON_AUTOMATIC_VEGETABLE_MARKERS = [
  "abobora",
  "abobrinha",
  "berinjela",
  "beterraba",
  "brocolis",
  "cenoura",
  "chuchu",
  "couve",
  "quiabo",
  "repolho",
  "tomate",
  "vagem",
] as const;

function registeredFoodText(context: PatientContext) {
  return normalizeFoodSearchText([
    ...context.clinical.preferredFoods,
    ...(context.clinical.habitualIntakeBasis === "CONFIRMED_REPRESENTATIVE"
      ? context.clinical.habitualFoods ?? []
      : []),
  ].join(" "));
}

function foodMatchesRegisteredText(food: ProfessionalFood, registeredText: string) {
  const normalizedName = normalizeFoodSearchText(food.officialName);
  return registeredText.includes(normalizedName) ||
    normalizedName
      .split(/[^\p{L}\p{N}]+/u)
      .some((token) => token.length >= 5 && registeredText.includes(token));
}

function includesNormalizedFoodTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u")
    .test(value);
}

function normalizedFoodWords(value: string) {
  return normalizeFoodSearchText(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveRegionalFoodContext(context: PatientContext) {
  const location = context.patient.location;
  const hasLocation = Boolean(location?.city?.trim() || location?.state?.trim());
  const recognizedRegions = hasLocation
    ? normalizeFoodSearchText(location?.recognizedRegions.join(" ") ?? "")
    : "";
  const ceara = includesAny(recognizedRegions, ["ceara"]);
  const cariri = includesAny(recognizedRegions, ["cariri"]);
  const northeast = ceara || cariri || includesAny(recognizedRegions, ["nordeste"]);
  const complementaryText = normalizeFoodSearchText([
    ...context.clinical.dailyRoutine,
    ...context.clinical.relevantObservations,
    context.nutritionStrategy.observations,
  ].join(" "));
  const textualSupport = northeast && includesAny(complementaryText, [
    ...(ceara ? ["ceara", "cearense"] : []),
    ...(cariri ? ["cariri"] : []),
    "nordeste",
    "nordestina",
    "nordestino",
  ]);
  return { hasLocation, northeast, ceara, cariri, textualSupport } as const;
}

function plainNortheastRegionalFood(food: ProfessionalFood) {
  const name = normalizeFoodSearchText(food.officialName);
  return includesAny(name, [
    "cuscuz",
    "tapioca",
    "macaxeira",
    "mandioca",
    "inhame",
    "feijao",
  ]) && !includesAny(name, ["paulista", "leite de coco", "frit"]);
}

export function regionalFoodRankingBonus(
  context: PatientContext,
  food: ProfessionalFood,
) {
  const regionalContext = resolveRegionalFoodContext(context);
  if (!regionalContext.northeast || !plainNortheastRegionalFood(food)) return 0;
  return 35 + (regionalContext.textualSupport ? 5 : 0);
}

function regionalCompatibilityReason(
  regionalContext: ReturnType<typeof resolveRegionalFoodContext>,
) {
  if (regionalContext.cariri) {
    return "Compatível com o padrão alimentar cotidiano do Cariri cearense.";
  }
  if (regionalContext.ceara) {
    return "Compatível com o padrão alimentar cotidiano do Ceará.";
  }
  return "Compatível com o padrão alimentar cotidiano do Nordeste.";
}

function industrialProtein(food: ProfessionalFood) {
  const name = normalizeFoodSearchText(food.officialName);
  return includesAny(name, INDUSTRIAL_PROTEIN_MARKERS);
}

function incompatibleMainMealBase(
  food: ProfessionalFood,
  role: ReturnType<typeof inferMealRole>,
  mealFunction: FoodMealFunction,
) {
  const name = normalizeFoodSearchText(food.officialName);
  return (
    (role === "LUNCH" || role === "DINNER") &&
    mealFunction === "STAPLE" &&
    includesAny(name, ["cuscuz", "tapioca"])
  );
}

function automaticFoodFitsHabitAndQuality(
  food: ProfessionalFood,
  registeredText: string,
) {
  const nameWords = normalizedFoodWords(food.officialName);
  const registeredWords = normalizedFoodWords(registeredText);
  const lowHabitualityMarker = LOW_HABITUALITY_MARKERS.find((marker) =>
    nameWords.includes(normalizedFoodWords(marker)),
  );
  if (
    lowHabitualityMarker &&
    !registeredWords.includes(normalizedFoodWords(lowHabitualityMarker))
  ) {
    return false;
  }
  if (
    nameWords.includes("cuscuz") &&
    nameWords.includes("leite de coco") &&
    !(registeredWords.includes("cuscuz") && registeredWords.includes("leite de coco"))
  ) {
    return false;
  }
  const industrialMarker = INDUSTRIAL_PROTEIN_MARKERS.find((marker) =>
    nameWords.includes(normalizedFoodWords(marker)),
  );
  if (
    industrialMarker &&
    !registeredWords.includes(normalizedFoodWords(industrialMarker))
  ) return false;
  return true;
}

function automaticProduceIsHabitual(
  food: ProfessionalFood,
  semantic: FoodSemanticProfile,
  registeredText: string,
) {
  const name = normalizeFoodSearchText(food.officialName);
  if (semantic.functions.includes("FRUIT")) {
    return COMMON_AUTOMATIC_FRUIT_MARKERS.some((marker) =>
      includesNormalizedFoodTerm(name, marker),
    ) ||
      foodMatchesRegisteredText(food, registeredText);
  }
  if (semantic.functions.includes("VEGETABLE")) {
    return COMMON_AUTOMATIC_VEGETABLE_MARKERS.some((marker) =>
      includesNormalizedFoodTerm(name, marker),
    ) ||
      foodMatchesRegisteredText(food, registeredText);
  }
  return true;
}

function culinaryCompatibility(
  candidate: FoodSemanticProfile,
  selected: readonly FoodSemanticProfile[],
) {
  return selected.every((item) =>
    candidate.combinesWith.some((mealFunction) => item.functions.includes(mealFunction)) ||
    item.combinesWith.some((mealFunction) => candidate.functions.includes(mealFunction)),
  );
}

function coherenceCoverage(profiles: readonly FoodCoherenceProfile[]) {
  return profiles.reduce<MealCoherenceNeed>(
    (coverage, profile) => ({
      protein: Math.max(coverage.protein, profile.protein),
      carbohydrate: Math.max(
        coverage.carbohydrate,
        Math.max(profile.stapleCarbohydrate, profile.carbohydrate * 0.45),
      ),
      produce: Math.max(coverage.produce, profile.fruit, profile.vegetable),
      healthyFat: Math.max(coverage.healthyFat, profile.healthyFat),
    }),
    { protein: 0, carbohydrate: 0, produce: 0, healthyFat: 0 },
  );
}

function clinicalCoherenceContext(context: PatientContext): ClinicalCoherenceContext {
  const objective = normalizeFoodSearchText(
    context.nutritionStrategy.objective ?? context.patient.objective,
  );
  const clinical = normalizeFoodSearchText([
    ...context.clinical.pathologies,
    ...context.clinical.restrictions,
    context.nutritionStrategy.observations,
  ].join(" "));
  const athlete =
    includesAny(objective, ["hipertrof", "performance", "atleta", "ganho de massa"]) ||
    Boolean(context.clinical.exercise.frequency || context.clinical.exercise.modality);
  return {
    weightLoss: includesAny(objective, ["emagrec", "perda de peso", "reduzir peso"]),
    hypertrophy: includesAny(objective, ["hipertrof", "ganho de massa"]),
    athlete,
    glycemicAttention: includesAny(clinical, ["diabetes", "resistencia a insulina", "sop"]),
    hypertension: includesAny(clinical, ["hipertensao", " has "]),
    endometriosis: clinical.includes("endometriose"),
    olderAdult: context.patient.ageYears >= 60,
  };
}

function clinicalCoherenceScore(
  profile: FoodCoherenceProfile,
  context: ClinicalCoherenceContext,
) {
  let score = 0;
  const reasons: string[] = [];

  if (context.weightLoss) {
    score += profile.fiber * 10 + profile.protein * 6 - profile.energyDensity * 4;
    if (profile.fiber >= 0.45) reasons.push("favorece saciedade compatível com o objetivo");
  }
  if (context.hypertrophy) {
    score += profile.protein * 12 + profile.carbohydrate * 4;
    if (profile.protein >= 0.55) reasons.push("contribui para a distribuição proteica");
  }
  if (context.athlete) {
    score += profile.carbohydrate * 7 + profile.protein * 6;
    if (profile.carbohydrate >= 0.55) reasons.push("compatível com a demanda da rotina ativa");
  }
  if (context.glycemicAttention) {
    score += profile.fiber * 10 + profile.carbohydrate * 4 - profile.treatLikelihood * 10;
    if (profile.fiber >= 0.45) reasons.push("melhor qualidade de carboidratos e fibras");
  }
  if (context.hypertension) {
    score += profile.produce * 6 - profile.sodiumDensity * 12;
    if (profile.sodiumDensity <= 0.2) reasons.push("menor impacto de sódio na composição");
  }
  if (context.endometriosis) {
    score += profile.produce * 7 + profile.fiber * 5 + profile.healthyFat * 4 - profile.treatLikelihood * 5;
    if (profile.produce >= 0.6) reasons.push("amplia a diversidade de alimentos in natura");
  }
  if (context.olderAdult) {
    score += profile.protein * 8 + profile.practicality * 3;
    if (profile.protein >= 0.55) reasons.push("apoia a distribuição proteica do idoso");
  }
  return { score, reasons };
}

function candidateCoherence(
  candidate: Candidate,
  profile: FoodCoherenceProfile,
  selected: readonly Candidate[],
  selectedProfiles: readonly FoodCoherenceProfile[],
  coverage: MealCoherenceNeed,
  need: MealCoherenceNeed,
  role: ReturnType<typeof inferMealRole>,
  focusKey: keyof MealCoherenceNeed,
  clinical: ReturnType<typeof clinicalCoherenceScore>,
  hasRegisteredRoutine: boolean,
  previousUseCount: number,
) {
  const group = normalizeFoodSearchText(candidate.food.foodGroup);
  const selectedGroups = new Set(selected.map((item) => normalizeFoodSearchText(item.food.foodGroup)));
  const keys = ["protein", "carbohydrate", "produce", "healthyFat"] as const;
  const mainMeal = role === "LUNCH" || role === "DINNER";
  const alignedProfile: FoodCoherenceProfile = {
    ...profile,
    carbohydrate: mainMeal
      ? Math.max(profile.stapleCarbohydrate, profile.carbohydrate * 0.45)
      : profile.carbohydrate,
    produce: mainMeal
      ? profile.vegetable
      : Math.max(profile.fruit, profile.vegetable * 0.45),
  };
  const alignedCoverageGain = keys.reduce(
    (sum, key) =>
      sum + Math.min(alignedProfile[key], Math.max(0, need[key] - coverage[key])),
    0,
  );
  const alignedMealScore = keys.reduce(
    (sum, key) => sum + alignedProfile[key] * need[key],
    0,
  );
  const unlikelyPair = selectedProfiles.some(
    (item) =>
      (item.treatLikelihood >= 0.65 && profile.concentratedDairy > 0) ||
      (profile.treatLikelihood >= 0.65 && item.concentratedDairy > 0),
  );
  const preference = candidate.eligibility.reason.startsWith("Preferência registrada:");
  const lightMeal = role === "BREAKFAST" || role === "SNACK";
  const mainProteinGroup = includesAny(group, ["carnes", "pescados"]);
  const functionalRedundancyPenalty =
    (coverage.carbohydrate >= need.carbohydrate * 0.8
      ? profile.stapleCarbohydrate * 20
      : 0) +
    (coverage.protein >= need.protein * 0.8 ? profile.protein * 12 : 0) +
    (coverage.produce >= need.produce * 0.8
      ? alignedProfile.produce * 12
      : 0);
  const score =
    20 +
    alignedCoverageGain * 28 +
    alignedMealScore * 8 +
    alignedProfile[focusKey] * 100 +
    profile.protein * (mainMeal ? 16 : 10) +
    alignedProfile.carbohydrate * 5 +
    alignedProfile.produce * (mainMeal ? 8 : 5) +
    profile.healthyFat * 3 +
    (mainMeal
      ? profile.stapleCarbohydrate * 12 + profile.vegetable * 12 - profile.fruit * 4
      : profile.breakfastAffinity * (role === "BREAKFAST" ? 12 : 7)) +
    profile.fiber * 6 +
    profile.practicality * (hasRegisteredRoutine ? 5 : 2) +
    clinical.score +
    (preference ? 14 : 0) +
    (selectedGroups.has(group) ? -9 : 7) -
    previousUseCount * 5 -
    (mainMeal ? profile.treatLikelihood * 22 : profile.treatLikelihood * 5) -
    (mainMeal ? profile.concentratedDairy * 8 : 0) -
    profile.processingPenalty * (mainMeal ? 18 : 10) -
    (lightMeal && mainProteinGroup ? 20 : 0) -
    functionalRedundancyPenalty -
    (unlikelyPair ? 30 : 0);
  const reasons = [
    alignedCoverageGain >= 0.45 ? "melhora o equilíbrio entre grupos e funções" : undefined,
    selectedGroups.has(group) ? undefined : "aumenta a diversidade da refeição",
    preference ? "preferência registrada" : undefined,
    ...clinical.reasons,
  ].filter((value): value is string => Boolean(value));
  return {
    score,
    profile: alignedProfile,
    reasons: [
      ...(mainMeal && profile.stapleCarbohydrate >= 0.55
        ? ["oferece base de carboidrato compatível com refeição principal"]
        : []),
      ...(mainMeal && profile.vegetable >= 0.55
        ? ["complementa a refeição com hortaliças"]
        : []),
      ...reasons,
    ],
  };
}

function portionSlots(
  candidates: readonly Candidate[],
  context: PatientContext,
  meals: readonly { readonly name: string; readonly time: string }[],
  previouslyUsedFoodIds: readonly string[] = [],
  previousUseCount = 4,
) {
  const slots: PortionSlot[] = [];
  const useCount = new Map<string, number>(
    previouslyUsedFoodIds.map((foodId) => [foodId, previousUseCount]),
  );
  const familyUseCount = new Map<string, number>();
  const semantics = new Map(
    candidates.map((candidate) => [
      candidate.food.id,
      cachedFoodSemanticProfile(candidate.food),
    ]),
  );
  const profiles = new Map(
    candidates.map((candidate) => [
      candidate.food.id,
      cachedFoodCoherenceProfile(candidate.food),
    ]),
  );
  const preferenceText = normalizeFoodSearchText(
    context.clinical.preferredFoods.join(" "),
  );
  const habitualText = normalizeFoodSearchText(
    context.clinical.habitualIntakeBasis === "CONFIRMED_REPRESENTATIVE"
      ? (context.clinical.habitualFoods ?? []).join(" ")
      : "",
  );
  const registeredText = registeredFoodText(context);
  const regionalContext = resolveRegionalFoodContext(context);
  const clinicalContext = clinicalCoherenceContext(context);
  const isRegistered = (registeredText: string, foodName: string) => {
    const normalizedName = normalizeFoodSearchText(foodName);
    return registeredText.includes(normalizedName) ||
      normalizedName
        .split(/[^\p{L}\p{N}]+/u)
        .some((token) => token.length >= 4 && registeredText.includes(token));
  };
  const registeredNonRegionalBreakfastStaple = candidates.some((candidate) => {
    const semantic = semantics.get(candidate.food.id)!;
    return semantic.automaticEligible &&
      semantic.compatibleMeals.includes("BREAKFAST") &&
      semantic.functions.includes("STAPLE") &&
      !semantic.functions.includes("REGIONAL_BASE") &&
      foodMatchesRegisteredText(candidate.food, registeredText);
  });
  for (let mealIndex = 0; mealIndex < meals.length; mealIndex += 1) {
    const meal = meals[mealIndex];
    const role = inferMealRole(meal.name, meal.time) as SemanticMealRole;
    const selected: Candidate[] = [];
    const selectedSemantics: FoodSemanticProfile[] = [];
    const selectedProfiles: FoodCoherenceProfile[] = [];
    const need = mealNeed(role);
    const structure = role === "BREAKFAST" && registeredNonRegionalBreakfastStaple
      ? ["STAPLE", "PROTEIN", "FRUIT"] as const
      : mealFunctionsFor(meal.name, meal.time);
    for (const mealFunction of structure) {
      const focus = mealFunctionFocus(mealFunction);
      const coverage = coherenceCoverage(selectedProfiles);
      const ranked = candidates
        .filter((candidate) => !selected.some((item) => item.food.id === candidate.food.id))
        .map((candidate) => ({
          candidate,
          semantic: semantics.get(candidate.food.id)!,
          profile: profiles.get(candidate.food.id)!,
          family: foodRepetitionFamily(candidate.food),
        }))
        .filter(({ candidate, semantic, profile, family }) =>
          semantic.automaticEligible &&
          semantic.compatibleMeals.includes(role) &&
          semantic.functions.includes(mealFunction) &&
          !incompatibleMainMealBase(candidate.food, role, mealFunction) &&
          (mealFunction === "REGIONAL_BASE" ||
            supportsMealFunction(candidate, profile, role, focus)) &&
          culinaryCompatibility(semantic, selectedSemantics) &&
          !concentratedFatFood(candidate.food) &&
          automaticFoodFitsHabitAndQuality(candidate.food, registeredText) &&
          automaticProduceIsHabitual(candidate.food, semantic, registeredText) &&
          (family !== "ovo" || (familyUseCount.get(family) ?? 0) === 0) &&
          (Boolean(context.clinical.financialAccessibility?.trim()) ||
            semantic.accessibility !== "HIGH_COST"),
        )
        .map(({ candidate, semantic, profile, family }) => {
          const normalizedName = normalizeFoodSearchText(candidate.food.officialName);
          const preferred = isRegistered(preferenceText, normalizedName);
          const habitual = isRegistered(habitualText, normalizedName);
          const regionalBonus = regionalFoodRankingBonus(context, candidate.food);
          const regionalDinnerBase =
            role === "DINNER" && semantic.functions.includes("REGIONAL_BASE");
          const naturalProtein =
            mealFunction === "PROTEIN" && !industrialProtein(candidate.food);
          const candidateUsualFat = (candidate.food.nutrients?.fatsGrams ?? 0) *
            (semantic.usualGrams / 100);
          const selectedAlreadyHasRelevantFat = selected.some((item) => {
            const selectedSemantic = semantics.get(item.food.id)!;
            return (item.food.nutrients?.fatsGrams ?? 0) *
              (selectedSemantic.usualGrams / 100) >= 5;
          });
          const coherence = candidateCoherence(
            candidate,
            profile,
            selected,
            selectedProfiles,
            coverage,
            need,
            role,
            focus,
            clinicalCoherenceScore(profile, clinicalContext),
            context.clinical.dailyRoutine.length > 0,
            useCount.get(candidate.food.id) ?? 0,
          );
          return {
            candidate,
            semantic,
            profile,
            family,
            preferred,
            habitual,
            coherenceReasons: coherence.reasons,
            score:
              coherence.score +
              (preferred ? 100 : 0) +
              (habitual ? 75 : 0) +
              regionalBonus +
              (role === "BREAKFAST" && regionalBonus > 0 ? 20 : 0) +
              (naturalProtein ? 50 : 0) +
              (semantic.accessibility === "LOW_COST" ? 15 : 0) +
              (semantic.frequency === "HABITUAL" ? 10 : 0) -
              (role === "BREAKFAST" &&
              selectedAlreadyHasRelevantFat &&
              candidateUsualFat >= 5
                ? 100
                : 0) -
              (regionalDinnerBase ? 25 : 0) -
              (useCount.get(candidate.food.id) ?? 0) * 40 -
              (familyUseCount.get(family) ?? 0) * 60,
          };
        })
        .sort(
          (left, right) =>
            Number(right.preferred) - Number(left.preferred) ||
            Number(right.habitual) - Number(left.habitual) ||
            right.score - left.score ||
            left.candidate.food.officialName.localeCompare(
              right.candidate.food.officialName,
              "pt-BR",
            ),
        );
      const chosen = ranked[0];
      if (!chosen) break;
      selected.push(chosen.candidate);
      selectedSemantics.push(chosen.semantic);
      selectedProfiles.push(chosen.profile);
      useCount.set(
        chosen.candidate.food.id,
        (useCount.get(chosen.candidate.food.id) ?? 0) + 1,
      );
      familyUseCount.set(
        chosen.family,
        (familyUseCount.get(chosen.family) ?? 0) + 1,
      );
      slots.push({
        ...chosen.candidate,
        mealIndex,
        mealFunction,
        semantic: chosen.semantic,
        selectionReason: [
          chosen.candidate.eligibility.reason,
          `Função ${mealFunction.toLocaleLowerCase("pt-BR")} prevista na estrutura de ${meal.name}.`,
          chosen.preferred ? "Preferência registrada." : undefined,
          chosen.habitual ? "Alimento presente no recordatório." : undefined,
          ...chosen.coherenceReasons,
          regionalFoodRankingBonus(context, chosen.candidate.food) > 0
            ? regionalCompatibilityReason(regionalContext)
            : "Compatibilidade baseada na função culinária e nos hábitos registrados.",
          `Porção usual: ${chosen.semantic.usualGrams} g; faixa ${chosen.semantic.minimumGrams}-${chosen.semantic.maximumGrams} g.`,
        ].join(" "),
      });
    }
  }
  return slots;
}

function missingMealStructure(
  slots: readonly PortionSlot[],
  meals: readonly { readonly name: string; readonly time: string }[],
) {
  return meals.flatMap((meal, mealIndex) => {
    const mealSlots = slots.filter((slot) => slot.mealIndex === mealIndex);
    return mealFunctionsFor(meal.name, meal.time).flatMap(
      (mealFunction) =>
        mealSlots.some((slot) =>
          slot.semantic.functions.includes(mealFunction) ||
          (mealFunction === "REGIONAL_BASE" &&
            slot.semantic.functions.includes("STAPLE")),
        )
          ? []
          : [`${meal.name}: ${mealFunction.toLocaleLowerCase("pt-BR")}`],
    );
  });
}

function mealInternalJustification(
  slots: readonly PortionSlot[],
  context: PatientContext,
) {
  const reasons = slots.flatMap((slot) => slot.selectionReason.toLocaleLowerCase("pt-BR"));
  const details = [
    "Composi\u00e7\u00e3o apresentada como hip\u00f3tese cl\u00ednica para revis\u00e3o do nutricionista.",
    "Objetivo, estrat\u00e9gia nutricional, contexto da refei\u00e7\u00e3o e restri\u00e7\u00f5es registradas foram considerados antes do ajuste de por\u00e7\u00f5es.",
    reasons.some((reason) => reason.includes("prefer\u00eancia registrada"))
      ? "Inclui prefer\u00eancia alimentar registrada."
      : undefined,
    reasons.some((reason) => reason.includes("fibra"))
      ? "Prioriza maior oferta de fibras."
      : undefined,
    context.clinical.dailyRoutine.length
      ? "A praticidade foi ponderada conforme a rotina informada."
      : undefined,
  ].filter((value): value is string => Boolean(value));
  return details.join(" ");
}

const nutrientVectorCache = new WeakMap<
  ProfessionalFood,
  readonly [number, number, number, number]
>();

function nutrientVector(food: ProfessionalFood) {
  const cached = nutrientVectorCache.get(food);
  if (cached) return cached;
  const nutrients = food.nutrients!;
  const vector = [
    nutrients.energyKcal! / 100,
    nutrients.proteinGrams! / 100,
    nutrients.carbohydratesGrams! / 100,
    nutrients.fatsGrams! / 100,
  ] as const;
  nutrientVectorCache.set(food, vector);
  return vector;
}

function optimizationScore(input: {
  readonly slots: readonly PortionSlot[];
  readonly weights: readonly number[];
  readonly targets: readonly [number, number, number, number];
  readonly mealEnergyTargets: readonly number[];
}) {
  const actual = [0, 0, 0, 0];
  const mealEnergy = input.mealEnergyTargets.map(() => 0);
  const mealProtein = input.mealEnergyTargets.map(() => 0);
  const mealFats = input.mealEnergyTargets.map(() => 0);
  for (let index = 0; index < input.slots.length; index += 1) {
    const nutrients = nutrientVector(input.slots[index].food);
    for (let metric = 0; metric < actual.length; metric += 1) {
      actual[metric] += nutrients[metric] * input.weights[index];
    }
    mealEnergy[input.slots[index].mealIndex] +=
      nutrients[0] * input.weights[index];
    mealProtein[input.slots[index].mealIndex] +=
      nutrients[1] * input.weights[index];
    mealFats[input.slots[index].mealIndex] +=
      nutrients[3] * input.weights[index];
  }
  const deviations = actual.map((value, metric) =>
    (value - input.targets[metric]) / input.targets[metric],
  );
  const mealPenalty = mealEnergy.reduce((sum, value, mealIndex) => {
    const target = input.mealEnergyTargets[mealIndex];
    return sum + ((value - target) / target) ** 2;
  }, 0);
  const maximumMealDeviation = Math.max(
    ...mealEnergy.map((value, mealIndex) =>
      Math.abs((value - input.mealEnergyTargets[mealIndex]) /
        input.mealEnergyTargets[mealIndex]),
    ),
  );
  const totalMealEnergyTarget = input.mealEnergyTargets.reduce(
    (sum, target) => sum + target,
    0,
  );
  const proteinDistributionPenalty = mealProtein.reduce((sum, value, mealIndex) => {
    const proportionalTarget = input.targets[1] *
      (input.mealEnergyTargets[mealIndex] / totalMealEnergyTarget);
    const deficit = Math.max(0, (proportionalTarget - value) / proportionalTarget);
    return sum + deficit ** 2;
  }, 0);
  const mealFatConcentrationPenalty = mealFats.reduce((sum, value, mealIndex) => {
    const proportionalTarget = input.targets[3] *
      (input.mealEnergyTargets[mealIndex] / totalMealEnergyTarget);
    const maximumAutomaticFat = proportionalTarget * 1.5;
    const excess = Math.max(0, (value - maximumAutomaticFat) / maximumAutomaticFat);
    return sum + excess ** 2;
  }, 0);
  const foodCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  for (const slot of input.slots) {
    foodCounts.set(slot.food.id, (foodCounts.get(slot.food.id) ?? 0) + 1);
    const family = foodRepetitionFamily(slot.food);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  }
  const repetitionPenalty =
    [...foodCounts.values()].reduce(
      (sum, count) => sum + Math.max(0, count - 1) * 0.03,
      0,
    ) +
    [...familyCounts.entries()].reduce(
      (sum, [family, count]) =>
        sum + Math.max(0, count - (family === "ovo" ? 1 : 2)) * 0.02,
      0,
    );
  const maximumDeviation = Math.max(...deviations.map(Math.abs));
  const dailyToleranceExcess = deviations.reduce(
    (sum, deviation) => sum + Math.max(0, Math.abs(deviation) - 0.05) ** 2,
    0,
  );
  return maximumDeviation ** 2 * 4 +
    deviations.reduce((sum, deviation) => sum + deviation ** 2, 0) +
    dailyToleranceExcess * 200 +
    mealPenalty * 3 +
    maximumMealDeviation ** 2 * 6 +
    proteinDistributionPenalty * 0.75 +
    mealFatConcentrationPenalty * 4 +
    repetitionPenalty;
}

function optimizedTotals(
  slots: readonly PortionSlot[],
  weights: readonly number[],
): SmartPlanNutritionTotals {
  return sumTotals(
    slots.map((slot, index) => itemFromSlot(slot, weights[index])),
  );
}

function mealEnergyWithinTolerance(
  slots: readonly PortionSlot[],
  weights: readonly number[],
  mealEnergyTargets: readonly number[],
  tolerance = 0.1,
) {
  const totals = mealEnergyTargets.map(() => 0);
  for (let index = 0; index < slots.length; index += 1) {
    totals[slots[index].mealIndex] += nutrientVector(slots[index].food)[0] *
      weights[index];
  }
  return totals.every((total, mealIndex) =>
    Math.abs(total - mealEnergyTargets[mealIndex]) /
      mealEnergyTargets[mealIndex] <= tolerance,
  );
}

function totalsWithinTolerance(
  targets: SmartPlanNutritionTotals,
  totals: SmartPlanNutritionTotals,
) {
  return Object.values(targetComparison(targets, totals)).every(
    (comparison) => comparison.withinTolerance,
  );
}

function optimizeWeights(input: {
  readonly slots: readonly PortionSlot[];
  readonly targets: readonly [number, number, number, number];
  readonly mealEnergyTargets: readonly number[];
  readonly coordinatedPairs?: boolean;
  readonly crossMealIndexes?: readonly number[];
}) {
  const { slots, targets, mealEnergyTargets } = input;
  const rowCount = 4 + mealEnergyTargets.length;
  const matrix = slots.map((slot) => {
    const nutrients = nutrientVector(slot.food);
    return Array.from({ length: rowCount }, (_, row) => {
      if (row < 4) return nutrients[row] / targets[row];
      const mealIndex = row - 4;
      return slot.mealIndex === mealIndex
        ? (nutrients[0] / mealEnergyTargets[mealIndex]) * 0.35
        : 0;
    });
  });
  const desired = [1, 1, 1, 1, ...mealEnergyTargets.map(() => 0.35)];
  const weights = slots.map((slot) => slot.semantic.usualGrams);
  const minimumWeights = slots.map((slot) => slot.semantic.minimumGrams);
  const maximumWeights = slots.map((slot) => slot.semantic.maximumGrams);

  for (let iteration = 0; iteration < 250; iteration += 1) {
    let largestChange = 0;
    for (let column = 0; column < weights.length; column += 1) {
      const residual = desired.map((target, row) =>
        matrix.reduce(
          (sum, coefficients, index) => sum + coefficients[row] * weights[index],
          -target,
        ),
      );
      const denominator = matrix[column].reduce((sum, coefficient) => sum + coefficient ** 2, 0);
      if (!denominator) continue;
      const delta = -matrix[column].reduce(
        (sum, coefficient, row) => sum + coefficient * residual[row],
        0,
      ) / denominator;
      const next = Math.max(
        minimumWeights[column],
        Math.min(maximumWeights[column], weights[column] + delta),
      );
      largestChange = Math.max(largestChange, Math.abs(next - weights[column]));
      weights[column] = next;
    }
    if (largestChange < 0.0001) break;
  }
  const practicalWeights = weights.map((weight, index) =>
    practicalPortionGrams(slots[index].food, weight, slots[index].semantic),
  );

  const score = (candidateWeights: readonly number[]) => optimizationScore({
    slots,
    weights: candidateWeights,
    targets,
    mealEnergyTargets,
  });

  // O arredondamento para medidas humanas altera os quatro nutrientes ao mesmo
  // tempo. Refine na grade real de cada alimento, em vez de aceitar o resultado
  // contínuo arredondado como se ainda atendesse às metas.
  let bestScore = score(practicalWeights);
  for (let iteration = 0; iteration < 250; iteration += 1) {
    let bestMove:
      | { readonly index: number; readonly value: number; readonly score: number }
      | undefined;
    for (let index = 0; index < practicalWeights.length; index += 1) {
      const semantic = slots[index].semantic;
      for (const direction of [-1, 1] as const) {
        const value = practicalWeights[index] + semantic.stepGrams * direction;
        if (value < semantic.minimumGrams || value > semantic.maximumGrams) continue;
        const candidateWeights = [...practicalWeights];
        candidateWeights[index] = value;
        const candidateScore = score(candidateWeights);
        if (candidateScore + 1e-12 < (bestMove?.score ?? bestScore)) {
          bestMove = { index, value, score: candidateScore };
        }
      }
    }
    if (!bestMove) break;
    practicalWeights[bestMove.index] = bestMove.value;
    bestScore = bestMove.score;
  }

  // Alguns ajustes seguros exigem compensar dois alimentos da mesma refeição
  // ao mesmo tempo (por exemplo, reduzir uma fonte de gordura e aumentar uma
  // fonte proteica para preservar a energia). O refinamento unitário não pode
  // atravessar um passo intermediário pior, portanto avalie pares de movimentos
  // em uma busca limitada e mantenha somente melhorias globais.
  const maximumPairIterations = input.coordinatedPairs
    ? input.mealEnergyTargets.length >= 5
      ? Math.min(2, practicalWeights.length)
      : 1
    : 0;
  for (let iteration = 0; iteration < maximumPairIterations; iteration += 1) {
    let bestPair:
      | {
          readonly leftIndex: number;
          readonly leftValue: number;
          readonly rightIndex: number;
          readonly rightValue: number;
          readonly score: number;
        }
      | undefined;
    for (let leftIndex = 0; leftIndex < practicalWeights.length; leftIndex += 1) {
      const leftSlot = slots[leftIndex];
      const leftSemantic = leftSlot.semantic;
      for (let rightIndex = leftIndex + 1; rightIndex < practicalWeights.length; rightIndex += 1) {
        const rightSlot = slots[rightIndex];
        if (
          rightSlot.mealIndex !== leftSlot.mealIndex &&
          !input.crossMealIndexes?.includes(leftSlot.mealIndex) &&
          !input.crossMealIndexes?.includes(rightSlot.mealIndex)
        ) continue;
        const rightSemantic = rightSlot.semantic;
        for (const leftDirection of [-1, 1] as const) {
          const leftValue = practicalWeights[leftIndex] +
            leftSemantic.stepGrams * leftDirection;
          if (
            leftValue < leftSemantic.minimumGrams ||
            leftValue > leftSemantic.maximumGrams
          ) continue;
          for (const rightDirection of [-1, 1] as const) {
            const rightValue = practicalWeights[rightIndex] +
              rightSemantic.stepGrams * rightDirection;
            if (
              rightValue < rightSemantic.minimumGrams ||
              rightValue > rightSemantic.maximumGrams
            ) continue;
            const candidateWeights = [...practicalWeights];
            candidateWeights[leftIndex] = leftValue;
            candidateWeights[rightIndex] = rightValue;
            const candidateScore = score(candidateWeights);
            if (candidateScore + 1e-12 < (bestPair?.score ?? bestScore)) {
              bestPair = {
                leftIndex,
                leftValue,
                rightIndex,
                rightValue,
                score: candidateScore,
              };
            }
          }
        }
      }
    }
    if (!bestPair) break;
    practicalWeights[bestPair.leftIndex] = bestPair.leftValue;
    practicalWeights[bestPair.rightIndex] = bestPair.rightValue;
    bestScore = bestPair.score;
  }

  return practicalWeights;
}

function optimizedMealSafetyIssues(input: {
  readonly slots: readonly PortionSlot[];
  readonly weights: readonly number[];
  readonly plannedMeals: readonly { readonly name: string; readonly time: string }[];
  readonly targets: SmartPlanNutritionTotals;
  readonly mealEnergyTargets: readonly number[];
}) {
  const meals = input.plannedMeals.map((plannedMeal, mealIndex): SmartPlanDraftMeal => {
    const items = input.slots.flatMap((slot, slotIndex) =>
      slot.mealIndex === mealIndex && input.weights[slotIndex] > 0
        ? [itemFromSlot(slot, input.weights[slotIndex])]
        : [],
    );
    return {
      id: `optimization-meal-${mealIndex}`,
      name: plannedMeal.name,
      time: plannedMeal.time,
      targetEnergyKcal: input.mealEnergyTargets[mealIndex],
      items,
      totals: sumTotals(items),
      internalJustification: "",
    };
  });
  return generatedMealSafetyIssues({
    meals,
    slots: input.slots,
    mealEnergyTargets: input.mealEnergyTargets,
    dailyProteinTarget: input.targets.proteinGrams,
    dailyFatTarget: input.targets.fatsGrams,
  });
}

interface OptimizedCompositionAssessment {
  readonly safetyIssues: readonly string[];
  readonly dailyViolationCount: number;
  readonly dailyToleranceExcess: number;
  readonly mealEnergyWithinTolerance: boolean;
  readonly valid: boolean;
}

function optimizedCompositionAssessment(input: {
  readonly slots: readonly PortionSlot[];
  readonly weights: readonly number[];
  readonly plannedMeals: readonly { readonly name: string; readonly time: string }[];
  readonly targets: SmartPlanNutritionTotals;
  readonly mealEnergyTargets: readonly number[];
}): OptimizedCompositionAssessment {
  const totals = optimizedTotals(input.slots, input.weights);
  const dailyTotalsWithinTolerance = totalsWithinTolerance(input.targets, totals);
  const comparisons = targetComparison(input.targets, totals);
  const dailyViolations = Object.values(comparisons).filter(
    (comparison) => !comparison.withinTolerance,
  );
  const safetyIssues = optimizedMealSafetyIssues(input);
  const mealEnergyIsWithinTolerance = mealEnergyWithinTolerance(
    input.slots,
    input.weights,
    input.mealEnergyTargets,
  );
  return {
    safetyIssues,
    dailyViolationCount: dailyViolations.length,
    dailyToleranceExcess: dailyViolations.reduce(
      (sum, comparison) =>
        sum + Math.max(0, Math.abs(comparison.adequacyPercentage - 100) -
          comparison.tolerancePercentage),
      0,
    ),
    mealEnergyWithinTolerance: mealEnergyIsWithinTolerance,
    valid:
      dailyTotalsWithinTolerance &&
      mealEnergyIsWithinTolerance &&
      safetyIssues.length === 0,
  };
}

function compareCompositionAssessments(
  left: OptimizedCompositionAssessment,
  right: OptimizedCompositionAssessment,
) {
  return Number(left.valid) - Number(right.valid) ||
    right.safetyIssues.length - left.safetyIssues.length ||
    right.dailyViolationCount - left.dailyViolationCount ||
    right.dailyToleranceExcess - left.dailyToleranceExcess;
}

function mealCorrectionNeed(input: {
  readonly mealIndex: number;
  readonly slots: readonly PortionSlot[];
  readonly weights: readonly number[];
  readonly plannedMeals: readonly { readonly name: string; readonly time: string }[];
  readonly targets: SmartPlanNutritionTotals;
  readonly mealEnergyTargets: readonly number[];
}) {
  const items = input.slots.flatMap((slot, slotIndex) =>
    slot.mealIndex === input.mealIndex
      ? [itemFromSlot(slot, input.weights[slotIndex])]
      : [],
  );
  const totals = sumTotals(items);
  const dailyEnergyTarget = input.mealEnergyTargets.reduce(
    (sum, target) => sum + target,
    0,
  );
  const targetEnergy = input.mealEnergyTargets[input.mealIndex];
  const role = inferMealRole(
    input.plannedMeals[input.mealIndex].name,
    input.plannedMeals[input.mealIndex].time,
  );
  const minimumProteinRatio = role === "LUNCH" || role === "DINNER"
    ? 0.6
    : role === "BREAKFAST"
      ? 0.5
      : 0.45;
  const minimumProtein = input.targets.proteinGrams *
    (targetEnergy / dailyEnergyTarget) * minimumProteinRatio;
  const maximumFat = input.targets.fatsGrams *
    (targetEnergy / dailyEnergyTarget) * 1.5;
  return {
    proteinDeficit: Math.max(0, minimumProtein - totals.proteinGrams),
    fatExcess: Math.max(0, totals.fatsGrams - maximumFat),
  };
}

function optimizeComposition(input: {
  readonly candidates: readonly Candidate[];
  readonly initialSlots: readonly PortionSlot[];
  readonly plannedMeals: readonly { readonly name: string; readonly time: string }[];
  readonly targets: SmartPlanNutritionTotals;
  readonly mealEnergyTargets: readonly number[];
  readonly context: PatientContext;
}) {
  const targetVector = [
    input.targets.energyKcal,
    input.targets.proteinGrams,
    input.targets.carbohydratesGrams,
    input.targets.fatsGrams,
  ] as const;
  let slots = [...input.initialSlots];
  let weights = optimizeWeights({
    slots,
    targets: targetVector,
    mealEnergyTargets: input.mealEnergyTargets,
    coordinatedPairs: true,
  });
  let score = optimizationScore({
    slots,
    weights,
    targets: targetVector,
    mealEnergyTargets: input.mealEnergyTargets,
  });
  const semanticCandidates = input.candidates.map((candidate) => ({
    candidate,
    semantic: cachedFoodSemanticProfile(candidate.food),
    profile: cachedFoodCoherenceProfile(candidate.food),
  }));
  const registeredText = registeredFoodText(input.context);
  const preferenceText = normalizeFoodSearchText(
    input.context.clinical.preferredFoods.join(" "),
  );
  const habitualText = normalizeFoodSearchText(
    input.context.clinical.habitualIntakeBasis === "CONFIRMED_REPRESENTATIVE"
      ? (input.context.clinical.habitualFoods ?? []).join(" ")
      : "",
  );
  const regionalContext = resolveRegionalFoodContext(input.context);
  const rankingSignals = new Map(
    input.candidates.map(({ food }) => [
      food.id,
      {
        preferred: foodMatchesRegisteredText(food, preferenceText),
        habitual: foodMatchesRegisteredText(food, habitualText),
        regionalBonus: regionalFoodRankingBonus(input.context, food),
        industrial: industrialProtein(food),
        normalizedName: normalizeFoodSearchText(food.officialName),
      },
    ]),
  );
  const automaticSignals = new Map(
    semanticCandidates.map(({ candidate, semantic }) => [
      candidate.food.id,
      {
        family: foodRepetitionFamily(candidate.food),
        plainNortheast: plainNortheastRegionalFood(candidate.food),
        concentratedFat: concentratedFatFood(candidate.food),
        fitsHabitAndQuality: automaticFoodFitsHabitAndQuality(
          candidate.food,
          registeredText,
        ),
        habitualProduce: automaticProduceIsHabitual(
          candidate.food,
          semantic,
          registeredText,
        ),
      },
    ]),
  );

  type CompositionState = {
    readonly slots: PortionSlot[];
    readonly weights: number[];
    readonly score: number;
    readonly assessment: OptimizedCompositionAssessment;
  };
  const assess = (candidateSlots: readonly PortionSlot[], candidateWeights: readonly number[]) =>
    optimizedCompositionAssessment({
      slots: candidateSlots,
      weights: candidateWeights,
      plannedMeals: input.plannedMeals,
      targets: input.targets,
      mealEnergyTargets: input.mealEnergyTargets,
    });
  let currentAssessment = assess(slots, weights);
  let bestValid: CompositionState | undefined = currentAssessment.valid
    ? { slots, weights, score, assessment: currentAssessment }
    : undefined;

  // Planos curtos têm menos graus de liberdade e convergem em poucos passes.
  // Planos com cinco ou mais refeições recebem espaço adicional para que uma
  // correção local possa ser compensada sem deslocar a pendência para outra refeição.
  const maximumCompositionPasses = input.plannedMeals.length >= 5
    ? 12
    : input.plannedMeals.length === 4
      ? 4
      : 3;
  for (let pass = 0; pass < maximumCompositionPasses; pass += 1) {
    const totals = optimizedTotals(slots, weights);
    currentAssessment = assess(slots, weights);
    if (currentAssessment.valid) break;
    const desiredDirection = [
      (input.targets.energyKcal - totals.energyKcal) / input.targets.energyKcal,
      (input.targets.proteinGrams - totals.proteinGrams) / input.targets.proteinGrams,
      (input.targets.carbohydratesGrams - totals.carbohydratesGrams) / input.targets.carbohydratesGrams,
      (input.targets.fatsGrams - totals.fatsGrams) / input.targets.fatsGrams,
    ];
    const correctionNeeds = input.plannedMeals.map((_, mealIndex) =>
      mealCorrectionNeed({
        mealIndex,
        slots,
        weights,
        plannedMeals: input.plannedMeals,
        targets: input.targets,
        mealEnergyTargets: input.mealEnergyTargets,
      }),
    );
    const proposals: {
      readonly slots: PortionSlot[];
      readonly weights: number[];
      readonly preliminaryScore: number;
      readonly assessment: OptimizedCompositionAssessment;
      readonly safetyDirected: boolean;
    }[] = [];

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const current = slots[slotIndex];
      const currentSignals = rankingSignals.get(current.food.id)!;
      const currentAutomaticSignals = automaticSignals.get(current.food.id)!;
      const role = inferMealRole(
        input.plannedMeals[current.mealIndex].name,
        input.plannedMeals[current.mealIndex].time,
      ) as SemanticMealRole;
      const foodIdsInMeal = new Set(
        slots
          .filter((slot, index) => slot.mealIndex === current.mealIndex && index !== slotIndex)
          .map((slot) => slot.food.id),
      );
      const otherSemanticsInMeal = slots
        .filter((slot, index) =>
          slot.mealIndex === current.mealIndex && index !== slotIndex,
        )
        .map((slot) => slot.semantic);
      const otherFamiliesInDay = slots
        .filter((_, index) => index !== slotIndex)
        .map((slot) => automaticSignals.get(slot.food.id)!.family);
      const otherMealHasRelevantFat = slots
        .filter((slot, index) =>
          slot.mealIndex === current.mealIndex && index !== slotIndex,
        )
        .some((slot) =>
          (slot.food.nutrients?.fatsGrams ?? 0) *
            (slot.semantic.usualGrams / 100) >= 5,
        );
      const rankedAlternatives = semanticCandidates
        .filter(({ candidate, semantic, profile }) => {
          const automatic = automaticSignals.get(candidate.food.id)!;
          const signals = rankingSignals.get(candidate.food.id)!;
          return candidate.food.id !== current.food.id &&
            (!currentSignals.preferred || signals.preferred) &&
            (!currentSignals.habitual || signals.preferred || signals.habitual) &&
            !foodIdsInMeal.has(candidate.food.id) &&
            semantic.automaticEligible &&
            semantic.compatibleMeals.includes(role) &&
            semantic.functions.includes(current.mealFunction) &&
            !incompatibleMainMealBase(candidate.food, role, current.mealFunction) &&
            supportsMealFunction(
              candidate,
              profile,
              role,
              mealFunctionFocus(current.mealFunction),
            ) &&
            profile.processingPenalty < 0.5 &&
            profile.sodiumDensity < 0.8 &&
            (!currentAutomaticSignals.plainNortheast || automatic.plainNortheast) &&
            !automatic.concentratedFat &&
            automatic.fitsHabitAndQuality &&
            automatic.habitualProduce &&
            !(role === "BREAKFAST" &&
              otherMealHasRelevantFat &&
              (candidate.food.nutrients?.fatsGrams ?? 0) *
                (semantic.usualGrams / 100) >= 5) &&
            (automatic.family !== "ovo" || !otherFamiliesInDay.includes("ovo")) &&
            culinaryCompatibility(semantic, otherSemanticsInMeal);
        })
        .sort((left, right) => {
          const potential = (candidate: Candidate) => nutrientVector(candidate.food)
            .reduce((sum, nutrient, metric) =>
              sum + desiredDirection[metric] * (nutrient * 100 / targetVector[metric]), 0);
          const clinicalPriority = (candidate: Candidate) => {
            const signals = rankingSignals.get(candidate.food.id)!;
            const mainMeal = role === "LUNCH" || role === "DINNER";
            return (
              (signals.preferred ? 100 : 0) +
              (signals.habitual ? 75 : 0) +
              signals.regionalBonus +
              (current.mealFunction === "PROTEIN" && !signals.industrial ? 80 : 0) -
              (signals.industrial ? 120 : 0) +
              (mainMeal && current.mealFunction === "STAPLE" && signals.normalizedName.includes("arroz") ? 50 : 0) -
              (mainMeal && signals.normalizedName.includes("cuscuz") ? 40 : 0)
            );
          };
          return clinicalPriority(right.candidate) - clinicalPriority(left.candidate) ||
            potential(right.candidate) - potential(left.candidate);
        });
      const need = correctionNeeds[current.mealIndex];
      const proteinDirected = need.proteinDeficit > 0 &&
          (current.mealFunction === "PROTEIN" || current.mealFunction === "DAIRY")
        ? [...rankedAlternatives]
            .sort((left, right) => {
              const density = (entry: typeof left) =>
                (entry.candidate.food.nutrients?.proteinGrams ?? 0) /
                Math.max(1, entry.candidate.food.nutrients?.energyKcal ?? 0);
              return density(right) - density(left);
            })
            .slice(0, 2)
        : [];
      const fatDirected = need.fatExcess > 0
        ? [...rankedAlternatives]
            .sort((left, right) => {
              const density = (entry: typeof left) =>
                (entry.candidate.food.nutrients?.fatsGrams ?? 0) /
                Math.max(1, entry.candidate.food.nutrients?.energyKcal ?? 0);
              return density(left) - density(right);
            })
            .slice(0, 2)
        : [];
      const safetyDirectedIds = new Set(
        [...proteinDirected, ...fatDirected].map(({ candidate }) => candidate.food.id),
      );
      const alternatives = [...new Map(
        [...rankedAlternatives.slice(0, 4), ...proteinDirected, ...fatDirected]
          .map((alternative) => [alternative.candidate.food.id, alternative]),
      ).values()];

      for (const alternative of alternatives) {
        const trialSlots = [...slots];
        trialSlots[slotIndex] = {
          ...alternative.candidate,
          mealIndex: current.mealIndex,
          mealFunction: current.mealFunction,
          semantic: alternative.semantic,
          selectionReason: [
            alternative.candidate.eligibility.reason,
            `Substitui alimento da mesma função ${current.mealFunction.toLocaleLowerCase("pt-BR")} para ajustar simultaneamente energia e macronutrientes.`,
            regionalContext.northeast && plainNortheastRegionalFood(alternative.candidate.food)
              ? regionalCompatibilityReason(regionalContext)
              : "Preparação habitual brasileira.",
            `Porção usual: ${alternative.semantic.usualGrams} g; faixa ${alternative.semantic.minimumGrams}-${alternative.semantic.maximumGrams} g.`,
          ].join(" "),
        };
        const currentEnergyDensity = nutrientVector(current.food)[0];
        const alternativeEnergyDensity = nutrientVector(alternative.candidate.food)[0];
        const energyEquivalentWeight = alternativeEnergyDensity > 0
          ? weights[slotIndex] * currentEnergyDensity / alternativeEnergyDensity
          : alternative.semantic.usualGrams;
        const trialWeights = [...weights];
        trialWeights[slotIndex] = practicalPortionGrams(
          alternative.candidate.food,
          energyEquivalentWeight,
          alternative.semantic,
        );
        proposals.push({
          slots: trialSlots,
          weights: trialWeights,
          preliminaryScore: optimizationScore({
            slots: trialSlots,
            weights: trialWeights,
            targets: targetVector,
            mealEnergyTargets: input.mealEnergyTargets,
          }),
          assessment: assess(trialSlots, trialWeights),
          safetyDirected: safetyDirectedIds.has(alternative.candidate.food.id),
        });
      }
    }

    const finalistMap = new Map<string, (typeof proposals)[number]>();
    const addFinalists = (candidates: readonly (typeof proposals)[number][]) => {
      for (const candidate of candidates) {
        const signature = candidate.slots.map((slot) => slot.food.id).join("|");
        if (!finalistMap.has(signature)) finalistMap.set(signature, candidate);
      }
    };
    addFinalists(
      [...proposals]
        .sort((left, right) =>
          compareCompositionAssessments(right.assessment, left.assessment) ||
          left.preliminaryScore - right.preliminaryScore,
        )
        .slice(0, 3),
    );
    addFinalists(
      [...proposals]
        .sort((left, right) => left.preliminaryScore - right.preliminaryScore)
        .slice(0, 3),
    );
    addFinalists(
      proposals
        .filter((proposal) => proposal.safetyDirected)
        .sort((left, right) =>
          compareCompositionAssessments(right.assessment, left.assessment) ||
          left.preliminaryScore - right.preliminaryScore,
        )
        .slice(0, 2),
    );

    let bestByScore: CompositionState | undefined;
    let bestClinical: CompositionState | undefined;
    const crossMealIndexes = correctionNeeds.flatMap((need, mealIndex) =>
      need.proteinDeficit > 0 || need.fatExcess > 0 ? [mealIndex] : [],
    );
    const allFinalists = [...finalistMap.values()];
    const finalists = input.plannedMeals.length >= 5
      ? allFinalists.slice(0, 8)
      : [...new Set([
          ...allFinalists.filter((finalist) => finalist.safetyDirected).slice(0, 1),
          ...allFinalists,
        ])].slice(0, 4);
    for (const finalist of finalists) {
      const trialWeights = optimizeWeights({
        slots: finalist.slots,
        targets: targetVector,
        mealEnergyTargets: input.mealEnergyTargets,
        coordinatedPairs: true,
        crossMealIndexes:
          input.plannedMeals.length >= 5 ? crossMealIndexes : undefined,
      });
      const trialScore = optimizationScore({
        slots: finalist.slots,
        weights: trialWeights,
        targets: targetVector,
        mealEnergyTargets: input.mealEnergyTargets,
      });
      const trialState: CompositionState = {
        slots: finalist.slots,
        weights: trialWeights,
        score: trialScore,
        assessment: assess(finalist.slots, trialWeights),
      };
      if (trialScore + 1e-12 < (bestByScore?.score ?? score)) {
        bestByScore = trialState;
      }
      if (
        !bestClinical ||
        compareCompositionAssessments(
          trialState.assessment,
          bestClinical.assessment,
        ) > 0 ||
        (compareCompositionAssessments(
          trialState.assessment,
          bestClinical.assessment,
        ) === 0 && trialScore < bestClinical.score)
      ) {
        bestClinical = trialState;
      }
      if (trialState.assessment.valid && trialScore < (bestValid?.score ?? Infinity)) {
        bestValid = trialState;
      }
    }

    if (bestValid) break;
    const next = bestByScore ?? (
      bestClinical && (
        bestClinical.assessment.safetyIssues.length <
          currentAssessment.safetyIssues.length ||
        compareCompositionAssessments(
          bestClinical.assessment,
          currentAssessment,
        ) > 0
      )
        ? bestClinical
        : undefined
    );
    if (!next) break;
    slots = next.slots;
    weights = next.weights;
    score = next.score;
  }

  const result = bestValid ?? { slots, weights };
  return { slots: result.slots, weights: result.weights };
}

export function practicalPortionGrams(
  food: ProfessionalFood,
  rawGrams: number,
  semantic = cachedFoodSemanticProfile(food),
) {
  if (semantic.automaticEligible) {
    const rounded = Math.round(rawGrams / semantic.stepGrams) * semantic.stepGrams;
    return Math.max(
      semantic.minimumGrams,
      Math.min(semantic.maximumGrams, rounded),
    );
  }
  const name = normalizeFoodSearchText(food.officialName);
  const group = normalizeFoodSearchText(food.foodGroup);
  const step = includesAny(name, ["ovo, galinha, inteiro", "ovo de galinha inteiro"])
    ? 50
    : includesAny(group, ["carnes", "pescados", "ovos"])
      ? 10
      : includesAny(group, ["frutas", "verduras", "hortalicas"])
        ? 25
        : includesAny(group, ["gorduras", "oleos", "sementes", "nozes"])
          ? 5
          : 10;
  const minimum = includesAny(group, ["carnes", "pescados"])
    ? 50
    : group.includes("ovos")
      ? 50
      : includesAny(group, ["frutas", "verduras", "hortalicas"])
        ? 50
        : step;
  return Math.max(minimum, Math.round(rawGrams / step) * step);
}

function zeroTotals(): SmartPlanNutritionTotals {
  return { energyKcal: 0, proteinGrams: 0, carbohydratesGrams: 0, fatsGrams: 0 };
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function sumTotals(values: readonly SmartPlanNutritionTotals[]) {
  return values.reduce(
    (total, value) => ({
      energyKcal: rounded(total.energyKcal + value.energyKcal),
      proteinGrams: rounded(total.proteinGrams + value.proteinGrams),
      carbohydratesGrams: rounded(total.carbohydratesGrams + value.carbohydratesGrams),
      fatsGrams: rounded(total.fatsGrams + value.fatsGrams),
    }),
    zeroTotals(),
  );
}

function householdMeasureLabel(
  food: ProfessionalFood,
  prescribedAmount: number,
) {
  const measures = food.householdMeasures.filter(
    (measure) => measure.active && positive(measure.grams) && positive(measure.quantity),
  );
  const measure = measures.find((candidate) => candidate.isDefault) ??
    [...measures].sort((left, right) => {
      const leftUnitGrams = left.grams / left.quantity;
      const rightUnitGrams = right.grams / right.quantity;
      return Math.abs(leftUnitGrams - prescribedAmount) -
        Math.abs(rightUnitGrams - prescribedAmount);
    })[0];
  if (!measure) {
    return `Porção de ${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(prescribedAmount)} g (medida caseira validada não disponível)`;
  }
  const measureName = measure.name;
  const gramsPerMeasure = measure.grams / measure.quantity;
  const rawQuantity = prescribedAmount / gramsPerMeasure;
  const quantity = Math.max(0.25, Math.round(rawQuantity * 4) / 4);
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(quantity)} ${measureName}`;
}

function itemFromSlot(slot: PortionSlot, prescribedAmount: number): SmartPlanDraftItem {
  const calculated = calculateFoodNutrientsForGrams(
    normalizeFoodNutrients(slot.food.nutrients!),
    prescribedAmount,
  );
  return {
    foodId: slot.food.id,
    name: slot.food.officialName,
    source: slot.food.source.kind,
    group: slot.food.foodGroup,
    prescribedAmount,
    unit: "g",
    householdMeasure: householdMeasureLabel(slot.food, prescribedAmount),
    energyKcal: calculated.energyKcal,
    proteinGrams: calculated.proteinGrams,
    carbohydratesGrams: calculated.carbohydratesGrams,
    fatsGrams: calculated.fatsGrams,
    selectionReason: slot.selectionReason,
  };
}

const UNSAFE_MEAL_MESSAGE =
  "Não foi possível completar esta refeição com segurança. Revise as preferências, restrições ou alimentos disponíveis.";

function generatedMealSafetyIssues(input: {
  readonly meals: readonly SmartPlanDraftMeal[];
  readonly slots: readonly PortionSlot[];
  readonly mealEnergyTargets: readonly number[];
  readonly dailyProteinTarget: number;
  readonly dailyFatTarget: number;
}) {
  const dailyEnergyTarget = input.mealEnergyTargets.reduce(
    (sum, target) => sum + target,
    0,
  );
  return input.meals.flatMap((meal, mealIndex) => {
    const issues: string[] = [];
    const mealSlots = input.slots.filter((slot) => slot.mealIndex === mealIndex);
    const targetEnergy = input.mealEnergyTargets[mealIndex];
    const energyDeviation = Math.abs(meal.totals.energyKcal - targetEnergy) /
      targetEnergy;
    if (energyDeviation > 0.1) {
      issues.push(
        `${meal.name} ficou em ${Math.round((1 + (meal.totals.energyKcal - targetEnergy) / targetEnergy) * 100)}% da meta energética`,
      );
    }

    const missingFunctions = mealFunctionsFor(meal.name, meal.time).filter(
      (mealFunction) => !mealSlots.some((slot) =>
        slot.semantic.functions.includes(mealFunction),
      ),
    );
    if (missingFunctions.length) {
      issues.push(`${meal.name} sem ${missingFunctions.join(", ").toLocaleLowerCase("pt-BR")}`);
    }

    const proportionalProteinTarget = input.dailyProteinTarget *
      (targetEnergy / dailyEnergyTarget);
    const role = inferMealRole(meal.name, meal.time);
    const minimumProteinRatio = role === "LUNCH" || role === "DINNER"
      ? 0.6
      : role === "BREAKFAST"
        ? 0.5
        : 0.45;
    if (meal.totals.proteinGrams < proportionalProteinTarget * minimumProteinRatio) {
      issues.push(`${meal.name} com proteína insuficientemente distribuída`);
    }

    const proportionalFatTarget = input.dailyFatTarget *
      (targetEnergy / dailyEnergyTarget);
    if (meal.totals.fatsGrams > proportionalFatTarget * 1.5) {
      issues.push(`${meal.name} concentra proporção excessiva dos lipídios diários`);
    }

    if (mealSlots.some((slot) => concentratedFatFood(slot.food))) {
      issues.push(`${meal.name} concentra gordura em um único alimento`);
    }
    for (let index = 1; index < mealSlots.length; index += 1) {
      const previous = mealSlots.slice(0, index).map((slot) => slot.semantic);
      if (!culinaryCompatibility(mealSlots[index].semantic, previous)) {
        issues.push(`${meal.name} contém combinação sem compatibilidade culinária`);
        break;
      }
    }
    return issues;
  });
}

function targetComparison(
  targets: SmartPlanNutritionTotals,
  totals: SmartPlanNutritionTotals,
) {
  return Object.fromEntries(
    (Object.keys(targets) as (keyof SmartPlanNutritionTotals)[]).map((key) => {
      const tolerance = SMART_PLAN_TOLERANCES[key];
      const comparison = compareMealPlanTarget(targets[key], totals[key], tolerance);
      return [key, {
        ...comparison,
        withinTolerance: comparison.status === "WITHIN_TARGET",
        tolerancePercentage: tolerance * 100,
      }];
    }),
  ) as unknown as SmartPlanDraft["targetComparison"];
}

function normalizedFoodComposition(
  composition: SmartPlanFoodComposition,
  mealCount: number,
) {
  return Array.from({ length: mealCount }, (_, mealIndex) => [
    ...new Set(
      (composition[mealIndex] ?? [])
        .filter((foodId) => typeof foodId === "string" && foodId.trim())
        .map((foodId) => foodId.trim()),
    ),
  ].sort());
}

function foodCompositionSignature(composition: SmartPlanFoodComposition) {
  return JSON.stringify(composition);
}

function generatedFoodComposition(
  slots: readonly PortionSlot[],
  weights: readonly number[],
  mealCount: number,
) {
  const composition = Array.from(
    { length: mealCount },
    () => [] as string[],
  );
  slots.forEach((slot, slotIndex) => {
    if (weights[slotIndex] > 0) composition[slot.mealIndex].push(slot.food.id);
  });
  return normalizedFoodComposition(composition, mealCount);
}

export const smartPlanDraftGenerator = {
  generate(input: {
    readonly patientContext: PatientContext | null | undefined;
    readonly eligibleFoods: readonly EligibleFood[];
    readonly currentComposition?: SmartPlanFoodComposition;
    readonly options?: SmartPlanGeneratorOptions;
  }): SmartPlanGenerationResult {
    const issues = validateSmartPlanGeneration(input.patientContext, input.eligibleFoods);
    if (issues.length || !input.patientContext) return { success: false, pending: issues };

    const context = input.patientContext;
    const candidates = approvedCandidates(context, input.eligibleFoods);
    if (!candidates.length) {
      return {
        success: false,
        pending: [pending("approvedFoods", "Motor de Decisão Nutricional", "Nenhum alimento APROVADO possui composição completa e segura.", "Nenhum alimento aprovado disponível para gerar a prévia.")],
      };
    }

    const distribution = context.nutritionStrategy.dailyDistribution;
    const mealCount = distribution.length;
    const defaultNames = standardMealNames(mealCount);
    const plannedMeals = distribution.map((meal, mealIndex) => ({
      name: meal.name?.trim() || defaultNames[mealIndex],
      time: meal.time?.trim() || "",
    }));
    const targets: SmartPlanNutritionTotals = {
      energyKcal: context.nutritionStrategy.caloriesKcal,
      proteinGrams: context.nutritionStrategy.protein.grams,
      carbohydratesGrams: context.nutritionStrategy.carbohydrates.grams,
      fatsGrams: context.nutritionStrategy.fats.grams,
    };
    const percentages = resolveSmartMealPercentages(distribution);
    const percentageTotal = percentages.reduce((sum, value) => sum + value, 0);
    const mealEnergyTargets = percentages.map(
      (percentage) => targets.energyKcal * (percentage / percentageTotal),
    );
    const currentComposition = input.currentComposition
      ? normalizedFoodComposition(input.currentComposition, mealCount)
      : undefined;
    const currentCompositionSignature = currentComposition
      ? foodCompositionSignature(currentComposition)
      : undefined;
    const previouslyUsedFoodIds = currentComposition
      ? [...new Set(currentComposition.flat())]
      : [];
    const previousUseCounts = currentComposition
      ? [0.25, 0.5, 1, 2, 4]
      : [0];
    let optimized: ReturnType<typeof optimizeComposition> | undefined;
    let foundDifferentComposition = false;
    for (const previousUseCount of previousUseCounts) {
      const initialSlots = portionSlots(
        candidates,
        context,
        plannedMeals,
        previouslyUsedFoodIds,
        previousUseCount,
      );
      const missingStructure = missingMealStructure(initialSlots, plannedMeals);
      if (missingStructure.length) {
        return {
          success: false,
          pending: [pending(
            "semanticFoodCatalog",
            "Camada semântica do Banco Mestre",
            `Não foram encontrados alimentos seguros para: ${missingStructure.join(", ")}.`,
            "O catálogo não possui estrutura culinária suficiente para montar todas as refeições com segurança.",
          )],
        };
      }
      const attempt = optimizeComposition({
        candidates,
        initialSlots,
        plannedMeals,
        targets,
        mealEnergyTargets,
        context,
      });
      const attemptSignature = foodCompositionSignature(
        generatedFoodComposition(attempt.slots, attempt.weights, mealCount),
      );
      const attemptAssessment = optimizedCompositionAssessment({
        slots: attempt.slots,
        weights: attempt.weights,
        plannedMeals,
        targets,
        mealEnergyTargets,
      });
      foundDifferentComposition ||=
        currentCompositionSignature !== undefined &&
        attemptSignature !== currentCompositionSignature;
      if (
        currentCompositionSignature === undefined ||
        (attemptSignature !== currentCompositionSignature &&
          attemptAssessment.valid)
      ) {
        optimized = attempt;
        break;
      }
    }
    if (!optimized) {
      return {
        success: false,
        pending: [pending(
          "alternativeComposition",
          "Plano Inteligente",
          foundDifferentComposition
            ? "As combinações alternativas encontradas não passaram pelas metas, tolerâncias e validações finais."
            : "As tentativas limitadas preservaram a mesma combinação de alimentos por refeição.",
          "Não foi encontrada outra combinação de alimentos adequada aos critérios atuais.",
        )],
      };
    }
    const { slots, weights } = optimized;
    const createId = input.options?.createId ?? randomUUID;
    const meals = distribution.map((meal, mealIndex): SmartPlanDraftMeal => {
      const items = slots.flatMap((slot, slotIndex) =>
        slot.mealIndex === mealIndex && weights[slotIndex] > 0
          ? [itemFromSlot(slot, weights[slotIndex])]
          : [],
      );
      return {
        id: createId(),
        name: meal.name?.trim() || defaultNames[mealIndex],
        time: meal.time?.trim() || NOT_INFORMED,
        targetPercentage: percentages[mealIndex],
        targetEnergyKcal: mealEnergyTargets[mealIndex],
        items,
        totals: sumTotals(items),
        internalJustification: mealInternalJustification(
          slots.filter((slot) => slot.mealIndex === mealIndex),
          context,
        ),
      };
    });
    const unsafeMealIssues = generatedMealSafetyIssues({
      meals,
      slots,
      mealEnergyTargets,
      dailyProteinTarget: targets.proteinGrams,
      dailyFatTarget: targets.fatsGrams,
    });
    const dailyTotals = sumTotals(meals.map((meal) => meal.totals));
    const comparison = targetComparison(targets, dailyTotals);
    const outOfTolerance = Object.entries(comparison)
      .filter(([, value]) => !value.withinTolerance)
      .map(([key]) => key as keyof SmartPlanNutritionTotals);
    const labels: Readonly<Record<keyof SmartPlanNutritionTotals, string>> = {
      energyKcal: "energia",
      proteinGrams: "proteínas",
      carbohydratesGrams: "carboidratos",
      fatsGrams: "lipídios",
    };
    const hasConfirmedRecall =
      context.clinical.habitualIntakeBasis === "CONFIRMED_REPRESENTATIVE";
    const warnings = [
      hasConfirmedRecall
        ? "Proposta baseada em recordatório alimentar confirmado como representativo pelo nutricionista."
        : "Proposta inicial gerada sem recordatório alimentar.",
      ...(candidates.length < mealCount * 2
        ? ["Poucos alimentos aprovados para diversificar todas as refeições."]
        : []),
      ...(outOfTolerance.length
        ? [`Não foi possível ajustar as porções ou substituir alimentos da mesma função para manter ${outOfTolerance.map((key) => labels[key]).join(", ")} dentro de ±5%. A prévia permanece pendente de revisão.`]
        : []),
      ...(unsafeMealIssues.length
        ? [`${UNSAFE_MEAL_MESSAGE} ${unsafeMealIssues.join("; ")}. A prévia permanece pendente de revisão.`]
        : []),
    ];
    const usedIds = new Set(meals.flatMap((meal) => meal.items.map((item) => item.foodId)));
    const usedFoods = candidates.filter((candidate) => usedIds.has(candidate.food.id));
    const schedules = distribution.map((meal) => meal.time?.trim()).filter((time): time is string => Boolean(time));
    const optionalDataNotProvided = optionalPatientContextFields(
      context.clinical,
    );

    return {
      success: true,
      smartPlanDraft: {
        semanticVersion: 2,
        patientId: context.patient.patientId,
        attendanceId: context.patient.attendanceId,
        nutritionStrategyId: context.nutritionStrategy.sourceStrategyId,
        generationStatus: "PREVIEW_NOT_APPROVED",
        approvalLabel: "Prévia não aprovada.",
        generatedAt: (input.options?.now ?? (() => new Date()))().toISOString(),
        requiresProfessionalAdjustment:
          outOfTolerance.length > 0 || unsafeMealIssues.length > 0,
        warnings,
        optionalDataNotProvided,
        inputSummary: {
          objective:
            context.nutritionStrategy.objective ?? context.patient.objective,
          routine: context.clinical.dailyRoutine.length ? context.clinical.dailyRoutine : NOT_INFORMED,
          preferences: context.clinical.preferredFoods.length ? context.clinical.preferredFoods : NOT_INFORMED,
          schedules: schedules.length ? schedules : NOT_INFORMED,
          habitualIntakeBasis:
            context.clinical.habitualIntakeBasis ?? "NOT_INFORMED",
        },
        meals,
        dailyTotals,
        targetComparison: comparison,
        sourceFoods: usedFoods.map(({ food }) => ({
          foodId: food.id,
          name: food.officialName,
          source: food.source.kind,
          sourceCode: food.sourceCode,
        })),
      },
    };
  },

  regenerateMeal(input: {
    readonly patientContext: PatientContext | null | undefined;
    readonly eligibleFoods: readonly EligibleFood[];
    readonly mealIndex: number;
    readonly targetTotals?: SmartPlanNutritionTotals;
    readonly previouslyUsedFoodIds?: readonly string[];
    readonly options?: SmartPlanGeneratorOptions;
  }): SmartPlanMealGenerationResult {
    const issues = validateSmartPlanGeneration(input.patientContext, input.eligibleFoods);
    if (issues.length || !input.patientContext) return { success: false, pending: issues };

    const context = input.patientContext;
    const distribution = context.nutritionStrategy.dailyDistribution;
    const strategyMeal = distribution[input.mealIndex];
    if (!strategyMeal) {
      return {
        success: false,
        pending: [pending(
          "mealIndex",
          "Estrat\u00e9gia Nutricional",
          "A refei\u00e7\u00e3o solicitada n\u00e3o pertence \u00e0 distribui\u00e7\u00e3o aprovada.",
          "Selecione uma refei\u00e7\u00e3o v\u00e1lida para regenerar.",
        )],
      };
    }
    const candidates = approvedCandidates(context, input.eligibleFoods);
    if (!candidates.length) {
      return {
        success: false,
        pending: [pending("approvedFoods", "Motor de Decis\u00e3o Nutricional", "Nenhum alimento APROVADO possui composi\u00e7\u00e3o completa e segura.", "Nenhum alimento aprovado dispon\u00edvel para regenerar a refei\u00e7\u00e3o.")],
      };
    }

    const defaultNames = standardMealNames(distribution.length);
    const name = strategyMeal.name?.trim() || defaultNames[input.mealIndex];
    const time = strategyMeal.time?.trim() || "";
    const dailyTargets: SmartPlanNutritionTotals = {
      energyKcal: context.nutritionStrategy.caloriesKcal,
      proteinGrams: context.nutritionStrategy.protein.grams,
      carbohydratesGrams: context.nutritionStrategy.carbohydrates.grams,
      fatsGrams: context.nutritionStrategy.fats.grams,
    };
    const percentages = resolveSmartMealPercentages(distribution);
    const percentageTotal = percentages.reduce((sum, value) => sum + value, 0);
    const ratio = percentages[input.mealIndex] / percentageTotal;
    const fallbackTargets: SmartPlanNutritionTotals = {
      energyKcal: dailyTargets.energyKcal * ratio,
      proteinGrams: dailyTargets.proteinGrams * ratio,
      carbohydratesGrams: dailyTargets.carbohydratesGrams * ratio,
      fatsGrams: dailyTargets.fatsGrams * ratio,
    };
    const requested = input.targetTotals;
    const targets = requested &&
      positive(requested.energyKcal) &&
      positive(requested.proteinGrams) &&
      positive(requested.carbohydratesGrams) &&
      positive(requested.fatsGrams)
      ? requested
      : fallbackTargets;
    const slots = portionSlots(
      candidates,
      context,
      [{ name, time }],
      input.previouslyUsedFoodIds,
    );
    const missingStructure = missingMealStructure(slots, [{ name, time }]);
    if (missingStructure.length) {
      return {
        success: false,
        pending: [pending(
          "semanticFoodCatalog",
          "Camada semântica do Banco Mestre",
          `Estrutura culinária incompleta: ${missingStructure.join(", ")}.`,
          "Não há alimentos semanticamente adequados para regenerar esta refeição.",
        )],
      };
    }
    const weights = optimizeWeights({
      slots,
      targets: [targets.energyKcal, targets.proteinGrams, targets.carbohydratesGrams, targets.fatsGrams],
      mealEnergyTargets: [targets.energyKcal],
    });
    const items = slots.flatMap((slot, slotIndex) =>
      weights[slotIndex] > 0 ? [itemFromSlot(slot, weights[slotIndex])] : [],
    );
    const smartPlanMeal: SmartPlanDraftMeal = {
      id: (input.options?.createId ?? randomUUID)(),
      name,
      time: time || NOT_INFORMED,
      targetPercentage: percentages[input.mealIndex],
      targetEnergyKcal: targets.energyKcal,
      items,
      totals: sumTotals(items),
      internalJustification: mealInternalJustification(slots, context),
    };
    return {
      success: true,
      smartPlanMeal,
    };
  },
};
