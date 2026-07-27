import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type ClinicFoodDraft,
  type FoodNutrientsPer100g,
  type NutritionSourceKind,
} from "@/features/food-database";
import { foodRepository } from "@/features/food-database/repository";
import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { canAccess, mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";
import { resolveDevelopmentAccess } from "@/features/development-session";

const nullableNumber = z.number().finite().nonnegative().nullable();
const nutrientsSchema = z.object({
  energyKcal: z.number().finite().nonnegative(),
  proteinGrams: z.number().finite().nonnegative(),
  carbohydratesGrams: z.number().finite().nonnegative(),
  fatsGrams: z.number().finite().nonnegative(),
  fiberGrams: z.number().finite().nonnegative(),
  sugarsGrams: nullableNumber.default(null),
  cholesterolMg: nullableNumber.default(null),
  saturatedFatsGrams: nullableNumber.default(null),
  monounsaturatedFatsGrams: nullableNumber.default(null),
  polyunsaturatedFatsGrams: nullableNumber.default(null),
  sodiumMg: nullableNumber.default(null),
  calciumMg: nullableNumber.default(null),
  ironMg: nullableNumber.default(null),
  magnesiumMg: nullableNumber.default(null),
  phosphorusMg: nullableNumber.default(null),
  potassiumMg: nullableNumber.default(null),
  zincMg: nullableNumber.default(null),
  copperMg: nullableNumber.default(null),
  manganeseMg: nullableNumber.default(null),
  seleniumMcg: nullableNumber.default(null),
  vitaminAMcg: nullableNumber.default(null),
  vitaminCMg: nullableNumber.default(null),
  vitaminDMcg: nullableNumber.default(null),
  vitaminEMg: nullableNumber.default(null),
  vitaminKMcg: nullableNumber.default(null),
  thiamineMg: nullableNumber.default(null),
  riboflavinMg: nullableNumber.default(null),
  niacinMg: nullableNumber.default(null),
  vitaminB6Mg: nullableNumber.default(null),
  folateMcg: nullableNumber.default(null),
  vitaminB12Mcg: nullableNumber.default(null),
});
const clinicFoodSchema = z.object({
  officialName: z.string().trim().min(2).max(180),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(2).max(100),
  foodGroup: z.string().trim().min(2).max(100),
  sourceCode: z.string().trim().max(100).optional(),
  preparationState: z.string().trim().max(80).optional(),
  presentation: z.string().trim().max(100).optional(),
  referenceServingGrams: z.number().finite().positive(),
  nutrients: nutrientsSchema,
  householdMeasures: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        variation: z.string().trim().max(100).optional(),
        quantity: z.number().finite().positive(),
        grams: z.number().finite().positive(),
        isDefault: z.boolean(),
        active: z.boolean(),
      }),
    )
    .min(1),
  synonyms: z.array(z.string().trim().min(2).max(180)).default([]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  confirmDuplicate: z.boolean().default(false),
});

export async function GET(request: Request) {
  const access = resolveDevelopmentAccess(
    request,
    await mvpService.getSession(),
  );
  const url = new URL(request.url);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    url.searchParams.get("scenario") as ClinicalCollectionScenarioKey,
  )
    ? (url.searchParams.get("scenario") as ClinicalCollectionScenarioKey)
    : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);
  if (
    viewer.id === BUILT_IN_IDS.users.mariaDeLourdesGomes ||
    !canAccess(access, "MEAL_PLAN", "READ")
  ) {
    return NextResponse.json({ message: "Acesso não permitido." }, { status: 403 });
  }

  const source = url.searchParams.get("source");
  const input = {
    query: url.searchParams.get("query") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    source:
      source === "TACO" ||
      source === "TBCA" ||
      source === "IBGE" ||
      source === "PHILIPS" ||
      source === "USDA" ||
      source === "CLINIC_SV"
        ? (source as NutritionSourceKind)
        : "ALL",
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20),
  } as const;

  try {
    const result = await foodRepository.search(input);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "Não foi possível consultar o banco de alimentos." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const access = await mvpService.getSession();
  const url = new URL(request.url);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    url.searchParams.get("scenario") as ClinicalCollectionScenarioKey,
  )
    ? (url.searchParams.get("scenario") as ClinicalCollectionScenarioKey)
    : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);
  if (
    viewer.id === BUILT_IN_IDS.users.mariaDeLourdesGomes ||
    !canAccess(access, "MEAL_PLAN", "MANAGE")
  ) {
    return NextResponse.json({ message: "Acesso não permitido." }, { status: 403 });
  }

  const parsed = clinicFoodSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados do alimento inválidos.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { confirmDuplicate, ...draft } = parsed.data;

  try {
    const duplicates = await foodRepository.findDuplicates(
      draft as ClinicFoodDraft,
    );
    if (duplicates.length && !confirmDuplicate) {
      return NextResponse.json(
        {
          message: "Possível duplicidade encontrada. Revise antes de confirmar.",
          duplicates,
        },
        { status: 409 },
      );
    }

    const food = await foodRepository.createClinicFood({
      ...draft,
      nutrients: draft.nutrients as FoodNutrientsPer100g,
    });
    return NextResponse.json(food, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível cadastrar o alimento." },
      { status: 503 },
    );
  }
}
