import { canAccess, mvpService, type FrontendAccessSnapshot } from "../mvp";
import { prisma } from "../../lib/database/prisma";
import { resolveFoodNutrientForms } from "../food-database/nutrient-forms";

import {
  calculateRecipeNutrition,
  type RecipeIngredientCalculationInput,
  type RecipeNutritionCalculationResult,
  type RecipeNutrientKey,
  type ScientificNutrientValue,
} from "./nutrition-calculator";
import type { RecipeContentSnapshot } from "./recipe-content-snapshot";

type MeasurementUnit = "GRAM" | "MILLILITER" | "UNIT";
type IngredientUnit = Exclude<MeasurementUnit, "UNIT">;
type WriteAction = "CREATE" | "UPDATE" | "DELETE";

export type RecipeServiceErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "INCOMPLETE_CALCULATION"
  | "PERSISTENCE_ERROR";

export class RecipeServiceError extends Error {
  constructor(
    readonly code: RecipeServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RecipeServiceError";
  }
}

export type RecipeDeletionDependency =
  | "PERSISTED_CALCULATION"
  | "COMMERCIAL_PRODUCT"
  | "NUTRITION_LABEL"
  | "CONCURRENT_REFERENCE";

export class RecipeDeletionConflictError extends RecipeServiceError {
  readonly conflict = "RECIPE_DELETION_BLOCKED" as const;

  constructor(
    readonly dependencies: readonly RecipeDeletionDependency[],
    message: string,
  ) {
    super("INVALID_INPUT", message);
    this.name = "RecipeDeletionConflictError";
  }
}

export interface RecipeContext {
  /** Unidade resolvida por contexto confiável do servidor. */
  readonly businessUnitId: string;
}

export interface RecipeDraftInput {
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly notes?: string;
  readonly preparationMethod?: string;
  readonly preparationTimeMinutes?: number;
  readonly finalYieldAmount?: number;
  readonly finalYieldUnit?: MeasurementUnit;
  readonly yieldAmount?: number;
  readonly yieldUnit?: MeasurementUnit;
  readonly servings?: number;
  readonly servingSize?: number;
  readonly servingSizeUnit?: MeasurementUnit;
  readonly servingHouseholdMeasure?: string;
  readonly physicalType?: "SOLID" | "SEMISOLID" | "LIQUID";
}

export interface RecipeIngredientInput {
  readonly foodId: string;
  readonly householdMeasureId?: string;
  readonly householdMeasureQuantity?: number;
  readonly householdMeasureDescription?: string;
  readonly grossQuantity: number;
  readonly netQuantity?: number;
  readonly quantityUnit: IngredientUnit;
  readonly correctionFactor?: number;
  readonly cookingYieldFactor?: number;
  readonly notes?: string;
  readonly position?: number;
}

export interface RecipeStepInput {
  readonly instruction: string;
  readonly position?: number;
}

export interface RecipeNutritionSnapshotView {
  readonly id: string;
  readonly recipeId: string;
  readonly version: number;
  readonly servings: unknown;
  readonly servingSize: unknown;
  readonly servingSizeUnit: "GRAM" | "MILLILITER" | null;
  readonly recipeContentSnapshot: unknown;
  readonly [key: string]: unknown;
}

interface NutrientObservationRow {
  readonly nutrientKey: string;
  readonly sourceNutrientName?: string | null;
  readonly numericValue: unknown;
  readonly valueStatus: "NUMERIC" | "TRACE" | "NOT_ANALYZED" | "NOT_APPLICABLE" | "MISSING";
}

interface FoodRow {
  readonly id: string;
  readonly officialName: string;
  readonly status: string;
  readonly referenceServingGrams?: unknown;
  readonly referenceServingUnit: string | null;
  readonly importedFrom?: string | null;
  readonly source: { readonly kind: string; readonly name: string };
  readonly nutrients: Record<string, unknown> | null;
  readonly nutrientObservations: readonly NutrientObservationRow[];
}

interface MeasureRow {
  readonly id: string;
  readonly foodId: string;
  readonly active: boolean;
  readonly name: string;
  readonly quantity: unknown;
  readonly grams: unknown;
}

