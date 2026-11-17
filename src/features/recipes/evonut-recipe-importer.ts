import { createHash } from "node:crypto";
import { basename } from "node:path";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import {
  EVONUT_IMPORTED_FROM,
  evonutFoodKey,
  evonutMeasureCode,
} from "../food-database/evonut-import";
import { EVONUT_SOURCE_VERSION } from "../food-database/evonut-audit";
import {
  parseEvonutRecipesWorkbook,
  type EvonutRecipe,
  type EvonutRecipeParseResult,
} from "./evonut-recipe-parser";

export const EVONUT_RECIPE_IMPORTER_VERSION = "evonut-recipe-importer/1";

type ImportDatabase = PrismaClient | Prisma.TransactionClient;
type ImportMode = "dry-run" | "apply";
type RecipeDisposition = "READY" | "IGNORED" | "BLOCKED";

export type EvonutRecipeImportReasonCode =
  | "FOOD_SOURCE_NOT_IMPORTED"
  | "FOOD_NOT_IMPORTED"
  | "FOOD_INACTIVE"
  | "INGREDIENT_QUANTITY_NOT_EXPLICIT"
  | "INGREDIENT_EQUIVALENCE_UNRESOLVED"
  | "MEASURE_REFERENCE_NOT_IMPORTED"
  | "MEASURE_REFERENCE_CONFLICT"
  | "IDENTICAL_ORIGIN_ALREADY_IMPORTED"
  | "SOURCE_CONTENT_CHANGED"
  | "MANUAL_EDIT_DETECTED"
  | "IMPORT_PROVENANCE_INCOMPLETE";

export interface EvonutRecipeImportReason {
  readonly code: EvonutRecipeImportReasonCode;
  readonly message: string;
  readonly ingredientOrder?: number;
}

export interface EvonutRecipeIngredientLink {
  readonly order: number;
  readonly foodSource: string | null;
  readonly foodCode: string;
  readonly foodId: string | null;
  readonly measure: string;
  readonly measureReferenceId: string | null;
  readonly quantity: number | null;
  readonly resolvedAmount: number | null;
  readonly resolvedUnit: "g" | "ml" | null;
}

export interface EvonutRecipeImportPlanItem {
  readonly originalCode: string;
  readonly name: string;
  readonly disposition: RecipeDisposition;
  readonly reasons: readonly EvonutRecipeImportReason[];
  readonly parserPendings: EvonutRecipe["pendings"];
  readonly ingredientLinks: readonly EvonutRecipeIngredientLink[];
  /** Mantém o conteúdo integral no relatório, inclusive quando a receita está bloqueada. */
  readonly sourceRecipe: EvonutRecipe;
}

export interface EvonutRecipeImportInput {
  readonly ownerUserId: string;
  readonly businessUnitId: string;
  readonly workbookBytes: Uint8Array;
  readonly sourcePath?: string;
  readonly mode?: ImportMode;
}

interface DatabaseFingerprint {
  readonly recipeImportBatches: number;
  readonly recipes: number;
  readonly recipeIngredients: number;
}

export interface EvonutRecipeImportResult {
  readonly mode: ImportMode;
  readonly ownerUserId: string;
  readonly businessUnitId: string;
  readonly ownerBusinessUnitLink: "ALL_MODULES_ROLE" | "ACTIVE_EMPLOYMENT";
  readonly parser: EvonutRecipeParseResult;
  readonly counts: {
    readonly ready: number;
    readonly ignored: number;
    readonly blocked: number;
    readonly recipes: number;
    readonly ingredients: number;
    readonly distinctFoodCodes: number;
    readonly grams: number;
    readonly milliliters: number;
    readonly foodsResolved: number;
    readonly measuresRequired: number;
    readonly measuresResolved: number;
  };
  readonly recipes: readonly EvonutRecipeImportPlanItem[];
  readonly databaseBefore: DatabaseFingerprint;
  readonly databaseAfter: DatabaseFingerprint;
  readonly databaseUnchanged: boolean;
  readonly transactionApplied: boolean;
  readonly importedRecipeIds: readonly string[];
}

