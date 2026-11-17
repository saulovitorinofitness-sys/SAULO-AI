import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ClinicContextError,
  resolveClinicRecipesContext,
} from "@/features/recipes/clinic-context";
import {
  ProductLabelServiceError,
  productLabelService,
  type CommercialProductDraftInput,
  type CommercialProductUpdateInput,
  type ProductLabelRegulatoryInput,
} from "@/features/recipes/product-label-service";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;
const uuidSchema = z.uuid();
const positiveNumberSchema = z.number().finite().positive();
const positiveIntegerSchema = z.number().int().positive();
const basisUnitSchema = z.enum(["GRAM", "MILLILITER"]);
const physicalTypeSchema = z.enum(["SOLID", "SEMISOLID", "LIQUID"]);
const criticalNutrientSchema = z.enum([
  "addedSugarsGrams",
  "saturatedFatsGrams",
  "sodiumMg",
]);

const productDraftSchema = z
  .object({
    recipeId: uuidSchema,
    recipeNutritionSnapshotId: uuidSchema,
    commercialName: z.string().trim().min(2).max(180),
    brand: z.string().trim().max(180).optional(),
    description: z.string().trim().max(10_000).optional(),
    category: z.string().trim().max(180).optional(),
    physicalType: physicalTypeSchema,
    netContent: positiveNumberSchema,
    netContentUnit: basisUnitSchema,
    servingsPerPackage: positiveNumberSchema,
    servingSize: positiveNumberSchema,
    servingSizeUnit: basisUnitSchema,
    servingHouseholdMeasure: z.string().trim().max(180).optional(),
    sku: z.string().trim().max(120).optional(),
    shelfLifeDays: positiveIntegerSchema.optional(),
    storageInstructions: z.string().trim().max(10_000).optional(),
    preparationOrConsumptionInstructions: z.string().trim().max(10_000).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const expectedUnit = input.physicalType === "LIQUID" ? "MILLILITER" : "GRAM";
    if (input.netContentUnit !== expectedUnit) {
      context.addIssue({
        code: "custom",
        path: ["netContentUnit"],
        message: "A unidade do conteúdo é incompatível com o tipo físico.",
      });
    }
    if (input.servingSizeUnit !== expectedUnit) {
      context.addIssue({
        code: "custom",
        path: ["servingSizeUnit"],
        message: "A unidade da porção é incompatível com o tipo físico.",
      });
    }
  });

const productUpdateSchema = z
  .object({
    recipeId: uuidSchema.optional(),
    recipeNutritionSnapshotId: uuidSchema.optional(),
    commercialName: z.string().trim().min(2).max(180).optional(),
    brand: z.string().trim().max(180).nullable().optional(),
    description: z.string().trim().max(10_000).nullable().optional(),
    category: z.string().trim().max(180).nullable().optional(),
    physicalType: physicalTypeSchema.optional(),
    netContent: positiveNumberSchema.optional(),
    netContentUnit: basisUnitSchema.optional(),
    servingsPerPackage: positiveNumberSchema.optional(),
    servingSize: positiveNumberSchema.optional(),
    servingSizeUnit: basisUnitSchema.optional(),
    servingHouseholdMeasure: z.string().trim().max(180).nullable().optional(),
    sku: z.string().trim().max(120).nullable().optional(),
    shelfLifeDays: positiveIntegerSchema.nullable().optional(),
    storageInstructions: z.string().trim().max(10_000).nullable().optional(),
    preparationOrConsumptionInstructions: z
      .string()
      .trim()
      .max(10_000)
      .nullable()
      .optional(),
  })
  .strict();

const servingReferenceSchema = z
  .object({
    source: z.enum(["IN_75_ANNEX_V", "RDC_429_ARTICLE_9"]),
    reference: z.string().trim().min(1).max(500),
    confirmed: z.boolean(),
  })
  .strict();

const additionalMandatoryNutrientsReviewSchema = z
  .object({
    reviewed: z.boolean(),
    missingNutrientsOrInformation: z.array(z.string().trim().min(1).max(500)).max(100),
  })
  .strict();

const nutritionTableContextSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("GENERAL_FOOD"),
      calculationBasis: z.literal("AS_SOLD"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("GENERAL_FOOD"),
      calculationBasis: z.literal("PREPARED_AS_DIRECTED"),
      snapshotIncludesAddedPreparationIngredients: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("SPECIAL_REGULATION"),
      reference: z.string().trim().min(1).max(500),
    })
    .strict(),
]);