interface IngredientRow {
  readonly id: string;
  readonly recipeId: string;
  readonly foodId: string;
  readonly householdMeasureId: string | null;
  readonly position: number;
  readonly quantityGrams: unknown;
  readonly grossQuantity: unknown;
  readonly netQuantity: unknown;
  readonly quantityUnit: IngredientUnit | null;
  readonly householdMeasureQuantity: unknown;
  readonly householdMeasureDescription: string | null;
  readonly correctionFactor: unknown;
  readonly cookingYieldFactor: unknown;
  readonly notes: string | null;
  readonly food: FoodRow;
  readonly householdMeasure: MeasureRow | null;
}

interface PreparationStepRow {
  readonly position: number;
  readonly instruction: string;
}

interface RecipeRow {
  readonly id: string;
  readonly businessUnitId: string;
  readonly ownerUserId: string;
  readonly title: string;
  readonly status: string;
  readonly preparationMethod: string | null;
  readonly yieldDescription: string | null;
  readonly finalYieldAmount: unknown;
  readonly finalYieldUnit: MeasurementUnit | null;
  readonly yieldAmount: unknown;
  readonly yieldUnit: MeasurementUnit | null;
  readonly servings: number | null;
  readonly servingSize: unknown;
  readonly servingSizeUnit: MeasurementUnit | null;
  readonly ingredients: readonly IngredientRow[];
  readonly preparationSteps: readonly PreparationStepRow[];
  readonly nutritionSnapshots: readonly RecipeNutritionSnapshotView[];
  readonly [key: string]: unknown;
}

interface RecipeTransaction {
  recipe: {
    create(args: Record<string, unknown>): Promise<RecipeRow>;
    findFirst(args: Record<string, unknown>): Promise<RecipeRow | null>;
    update(args: Record<string, unknown>): Promise<RecipeRow>;
    delete(args: Record<string, unknown>): Promise<{ readonly id: string; readonly title: string }>;
  };
  recipeIngredient: {
    create(args: Record<string, unknown>): Promise<unknown>;
    findFirst(args: Record<string, unknown>): Promise<IngredientRow | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
    updateMany(args: Record<string, unknown>): Promise<unknown>;
    delete(args: Record<string, unknown>): Promise<unknown>;
    count(args: Record<string, unknown>): Promise<number>;
  };
  recipePreparationStep: {
    create(args: Record<string, unknown>): Promise<unknown>;
    findFirst(args: Record<string, unknown>): Promise<{ readonly id: string } | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
    updateMany(args: Record<string, unknown>): Promise<unknown>;
    delete(args: Record<string, unknown>): Promise<unknown>;
    count(args: Record<string, unknown>): Promise<number>;
  };
  recipeNutritionSnapshot: {
    aggregate(args: Record<string, unknown>): Promise<{ readonly _max: { readonly version: number | null } }>;
    count(args: Record<string, unknown>): Promise<number>;
    create(args: Record<string, unknown>): Promise<unknown>;
  };
  commercialFoodProduct: { count(args: Record<string, unknown>): Promise<number> };
  productNutritionLabel: { count(args: Record<string, unknown>): Promise<number> };
  food: { findFirst(args: Record<string, unknown>): Promise<FoodRow | null> };
  foodHouseholdMeasure: { findFirst(args: Record<string, unknown>): Promise<MeasureRow | null> };
}

interface RecipeDatabase extends RecipeTransaction {
  recipe: RecipeTransaction["recipe"] & {
    findMany(args: Record<string, unknown>): Promise<readonly RecipeRow[]>;
  };
  $transaction<T>(
    operation: (transaction: RecipeTransaction) => Promise<T>,
    options?: { readonly isolationLevel: "Serializable" },
  ): Promise<T>;
}

interface RecipeServiceDependencies {
  readonly database: RecipeDatabase;
  readonly getSession: () => Promise<FrontendAccessSnapshot>;
}

const recipeInclude = {
  ingredients: {
    orderBy: { position: "asc" },
    include: {
      food: {
        include: { source: true, nutrients: true, nutrientObservations: true },
      },
      householdMeasure: true,
    },
  },
  preparationSteps: { orderBy: { position: "asc" } },
  nutritionSnapshots: { orderBy: { version: "desc" } },
};

