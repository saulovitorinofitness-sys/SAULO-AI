import { canAccess, mvpService, type FrontendAccessSnapshot } from "../mvp";
import { prisma } from "../../lib/database/prisma";

import {
  calculateNutritionLabel,
  NUTRITION_LABEL_RULES,
  type NutritionLabelCalculationResult,
  type NutritionLabelPending,
  type NutritionLabelProductInput,
  type NutritionLabelSnapshotInput,
} from "./nutrition-label-calculator";

type WriteAction = "CREATE" | "UPDATE" | "DELETE";
type ProductPhysicalType = "SOLID" | "SEMISOLID" | "LIQUID";
type ProductContentUnit = "GRAM" | "MILLILITER";

export type ProductLabelServiceErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "BLOCKING_PENDINGS"
  | "NEW_VERSION_REQUIRED"
  | "VERSION_CONFLICT"
  | "PERSISTENCE_CONTRACT_UNAVAILABLE";

export class ProductLabelServiceError extends Error {
  constructor(
    readonly code: ProductLabelServiceErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProductLabelServiceError";
  }
}

export interface ProductLabelContext {
  /** Unidade empresarial resolvida em contexto confiável do servidor. */
  readonly businessUnitId: string;
}

export interface CommercialProductDraftInput {
  readonly recipeId: string;
  readonly recipeNutritionSnapshotId: string;
  readonly commercialName: string;
  readonly brand?: string;
  readonly description?: string;
  readonly category?: string;
  readonly physicalType: ProductPhysicalType;
  readonly netContent: number;
  readonly netContentUnit: ProductContentUnit;
  readonly servingsPerPackage: number;
  readonly servingSize: number;
  readonly servingSizeUnit: ProductContentUnit;
  readonly servingHouseholdMeasure?: string;
  readonly sku?: string;
  readonly shelfLifeDays?: number;
  readonly storageInstructions?: string;
  readonly preparationOrConsumptionInstructions?: string;
}

export interface CommercialProductUpdateInput {
  readonly recipeId?: string;
  readonly recipeNutritionSnapshotId?: string;
  readonly commercialName?: string;
  readonly brand?: string | null;
  readonly description?: string | null;
  readonly category?: string | null;
  readonly physicalType?: ProductPhysicalType;
  readonly netContent?: number;
  readonly netContentUnit?: ProductContentUnit;
  readonly servingsPerPackage?: number;
  readonly servingSize?: number;
  readonly servingSizeUnit?: ProductContentUnit;
  readonly servingHouseholdMeasure?: string | null;
  readonly sku?: string | null;
  readonly shelfLifeDays?: number | null;
  readonly storageInstructions?: string | null;
  readonly preparationOrConsumptionInstructions?: string | null;
}

export type ProductLabelRegulatoryInput = Pick<
  NutritionLabelProductInput,
  | "servingReference"
  | "additionalMandatoryNutrientsReview"
  | "nutritionTableContext"
  | "nonSignificantZeroEligibility"
  | "frontOfPack"
>;

export const PRODUCT_LABEL_PERSISTENCE_BLOCKERS = [] as const;

interface RecipeRow {
  readonly id: string;
  readonly businessUnitId: string;
  readonly ownerUserId: string;
  readonly status?: "DRAFT" | "CALCULATED" | "FINALIZED" | "ARCHIVED";
  readonly updatedAt?: Date;
}

interface NutritionSnapshotRow {
  readonly id: string;
  readonly recipeId: string;
  readonly version: number;
  readonly ingredientCount: number;
  readonly totalIngredientWeightGrams: unknown;
  readonly totalIngredientMassGrams: unknown;
  readonly totalIngredientVolumeMilliliters: unknown;
  readonly finalWeightGrams: unknown;
  readonly finalYieldAmount: unknown;
  readonly finalYieldUnit: ProductContentUnit;
  readonly servings: number;
  readonly servingWeightGrams: unknown;
  readonly servingSize: unknown;
  readonly servingSizeUnit: ProductContentUnit;
  readonly calculationBasisAmount: unknown;
  readonly calculationBasisUnit: ProductContentUnit;
  readonly energyKcal: unknown;
  readonly proteinGrams: unknown;
  readonly carbohydratesGrams: unknown;
  readonly fatsGrams: unknown;
  readonly fiberGrams: unknown;
  readonly sugarsGrams: unknown;
  readonly addedSugarsGrams: unknown;
  readonly saturatedFatsGrams: unknown;
  readonly transFatsGrams: unknown;
  readonly sodiumMg: unknown;
  readonly additionalNutrients: unknown;
  readonly calculatedAt: Date;
}

interface ProductNutritionLabelRow {
  readonly id: string;
  readonly commercialFoodProductId: string;
  readonly recipeNutritionSnapshotId: string;
  readonly version: number;
  readonly status: "DRAFT" | "VALIDATED" | "SUPERSEDED" | "ARCHIVED";
  readonly regulatoryInput: unknown;
  readonly calculationResult: unknown;
  readonly calculationPendings: unknown;
  readonly rulesSnapshot: unknown;
  readonly productInputSnapshot: unknown;
  readonly createdAt: Date;
  readonly validatedAt: Date | null;
  readonly validatedByUserId: string | null;
  readonly [key: string]: unknown;
}

