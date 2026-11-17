import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ClinicContextError,
  resolveClinicRecipesContext,
} from "@/features/recipes/clinic-context";
import {
  RecipeDeletionConflictError,
  RecipeServiceError,
  recipeService,
  type RecipeDraftInput,
  type RecipeIngredientInput,
  type RecipeStepInput,
} from "@/features/recipes/service";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;
const uuidSchema = z.uuid();
const measurementUnitSchema = z.enum(["GRAM", "MILLILITER", "UNIT"]);
const ingredientUnitSchema = z.enum(["GRAM", "MILLILITER"]);
const positiveNumberSchema = z.number().finite().positive();
const positiveIntegerSchema = z.number().int().positive();

const recipeDraftSchema = z
  .object({
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(10_000).optional(),
    category: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(10_000).optional(),
    preparationMethod: z.string().trim().max(20_000).optional(),
    preparationTimeMinutes: positiveIntegerSchema.optional(),
    finalYieldAmount: positiveNumberSchema.optional(),
    finalYieldUnit: measurementUnitSchema.optional(),
    yieldAmount: positiveNumberSchema.optional(),
    yieldUnit: measurementUnitSchema.optional(),
    servings: positiveIntegerSchema.optional(),
    servingSize: positiveNumberSchema.optional(),
    servingSizeUnit: measurementUnitSchema.optional(),
    servingHouseholdMeasure: z.string().trim().max(180).optional(),
    physicalType: z.enum(["SOLID", "SEMISOLID", "LIQUID"]).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const pairedFields = [
      ["finalYieldAmount", "finalYieldUnit", input.finalYieldAmount, input.finalYieldUnit],
      ["yieldAmount", "yieldUnit", input.yieldAmount, input.yieldUnit],
      ["servingSize", "servingSizeUnit", input.servingSize, input.servingSizeUnit],
    ] as const;

    for (const [amountField, unitField, amount, unit] of pairedFields) {
      if ((amount === undefined) !== (unit === undefined)) {
        context.addIssue({
          code: "custom",
          path: [amount === undefined ? amountField : unitField],
          message: "Informe conjuntamente o valor e a unidade.",
        });
      }
    }

    const expectedUnit =
      input.physicalType === "LIQUID"
        ? "MILLILITER"
        : input.physicalType === "SOLID" || input.physicalType === "SEMISOLID"
          ? "GRAM"
          : null;
    if (!expectedUnit) return;

    for (const [field, unit] of [
      ["finalYieldUnit", input.finalYieldUnit],
      ["yieldUnit", input.yieldUnit],
      ["servingSizeUnit", input.servingSizeUnit],
    ] as const) {
      if (unit && unit !== "UNIT" && unit !== expectedUnit) {
        context.addIssue({
          code: "custom",
          path: [field],
          message:
            "A unidade é incompatível com o tipo físico; conversões entre massa e volume exigem equivalência explícita.",
        });
      }
    }
  });

const ingredientSchema = z
  .object({
    foodId: uuidSchema,
    householdMeasureId: uuidSchema.optional(),
    householdMeasureQuantity: positiveNumberSchema.optional(),
    householdMeasureDescription: z.string().trim().max(180).optional(),
    grossQuantity: positiveNumberSchema,
    netQuantity: positiveNumberSchema.optional(),
    quantityUnit: ingredientUnitSchema,
    correctionFactor: positiveNumberSchema.optional(),
    cookingYieldFactor: positiveNumberSchema.optional(),
    notes: z.string().trim().max(4_000).optional(),
    position: positiveIntegerSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.householdMeasureId && input.quantityUnit !== "GRAM") {
      context.addIssue({
        code: "custom",
        path: ["quantityUnit"],
        message:
          "A medida caseira existente fornece equivalência em gramas e não pode ser convertida em mililitros sem equivalência explícita.",
      });
    }
    if (
      input.netQuantity === undefined &&
      input.correctionFactor === undefined &&
      !(input.householdMeasureId && input.householdMeasureQuantity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["netQuantity"],
        message:
          "Informe quantidade líquida, fator de correção ou medida caseira com quantidade.",
      });
    }
  });

const stepSchema = z
  .object({
    instruction: z.string().trim().min(1).max(10_000),
    position: positiveIntegerSchema.optional(),
  })
  .strict();