function text(value: string | undefined) {
  return value?.trim() || null;
}

function normalizedTitle(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function positive(value: number | undefined, field: string) {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new RecipeServiceError("INVALID_INPUT", `${field} deve ser maior que zero.`);
  }
}

function numberValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
}

async function access(dependencies: RecipeServiceDependencies, action: "READ" | WriteAction) {
  let session: FrontendAccessSnapshot;
  try {
    session = await dependencies.getSession();
  } catch {
    throw new RecipeServiceError("AUTHENTICATION_REQUIRED", "Sessão autenticada obrigatória.");
  }
  if (session.user.status !== "ACTIVE" || !canAccess(session, "MEAL_PLAN", action)) {
    throw new RecipeServiceError("FORBIDDEN", "A sessão não possui acesso a Receitas.");
  }
  return session;
}

function recipeWhere(id: string, context: RecipeContext, ownerUserId: string) {
  return { id, businessUnitId: context.businessUnitId, ownerUserId };
}

async function ownedRecipe(
  transaction: Pick<RecipeTransaction, "recipe">,
  id: string,
  context: RecipeContext,
  ownerUserId: string,
) {
  const recipe = await transaction.recipe.findFirst({
    where: recipeWhere(id, context, ownerUserId),
    include: recipeInclude,
  });
  if (!recipe) throw new RecipeServiceError("NOT_FOUND", "Receita não encontrada.");
  return recipe;
}

function databaseErrorCode(error: unknown) {
  return error !== null && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
}

function deletionDependencyMessage(
  dependencies: readonly RecipeDeletionDependency[],
) {
  const reasons: string[] = [];
  if (dependencies.includes("PERSISTED_CALCULATION")) {
    reasons.push("cálculos nutricionais persistidos");
  }
  if (dependencies.includes("COMMERCIAL_PRODUCT")) {
    reasons.push("produtos vinculados");
  }
  if (dependencies.includes("NUTRITION_LABEL")) {
    reasons.push("versões de rótulos vinculadas");
  }
  if (dependencies.includes("CONCURRENT_REFERENCE")) {
    reasons.push("um vínculo criado ou alterado durante a exclusão");
  }
  return `A receita não pode ser excluída porque possui ${reasons.join(", ")}. O histórico deve ser preservado.`;
}

function draftData(input: RecipeDraftInput) {
  const title = input.title.trim();
  if (title.length < 2) throw new RecipeServiceError("INVALID_INPUT", "Nome da receita é obrigatório.");
  positive(input.finalYieldAmount, "Rendimento final");
  positive(input.yieldAmount, "Rendimento");
  positive(input.servings, "Número de porções");
  positive(input.servingSize, "Tamanho da porção");
  positive(input.preparationTimeMinutes, "Tempo de preparo");
  return {
    title,
    normalizedTitle: normalizedTitle(title),
    description: text(input.description),
    category: text(input.category),
    notes: text(input.notes),
    preparationMethod: text(input.preparationMethod),
    preparationTimeMinutes: input.preparationTimeMinutes,
    finalYieldAmount: input.finalYieldAmount,
    finalYieldUnit: input.finalYieldUnit,
    yieldAmount: input.yieldAmount,
    yieldUnit: input.yieldUnit,
    servings: input.servings,
    servingSize: input.servingSize,
    servingSizeUnit: input.servingSizeUnit,
    servingHouseholdMeasure: text(input.servingHouseholdMeasure),
    physicalType: input.physicalType,
  };
}