export class EvonutRecipeImportError extends Error {
  constructor(
    readonly code:
      | "OWNER_NOT_ACTIVE"
      | "BUSINESS_UNIT_NOT_ACTIVE"
      | "OWNER_BUSINESS_UNIT_LINK_NOT_FOUND"
      | "EVONUT_SOURCE_NOT_IMPORTED"
      | "CONCURRENT_IMPORT_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "EvonutRecipeImportError";
  }
}

interface ResolvedContext {
  readonly sourceId: string;
  readonly ownerBusinessUnitLink: "ALL_MODULES_ROLE" | "ACTIVE_EMPLOYMENT";
}

interface PlannedIngredient {
  readonly position: number;
  readonly foodId: string;
  readonly quantityGrams: number;
  readonly grossQuantity: null;
  readonly netQuantity: null;
  readonly quantityUnit: "GRAM" | "MILLILITER";
  readonly householdMeasureId: null;
  readonly householdMeasureQuantity: number | null;
  readonly householdMeasureDescription: string;
  readonly correctionFactor: null;
  readonly cookingYieldFactor: null;
  readonly notes: string | null;
}

interface PlannedRecipe {
  readonly item: EvonutRecipeImportPlanItem;
  readonly data: ReturnType<typeof structuredRecipeData> | null;
  readonly stateHash: string | null;
  readonly originalData: Prisma.InputJsonValue;
}

interface ImportPlan {
  readonly context: ResolvedContext;
  readonly parsed: EvonutRecipeParseResult;
  readonly recipes: readonly PlannedRecipe[];
  readonly counts: EvonutRecipeImportResult["counts"];
}