const nonSignificantZeroEligibilitySchema = z
  .object({
    carbohydratesGrams: z.boolean().optional(),
    totalSugarsGrams: z.boolean().optional(),
    addedSugarsGrams: z.boolean().optional(),
    proteinGrams: z.boolean().optional(),
    totalFatsGrams: z.boolean().optional(),
  })
  .strict();

const frontOfPackBasisSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("AS_SOLD") }).strict(),
  z
    .object({
      kind: z.literal("PREPARED_AS_DIRECTED_EXCLUDING_ADDED_INGREDIENTS"),
      nutrientsPer100: z
        .object({
          addedSugarsGrams: z.number().finite().nonnegative().nullable().optional(),
          saturatedFatsGrams: z.number().finite().nonnegative().nullable().optional(),
          sodiumMg: z.number().finite().nonnegative().nullable().optional(),
        })
        .strict(),
    })
    .strict(),
]);

const frontOfPackSchema = z
  .object({
    applicability: z.enum([
      "STANDARD",
      "PROHIBITED",
      "OPTIONAL",
      "CONDITIONAL_ANNEX_XVI_ITEMS_1_TO_6",
    ]),
    reason: z.string().trim().min(1).max(2_000),
    nutrientsAlteredByAddedIngredients: z
      .array(criticalNutrientSchema)
      .max(3)
      .optional(),
    basis: frontOfPackBasisSchema,
  })
  .strict();

const regulatoryInputSchema = z
  .object({
    servingReference: servingReferenceSchema.nullable().optional(),
    additionalMandatoryNutrientsReview:
      additionalMandatoryNutrientsReviewSchema.nullable().optional(),
    nutritionTableContext: nutritionTableContextSchema.nullable().optional(),
    nonSignificantZeroEligibility: nonSignificantZeroEligibilitySchema.optional(),
    frontOfPack: frontOfPackSchema.nullable().optional(),
  })
  .strict();

const businessUnitsQuerySchema = z
  .object({ resource: z.literal("business-units") })
  .strict();

const productsQuerySchema = z
  .object({
    resource: z.literal("products").optional(),
    businessUnitId: uuidSchema.optional(),
    productId: uuidSchema.optional(),
    recipeId: uuidSchema.optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.productId && input.recipeId) {
      context.addIssue({
        code: "custom",
        message: "Não combine productId e recipeId na mesma consulta.",
      });
    }
  });

const labelVersionsQuerySchema = z
  .object({
    resource: z.literal("label-versions"),
    businessUnitId: uuidSchema.optional(),
    productId: uuidSchema,
  })
  .strict();

const postBodySchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("CREATE_PRODUCT"),
      businessUnitId: uuidSchema.optional(),
      product: productDraftSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("CALCULATE_LABEL_PREVIEW"),
      businessUnitId: uuidSchema.optional(),
      productId: uuidSchema,
      regulatoryInput: regulatoryInputSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("GENERATE_LABEL_VERSION"),
      businessUnitId: uuidSchema.optional(),
      productId: uuidSchema,
      regulatoryInput: regulatoryInputSchema,
    })
    .strict(),
]);

const patchBodySchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("UPDATE_PRODUCT"),
      businessUnitId: uuidSchema.optional(),
      productId: uuidSchema,
      product: productUpdateSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("REVIEW_LABEL_VERSION"),
      businessUnitId: uuidSchema.optional(),
      productId: uuidSchema,
      labelId: uuidSchema,
      regulatoryInput: regulatoryInputSchema.optional(),
    })
    .strict(),
]);

async function listAuthorizedBusinessUnits() {
  const context = await resolveClinicRecipesContext("READ");
  const clinic = await prisma.businessUnit.findUnique({
    where: { id: context.businessUnitId },
    select: { id: true, name: true },
  });

  if (!clinic) {
    throw new ClinicContextError(
      "CLINIC_NOT_CONFIGURED",
      "A unidade empresarial CLINICA não está configurada.",
    );
  }

  return [clinic];
}