interface CommercialProductRow {
  readonly id: string;
  readonly businessUnitId: string;
  readonly ownerUserId: string;
  readonly recipeId: string;
  readonly recipeNutritionSnapshotId: string;
  readonly commercialName: string;
  readonly normalizedCommercialName?: string;
  readonly brand?: string | null;
  readonly description?: string | null;
  readonly category: string | null;
  readonly physicalType: ProductPhysicalType;
  readonly netContent: unknown;
  readonly netContentUnit: ProductContentUnit;
  readonly servingsPerPackage: unknown;
  readonly servingSize: unknown;
  readonly servingSizeUnit: ProductContentUnit;
  readonly servingHouseholdMeasure: string | null;
  readonly status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  readonly sku?: string | null;
  readonly shelfLifeDays?: number | null;
  readonly storageInstructions?: string | null;
  readonly preparationOrConsumptionInstructions?: string | null;
  readonly activatedAt?: Date | null;
  readonly archivedAt?: Date | null;
  readonly offlineAvailable?: boolean;
  readonly offlinePublishedAt?: Date | null;
  readonly createdAt?: Date;
  readonly updatedAt: Date;
  readonly recipe: RecipeRow;
  readonly recipeNutritionSnapshot: NutritionSnapshotRow;
  readonly nutritionLabels: readonly ProductNutritionLabelRow[];
  readonly [key: string]: unknown;
}

interface ProductLabelTransaction {
  recipe: {
    findFirst(args: Record<string, unknown>): Promise<RecipeRow | null>;
  };
  recipeNutritionSnapshot: {
    findFirst(args: Record<string, unknown>): Promise<NutritionSnapshotRow | null>;
  };
  commercialFoodProduct: {
    create(args: Record<string, unknown>): Promise<CommercialProductRow>;
    update(args: Record<string, unknown>): Promise<CommercialProductRow>;
    findFirst(args: Record<string, unknown>): Promise<CommercialProductRow | null>;
    findMany(args: Record<string, unknown>): Promise<readonly CommercialProductRow[]>;
  };
  productNutritionLabel: {
    findFirst(args: Record<string, unknown>): Promise<ProductNutritionLabelRow | null>;
    findMany(args: Record<string, unknown>): Promise<readonly ProductNutritionLabelRow[]>;
    create(args: Record<string, unknown>): Promise<ProductNutritionLabelRow>;
    update(args: Record<string, unknown>): Promise<ProductNutritionLabelRow>;
  };
}

interface ProductLabelDatabase extends ProductLabelTransaction {
  $transaction<T>(
    operation: (transaction: ProductLabelTransaction) => Promise<T>,
    options?: { isolationLevel: "Serializable" },
  ): Promise<T>;
}

interface ProductLabelServiceDependencies {
  readonly database: ProductLabelDatabase;
  readonly getSession: () => Promise<FrontendAccessSnapshot>;
}

const productInclude = {
  recipe: true,
  recipeNutritionSnapshot: true,
  nutritionLabels: { orderBy: { version: "desc" } },
} as const;

function trimmed(value: string | undefined) {
  return value?.trim() || null;
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

function numberValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
}

function isoDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }
  return null;
}