const existingRecipeInclude = {
  ingredients: { orderBy: { position: "asc" as const } },
  preparationSteps: { orderBy: { position: "asc" as const } },
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function decimalNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function explicitPreparationMinutes(value: string | null) {
  const match = value?.trim().match(/^(\d+)\s*(?:min|minuto(?:s)?)$/iu);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
}

function explicitServings(recipe: EvonutRecipe) {
  const portions = recipe.yield.options.length === 1 ? recipe.yield.portions : null;
  return portions !== null && Number.isSafeInteger(portions) && portions > 0 ? portions : null;
}

function measurementUnit(unit: "g" | "ml" | null) {
  return unit === "g" ? ("GRAM" as const) : unit === "ml" ? ("MILLILITER" as const) : null;
}

function structuredRecipeData(recipe: EvonutRecipe, ingredients: readonly PlannedIngredient[]) {
  const singleYield = recipe.yield.options.length === 1;
  return {
    title: recipe.name.trim(),
    normalizedTitle: normalizeTitle(recipe.name),
    description: null,
    notes: recipe.detailsText,
    category: null,
    preparationMethod: recipe.preparationText,
    preparationTimeMinutes: explicitPreparationMinutes(recipe.preparationTimeText),
    yieldDescription: recipe.yield.originalText,
    finalYieldAmount: null,
    finalYieldUnit: null,
    yieldAmount: null,
    yieldUnit: null,
    finalWeightGrams: null,
    servings: explicitServings(recipe),
    servingSize: singleYield ? recipe.yield.portionWeight?.value ?? null : null,
    servingSizeUnit: singleYield
      ? measurementUnit(recipe.yield.portionWeight?.unit ?? null)
      : null,
    servingHouseholdMeasure: singleYield ? recipe.yield.portionLabel : null,
    servingWeightGrams:
      singleYield && recipe.yield.portionWeight?.unit === "g"
        ? recipe.yield.portionWeight.value
        : null,
    physicalType: null,
    status: "DRAFT" as const,
    calculatedAt: null,
    finalizedAt: null,
    archivedAt: null,
    ingredients,
    preparationSteps: [] as const,
  };
}

function persistedRecipeState(recipe: {
  readonly title: string;
  readonly normalizedTitle: string;
  readonly description: string | null;
  readonly notes: string | null;
  readonly category: string | null;
  readonly preparationMethod: string | null;
  readonly preparationTimeMinutes: number | null;
  readonly yieldDescription: string | null;
  readonly finalYieldAmount: unknown;
  readonly finalYieldUnit: string | null;
  readonly yieldAmount: unknown;
  readonly yieldUnit: string | null;
  readonly finalWeightGrams: unknown;
  readonly servings: number | null;
  readonly servingSize: unknown;
  readonly servingSizeUnit: string | null;
  readonly servingHouseholdMeasure: string | null;
  readonly servingWeightGrams: unknown;
  readonly physicalType: string | null;
  readonly status: string;
  readonly calculatedAt: Date | null;
  readonly finalizedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly ingredients: readonly {
    readonly position: number;
    readonly foodId: string;
    readonly quantityGrams: unknown;
    readonly grossQuantity: unknown;
    readonly netQuantity: unknown;
    readonly quantityUnit: string | null;
    readonly householdMeasureId: string | null;
    readonly householdMeasureQuantity: unknown;
    readonly householdMeasureDescription: string | null;
    readonly correctionFactor: unknown;
    readonly cookingYieldFactor: unknown;
    readonly notes: string | null;
  }[];
  readonly preparationSteps: readonly { readonly position: number; readonly instruction: string }[];
}) {
  return {
    title: recipe.title,
    normalizedTitle: recipe.normalizedTitle,
    description: recipe.description,
    notes: recipe.notes,
    category: recipe.category,
    preparationMethod: recipe.preparationMethod,
    preparationTimeMinutes: recipe.preparationTimeMinutes,
    yieldDescription: recipe.yieldDescription,
    finalYieldAmount: decimalNumber(recipe.finalYieldAmount),
    finalYieldUnit: recipe.finalYieldUnit,
    yieldAmount: decimalNumber(recipe.yieldAmount),
    yieldUnit: recipe.yieldUnit,
    finalWeightGrams: decimalNumber(recipe.finalWeightGrams),
    servings: recipe.servings,
    servingSize: decimalNumber(recipe.servingSize),
    servingSizeUnit: recipe.servingSizeUnit,
    servingHouseholdMeasure: recipe.servingHouseholdMeasure,
    servingWeightGrams: decimalNumber(recipe.servingWeightGrams),
    physicalType: recipe.physicalType,
    status: recipe.status,
    calculatedAt: recipe.calculatedAt,
    finalizedAt: recipe.finalizedAt,
    archivedAt: recipe.archivedAt,
    ingredients: recipe.ingredients.map((ingredient) => ({
      position: ingredient.position,
      foodId: ingredient.foodId,
      quantityGrams: decimalNumber(ingredient.quantityGrams),
      grossQuantity: decimalNumber(ingredient.grossQuantity),
      netQuantity: decimalNumber(ingredient.netQuantity),
      quantityUnit: ingredient.quantityUnit,
      householdMeasureId: ingredient.householdMeasureId,
      householdMeasureQuantity: decimalNumber(ingredient.householdMeasureQuantity),
      householdMeasureDescription: ingredient.householdMeasureDescription,
      correctionFactor: decimalNumber(ingredient.correctionFactor),
      cookingYieldFactor: decimalNumber(ingredient.cookingYieldFactor),
      notes: ingredient.notes,
    })),
    preparationSteps: recipe.preparationSteps.map((step) => ({
      position: step.position,
      instruction: step.instruction,
    })),
  };
}

function stateHash(value: unknown) {
  return sha256(JSON.stringify(value));
}

async function databaseFingerprint(database: ImportDatabase): Promise<DatabaseFingerprint> {
  const [recipeImportBatches, recipes, recipeIngredients] = await Promise.all([
    database.recipeImportBatch.count(),
    database.recipe.count(),
    database.recipeIngredient.count(),
  ]);
  return { recipeImportBatches, recipes, recipeIngredients };
}

async function resolveContext(
  database: ImportDatabase,
  ownerUserId: string,
  businessUnitId: string,
): Promise<ResolvedContext> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [owner, businessUnit, source] = await Promise.all([
    database.user.findFirst({
      where: { id: ownerUserId, status: "ACTIVE", deletedAt: null },
      select: {
        roles: { select: { role: { select: { grantsAllModules: true } } } },
        employeeProfile: {
          select: {
            status: true,
            deletedAt: true,
            employments: {
              where: {
                businessUnitId,
                status: "ACTIVE",
                startedAt: { lte: today },
                OR: [{ endedAt: null }, { endedAt: { gte: today } }],
              },
              select: { id: true },
            },
          },
        },
      },
    }),
    database.businessUnit.findFirst({
      where: { id: businessUnitId, status: "ACTIVE" },
      select: { id: true },
    }),
    database.nutritionSource.findFirst({
      where: { kind: "EVONUT", name: "EVONUT", version: EVONUT_SOURCE_VERSION },
      select: { id: true },
    }),
  ]);
  if (!owner) {
    throw new EvonutRecipeImportError("OWNER_NOT_ACTIVE", "Proprietário ativo não encontrado.");
  }
  if (!businessUnit) {
    throw new EvonutRecipeImportError(
      "BUSINESS_UNIT_NOT_ACTIVE",
      "Unidade de negócio ativa não encontrada.",
    );
  }
  const allModules = owner.roles.some(({ role }) => role.grantsAllModules);
  const activeEmployment =
    owner.employeeProfile?.status === "ACTIVE" &&
    owner.employeeProfile.deletedAt === null &&
    owner.employeeProfile.employments.length > 0;
  if (!allModules && !activeEmployment) {
    throw new EvonutRecipeImportError(
      "OWNER_BUSINESS_UNIT_LINK_NOT_FOUND",
      "O proprietário não possui vínculo ativo e vigente com a unidade de negócio.",
    );
  }
  if (!source) {
    throw new EvonutRecipeImportError(
      "EVONUT_SOURCE_NOT_IMPORTED",
      `A fonte EVONUT ${EVONUT_SOURCE_VERSION} não está cadastrada.`,
    );
  }
  return {
    sourceId: source.id,
    ownerBusinessUnitLink: allModules ? "ALL_MODULES_ROLE" : "ACTIVE_EMPLOYMENT",
  };
}