async function resolvedIngredient(
  transaction: RecipeTransaction,
  input: RecipeIngredientInput,
) {
  positive(input.grossQuantity, "Quantidade bruta");
  positive(input.netQuantity, "Quantidade líquida");
  positive(input.correctionFactor, "Fator de correção");
  positive(input.cookingYieldFactor, "Fator de cocção");
  positive(input.householdMeasureQuantity, "Quantidade da medida caseira");
  const food = await transaction.food.findFirst({
    where: { id: input.foodId, status: "ACTIVE" },
    include: { source: true, nutrients: true, nutrientObservations: true },
  });
  if (!food) throw new RecipeServiceError("NOT_FOUND", "Alimento ativo não encontrado.");

  let measure: MeasureRow | null = null;
  if (input.householdMeasureId) {
    measure = await transaction.foodHouseholdMeasure.findFirst({
      where: { id: input.householdMeasureId, foodId: food.id, active: true },
    });
    if (!measure) {
      throw new RecipeServiceError("INVALID_INPUT", "Medida caseira inexistente ou incompatível com o alimento.");
    }
    if (input.quantityUnit !== "GRAM") {
      throw new RecipeServiceError("INVALID_INPUT", "A medida vinculada informa gramas e não pode ser convertida em mililitros.");
    }
  }

  const measuredNet = measure && input.householdMeasureQuantity
    ? numberValue(measure.grams)! * input.householdMeasureQuantity
    : undefined;
  const netQuantity = input.netQuantity ?? measuredNet;
  if (netQuantity === undefined && input.correctionFactor === undefined) {
    throw new RecipeServiceError("INVALID_INPUT", "Informe quantidade líquida, medida científica ou fator de correção.");
  }
  const legacyQuantity = netQuantity ?? input.grossQuantity / input.correctionFactor!;
  return {
    food,
    data: {
      foodId: food.id,
      householdMeasureId: measure?.id ?? null,
      quantityGrams: legacyQuantity,
      grossQuantity: input.grossQuantity,
      netQuantity,
      quantityUnit: input.quantityUnit,
      householdMeasureQuantity: input.householdMeasureQuantity,
      householdMeasureDescription: text(input.householdMeasureDescription) ?? measure?.name ?? null,
      correctionFactor: input.correctionFactor,
      cookingYieldFactor: input.cookingYieldFactor,
      notes: text(input.notes),
    },
  };
}

const fieldByNutrient: Partial<Record<RecipeNutrientKey, string>> = {
  energyKcal: "energyKcal",
  carbohydratesGrams: "carbohydratesGrams",
  totalSugarsGrams: "sugarsGrams",
  proteinGrams: "proteinGrams",
  totalFatsGrams: "fatsGrams",
  saturatedFatsGrams: "saturatedFatsGrams",
  cholesterolMg: "cholesterolMg",
  monounsaturatedFatsGrams: "monounsaturatedFatsGrams",
  polyunsaturatedFatsGrams: "polyunsaturatedFatsGrams",
  fiberGrams: "fiberGrams",
  sodiumMg: "sodiumMg",
  calciumMg: "calciumMg",
  ironMg: "ironMg",
  magnesiumMg: "magnesiumMg",
  phosphorusMg: "phosphorusMg",
  potassiumMg: "potassiumMg",
  zincMg: "zincMg",
  copperMg: "copperMg",
  manganeseMg: "manganeseMg",
  seleniumMcg: "seleniumMcg",
  vitaminAMcg: "vitaminAMcg",
  vitaminCMg: "vitaminCMg",
  vitaminDMcg: "vitaminDMcg",
  vitaminEMg: "vitaminEMg",
  vitaminKMcg: "vitaminKMcg",
  thiamineMg: "thiamineMg",
  riboflavinMg: "riboflavinMg",
  niacinMg: "niacinMg",
  vitaminB6Mg: "vitaminB6Mg",
  folateMcg: "folateMcg",
  vitaminB12Mcg: "vitaminB12Mcg",
};

const additionalNutrientAliases: Partial<
  Record<RecipeNutrientKey, readonly string[]>
> = {
  addedSugarsGrams: ["Açúcar de adição"],
  transFatsGrams: ["G. trans total"],
};

const KILOJOULES_PER_KILOCALORIE = 4.184;