function incompatibleBusinessUnitResponse(
  selectedBusinessUnitId: string | undefined,
  clinicBusinessUnitId: string,
) {
  if (
    selectedBusinessUnitId === undefined ||
    selectedBusinessUnitId === clinicBusinessUnitId
  ) {
    return null;
  }

  return NextResponse.json(
    {
      code: "BUSINESS_UNIT_FORBIDDEN",
      message: "Receitas e Produtos opera exclusivamente no contexto da Clínica SV.",
    },
    { status: 403, headers: noStoreHeaders },
  );
}

function invalidResponse(
  code: "INVALID_BODY" | "INVALID_QUERY",
  issues?: readonly { readonly path: PropertyKey[]; readonly message: string }[],
) {
  return NextResponse.json(
    {
      code,
      message:
        code === "INVALID_QUERY"
          ? "Revise os parâmetros da consulta de produtos."
          : "Revise os dados enviados para Produtos e Rótulos.",
      ...(issues
        ? {
            issues: issues.map((issue) => ({
              path: issue.path.map(String),
              message: issue.message,
            })),
          }
        : {}),
    },
    { status: 400, headers: noStoreHeaders },
  );
}

function isDatabaseConflict(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

function newLabelVersionRequirement(
  product: Awaited<ReturnType<typeof productLabelService.updateProduct>>,
) {
  const hasSupersededVersion = product.nutritionLabels.some(
    (label) => label.status === "SUPERSEDED",
  );
  const hasCurrentVersion = product.nutritionLabels.some(
    (label) => label.status === "DRAFT" || label.status === "VALIDATED",
  );
  const required = hasSupersededVersion && !hasCurrentVersion;
  return {
    required,
    message: required
      ? "Os dados relevantes do produto mudaram. Gere uma nova vers\u00e3o do r\u00f3tulo antes da revis\u00e3o ou emiss\u00e3o."
      : null,
  };
}

function errorResponse(error: unknown) {
  if (error instanceof ClinicContextError) {
    const statusByCode = {
      AUTHENTICATION_REQUIRED: 401,
      MODULE_ACCESS_FORBIDDEN: 403,
      CLINIC_NOT_CONFIGURED: 503,
      CLINIC_INACTIVE: 503,
      CLINIC_ACCESS_FORBIDDEN: 403,
    } as const satisfies Record<ClinicContextError["code"], number>;
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: statusByCode[error.code], headers: noStoreHeaders },
    );
  }
  if (error instanceof ProductLabelServiceError) {
    const statusByCode = {
      AUTHENTICATION_REQUIRED: 401,
      FORBIDDEN: 403,
      INVALID_INPUT: 400,
      NOT_FOUND: 404,
      BLOCKING_PENDINGS: 422,
      NEW_VERSION_REQUIRED: 409,
      VERSION_CONFLICT: 409,
      PERSISTENCE_CONTRACT_UNAVAILABLE: 409,
    } as const satisfies Record<ProductLabelServiceError["code"], number>;
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      { status: statusByCode[error.code], headers: noStoreHeaders },
    );
  }
  if (isDatabaseConflict(error)) {
    return NextResponse.json(
      {
        code: "CONFLICT",
        message: "Já existe um produto ou versão com os mesmos dados únicos.",
      },
      { status: 409, headers: noStoreHeaders },
    );
  }
  console.error("Falha não mapeada na API de Produtos e Rótulos.");
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "Não foi possível processar a solicitação de Produtos e Rótulos.",
    },
    { status: 503, headers: noStoreHeaders },
  );
}

async function requestBody(request: Request) {
  try {
    return { success: true as const, data: await request.json() as unknown };
  } catch {
    return { success: false as const };
  }
}