function addReason(
  reasons: EvonutRecipeImportReason[],
  code: EvonutRecipeImportReasonCode,
  message: string,
  ingredientOrder?: number,
) {
  reasons.push({ code, message, ...(ingredientOrder === undefined ? {} : { ingredientOrder }) });
}

async function buildPlan(
  database: ImportDatabase,
  parsed: EvonutRecipeParseResult,
  input: Pick<EvonutRecipeImportInput, "ownerUserId" | "businessUnitId">,
): Promise<ImportPlan> {
  const context = await resolveContext(database, input.ownerUserId, input.businessUnitId);
  const ingredients = parsed.recipes.flatMap((recipe) => recipe.ingredients);
  const foodCodes = [...new Set(ingredients.map((ingredient) => ingredient.foodCode))];
  const foodSourceNames = [
    ...new Set(ingredients.map((ingredient) => ingredient.foodSource).filter((value): value is string => value !== null)),
  ];
  const [sources, foods, measureReferences, existingRecipes] = await Promise.all([
    database.nutritionSource.findMany({
      where: { kind: "EVONUT", version: EVONUT_SOURCE_VERSION, name: { in: foodSourceNames } },
      select: { id: true, name: true },
    }),
    database.food.findMany({
      where: {
        importedFrom: EVONUT_IMPORTED_FROM,
        sourceCode: { in: foodCodes },
        source: { kind: "EVONUT", version: EVONUT_SOURCE_VERSION, name: { in: foodSourceNames } },
      },
      select: { id: true, sourceCode: true, status: true, source: { select: { name: true } } },
    }),
    database.foodHouseholdMeasureReference.findMany({
      where: {
        sourceId: context.sourceId,
        sourceFoodCode: { in: foodCodes },
        preparationCode: "",
        importedFrom: EVONUT_IMPORTED_FROM,
      },
      select: {
        id: true,
        foodId: true,
        sourceFoodCode: true,
        measureCode: true,
        measureName: true,
        quantityValue: true,
        quantityUnit: true,
        sourceVersion: true,
        matchStatus: true,
        foodSource: true,
      },
    }),
    database.recipe.findMany({
      where: {
        businessUnitId: input.businessUnitId,
        ownerUserId: input.ownerUserId,
        importSourceId: context.sourceId,
        sourceRecordCode: { in: parsed.recipes.map((recipe) => recipe.originalCode) },
      },
      include: existingRecipeInclude,
    }),
  ]);

  const sourceNames = new Set(sources.map((source) => source.name));
  const foodByKey = new Map(
    foods
      .filter((food) => food.sourceCode !== null)
      .map((food) => [evonutFoodKey(food.source.name, food.sourceCode!), food] as const),
  );
  const measureByKey = new Map<string, (typeof measureReferences)[number]>(
    measureReferences.map((reference) => [
      `${reference.foodSource ?? ""}\u0000${reference.sourceFoodCode}\u0000${reference.measureCode}`,
      reference,
    ] as const),
  );
  const existingByCode = new Map(
    existingRecipes
      .filter((recipe) => recipe.sourceRecordCode !== null)
      .map((recipe) => [recipe.sourceRecordCode!, recipe] as const),
  );

  let foodsResolved = 0;
  let measuresRequired = 0;
  let measuresResolved = 0;
  const plannedRecipes: PlannedRecipe[] = parsed.recipes.map((recipe) => {
    const reasons: EvonutRecipeImportReason[] = [];
    const plannedIngredients: PlannedIngredient[] = [];
    const ingredientLinks: EvonutRecipeIngredientLink[] = [];
    const resolvedLinks: Record<string, string | number | null>[] = [];

    for (const ingredient of recipe.ingredients) {
      const sourceName = ingredient.foodSource;
      const food = sourceName ? foodByKey.get(evonutFoodKey(sourceName, ingredient.foodCode)) : null;
      if (!sourceName || !sourceNames.has(sourceName)) {
        addReason(
          reasons,
          "FOOD_SOURCE_NOT_IMPORTED",
          `Fonte alimentar não importada para o código ${ingredient.foodCode}.`,
          ingredient.order,
        );
      } else if (!food) {
        addReason(
          reasons,
          "FOOD_NOT_IMPORTED",
          `Alimento ${sourceName}/${ingredient.foodCode} não foi localizado pela identidade de origem.`,
          ingredient.order,
        );
      } else if (food.status !== "ACTIVE") {
        addReason(
          reasons,
          "FOOD_INACTIVE",
          `Alimento ${sourceName}/${ingredient.foodCode} está inativo.`,
          ingredient.order,
        );
      } else {
        foodsResolved += 1;
      }

      const informedQuantity = ingredient.informedQuantity.value;
      const resolvedAmount = ingredient.resolvedEquivalence.amount;
      const resolvedUnit = ingredient.resolvedEquivalence.unit;
      if (informedQuantity === null || !Number.isFinite(informedQuantity) || informedQuantity <= 0) {
        addReason(
          reasons,
          "INGREDIENT_QUANTITY_NOT_EXPLICIT",
          "Quantidade informada do ingrediente não é explícita e positiva.",
          ingredient.order,
        );
      }
      if (
        resolvedAmount === null ||
        !Number.isFinite(resolvedAmount) ||
        resolvedAmount <= 0 ||
        resolvedUnit === null
      ) {
        addReason(
          reasons,
          "INGREDIENT_EQUIVALENCE_UNRESOLVED",
          "Equivalência em g/ml não foi resolvida pela origem.",
          ingredient.order,
        );
      }

      let measureReferenceId: string | null = null;
      if (ingredient.resolvedEquivalence.method === "BD_MEDIDAS") {
        measuresRequired += 1;
        const measureKey = `${sourceName ?? ""}\u0000${ingredient.foodCode}\u0000${evonutMeasureCode(ingredient.householdMeasure)}`;
        const reference = measureByKey.get(measureKey);
        if (!reference) {
          addReason(
            reasons,
            "MEASURE_REFERENCE_NOT_IMPORTED",
            `Medida ${ingredient.householdMeasure} não foi localizada pela identidade Evonut do alimento.`,
            ingredient.order,
          );
        } else {
          const sameFood = food?.id === reference.foodId;
          const sameAmount =
            decimalNumber(reference.quantityValue) === ingredient.resolvedEquivalence.measureValue;
          const sameUnit = reference.quantityUnit === resolvedUnit;
          const confirmed = reference.matchStatus === "CONFIRMED";
          const sameVersion = reference.sourceVersion === EVONUT_SOURCE_VERSION;
          if (!sameFood || !sameAmount || !sameUnit || !confirmed || !sameVersion) {
            addReason(
              reasons,
              "MEASURE_REFERENCE_CONFLICT",
              `A medida importada ${ingredient.householdMeasure} diverge do vínculo resolvido pelo parser.`,
              ingredient.order,
            );
          } else {
            measureReferenceId = reference.id;
            measuresResolved += 1;
          }
        }
      }

      ingredientLinks.push({
        order: ingredient.order,
        foodSource: sourceName,
        foodCode: ingredient.foodCode,
        foodId: food?.id ?? null,
        measure: ingredient.householdMeasure,
        measureReferenceId,
        quantity: informedQuantity,
        resolvedAmount,
        resolvedUnit,
      });
      resolvedLinks.push({
        order: ingredient.order,
        foodId: food?.id ?? null,
        measureReferenceId,
      });
      if (food && food.status === "ACTIVE" && informedQuantity !== null && resolvedAmount !== null && resolvedUnit) {
        plannedIngredients.push({
          position: ingredient.order,
          foodId: food.id,
          quantityGrams: resolvedAmount,
          grossQuantity: null,
          netQuantity: null,
          quantityUnit: resolvedUnit === "g" ? "GRAM" : "MILLILITER",
          householdMeasureId: null,
          householdMeasureQuantity: informedQuantity,
          householdMeasureDescription: ingredient.householdMeasure,
          correctionFactor: null,
          cookingYieldFactor: null,
          notes: ingredient.observation,
        });
      }
    }

    const data = reasons.length === 0 ? structuredRecipeData(recipe, plannedIngredients) : null;
    const hash = data ? stateHash(data) : null;
    const existing = existingByCode.get(recipe.originalCode);
    if (existing) {
      if (!existing.sourceContentHash || !existing.importedStateHash) {
        addReason(
          reasons,
          "IMPORT_PROVENANCE_INCOMPLETE",
          "A receita de mesma origem não possui hashes completos de proveniência.",
        );
      } else {
        if (existing.sourceContentHash !== recipe.contentSha256) {
          addReason(
            reasons,
            "SOURCE_CONTENT_CHANGED",
            "O conteúdo da receita na origem mudou; a versão importada não será sobrescrita.",
          );
        }
        const currentStateHash = stateHash(persistedRecipeState(existing));
        if (currentStateHash !== existing.importedStateHash) {
          addReason(
            reasons,
            "MANUAL_EDIT_DETECTED",
            "A receita importada recebeu alteração posterior e não será sobrescrita.",
          );
        }
        if (
          existing.sourceContentHash === recipe.contentSha256 &&
          currentStateHash === existing.importedStateHash
        ) {
          addReason(
            reasons,
            "IDENTICAL_ORIGIN_ALREADY_IMPORTED",
            "A mesma receita de origem já foi importada sem alterações posteriores.",
          );
        }
      }
    }

    const identical = reasons.some((reason) => reason.code === "IDENTICAL_ORIGIN_ALREADY_IMPORTED");
    const disposition: RecipeDisposition = identical
      ? "IGNORED"
      : reasons.length > 0
        ? "BLOCKED"
        : "READY";
    const item: EvonutRecipeImportPlanItem = {
      originalCode: recipe.originalCode,
      name: recipe.name,
      disposition,
      reasons,
      parserPendings: recipe.pendings,
      ingredientLinks,
      sourceRecipe: recipe,
    };
    const originalData = {
      schemaVersion: 1,
      parserMetadata: parsed.metadata,
      recipe,
      resolvedLinks,
    } as unknown as Prisma.InputJsonValue;
    return { item, data, stateHash: hash, originalData };
  });

  return {
    context,
    parsed,
    recipes: plannedRecipes,
    counts: {
      ready: plannedRecipes.filter(({ item }) => item.disposition === "READY").length,
      ignored: plannedRecipes.filter(({ item }) => item.disposition === "IGNORED").length,
      blocked: plannedRecipes.filter(({ item }) => item.disposition === "BLOCKED").length,
      recipes: parsed.counts.recipes,
      ingredients: parsed.counts.ingredients,
      distinctFoodCodes: parsed.counts.distinctFoodCodes,
      grams: parsed.counts.grams,
      milliliters: parsed.counts.milliliters,
      foodsResolved,
      measuresRequired,
      measuresResolved,
    },
  };
}