function additionalNutrientValue(
  food: FoodRow,
  key: RecipeNutrientKey,
): ScientificNutrientValue | null {
  const aliases = additionalNutrientAliases[key];
  const basisAmount = numberValue(food.referenceServingGrams);
  const basisUnit = food.referenceServingUnit?.trim().toLowerCase();
  if (
    !aliases
    || basisAmount !== 100
    || (basisUnit !== "g" && basisUnit !== "ml")
    || !food.nutrients
  ) {
    return null;
  }

  const additional = food.nutrients.additionalNutrients;
  if (!additional || typeof additional !== "object" || Array.isArray(additional)) {
    return null;
  }

  const values = aliases
    .filter((alias) => Object.hasOwn(additional, alias))
    .map((alias) => (additional as Record<string, unknown>)[alias]);
  if (!values.length) return null;
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    return null;
  }

  const numericValues = values as number[];
  if (new Set(numericValues).size !== 1) return null;
  return { status: "VALUE", value: numericValues[0] };
}

function scientificValue(food: FoodRow, key: RecipeNutrientKey): ScientificNutrientValue {
  const observationKeys: Record<string, readonly string[]> = {
    energyKj: ["additional:energyKj", "energyKj"],
    addedSugarsGrams: ["additional:addedSugarsGrams", "addedSugarsGrams"],
    transFatsGrams: ["additional:transFatsGrams", "transFatsGrams"],
  };
  const observation = food.nutrientObservations.find((item) =>
    (observationKeys[key] ?? [fieldByNutrient[key] ?? key]).includes(item.nutrientKey),
  );
  if (observation) {
    if (observation.valueStatus === "NUMERIC") {
      const numericValue = numberValue(observation.numericValue);
      return numericValue === null
        ? { status: "MISSING", value: null }
        : { status: "VALUE", value: numericValue };
    }
    return { status: observation.valueStatus, value: null };
  }
  if (key === "energyKj") {
    const energyKcal = food.nutrients
      ? numberValue(food.nutrients.energyKcal)
      : null;
    if (energyKcal !== null && energyKcal >= 0) {
      return {
        status: "VALUE",
        value: energyKcal * KILOJOULES_PER_KILOCALORIE,
      };
    }
  }
  const field = fieldByNutrient[key];
  const value = field && food.nutrients ? numberValue(food.nutrients[field]) : null;
  if (value !== null) return { status: "VALUE", value };
  return additionalNutrientValue(food, key) ?? { status: "MISSING", value: null };
}

function calculationIngredient(row: IngredientRow): RecipeIngredientCalculationInput {
  const unit = row.quantityUnit === "MILLILITER" ? "ml" : "g";
  return {
    ingredientId: row.id,
    foodId: row.foodId,
    foodName: row.food.officialName,
    source: row.food.source,
    nutrientReferenceUnit: row.food.referenceServingUnit?.toLowerCase() === "ml" ? "ml" : "g",
    nutrientsPer100: {
      energyKcal: scientificValue(row.food, "energyKcal"),
      energyKj: scientificValue(row.food, "energyKj"),
      carbohydratesGrams: scientificValue(
        row.food,
        "carbohydratesGrams",
      ),
      totalSugarsGrams: scientificValue(row.food, "totalSugarsGrams"),
      addedSugarsGrams: scientificValue(row.food, "addedSugarsGrams"),
      proteinGrams: scientificValue(row.food, "proteinGrams"),
      totalFatsGrams: scientificValue(row.food, "totalFatsGrams"),
      saturatedFatsGrams: scientificValue(row.food, "saturatedFatsGrams"),
      transFatsGrams: scientificValue(row.food, "transFatsGrams"),
      cholesterolMg: scientificValue(row.food, "cholesterolMg"),
      monounsaturatedFatsGrams: scientificValue(
        row.food,
        "monounsaturatedFatsGrams",
      ),
      polyunsaturatedFatsGrams: scientificValue(
        row.food,
        "polyunsaturatedFatsGrams",
      ),
      fiberGrams: scientificValue(row.food, "fiberGrams"),
      sodiumMg: scientificValue(row.food, "sodiumMg"),
      calciumMg: scientificValue(row.food, "calciumMg"),
      ironMg: scientificValue(row.food, "ironMg"),
      magnesiumMg: scientificValue(row.food, "magnesiumMg"),
      phosphorusMg: scientificValue(row.food, "phosphorusMg"),
      potassiumMg: scientificValue(row.food, "potassiumMg"),
      zincMg: scientificValue(row.food, "zincMg"),
      copperMg: scientificValue(row.food, "copperMg"),
      manganeseMg: scientificValue(row.food, "manganeseMg"),
      seleniumMcg: scientificValue(row.food, "seleniumMcg"),
      vitaminAMcg: scientificValue(row.food, "vitaminAMcg"),
      vitaminCMg: scientificValue(row.food, "vitaminCMg"),
      vitaminDMcg: scientificValue(row.food, "vitaminDMcg"),
      vitaminEMg: scientificValue(row.food, "vitaminEMg"),
      vitaminKMcg: scientificValue(row.food, "vitaminKMcg"),
      thiamineMg: scientificValue(row.food, "thiamineMg"),
      riboflavinMg: scientificValue(row.food, "riboflavinMg"),
      niacinMg: scientificValue(row.food, "niacinMg"),
      vitaminB6Mg: scientificValue(row.food, "vitaminB6Mg"),
      folateMcg: scientificValue(row.food, "folateMcg"),
      vitaminB12Mcg: scientificValue(row.food, "vitaminB12Mcg"),
    },
    nutrientForms: resolveFoodNutrientForms({
      sourceKind: row.food.source.kind,
      importedFrom: row.food.importedFrom,
      observations: row.food.nutrientObservations,
    }),
    grossQuantity: numberValue(row.grossQuantity) ?? undefined,
    resolvedQuantity: numberValue(row.quantityGrams) ?? undefined,
    netQuantity: numberValue(row.netQuantity) ?? undefined,
    quantityUnit: unit,
    correctionFactor: numberValue(row.correctionFactor) ?? undefined,
    cookingYieldFactor: numberValue(row.cookingYieldFactor) ?? undefined,
  };
}