const listQuerySchema = z
  .object({
    businessUnitId: uuidSchema.optional(),
    recipeId: uuidSchema.optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const authorizedBusinessUnitsQuerySchema = z
  .object({ resource: z.literal("business-units") })
  .strict();

const postBodySchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("CREATE_RECIPE"),
      businessUnitId: uuidSchema.optional(),
      recipe: recipeDraftSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("ADD_INGREDIENT"),
      businessUnitId: uuidSchema.optional(),
      recipeId: uuidSchema,
      ingredient: ingredientSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("ADD_PREPARATION_STEP"),
      businessUnitId: uuidSchema.optional(),
      recipeId: uuidSchema,
      step: stepSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("CALCULATE_NUTRITION"),
      businessUnitId: uuidSchema.optional(),
      recipeId: uuidSchema,
    })
    .strict(),
]);

const patchBodySchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("UPDATE_RECIPE"),
      businessUnitId: uuidSchema.optional(),
      recipeId: uuidSchema,
      recipe: recipeDraftSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("UPDATE_INGREDIENT"),
      businessUnitId: uuidSchema.optional(),
      recipeId: uuidSchema,
      ingredientId: uuidSchema,
      ingredient: ingredientSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("REORDER_INGREDIENTS"),
      businessUnitId: uuidSchema.optional(),
      recipeId: uuidSchema,
      ingredientIds: z.array(uuidSchema).min(1).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("UPDATE_PREPARATION_STEP"),
      businessUnitId: uuidSchema.optional(),
      recipeId: uuidSchema,
      stepId: uuidSchema,
      step: stepSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("REORDER_PREPARATION_STEPS"),
      businessUnitId: uuidSchema.optional(),
      recipeId: uuidSchema,
      stepIds: z.array(uuidSchema).min(1).max(500),
    })
    .strict(),
]);