async function applyPlan(
  database: PrismaClient,
  parsed: EvonutRecipeParseResult,
  input: Pick<EvonutRecipeImportInput, "ownerUserId" | "businessUnitId">,
) {
  return database.$transaction(async (transaction) => {
    const plan = await buildPlan(transaction, parsed, input);
    const ready = plan.recipes.filter(
      (recipe): recipe is PlannedRecipe & {
        readonly data: NonNullable<PlannedRecipe["data"]>;
        readonly stateHash: string;
      } => recipe.item.disposition === "READY" && recipe.data !== null && recipe.stateHash !== null,
    );
    if (ready.length === 0) return { plan, importedRecipeIds: [] as string[] };

    let batch = await transaction.recipeImportBatch.findFirst({
      where: {
        sourceId: plan.context.sourceId,
        fileHash: parsed.metadata.sourceSha256,
        parserVersion: EVONUT_RECIPE_IMPORTER_VERSION,
      },
      select: { id: true },
    });
    if (!batch) {
      batch = await transaction.recipeImportBatch.create({
        data: {
          sourceId: plan.context.sourceId,
          sourceVersion: parsed.metadata.sourceVersion,
          fileName: basename(parsed.metadata.sourcePath),
          fileHash: parsed.metadata.sourceSha256,
          hashAlgorithm: "SHA-256",
          parserVersion: EVONUT_RECIPE_IMPORTER_VERSION,
          status: "IMPORTED",
          completedAt: new Date(),
          importedAt: new Date(),
        },
        select: { id: true },
      });
    }

    const importedRecipeIds: string[] = [];
    for (const planned of ready) {
      const concurrent = await transaction.recipe.findFirst({
        where: {
          businessUnitId: input.businessUnitId,
          ownerUserId: input.ownerUserId,
          importSourceId: plan.context.sourceId,
          sourceRecordCode: planned.item.originalCode,
        },
        select: { id: true },
      });
      if (concurrent) {
        throw new EvonutRecipeImportError(
          "CONCURRENT_IMPORT_CONFLICT",
          `A receita ${planned.item.originalCode} foi criada durante a importação.`,
        );
      }
      const { ingredients, preparationSteps: _preparationSteps, ...recipeData } = planned.data;
      void _preparationSteps;
      const created = await transaction.recipe.create({
        data: {
          ...recipeData,
          businessUnitId: input.businessUnitId,
          ownerUserId: input.ownerUserId,
          createdByUserId: input.ownerUserId,
          updatedByUserId: input.ownerUserId,
          importBatchId: batch.id,
          importSourceId: plan.context.sourceId,
          sourceRecordCode: planned.item.originalCode,
          sourceContentHash: planned.item.sourceRecipe.contentSha256,
          importedStateHash: planned.stateHash,
          sourceLocation: {
            sourcePath: parsed.metadata.sourcePath,
            recipe: planned.item.sourceRecipe.sourceLocation,
          } as unknown as Prisma.InputJsonValue,
          sourceOriginalData: planned.originalData,
          sourcePendings: planned.item.parserPendings as unknown as Prisma.InputJsonValue,
          importedAt: new Date(),
          ingredients: { create: [...ingredients] },
        },
        select: { id: true },
      });
      importedRecipeIds.push(created.id);
    }
    return { plan, importedRecipeIds };
  }, { isolationLevel: "Serializable" });
}