function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizedJson(entry)]),
    );
  }
  return value;
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(normalizedJson(left)) === JSON.stringify(normalizedJson(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function productInputSnapshot(product: CommercialProductRow) {
  return jsonCopy({
    schemaVersion: 1,
    product: {
      id: product.id,
      businessUnitId: product.businessUnitId,
      ownerUserId: product.ownerUserId,
      recipeId: product.recipeId,
      recipeNutritionSnapshotId: product.recipeNutritionSnapshotId,
      commercialName: product.commercialName,
      normalizedCommercialName: product.normalizedCommercialName ?? null,
      brand: product.brand ?? null,
      description: product.description ?? null,
      category: product.category,
      physicalType: product.physicalType,
      netContent: numberValue(product.netContent),
      netContentUnit: product.netContentUnit,
      servingsPerPackage: numberValue(product.servingsPerPackage),
      servingSize: numberValue(product.servingSize),
      servingSizeUnit: product.servingSizeUnit,
      servingHouseholdMeasure: product.servingHouseholdMeasure,
      status: product.status ?? null,
      sku: product.sku ?? null,
      shelfLifeDays: product.shelfLifeDays ?? null,
      storageInstructions: product.storageInstructions ?? null,
      preparationOrConsumptionInstructions:
        product.preparationOrConsumptionInstructions ?? null,
      activatedAt: isoDate(product.activatedAt),
      archivedAt: isoDate(product.archivedAt),
      offlineAvailable: product.offlineAvailable ?? null,
      offlinePublishedAt: isoDate(product.offlinePublishedAt),
      createdAt: isoDate(product.createdAt),
      updatedAt: isoDate(product.updatedAt),
    },
    source: {
      recipe: {
        id: product.recipe.id,
        status: product.recipe.status ?? null,
        updatedAt: isoDate(product.recipe.updatedAt),
      },
      nutritionSnapshot: {
        id: product.recipeNutritionSnapshot.id,
        recipeId: product.recipeNutritionSnapshot.recipeId,
        version: product.recipeNutritionSnapshot.version,
        calculatedAt: isoDate(product.recipeNutritionSnapshot.calculatedAt),
        input: snapshotInput(product.recipeNutritionSnapshot),
      },
    },
  });
}

function requiredId(value: string, field: string) {
  const result = value.trim();
  if (!result) {
    throw new ProductLabelServiceError(
      "INVALID_INPUT",
      `${field} é obrigatório.`,
    );
  }
  return result;
}

function positive(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ProductLabelServiceError(
      "INVALID_INPUT",
      `${field} deve ser maior que zero.`,
    );
  }
}

function productDraftData(input: CommercialProductDraftInput) {
  const commercialName = input.commercialName.trim();
  if (commercialName.length < 2) {
    throw new ProductLabelServiceError(
      "INVALID_INPUT",
      "Nome comercial do produto é obrigatório.",
    );
  }
  positive(input.netContent, "Conteúdo líquido");
  positive(input.servingsPerPackage, "Porções por embalagem");
  positive(input.servingSize, "Tamanho da porção");
  if (
    input.shelfLifeDays !== undefined &&
    (!Number.isInteger(input.shelfLifeDays) || input.shelfLifeDays <= 0)
  ) {
    throw new ProductLabelServiceError(
      "INVALID_INPUT",
      "Validade em dias deve ser um número inteiro maior que zero.",
    );
  }

  const expectedUnit =
    input.physicalType === "LIQUID" ? "MILLILITER" : "GRAM";
  if (
    input.netContentUnit !== expectedUnit ||
    input.servingSizeUnit !== expectedUnit
  ) {
    throw new ProductLabelServiceError(
      "INVALID_INPUT",
      "Conteúdo e porção devem usar mililitros para líquidos e gramas para sólidos ou semissólidos; densidade não foi presumida.",
    );
  }

  return {
    commercialName,
    normalizedCommercialName: normalized(commercialName),
    brand: trimmed(input.brand),
    description: trimmed(input.description),
    category: trimmed(input.category),
    physicalType: input.physicalType,
    netContent: input.netContent,
    netContentUnit: input.netContentUnit,
    servingsPerPackage: input.servingsPerPackage,
    servingSize: input.servingSize,
    servingSizeUnit: input.servingSizeUnit,
    servingHouseholdMeasure: trimmed(input.servingHouseholdMeasure),
    sku: trimmed(input.sku),
    shelfLifeDays: input.shelfLifeDays,
    storageInstructions: trimmed(input.storageInstructions),
    preparationOrConsumptionInstructions: trimmed(
      input.preparationOrConsumptionInstructions,
    ),
  };
}

function productUpdateData(
  product: CommercialProductRow,
  input: CommercialProductUpdateInput,
) {
  const data = productDraftData({
    recipeId: input.recipeId ?? product.recipeId,
    recipeNutritionSnapshotId:
      input.recipeNutritionSnapshotId ?? product.recipeNutritionSnapshotId,
    commercialName: input.commercialName ?? product.commercialName,
    brand: input.brand ?? product.brand ?? undefined,
    description: input.description ?? product.description ?? undefined,
    category: input.category ?? product.category ?? undefined,
    physicalType: input.physicalType ?? product.physicalType,
    netContent: input.netContent ?? numberValue(product.netContent) ?? Number.NaN,
    netContentUnit: input.netContentUnit ?? product.netContentUnit,
    servingsPerPackage:
      input.servingsPerPackage ??
      numberValue(product.servingsPerPackage) ??
      Number.NaN,
    servingSize:
      input.servingSize ?? numberValue(product.servingSize) ?? Number.NaN,
    servingSizeUnit: input.servingSizeUnit ?? product.servingSizeUnit,
    servingHouseholdMeasure:
      input.servingHouseholdMeasure ??
      product.servingHouseholdMeasure ??
      undefined,
    sku: input.sku ?? product.sku ?? undefined,
    shelfLifeDays:
      input.shelfLifeDays ?? product.shelfLifeDays ?? undefined,
    storageInstructions:
      input.storageInstructions ?? product.storageInstructions ?? undefined,
    preparationOrConsumptionInstructions:
      input.preparationOrConsumptionInstructions ??
      product.preparationOrConsumptionInstructions ??
      undefined,
  });

  return {
    ...data,
    brand: input.brand === null ? null : data.brand,
    description: input.description === null ? null : data.description,
    category: input.category === null ? null : data.category,
    servingHouseholdMeasure:
      input.servingHouseholdMeasure === null
        ? null
        : data.servingHouseholdMeasure,
    sku: input.sku === null ? null : data.sku,
    shelfLifeDays: input.shelfLifeDays === null ? null : data.shelfLifeDays,
    storageInstructions:
      input.storageInstructions === null ? null : data.storageInstructions,
    preparationOrConsumptionInstructions:
      input.preparationOrConsumptionInstructions === null
        ? null
        : data.preparationOrConsumptionInstructions,
  };
}

async function access(
  dependencies: ProductLabelServiceDependencies,
  action: "READ" | WriteAction,
) {
  let session: FrontendAccessSnapshot;
  try {
    session = await dependencies.getSession();
  } catch {
    throw new ProductLabelServiceError(
      "AUTHENTICATION_REQUIRED",
      "Sessão autenticada obrigatória.",
    );
  }
  if (
    session.user.status !== "ACTIVE" ||
    !canAccess(session, "MEAL_PLAN", action)
  ) {
    throw new ProductLabelServiceError(
      "FORBIDDEN",
      "A sessão não possui acesso a Receitas e Produtos.",
    );
  }
  return session;
}

function ownershipWhere(
  id: string,
  context: ProductLabelContext,
  ownerUserId: string,
) {
  return {
    id,
    businessUnitId: context.businessUnitId,
    ownerUserId,
  };
}

async function ownedRecipe(
  transaction: Pick<ProductLabelTransaction, "recipe">,
  recipeId: string,
  context: ProductLabelContext,
  ownerUserId: string,
) {
  const recipe = await transaction.recipe.findFirst({
    where: ownershipWhere(recipeId, context, ownerUserId),
  });
  if (!recipe) {
    throw new ProductLabelServiceError("NOT_FOUND", "Receita não encontrada.");
  }
  return recipe;
}

async function ownedProduct(
  transaction: Pick<ProductLabelTransaction, "commercialFoodProduct">,
  productId: string,
  context: ProductLabelContext,
  ownerUserId: string,
) {
  const product = await transaction.commercialFoodProduct.findFirst({
    where: ownershipWhere(productId, context, ownerUserId),
    include: productInclude,
  });
  if (!product) {
    throw new ProductLabelServiceError("NOT_FOUND", "Produto não encontrado.");
  }
  return product;
}

function scientificEnergyKj(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const energyKj = (value as Record<string, unknown>).energyKj;
  if (typeof energyKj === "number" && Number.isFinite(energyKj)) return energyKj;
  if (!energyKj || typeof energyKj !== "object" || Array.isArray(energyKj)) {
    return null;
  }
  const scientific = energyKj as Record<string, unknown>;
  if (scientific.status === "VALUE") {
    const numeric = numberValue(scientific.value);
    return numeric === null ? null : { status: "VALUE" as const, value: numeric };
  }
  if (
    scientific.status === "TRACE" ||
    scientific.status === "NOT_ANALYZED" ||
    scientific.status === "NOT_APPLICABLE" ||
    scientific.status === "MISSING"
  ) {
    return { status: scientific.status, value: null } as const;
  }
  return null;
}

function snapshotInput(
  snapshot: NutritionSnapshotRow,
): NutritionLabelSnapshotInput {
  return {
    id: snapshot.id,
    recipeId: snapshot.recipeId,
    version: snapshot.version,
    calculatedAt: snapshot.calculatedAt,
    ingredientCount: snapshot.ingredientCount,
    totalIngredientWeightGrams: numberValue(
      snapshot.totalIngredientWeightGrams,
    ),
    totalIngredientMassGrams: numberValue(snapshot.totalIngredientMassGrams),
    totalIngredientVolumeMilliliters: numberValue(
      snapshot.totalIngredientVolumeMilliliters,
    ),
    finalWeightGrams: numberValue(snapshot.finalWeightGrams),
    finalYieldAmount: numberValue(snapshot.finalYieldAmount) ?? undefined,
    finalYieldUnit: snapshot.finalYieldUnit,
    servings: snapshot.servings,
    servingWeightGrams: numberValue(snapshot.servingWeightGrams),
    servingSize: numberValue(snapshot.servingSize) ?? undefined,
    servingSizeUnit: snapshot.servingSizeUnit,
    calculationBasisAmount:
      numberValue(snapshot.calculationBasisAmount) === 100 ? 100 : undefined,
    calculationBasisUnit: snapshot.calculationBasisUnit,
    energyKcal: numberValue(snapshot.energyKcal),
    proteinGrams: numberValue(snapshot.proteinGrams),
    carbohydratesGrams: numberValue(snapshot.carbohydratesGrams),
    fatsGrams: numberValue(snapshot.fatsGrams),
    fiberGrams: numberValue(snapshot.fiberGrams),
    sugarsGrams: numberValue(snapshot.sugarsGrams),
    addedSugarsGrams: numberValue(snapshot.addedSugarsGrams),
    saturatedFatsGrams: numberValue(snapshot.saturatedFatsGrams),
    transFatsGrams: numberValue(snapshot.transFatsGrams),
    sodiumMg: numberValue(snapshot.sodiumMg),
    additionalNutrients: { energyKj: scientificEnergyKj(snapshot.additionalNutrients) },
  };
}

function calculationProductInput(
  product: CommercialProductRow,
  regulatoryInput: ProductLabelRegulatoryInput,
): NutritionLabelProductInput {
  return {
    id: product.id,
    physicalType: product.physicalType,
    category: product.category,
    netContent: numberValue(product.netContent),
    netContentUnit: product.netContentUnit,
    servingsPerPackage: numberValue(product.servingsPerPackage),
    servingSize: numberValue(product.servingSize),
    servingSizeUnit: product.servingSizeUnit,
    servingHouseholdMeasure: product.servingHouseholdMeasure,
    ...regulatoryInput,
  };
}

function calculateProductLabel(
  product: CommercialProductRow,
  regulatoryInput: ProductLabelRegulatoryInput,
) {
  return calculateNutritionLabel({
    snapshot: snapshotInput(product.recipeNutritionSnapshot),
    product: calculationProductInput(product, regulatoryInput),
  });
}

function blockingPendings(calculation: NutritionLabelCalculationResult) {
  return calculation.pendings.filter((pending) =>
    pending.blockingFor.includes("LABEL_EMISSION"),
  );
}

interface PreservedLabelVersionData {
  readonly regulatoryInput: ProductLabelRegulatoryInput;
  readonly calculation: NutritionLabelCalculationResult;
  readonly pendings: readonly NutritionLabelPending[];
  readonly rules: typeof NUTRITION_LABEL_RULES;
  readonly productInputSnapshot: ReturnType<typeof productInputSnapshot>;
}

type PreservedLabelVersionRead =
  | {
      readonly status: "PRESERVED";
      readonly data: PreservedLabelVersionData;
      readonly reason: null;
    }
  | {
      readonly status: "LEGACY_UNVERIFIABLE" | "INVALID";
      readonly data: null;
      readonly reason: string;
    };

function readPreservedVersion(
  label: ProductNutritionLabelRow,
): PreservedLabelVersionRead {
  const values = [
    label.regulatoryInput,
    label.calculationResult,
    label.calculationPendings,
    label.rulesSnapshot,
    label.productInputSnapshot,
  ];
  if (values.some((value) => value === null || value === undefined)) {
    return {
      status: "LEGACY_UNVERIFIABLE",
      data: null,
      reason:
        "Versão anterior ao contrato de preservação integral; permanece consultável, mas sua integridade não pode ser comprovada.",
    };
  }

  const calculation = label.calculationResult;
  if (
    !isRecord(label.regulatoryInput) ||
    !isRecord(calculation) ||
    !Array.isArray(label.calculationPendings) ||
    !isRecord(label.rulesSnapshot) ||
    !isRecord(label.productInputSnapshot) ||
    !isRecord(calculation.rules) ||
    !isRecord(calculation.labelEmission) ||
    !isRecord(calculation.nutrients) ||
    !isRecord(calculation.frontOfPack) ||
    !isRecord(calculation.traceability) ||
    !Array.isArray(calculation.pendings) ||
    !["UNAVAILABLE", "PARTIAL", "COMPLETE"].includes(
      String(calculation.calculationStatus),
    ) ||
    !sameJson(calculation.rules, label.rulesSnapshot) ||
    !sameJson(calculation.pendings, label.calculationPendings) ||
    calculation.traceability.snapshotId !== label.recipeNutritionSnapshotId ||
    calculation.traceability.productId !== label.commercialFoodProductId
  ) {
    return {
      status: "INVALID",
      data: null,
      reason:
        "Os dados preservados da versão estão ausentes, divergentes ou estruturalmente inválidos.",
    };
  }

  return {
    status: "PRESERVED",
    data: {
      regulatoryInput:
        label.regulatoryInput as unknown as ProductLabelRegulatoryInput,
      calculation:
        calculation as unknown as NutritionLabelCalculationResult,
      pendings:
        label.calculationPendings as unknown as readonly NutritionLabelPending[],
      rules: label.rulesSnapshot as unknown as typeof NUTRITION_LABEL_RULES,
      productInputSnapshot:
        label.productInputSnapshot as ReturnType<typeof productInputSnapshot>,
    },
    reason: null,
  };
}

function labelVersionReadModel(label: ProductNutritionLabelRow) {
  return {
    ...label,
    preservedVersion: readPreservedVersion(label),
  };
}

function rawNutrient(
  calculation: NutritionLabelCalculationResult,
  nutrient: keyof NutritionLabelCalculationResult["nutrients"],
  field: "per100" | "perServing" | "dailyValuePercent",
) {
  return calculation.nutrients[nutrient].raw[field];
}

function frontThresholdState(
  calculation: NutritionLabelCalculationResult,
  nutrient: keyof NutritionLabelCalculationResult["frontOfPack"]["nutrients"],
) {
  return calculation.frontOfPack.nutrients[nutrient].meetsThreshold;
}

function labelVersionData(
  product: CommercialProductRow,
  regulatoryInput: ProductLabelRegulatoryInput,
  calculation: NutritionLabelCalculationResult,
  version: number,
  userId: string,
) {
  return {
    commercialFoodProductId: product.id,
    recipeNutritionSnapshotId: product.recipeNutritionSnapshotId,
    version,
    status: "DRAFT" as const,
    legislationReference: calculation.rules.id,
    regulatoryInput: jsonCopy(regulatoryInput),
    calculationResult: jsonCopy(calculation),
    calculationPendings: jsonCopy(calculation.pendings),
    rulesSnapshot: jsonCopy(calculation.rules),
    productInputSnapshot: productInputSnapshot(product),
    servingsPerPackage: numberValue(product.servingsPerPackage),
    servingSize: numberValue(product.servingSize),
    servingSizeUnit: product.servingSizeUnit,
    servingHouseholdMeasure: product.servingHouseholdMeasure,
    energyKcalPerServing: rawNutrient(calculation, "energyKcal", "perServing"),
    carbohydratesGramsPerServing: rawNutrient(
      calculation,
      "carbohydratesGrams",
      "perServing",
    ),
    totalSugarsGramsPerServing: rawNutrient(
      calculation,
      "totalSugarsGrams",
      "perServing",
    ),
    addedSugarsGramsPerServing: rawNutrient(
      calculation,
      "addedSugarsGrams",
      "perServing",
    ),
    proteinGramsPerServing: rawNutrient(calculation, "proteinGrams", "perServing"),
    totalFatsGramsPerServing: rawNutrient(
      calculation,
      "totalFatsGrams",
      "perServing",
    ),
    saturatedFatsGramsPerServing: rawNutrient(
      calculation,
      "saturatedFatsGrams",
      "perServing",
    ),
    transFatsGramsPerServing: rawNutrient(
      calculation,
      "transFatsGrams",
      "perServing",
    ),
    fiberGramsPerServing: rawNutrient(calculation, "fiberGrams", "perServing"),
    sodiumMgPerServing: rawNutrient(calculation, "sodiumMg", "perServing"),
    energyKcalPer100: rawNutrient(calculation, "energyKcal", "per100"),
    carbohydratesGramsPer100: rawNutrient(
      calculation,
      "carbohydratesGrams",
      "per100",
    ),
    totalSugarsGramsPer100: rawNutrient(
      calculation,
      "totalSugarsGrams",
      "per100",
    ),
    addedSugarsGramsPer100: rawNutrient(
      calculation,
      "addedSugarsGrams",
      "per100",
    ),
    proteinGramsPer100: rawNutrient(calculation, "proteinGrams", "per100"),
    totalFatsGramsPer100: rawNutrient(
      calculation,
      "totalFatsGrams",
      "per100",
    ),
    saturatedFatsGramsPer100: rawNutrient(
      calculation,
      "saturatedFatsGrams",
      "per100",
    ),
    transFatsGramsPer100: rawNutrient(
      calculation,
      "transFatsGrams",
      "per100",
    ),
    fiberGramsPer100: rawNutrient(calculation, "fiberGrams", "per100"),
    sodiumMgPer100: rawNutrient(calculation, "sodiumMg", "per100"),
    energyDailyValuePercent: rawNutrient(
      calculation,
      "energyKcal",
      "dailyValuePercent",
    ),
    carbohydratesDailyValuePercent: rawNutrient(
      calculation,
      "carbohydratesGrams",
      "dailyValuePercent",
    ),
    addedSugarsDailyValuePercent: rawNutrient(
      calculation,
      "addedSugarsGrams",
      "dailyValuePercent",
    ),
    proteinDailyValuePercent: rawNutrient(
      calculation,
      "proteinGrams",
      "dailyValuePercent",
    ),
    totalFatsDailyValuePercent: rawNutrient(
      calculation,
      "totalFatsGrams",
      "dailyValuePercent",
    ),
    saturatedFatsDailyValuePercent: rawNutrient(
      calculation,
      "saturatedFatsGrams",
      "dailyValuePercent",
    ),
    fiberDailyValuePercent: rawNutrient(
      calculation,
      "fiberGrams",
      "dailyValuePercent",
    ),
    sodiumDailyValuePercent: rawNutrient(
      calculation,
      "sodiumMg",
      "dailyValuePercent",
    ),
    highAddedSugars: frontThresholdState(
      calculation,
      "addedSugarsGrams",
    ),
    highSaturatedFats: frontThresholdState(
      calculation,
      "saturatedFatsGrams",
    ),
    highSodium: frontThresholdState(calculation, "sodiumMg"),
    createdByUserId: userId,
  };
}

function retryableVersionConflict(error: unknown) {
  if (!isRecord(error)) return false;
  return error.code === "P2002" || error.code === "P2034";
}

export interface ProductLabelPreview {
  readonly productId: string;
  readonly recipeNutritionSnapshotId: string;
  readonly proposedVersion: number;
  readonly regulatoryInput: ProductLabelRegulatoryInput;
  readonly calculation: NutritionLabelCalculationResult;
  readonly sourceState: {
    readonly readyForNewLabelVersion: boolean;
    readonly reason: string | null;
    readonly recipeStatus: RecipeRow["status"] | null;
    readonly linkedSnapshotVersion: number;
    readonly latestSnapshotVersion: number | null;
  };
  readonly canPersistVersion: boolean;
  readonly persistenceBlockers: typeof PRODUCT_LABEL_PERSISTENCE_BLOCKERS;
}

export type ProductLabelVersionAttempt =
  | (ProductLabelPreview & {
      readonly success: true;
      readonly label: ReturnType<typeof labelVersionReadModel>;
      readonly blockingPendings: readonly NutritionLabelPending[];
      readonly reviewEligible: boolean;
    })
  | (ProductLabelPreview & {
      readonly success: false;
      readonly code: "BLOCKING_PENDINGS";
      readonly message: string;
    })
  | (ProductLabelPreview & {
      readonly success: false;
      readonly code: "PERSISTENCE_CONTRACT_UNAVAILABLE";
      readonly message: string;
    })
  | (ProductLabelPreview & {
      readonly success: false;
      readonly code: "NEW_VERSION_REQUIRED";
      readonly message: string;
    })
  | (ProductLabelPreview & {
      readonly success: false;
      readonly code: "VERSION_CONFLICT";
      readonly message: string;
    });

export function createProductLabelService(
  dependencies: ProductLabelServiceDependencies,
) {
  async function preview(
    context: ProductLabelContext,
    productId: string,
    regulatoryInput: ProductLabelRegulatoryInput,
    action: "READ" | "CREATE" | "UPDATE" = "READ",
  ): Promise<ProductLabelPreview> {
    const session = await access(dependencies, action);
    const product = await ownedProduct(
      dependencies.database,
      requiredId(productId, "Produto"),
      context,
      session.user.id,
    );
    const calculation = calculateProductLabel(product, regulatoryInput);
    const latestSnapshot =
      await dependencies.database.recipeNutritionSnapshot.findFirst({
        where: { recipeId: product.recipeId },
        orderBy: { version: "desc" },
      });
    const recipeRequiresRecalculation = product.recipe.status !== "CALCULATED";
    const productSnapshotIsOutdated =
      latestSnapshot !== null &&
      latestSnapshot.id !== product.recipeNutritionSnapshotId;
    const latestVersion = product.nutritionLabels.reduce(
      (maximum, label) => Math.max(maximum, label.version),
      0,
    );
    return {
      productId: product.id,
      recipeNutritionSnapshotId: product.recipeNutritionSnapshotId,
      proposedVersion: latestVersion + 1,
      regulatoryInput,
      calculation,
      sourceState: {
        readyForNewLabelVersion:
          !recipeRequiresRecalculation && !productSnapshotIsOutdated,
        reason: recipeRequiresRecalculation
          ? "A receita mudou ou ainda não possui cálculo vigente; gere um novo snapshot antes do rótulo."
          : productSnapshotIsOutdated
            ? "O produto está vinculado a um snapshot anterior; vincule o snapshot mais recente antes de gerar outra versão."
            : null,
        recipeStatus: product.recipe.status ?? null,
        linkedSnapshotVersion: product.recipeNutritionSnapshot.version,
        latestSnapshotVersion: latestSnapshot?.version ?? null,
      },
      canPersistVersion:
        !recipeRequiresRecalculation && !productSnapshotIsOutdated,
      persistenceBlockers: PRODUCT_LABEL_PERSISTENCE_BLOCKERS,
    };
  }

  return {
    async createProduct(
      context: ProductLabelContext,
      input: CommercialProductDraftInput,
    ) {
      const session = await access(dependencies, "CREATE");
      const recipeId = requiredId(input.recipeId, "Receita");
      const snapshotId = requiredId(
        input.recipeNutritionSnapshotId,
        "Snapshot nutricional",
      );
      const data = productDraftData(input);

      return dependencies.database.$transaction(async (transaction) => {
        await ownedRecipe(transaction, recipeId, context, session.user.id);
        const snapshot = await transaction.recipeNutritionSnapshot.findFirst({
          where: { id: snapshotId, recipeId },
        });
        if (!snapshot) {
          throw new ProductLabelServiceError(
            "NOT_FOUND",
            "Snapshot nutricional não encontrado para a receita informada.",
          );
        }
        return transaction.commercialFoodProduct.create({
          data: {
            ...data,
            businessUnitId: context.businessUnitId,
            ownerUserId: session.user.id,
            recipeId,
            recipeNutritionSnapshotId: snapshot.id,
            status: "DRAFT",
            createdByUserId: session.user.id,
            updatedByUserId: session.user.id,
          },
          include: productInclude,
        });
      });
    },

    async updateProduct(
      context: ProductLabelContext,
      productId: string,
      input: CommercialProductUpdateInput,
    ) {
      const session = await access(dependencies, "UPDATE");
      const scopedProductId = requiredId(productId, "Produto");

      return dependencies.database.$transaction(
        async (transaction) => {
          const product = await ownedProduct(
            transaction,
            scopedProductId,
            context,
            session.user.id,
          );
          const recipeId = requiredId(
            input.recipeId ?? product.recipeId,
            "Receita",
          );
          const snapshotId = requiredId(
            input.recipeNutritionSnapshotId ??
              product.recipeNutritionSnapshotId,
            "Snapshot nutricional",
          );
          const recipe = await ownedRecipe(
            transaction,
            recipeId,
            context,
            session.user.id,
          );
          const snapshot =
            await transaction.recipeNutritionSnapshot.findFirst({
              where: { id: snapshotId, recipeId: recipe.id },
            });
          if (!snapshot) {
            throw new ProductLabelServiceError(
              "NOT_FOUND",
              "Snapshot nutricional n\u00e3o encontrado para a receita informada.",
            );
          }

          const data = productUpdateData(product, input);
          const proposedProduct: CommercialProductRow = {
            ...product,
            ...data,
            recipeId: recipe.id,
            recipeNutritionSnapshotId: snapshot.id,
            recipe,
            recipeNutritionSnapshot: snapshot,
          };
          const relevantChange = !sameJson(
            productInputSnapshot(product),
            productInputSnapshot(proposedProduct),
          );

          if (!relevantChange) return product;

          const supersededAt = new Date();
          for (const label of product.nutritionLabels) {
            if (label.status !== "DRAFT" && label.status !== "VALIDATED") {
              continue;
            }
            await transaction.productNutritionLabel.update({
              where: { id: label.id },
              data: { status: "SUPERSEDED", supersededAt },
            });
          }

          return transaction.commercialFoodProduct.update({
            where: { id: product.id },
            data: {
              ...data,
              recipeId: recipe.id,
              recipeNutritionSnapshotId: snapshot.id,
              updatedByUserId: session.user.id,
            },
            include: productInclude,
          });
        },
        { isolationLevel: "Serializable" },
      );
    },

    async listProducts(
      context: ProductLabelContext,
      recipeId?: string,
    ) {
      const session = await access(dependencies, "READ");
      const scopedRecipeId = recipeId
        ? requiredId(recipeId, "Receita")
        : undefined;
      if (scopedRecipeId) {
        await ownedRecipe(
          dependencies.database,
          scopedRecipeId,
          context,
          session.user.id,
        );
      }
      return dependencies.database.commercialFoodProduct.findMany({
        where: {
          businessUnitId: context.businessUnitId,
          ownerUserId: session.user.id,
          ...(scopedRecipeId ? { recipeId: scopedRecipeId } : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { commercialName: "asc" }],
        include: productInclude,
      });
    },

    async getProduct(context: ProductLabelContext, productId: string) {
      const session = await access(dependencies, "READ");
      return ownedProduct(
        dependencies.database,
        requiredId(productId, "Produto"),
        context,
        session.user.id,
      );
    },

    async listLabelVersions(
      context: ProductLabelContext,
      productId: string,
    ) {
      const session = await access(dependencies, "READ");
      const product = await ownedProduct(
        dependencies.database,
        requiredId(productId, "Produto"),
        context,
        session.user.id,
      );
      const labels = await dependencies.database.productNutritionLabel.findMany({
        where: { commercialFoodProductId: product.id },
        orderBy: { version: "desc" },
      });
      return labels.map(labelVersionReadModel);
    },

    calculateLabelPreview(
      context: ProductLabelContext,
      productId: string,
      regulatoryInput: ProductLabelRegulatoryInput,
    ) {
      return preview(context, productId, regulatoryInput);
    },

    async generateLabelVersion(
      context: ProductLabelContext,
      productId: string,
      regulatoryInput: ProductLabelRegulatoryInput,
    ): Promise<ProductLabelVersionAttempt> {
      const session = await access(dependencies, "CREATE");
      const scopedProductId = requiredId(productId, "Produto");
      const maximumAttempts = 3;

      for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        try {
          return await dependencies.database.$transaction(
            async (transaction) => {
              const product = await ownedProduct(
                transaction,
                scopedProductId,
                context,
                session.user.id,
              );
              const calculation = calculateProductLabel(
                product,
                regulatoryInput,
              );
              const latestSnapshot =
                await transaction.recipeNutritionSnapshot.findFirst({
                  where: { recipeId: product.recipeId },
                  orderBy: { version: "desc" },
                });
              const latestLabel =
                await transaction.productNutritionLabel.findFirst({
                  where: { commercialFoodProductId: product.id },
                  orderBy: { version: "desc" },
                });
              const recipeRequiresRecalculation =
                product.recipe.status !== "CALCULATED";
              const productSnapshotIsOutdated =
                latestSnapshot !== null &&
                latestSnapshot.id !== product.recipeNutritionSnapshotId;
              const sourceReason = recipeRequiresRecalculation
                ? "A receita mudou ou ainda não possui cálculo vigente; gere um novo snapshot antes do rótulo."
                : productSnapshotIsOutdated
                  ? "O produto está vinculado a um snapshot anterior; vincule o snapshot mais recente antes de gerar outra versão."
                  : null;
              const proposedVersion = (latestLabel?.version ?? 0) + 1;
              const result: ProductLabelPreview = {
                productId: product.id,
                recipeNutritionSnapshotId:
                  product.recipeNutritionSnapshotId,
                proposedVersion,
                regulatoryInput,
                calculation,
                sourceState: {
                  readyForNewLabelVersion: sourceReason === null,
                  reason: sourceReason,
                  recipeStatus: product.recipe.status ?? null,
                  linkedSnapshotVersion:
                    product.recipeNutritionSnapshot.version,
                  latestSnapshotVersion: latestSnapshot?.version ?? null,
                },
                canPersistVersion: sourceReason === null,
                persistenceBlockers: PRODUCT_LABEL_PERSISTENCE_BLOCKERS,
              };

              if (sourceReason !== null) {
                return {
                  ...result,
                  success: false as const,
                  code: "NEW_VERSION_REQUIRED" as const,
                  message: sourceReason,
                };
              }

              const label = await transaction.productNutritionLabel.create({
                data: labelVersionData(
                  product,
                  regulatoryInput,
                  calculation,
                  proposedVersion,
                  session.user.id,
                ),
              });
              const blockers = blockingPendings(calculation);
              return {
                ...result,
                success: true as const,
                label: labelVersionReadModel(label),
                blockingPendings: blockers,
                reviewEligible:
                  calculation.calculationStatus === "COMPLETE" &&
                  calculation.labelEmission.sufficientInformation &&
                  blockers.length === 0,
              };
            },
            { isolationLevel: "Serializable" },
          );
        } catch (error) {
          if (retryableVersionConflict(error) && attempt < maximumAttempts) {
            continue;
          }
          if (retryableVersionConflict(error)) {
            throw new ProductLabelServiceError(
              "VERSION_CONFLICT",
              "Não foi possível reservar uma nova versão após tentativas concorrentes; tente novamente.",
            );
          }
          throw error;
        }
      }

      throw new ProductLabelServiceError(
        "VERSION_CONFLICT",
        "Não foi possível reservar uma nova versão.",
      );
    },

    async reviewLabelVersion(
      context: ProductLabelContext,
      productId: string,
      labelId: string,
      regulatoryInput?: ProductLabelRegulatoryInput,
    ) {
      const session = await access(dependencies, "UPDATE");
      const scopedProductId = requiredId(productId, "Produto");
      const scopedLabelId = requiredId(labelId, "Versão do rótulo");

      return dependencies.database.$transaction(
        async (transaction) => {
          const product = await ownedProduct(
            transaction,
            scopedProductId,
            context,
            session.user.id,
          );
          const label = await transaction.productNutritionLabel.findFirst({
            where: {
              id: scopedLabelId,
              commercialFoodProductId: product.id,
            },
          });
          if (!label) {
            throw new ProductLabelServiceError(
              "NOT_FOUND",
              "Versão do rótulo não encontrada.",
            );
          }

          const preserved = readPreservedVersion(label);
          if (preserved.status !== "PRESERVED") {
            throw new ProductLabelServiceError(
              "PERSISTENCE_CONTRACT_UNAVAILABLE",
              preserved.reason,
              { integrityStatus: preserved.status },
            );
          }

          const [latestSnapshot, latestLabel] = await Promise.all([
            transaction.recipeNutritionSnapshot.findFirst({
              where: { recipeId: product.recipeId },
              orderBy: { version: "desc" },
            }),
            transaction.productNutritionLabel.findFirst({
              where: { commercialFoodProductId: product.id },
              orderBy: { version: "desc" },
            }),
          ]);
          if (
            label.id !== latestLabel?.id ||
            label.recipeNutritionSnapshotId !==
              product.recipeNutritionSnapshotId ||
            latestSnapshot?.id !== product.recipeNutritionSnapshotId ||
            product.recipe.status !== "CALCULATED" ||
            !sameJson(
              preserved.data.productInputSnapshot,
              productInputSnapshot(product),
            ) ||
            !sameJson(preserved.data.rules, NUTRITION_LABEL_RULES) ||
            (regulatoryInput !== undefined &&
              !sameJson(preserved.data.regulatoryInput, regulatoryInput))
          ) {
            throw new ProductLabelServiceError(
              "NEW_VERSION_REQUIRED",
              "A receita, o snapshot, as regras ou dados relevantes do produto mudaram; gere uma nova versão em vez de validar a anterior.",
            );
          }

          const blockers = blockingPendings(preserved.data.calculation);
          if (
            blockers.length ||
            preserved.data.calculation.calculationStatus !== "COMPLETE" ||
            !preserved.data.calculation.labelEmission.sufficientInformation
          ) {
            throw new ProductLabelServiceError(
              "BLOCKING_PENDINGS",
              "A versão não pode ser validada enquanto houver pendências bloqueantes ou informação insuficiente.",
              blockers.length ? blockers : preserved.data.pendings,
            );
          }
          if (label.status !== "DRAFT") {
            throw new ProductLabelServiceError(
              "INVALID_INPUT",
              "Somente uma versão em rascunho pode receber revisão humana.",
            );
          }

          const updated = await transaction.productNutritionLabel.update({
            where: { id: label.id },
            data: {
              status: "VALIDATED",
              validatedAt: new Date(),
              validatedByUserId: session.user.id,
            },
          });
          return labelVersionReadModel(updated);
        },
        { isolationLevel: "Serializable" },
      );
    },
  };
}

export const productLabelService = createProductLabelService({
  database: prisma as unknown as ProductLabelDatabase,
  getSession: () => mvpService.getSession(),
});