const deleteQuerySchema = z
  .object({
    businessUnitId: uuidSchema.optional(),
    recipeId: uuidSchema,
    ingredientId: uuidSchema.optional(),
    stepId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.ingredientId && input.stepId) {
      context.addIssue({
        code: "custom",
        message: "Informe somente ingredientId ou stepId, nunca os dois juntos.",
      });
    }
  });

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
          ? "Revise os parâmetros da consulta de receitas."
          : "Revise os dados enviados para Receitas.",
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
    error.code === "P2002"
  );
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
      {
        status: statusByCode[error.code],
        headers: noStoreHeaders,
      },
    );
  }
  if (error instanceof RecipeDeletionConflictError) {
    return NextResponse.json(
      {
        code: error.conflict,
        reason: error.dependencies[0],
        dependencies: error.dependencies,
        message: error.message,
      },
      { status: 409, headers: noStoreHeaders },
    );
  }
  if (error instanceof RecipeServiceError) {
    const statusByCode = {
      AUTHENTICATION_REQUIRED: 401,
      FORBIDDEN: 403,
      INVALID_INPUT: 400,
      NOT_FOUND: 404,
      INCOMPLETE_CALCULATION: 422,
      PERSISTENCE_ERROR: 503,
    } as const satisfies Record<RecipeServiceError["code"], number>;
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: statusByCode[error.code], headers: noStoreHeaders },
    );
  }
  if (isDatabaseConflict(error)) {
    return NextResponse.json(
      {
        code: "CONFLICT",
        message: "Já existe um registro de receita com os mesmos dados únicos.",
      },
      { status: 409, headers: noStoreHeaders },
    );
  }

  console.error("Falha não mapeada na API de Receitas.");
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "Não foi possível processar a solicitação de Receitas.",
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
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  if (query.resource === "business-units") {
    const parsed = authorizedBusinessUnitsQuerySchema.safeParse(query);
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

  const parsed = listQuerySchema.safeParse(query);
  if (!parsed.success) return invalidResponse("INVALID_QUERY", parsed.error.issues);

  try {
    const context = await resolveClinicRecipesContext("READ");
    const incompatibleUnit = incompatibleBusinessUnitResponse(
      parsed.data.businessUnitId,
      context.businessUnitId,
    );
    if (incompatibleUnit) return incompatibleUnit;

    if (parsed.data.recipeId) {
      const recipe = await recipeService.get(context, parsed.data.recipeId);
      return NextResponse.json({ recipe }, { headers: noStoreHeaders });
    }

    const accessibleRecipes = await recipeService.list(context);
    const total = accessibleRecipes.length;
    const start = (parsed.data.page - 1) * parsed.data.pageSize;
    const recipes = accessibleRecipes.slice(start, start + parsed.data.pageSize);
    return NextResponse.json(
      {
        recipes,
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
    const action = parsed.data.action === "CREATE_RECIPE" ? "CREATE" : "UPDATE";
    const context = await resolveClinicRecipesContext(action);
    const incompatibleUnit = incompatibleBusinessUnitResponse(
      parsed.data.businessUnitId,
      context.businessUnitId,
    );
    if (incompatibleUnit) return incompatibleUnit;

    if (parsed.data.action === "CREATE_RECIPE") {
      const recipe = await recipeService.create(
        context,
        parsed.data.recipe satisfies RecipeDraftInput,
      );
      return NextResponse.json({ recipe }, { status: 201, headers: noStoreHeaders });
    }
    if (parsed.data.action === "ADD_INGREDIENT") {
      const recipe = await recipeService.addIngredient(
        context,
        parsed.data.recipeId,
        parsed.data.ingredient satisfies RecipeIngredientInput,
      );
      return NextResponse.json({ recipe }, { status: 201, headers: noStoreHeaders });
    }
    if (parsed.data.action === "ADD_PREPARATION_STEP") {
      const recipe = await recipeService.addStep(
        context,
        parsed.data.recipeId,
        parsed.data.step satisfies RecipeStepInput,
      );
      return NextResponse.json({ recipe }, { status: 201, headers: noStoreHeaders });
    }

    const result = await recipeService.calculate(context, parsed.data.recipeId);
    const { snapshotDraft, snapshotVersion, pendings, ...calculation } = result;
    return NextResponse.json(
      {
        calculation,
        pendings,
        snapshot:
          snapshotVersion !== null && snapshotDraft
            ? { version: snapshotVersion, data: snapshotDraft }
            : null,
      },
      { headers: noStoreHeaders },
    );
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

    if (parsed.data.action === "UPDATE_RECIPE") {
      const recipe = await recipeService.update(
        context,
        parsed.data.recipeId,
        parsed.data.recipe satisfies RecipeDraftInput,
      );
      return NextResponse.json({ recipe }, { headers: noStoreHeaders });
    }
    if (parsed.data.action === "UPDATE_INGREDIENT") {
      const recipe = await recipeService.updateIngredient(
        context,
        parsed.data.recipeId,
        parsed.data.ingredientId,
        parsed.data.ingredient satisfies RecipeIngredientInput,
      );
      return NextResponse.json({ recipe }, { headers: noStoreHeaders });
    }
    if (parsed.data.action === "REORDER_INGREDIENTS") {
      const recipe = await recipeService.reorderIngredients(
        context,
        parsed.data.recipeId,
        parsed.data.ingredientIds,
      );
      return NextResponse.json({ recipe }, { headers: noStoreHeaders });
    }
    if (parsed.data.action === "UPDATE_PREPARATION_STEP") {
      await recipeService.updateStep(
        context,
        parsed.data.recipeId,
        parsed.data.stepId,
        parsed.data.step satisfies RecipeStepInput,
      );
    } else {
      await recipeService.reorderSteps(
        context,
        parsed.data.recipeId,
        parsed.data.stepIds,
      );
    }
    const recipe = await recipeService.get(context, parsed.data.recipeId);
    return NextResponse.json({ recipe }, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  const parsed = deleteQuerySchema.safeParse(query);
  if (!parsed.success) return invalidResponse("INVALID_QUERY", parsed.error.issues);

  try {
    const context = await resolveClinicRecipesContext("DELETE");
    const incompatibleUnit = incompatibleBusinessUnitResponse(
      parsed.data.businessUnitId,
      context.businessUnitId,
    );
    if (incompatibleUnit) return incompatibleUnit;

    if (parsed.data.ingredientId) {
      await recipeService.removeIngredient(
        context,
        parsed.data.recipeId,
        parsed.data.ingredientId,
      );
    } else if (parsed.data.stepId) {
      await recipeService.removeStep(
        context,
        parsed.data.recipeId,
        parsed.data.stepId,
      );
    } else {
      const recipe = await recipeService.remove(context, parsed.data.recipeId);
      return NextResponse.json({ recipe }, { headers: noStoreHeaders });
    }
    const recipe = await recipeService.get(context, parsed.data.recipeId);
    return NextResponse.json({ recipe }, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