export async function importEvonutRecipes(
  database: PrismaClient,
  input: EvonutRecipeImportInput,
): Promise<EvonutRecipeImportResult> {
  const mode = input.mode ?? "dry-run";
  const parsed = parseEvonutRecipesWorkbook(input.workbookBytes, {
    sourcePath: input.sourcePath,
  });
  const databaseBefore = await databaseFingerprint(database);
  let plan = await buildPlan(database, parsed, input);
  let importedRecipeIds: readonly string[] = [];
  let transactionApplied = false;

  if (mode === "apply") {
    const applied = await applyPlan(database, parsed, input);
    plan = applied.plan;
    importedRecipeIds = applied.importedRecipeIds;
    transactionApplied = applied.importedRecipeIds.length > 0;
  }

  const databaseAfter = await databaseFingerprint(database);
  return {
    mode,
    ownerUserId: input.ownerUserId,
    businessUnitId: input.businessUnitId,
    ownerBusinessUnitLink: plan.context.ownerBusinessUnitLink,
    parser: parsed,
    counts: plan.counts,
    recipes: plan.recipes.map(({ item }) => item),
    databaseBefore,
    databaseAfter,
    databaseUnchanged: JSON.stringify(databaseBefore) === JSON.stringify(databaseAfter),
    transactionApplied,
    importedRecipeIds,
  };
}