function calculate(recipe: RecipeRow) {
  const yieldUnit = recipe.finalYieldUnit === "MILLILITER" ? "ml" : "g";
  const servingUnit = recipe.servingSizeUnit === "MILLILITER" ? "ml" : "g";
  return calculateRecipeNutrition({
    ingredients: recipe.ingredients.map(calculationIngredient),
    finalYield: recipe.finalYieldUnit && recipe.finalYieldUnit !== "UNIT" && numberValue(recipe.finalYieldAmount)
      ? { amount: numberValue(recipe.finalYieldAmount)!, unit: yieldUnit }
      : undefined,
    servingSize: recipe.servingSizeUnit && recipe.servingSizeUnit !== "UNIT" && numberValue(recipe.servingSize)
      ? { amount: numberValue(recipe.servingSize)!, unit: servingUnit }
      : undefined,
    servings: recipe.servings ?? undefined,
  });
}

function recipeContentSnapshot(recipe: RecipeRow): RecipeContentSnapshot {
  const finalYieldAmount = numberValue(recipe.finalYieldAmount);
  const declaredYieldAmount = numberValue(recipe.yieldAmount);
  return {
    schemaVersion: 1,
    title: recipe.title,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ingredientId: ingredient.id,
      foodId: ingredient.foodId,
      foodName: ingredient.food.officialName,
      position: ingredient.position,
      grossQuantity: numberValue(ingredient.grossQuantity),
      netQuantity: numberValue(ingredient.netQuantity),
      quantityUnit: ingredient.quantityUnit ?? null,
      householdMeasureQuantity: numberValue(
        ingredient.householdMeasureQuantity,
      ),
      householdMeasureDescription:
        ingredient.householdMeasureDescription ?? null,
      notes: ingredient.notes ?? null,
    })),
    preparationMethod: recipe.preparationMethod ?? null,
    preparationSteps: recipe.preparationSteps.map((step) => ({
      position: step.position,
      instruction: step.instruction,
    })),
    yieldDescription: recipe.yieldDescription ?? null,
    finalYield:
      finalYieldAmount !== null && recipe.finalYieldUnit !== null
        ? { amount: finalYieldAmount, unit: recipe.finalYieldUnit }
        : null,
    declaredYield:
      declaredYieldAmount !== null && recipe.yieldUnit !== null
        ? { amount: declaredYieldAmount, unit: recipe.yieldUnit }
        : null,
    servings: recipe.servings ?? null,
  };
}