export async function GET(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  if (query.resource === "business-units") {
    const parsed = businessUnitsQuerySchema.safeParse(query);
    if (!parsed.success) return invalidResponse("INVALID_QUERY", parsed.error.issues);
    try {
      return NextResponse.json(
        { businessUnits: await listAuthorizedBusinessUnits() },
        { headers: noStoreHeaders },
      );
    } catch (error) {
      return errorResponse(error);
    }
  }

  if (query.resource === "label-versions") {
    const parsed = labelVersionsQuerySchema.safeParse(query);
    if (!parsed.success) return invalidResponse("INVALID_QUERY", parsed.error.issues);
    try {
      const context = await resolveClinicRecipesContext("READ");
      const incompatibleUnit = incompatibleBusinessUnitResponse(
        parsed.data.businessUnitId,
        context.businessUnitId,
      );
      if (incompatibleUnit) return incompatibleUnit;

      const labelVersions = await productLabelService.listLabelVersions(
        context,
        parsed.data.productId,
      );
      return NextResponse.json({ labelVersions }, { headers: noStoreHeaders });
    } catch (error) {
      return errorResponse(error);
    }
  }

  const parsed = productsQuerySchema.safeParse(query);
  if (!parsed.success) return invalidResponse("INVALID_QUERY", parsed.error.issues);
  try {
    const context = await resolveClinicRecipesContext("READ");
    const incompatibleUnit = incompatibleBusinessUnitResponse(
      parsed.data.businessUnitId,
      context.businessUnitId,
    );
    if (incompatibleUnit) return incompatibleUnit;

    if (parsed.data.productId) {
      const product = await productLabelService.getProduct(
        context,
        parsed.data.productId,
      );
      return NextResponse.json({ product }, { headers: noStoreHeaders });
    }
    const accessibleProducts = await productLabelService.listProducts(
      context,
      parsed.data.recipeId,
    );
    const total = accessibleProducts.length;
    const start = (parsed.data.page - 1) * parsed.data.pageSize;
    const products = accessibleProducts.slice(start, start + parsed.data.pageSize);
    return NextResponse.json(
      {
        products,
        pagination: {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          total,
          totalPages: Math.ceil(total / parsed.data.pageSize),
        },
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await requestBody(request);
  if (!body.success) return invalidResponse("INVALID_BODY");
  const parsed = postBodySchema.safeParse(body.data);
  if (!parsed.success) return invalidResponse("INVALID_BODY", parsed.error.issues);

  try {
    const action =
      parsed.data.action === "CALCULATE_LABEL_PREVIEW" ? "READ" : "CREATE";
    const context = await resolveClinicRecipesContext(action);
    const incompatibleUnit = incompatibleBusinessUnitResponse(
      parsed.data.businessUnitId,
      context.businessUnitId,
    );
    if (incompatibleUnit) return incompatibleUnit;

    if (parsed.data.action === "CREATE_PRODUCT") {
      const product = await productLabelService.createProduct(
        context,
        parsed.data.product satisfies CommercialProductDraftInput,
      );
      return NextResponse.json({ product }, { status: 201, headers: noStoreHeaders });
    }

    if (parsed.data.action === "CALCULATE_LABEL_PREVIEW") {
      const preview = await productLabelService.calculateLabelPreview(
        context,
        parsed.data.productId,
        parsed.data.regulatoryInput satisfies ProductLabelRegulatoryInput,
      );
      return NextResponse.json({ preview }, { headers: noStoreHeaders });
    }

    const result = await productLabelService.generateLabelVersion(
      context,
      parsed.data.productId,
      parsed.data.regulatoryInput satisfies ProductLabelRegulatoryInput,
    );
    const status = result.success
      ? 201
      : result.code === "BLOCKING_PENDINGS"
        ? 422
        : result.code === "PERSISTENCE_CONTRACT_UNAVAILABLE"
          ? 503
          : 409;
    return NextResponse.json(result, { status, headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const body = await requestBody(request);
  if (!body.success) return invalidResponse("INVALID_BODY");
  const parsed = patchBodySchema.safeParse(body.data);
  if (!parsed.success) return invalidResponse("INVALID_BODY", parsed.error.issues);

  try {
    const context = await resolveClinicRecipesContext("UPDATE");
    const incompatibleUnit = incompatibleBusinessUnitResponse(
      parsed.data.businessUnitId,
      context.businessUnitId,
    );
    if (incompatibleUnit) return incompatibleUnit;

    if (parsed.data.action === "UPDATE_PRODUCT") {
      const product = await productLabelService.updateProduct(
        context,
        parsed.data.productId,
        parsed.data.product satisfies CommercialProductUpdateInput,
      );
      return NextResponse.json(
        {
          product,
          newLabelVersionRequirement: newLabelVersionRequirement(product),
        },
        { headers: noStoreHeaders },
      );
    }

    const labelVersion = await productLabelService.reviewLabelVersion(
      context,
      parsed.data.productId,
      parsed.data.labelId,
      parsed.data.regulatoryInput satisfies ProductLabelRegulatoryInput | undefined,
    );
    return NextResponse.json({ labelVersion }, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
