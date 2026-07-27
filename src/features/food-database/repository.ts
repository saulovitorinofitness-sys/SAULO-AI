import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import type {
  ClinicFoodDraft,
  FoodDuplicateCandidate,
  FoodNutrientsPer100g,
  FoodSearchInput,
  FoodSearchResult,
  ProfessionalFood,
} from "./contracts";
import { normalizeFoodSearchText } from "./normalization";

const foodInclude = {
  category: true,
  source: true,
  nutrients: true,
  householdMeasures: {
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  },
  synonyms: { orderBy: { name: "asc" } },
} as const satisfies Prisma.FoodInclude;

type FoodRow = Prisma.FoodGetPayload<{ include: typeof foodInclude }>;

function numberValue(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

function mapNutrients(
  row: FoodRow["nutrients"],
): FoodNutrientsPer100g | null {
  if (!row) return null;

  return {
    energyKcal: numberValue(row.energyKcal),
    proteinGrams: numberValue(row.proteinGrams),
    carbohydratesGrams: numberValue(row.carbohydratesGrams),
    fatsGrams: numberValue(row.fatsGrams),
    fiberGrams: numberValue(row.fiberGrams),
    sugarsGrams: numberValue(row.sugarsGrams),
    cholesterolMg: numberValue(row.cholesterolMg),
    saturatedFatsGrams: numberValue(row.saturatedFatsGrams),
    monounsaturatedFatsGrams: numberValue(row.monounsaturatedFatsGrams),
    polyunsaturatedFatsGrams: numberValue(row.polyunsaturatedFatsGrams),
    sodiumMg: numberValue(row.sodiumMg),
    calciumMg: numberValue(row.calciumMg),
    ironMg: numberValue(row.ironMg),
    magnesiumMg: numberValue(row.magnesiumMg),
    phosphorusMg: numberValue(row.phosphorusMg),
    potassiumMg: numberValue(row.potassiumMg),
    zincMg: numberValue(row.zincMg),
    copperMg: numberValue(row.copperMg),
    manganeseMg: numberValue(row.manganeseMg),
    seleniumMcg: numberValue(row.seleniumMcg),
    vitaminAMcg: numberValue(row.vitaminAMcg),
    vitaminCMg: numberValue(row.vitaminCMg),
    vitaminDMcg: numberValue(row.vitaminDMcg),
    vitaminEMg: numberValue(row.vitaminEMg),
    vitaminKMcg: numberValue(row.vitaminKMcg),
    thiamineMg: numberValue(row.thiamineMg),
    riboflavinMg: numberValue(row.riboflavinMg),
    niacinMg: numberValue(row.niacinMg),
    vitaminB6Mg: numberValue(row.vitaminB6Mg),
    folateMcg: numberValue(row.folateMcg),
    vitaminB12Mcg: numberValue(row.vitaminB12Mcg),
  };
}

function mapFood(row: FoodRow): ProfessionalFood {
  return {
    id: row.id,
    officialName: row.officialName,
    normalizedName: row.normalizedName,
    description: row.description ?? undefined,
    category: row.category.name,
    categoryId: row.categoryId,
    foodGroup: row.foodGroup,
    source: {
      id: row.source.id,
      kind: row.source.kind,
      name: row.source.name,
      version: row.source.version ?? undefined,
      reference: row.source.reference ?? undefined,
      origin: row.source.origin,
      editable: row.source.editable,
    },
    sourceCode: row.sourceCode ?? undefined,
    preparationState: row.preparationState ?? undefined,
    presentation: row.presentation ?? undefined,
    referenceServingGrams: Number(row.referenceServingGrams),
    status: row.status,
    nutrients: mapNutrients(row.nutrients),
    householdMeasures: row.householdMeasures.map((measure) => ({
      id: measure.id,
      name: measure.name,
      normalizedName: measure.normalizedName,
      variation: measure.variation ?? undefined,
      quantity: Number(measure.quantity),
      grams: Number(measure.grams),
      source: row.source.name,
      isDefault: measure.isDefault,
      active: measure.active,
    })),
    synonyms: row.synonyms.map((synonym) => synonym.name),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const foodRepository = {
  async search(input: FoodSearchInput = {}): Promise<FoodSearchResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
    const query = input.query?.trim();
    const normalizedQuery = normalizeFoodSearchText(query ?? "");
    const where: Prisma.FoodWhereInput = {
      status: input.status ?? "ACTIVE",
      category: input.category
        ? { normalizedName: normalizeFoodSearchText(input.category) }
        : undefined,
      source:
        input.source && input.source !== "ALL"
          ? { kind: input.source }
          : undefined,
      OR: query
        ? [
            {
              officialName: {
                contains: query,
                mode: "insensitive",
              },
            },
            { normalizedName: { contains: normalizedQuery } },
            {
              description: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              foodGroup: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              preparationState: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              presentation: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              synonyms: {
                some: {
                  normalizedName: { contains: normalizedQuery },
                },
              },
            },
            {
              category: {
                name: { contains: query, mode: "insensitive" },
              },
            },
            {
              source: {
                name: { contains: query, mode: "insensitive" },
              },
            },
          ]
        : undefined,
    };

    const [rows, total] = await prisma.$transaction([
      prisma.food.findMany({
        where,
        include: foodInclude,
        orderBy: [{ officialName: "asc" }, { source: { name: "asc" } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.food.count({ where }),
    ]);

    return {
      items: rows.map(mapFood),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async findById(id: string) {
    const row = await prisma.food.findUnique({
      where: { id },
      include: foodInclude,
    });
    return row ? mapFood(row) : null;
  },

  async findManyByIds(ids: readonly string[]) {
    if (!ids.length) return [];
    const rows = await prisma.food.findMany({
      where: {
        id: { in: [...new Set(ids)] },
        status: "ACTIVE",
      },
      include: foodInclude,
    });
    return rows.map(mapFood);
  },

  async findEquivalencePool(
    food: Pick<ProfessionalFood, "id" | "foodGroup" | "categoryId">,
    limit = 100,
  ) {
    const rows = await prisma.food.findMany({
      where: {
        id: { not: food.id },
        status: "ACTIVE",
        OR: [
          { foodGroup: food.foodGroup },
          { categoryId: food.categoryId },
        ],
      },
      include: foodInclude,
      orderBy: [{ officialName: "asc" }],
      take: Math.min(250, Math.max(1, limit)),
    });
    return rows.map(mapFood);
  },

  async findDuplicates(
    draft: ClinicFoodDraft,
  ): Promise<readonly FoodDuplicateCandidate[]> {
    const rows = await prisma.food.findMany({
      where: {
        normalizedName: normalizeFoodSearchText(draft.officialName),
        preparationState: draft.preparationState ?? null,
        sourceCode: draft.sourceCode ?? null,
      },
      include: foodInclude,
      take: 10,
    });

    return rows.map((row) => ({
      id: row.id,
      officialName: row.officialName,
      source: mapFood(row).source,
      sourceCode: row.sourceCode ?? undefined,
      preparationState: row.preparationState ?? undefined,
      reason:
        row.source.kind === "CLINIC_SV"
          ? "Mesmo nome, estado e código na fonte Clínica SV."
          : "Registro semelhante em outra fonte; requer revisão profissional.",
    }));
  },

  async createClinicFood(draft: ClinicFoodDraft) {
    return prisma.$transaction(async (transaction) => {
      const normalizedCategory = normalizeFoodSearchText(draft.category);
      const category = await transaction.foodCategory.upsert({
        where: { normalizedName: normalizedCategory },
        create: {
          name: draft.category,
          normalizedName: normalizedCategory,
        },
        update: { name: draft.category, active: true },
      });
      const existingSource = await transaction.nutritionSource.findFirst({
        where: { kind: "CLINIC_SV", name: "Clínica SV" },
      });
      const source =
        existingSource ??
        (await transaction.nutritionSource.create({
          data: {
            kind: "CLINIC_SV",
            name: "Clínica SV",
            origin: "PROFESSIONAL",
            editable: true,
          },
        }));
      const row = await transaction.food.create({
        data: {
          officialName: draft.officialName,
          normalizedName: normalizeFoodSearchText(draft.officialName),
          description: draft.description,
          categoryId: category.id,
          foodGroup: draft.foodGroup,
          sourceId: source.id,
          sourceCode: draft.sourceCode,
          preparationState: draft.preparationState,
          presentation: draft.presentation,
          referenceServingGrams: draft.referenceServingGrams,
          status: draft.status,
          nutrients: { create: draft.nutrients },
          householdMeasures: {
            create: draft.householdMeasures.map((measure) => ({
              sourceId: source.id,
              name: measure.name,
              normalizedName: normalizeFoodSearchText(measure.name),
              variation: measure.variation,
              quantity: measure.quantity,
              grams: measure.grams,
              isDefault: measure.isDefault,
              active: measure.active,
            })),
          },
          synonyms: {
            create: [
              ...new Set(
                draft.synonyms
                  .map((synonym) => synonym.trim())
                  .filter(Boolean),
              ),
            ].map((synonym) => ({
              name: synonym,
              normalizedName: normalizeFoodSearchText(synonym),
            })),
          },
        },
        include: foodInclude,
      });

      return mapFood(row);
    });
  },

  async setStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    const current = await prisma.food.findUnique({
      where: { id },
      include: { source: true },
    });
    if (!current) return null;
    if (!current.source.editable || current.source.kind !== "CLINIC_SV") {
      throw new Error("OFFICIAL_FOOD_READ_ONLY");
    }
    const row = await prisma.food.update({
      where: { id },
      data: { status },
      include: foodInclude,
    });
    return mapFood(row);
  },
};