export function createRecipeService(dependencies: RecipeServiceDependencies) {
  return {
    async create(context: RecipeContext, input: RecipeDraftInput) {
      const session = await access(dependencies, "CREATE");
      return dependencies.database.$transaction((transaction) =>
        transaction.recipe.create({
          data: {
            ...draftData(input),
            businessUnitId: context.businessUnitId,
            ownerUserId: session.user.id,
            createdByUserId: session.user.id,
            updatedByUserId: session.user.id,
            status: "DRAFT",
          },
          include: recipeInclude,
        }),
      );
    },

    async list(context: RecipeContext) {
      const session = await access(dependencies, "READ");
      return dependencies.database.recipe.findMany({
        where: { businessUnitId: context.businessUnitId, ownerUserId: session.user.id },
        orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
        include: recipeInclude,
      });
    },

    async get(context: RecipeContext, recipeId: string) {
      const session = await access(dependencies, "READ");
      return ownedRecipe(dependencies.database, recipeId, context, session.user.id);
    },

    async update(context: RecipeContext, recipeId: string, input: RecipeDraftInput) {
      const session = await access(dependencies, "UPDATE");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        return transaction.recipe.update({
          where: { id: recipeId },
          data: { ...draftData(input), updatedByUserId: session.user.id, status: "DRAFT" },
          include: recipeInclude,
        });
      });
    },

    async remove(context: RecipeContext, recipeId: string) {
      const session = await access(dependencies, "DELETE");
      try {
        return await dependencies.database.$transaction(async (transaction) => {
          await ownedRecipe(transaction, recipeId, context, session.user.id);
          const [calculationCount, productCount, labelCount] = await Promise.all([
            transaction.recipeNutritionSnapshot.count({ where: { recipeId } }),
            transaction.commercialFoodProduct.count({ where: { recipeId } }),
            transaction.productNutritionLabel.count({
              where: { recipeNutritionSnapshot: { recipeId } },
            }),
          ]);
          const deletionDependencies: RecipeDeletionDependency[] = [];
          if (calculationCount > 0) deletionDependencies.push("PERSISTED_CALCULATION");
          if (productCount > 0) deletionDependencies.push("COMMERCIAL_PRODUCT");
          if (labelCount > 0) deletionDependencies.push("NUTRITION_LABEL");
          if (deletionDependencies.length) {
            throw new RecipeDeletionConflictError(
              deletionDependencies,
              deletionDependencyMessage(deletionDependencies),
            );
          }
          return transaction.recipe.delete({
            where: { id: recipeId },
            select: { id: true, title: true },
          });
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error instanceof RecipeServiceError) throw error;
        const code = databaseErrorCode(error);
        if (code === "P2003" || code === "P2034") {
          const concurrentDependency = ["CONCURRENT_REFERENCE"] as const;
          throw new RecipeDeletionConflictError(
            concurrentDependency,
            deletionDependencyMessage(concurrentDependency),
          );
        }
        throw error;
      }
    },

    async addIngredient(context: RecipeContext, recipeId: string, input: RecipeIngredientInput) {
      const session = await access(dependencies, "UPDATE");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        const prepared = await resolvedIngredient(transaction, input);
        const position = input.position ?? (await transaction.recipeIngredient.count({ where: { recipeId } })) + 1;
        await transaction.recipeIngredient.create({ data: { ...prepared.data, recipeId, position } });
        return ownedRecipe(transaction, recipeId, context, session.user.id);
      });
    },

    async updateIngredient(context: RecipeContext, recipeId: string, ingredientId: string, input: RecipeIngredientInput) {
      const session = await access(dependencies, "UPDATE");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        const current = await transaction.recipeIngredient.findFirst({ where: { id: ingredientId, recipeId } });
        if (!current) throw new RecipeServiceError("NOT_FOUND", "Ingrediente não encontrado.");
        const prepared = await resolvedIngredient(transaction, input);
        await transaction.recipeIngredient.update({ where: { id: ingredientId }, data: { ...prepared.data, position: input.position ?? current.position } });
        return ownedRecipe(transaction, recipeId, context, session.user.id);
      });
    },

    async reorderIngredients(context: RecipeContext, recipeId: string, ingredientIds: readonly string[]) {
      const session = await access(dependencies, "UPDATE");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        for (const [index, id] of ingredientIds.entries()) {
          await transaction.recipeIngredient.updateMany({ where: { id, recipeId }, data: { position: index + 1 } });
        }
        return ownedRecipe(transaction, recipeId, context, session.user.id);
      });
    },

    async removeIngredient(context: RecipeContext, recipeId: string, ingredientId: string) {
      const session = await access(dependencies, "DELETE");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        const current = await transaction.recipeIngredient.findFirst({ where: { id: ingredientId, recipeId } });
        if (!current) throw new RecipeServiceError("NOT_FOUND", "Ingrediente não encontrado.");
        await transaction.recipeIngredient.delete({ where: { id: ingredientId } });
      });
    },

    async addStep(context: RecipeContext, recipeId: string, input: RecipeStepInput) {
      const session = await access(dependencies, "UPDATE");
      const instruction = input.instruction.trim();
      if (!instruction) throw new RecipeServiceError("INVALID_INPUT", "Etapa de preparo obrigatória.");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        const position = input.position ?? (await transaction.recipePreparationStep.count({ where: { recipeId } })) + 1;
        await transaction.recipePreparationStep.create({ data: { recipeId, instruction, position } });
        return ownedRecipe(transaction, recipeId, context, session.user.id);
      });
    },

    async updateStep(context: RecipeContext, recipeId: string, stepId: string, input: RecipeStepInput) {
      const session = await access(dependencies, "UPDATE");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        const step = await transaction.recipePreparationStep.findFirst({ where: { id: stepId, recipeId } });
        if (!step) throw new RecipeServiceError("NOT_FOUND", "Etapa não encontrada.");
        await transaction.recipePreparationStep.update({ where: { id: stepId }, data: { instruction: input.instruction.trim(), position: input.position } });
      });
    },

    async reorderSteps(context: RecipeContext, recipeId: string, stepIds: readonly string[]) {
      const session = await access(dependencies, "UPDATE");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        for (const [index, id] of stepIds.entries()) {
          await transaction.recipePreparationStep.updateMany({ where: { id, recipeId }, data: { position: index + 1 } });
        }
      });
    },

    async removeStep(context: RecipeContext, recipeId: string, stepId: string) {
      const session = await access(dependencies, "DELETE");
      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        const step = await transaction.recipePreparationStep.findFirst({ where: { id: stepId, recipeId } });
        if (!step) throw new RecipeServiceError("NOT_FOUND", "Etapa não encontrada.");
        await transaction.recipePreparationStep.delete({ where: { id: stepId } });
      });
    },

    async calculate(context: RecipeContext, recipeId: string): Promise<RecipeNutritionCalculationResult & { readonly snapshotVersion: number | null }> {
      const session = await access(dependencies, "UPDATE");
      return dependencies.database.$transaction(async (transaction) => {
        const recipe = await ownedRecipe(transaction, recipeId, context, session.user.id);
        const result = calculate(recipe);
        if (!result.snapshotDraft) return { ...result, snapshotVersion: null };
        const versions = await transaction.recipeNutritionSnapshot.aggregate({ where: { recipeId }, _max: { version: true } });
        const version = (versions._max.version ?? 0) + 1;
        await transaction.recipeNutritionSnapshot.create({
          data: {
            ...result.snapshotDraft,
            recipeId,
            version,
            recipeContentSnapshot: recipeContentSnapshot(recipe),
            createdByUserId: session.user.id,
          },
        });
        await transaction.recipe.update({ where: { id: recipeId }, data: { status: "CALCULATED", calculatedAt: new Date(), updatedByUserId: session.user.id }, include: recipeInclude });
        return { ...result, snapshotVersion: version };
      });
    },
  };
}

export const recipeService = createRecipeService({
  database: prisma as unknown as RecipeDatabase,
  getSession: () => mvpService.getSession(),
});
