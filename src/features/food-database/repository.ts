import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import type {
  ClinicFoodDraft,
  FoodDuplicateCandidate,
  FoodNutrientsPer100g,
  FoodSearchInput,
  FoodSearchResult,
  FoodSearchSourceOption,
  ProfessionalFood,
} from "./contracts";
import { normalizeFoodSearchText } from "./normalization";
import { resolveFoodNutrientForms } from "./nutrient-forms";
import {
  buildFoodSearchWhere,
  resolveFoodSearchPagination,
} from "./search-filter";

const foodInclude = {
  category: true,
  source: true,
  nutrients: true,
  nutrientObservations: true,
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

function transFatsValue(row: FoodRow) {
  const observation = row.nutrientObservations.find((item) =>
    item.nutrientKey === "transFatsGrams" || item.nutrientKey === "additional:transFatsGrams",
  );
  if (observation) {
    return observation.valueStatus === "NUMERIC"
      ? numberValue(observation.numericValue)
      : null;
  }
  const additional = row.nutrients?.additionalNutrients;
  if (!additional || typeof additional !== "object" || Array.isArray(additional)) return null;
  const value = (additional as Record<string, unknown>)["G. trans total"];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function mapNutrients(
  row: FoodRow,
): FoodNutrientsPer100g | null {
  if (!row.nutrients) return null;
  const nutrients = row.nutrients;

  return {
    energyKcal: numberValue(nutrients.energyKcal),
    proteinGrams: numberValue(nutrients.proteinGrams),
    carbohydratesGrams: numberValue(nutrients.carbohydratesGrams),
    fatsGrams: numberValue(nutrients.fatsGrams),
    fiberGrams: numberValue(nutrients.fiberGrams),
    sugarsGrams: numberValue(nutrients.sugarsGrams),
    cholesterolMg: numberValue(nutrients.cholesterolMg),
    saturatedFatsGrams: numberValue(nutrients.saturatedFatsGrams),
    transFatsGrams: transFatsValue(row),
    monounsaturatedFatsGrams: numberValue(nutrients.monounsaturatedFatsGrams),
    polyunsaturatedFatsGrams: numberValue(nutrients.polyunsaturatedFatsGrams),
    sodiumMg: numberValue(nutrients.sodiumMg),
    calciumMg: numberValue(nutrients.calciumMg),
    ironMg: numberValue(nutrients.ironMg),
    magnesiumMg: numberValue(nutrients.magnesiumMg),
    phosphorusMg: numberValue(nutrients.phosphorusMg),
    potassiumMg: numberValue(nutrients.potassiumMg),
    zincMg: numberValue(nutrients.zincMg),
    copperMg: numberValue(nutrients.copperMg),
    manganeseMg: numberValue(nutrients.manganeseMg),
    seleniumMcg: numberValue(nutrients.seleniumMcg),
    vitaminAMcg: numberValue(nutrients.vitaminAMcg),
    vitaminCMg: numberValue(nutrients.vitaminCMg),
    vitaminDMcg: numberValue(nutrients.vitaminDMcg),
    vitaminEMg: numberValue(nutrients.vitaminEMg),
    vitaminKMcg: numberValue(nutrients.vitaminKMcg),
    thiamineMg: numberValue(nutrients.thiamineMg),
    riboflavinMg: numberValue(nutrients.riboflavinMg),
    niacinMg: numberValue(nutrients.niacinMg),
    vitaminB6Mg: numberValue(nutrients.vitaminB6Mg),
    folateMcg: numberValue(nutrients.folateMcg),
    vitaminB12Mcg: numberValue(nutrients.vitaminB12Mcg),
  };
}

function mapFood(row: FoodRow): ProfessionalFood {
  return {
    id: row.id,
    officialName: row.officialName,
    sourceOriginalName: row.sourceOriginalName ?? undefined,
    professionalName: row.professionalName ?? undefined,
    normalizedName: row.normalizedName,
    description: row.description ?? undefined,
    category: row.category.name,
    categoryId: row.categoryId,
    foodGroup: row.foodGroup,
    nutrientForms: resolveFoodNutrientForms({
      sourceKind: row.source.kind,
      importedFrom: row.importedFrom,
      observations: row.nutrientObservations,
    }),
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
    preparationMethod: row.preparationMethod ?? undefined,
    foodState: row.foodState ?? undefined,
    presentation: row.presentation ?? undefined,
    referenceServingGrams: Number(row.referenceServingGrams),
    referenceServingUnit: row.referenceServingUnit ?? undefined,
    status: row.status,
    nutrients: mapNutrients(row),
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
  async listActiveSourceOptions(): Promise<readonly FoodSearchSourceOption[]> {
    const sources = await prisma.nutritionSource.findMany({
      where: {
        active: true,
        foods: { some: { status: "ACTIVE" } },
      },
      select: {
        name: true,
        _count: {
          select: { foods: { where: { status: "ACTIVE" } } },
        },
      },
    });
    const byName = new Map<string, FoodSearchSourceOption>();
    for (const source of sources) {
      const value = source.name.trim();
      if (!value) continue;
      const key = normalizeFoodSearchText(value);
      const current = byName.get(key);
      byName.set(key, {
        value,
        label: value,
        activeFoods:
          (current?.activeFoods ?? 0) + source._count.foods,
      });
    }
    return [...byName.values()].sort((left, right) =>
      left.label.localeCompare(right.label, "pt-BR"),
    );
  },

  async search(input: FoodSearchInput = {}): Promise<FoodSearchResult> {
    const { page, pageSize } = resolveFoodSearchPagination(input);
    const where = buildFoodSearchWhere(input);

    const rows = await prisma.food.findMany({
      where,
      include: foodInclude,
      orderBy: [{ officialName: "asc" }, { source: { name: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await prisma.food.count({ where });

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

  async searchSubstitutionCandidates(query: string, limit = 50) {
    const normalizedQuery = normalizeFoodSearchText(query.trim());
    if (!normalizedQuery) return [];
    const safeLimit = Math.min(50, Math.max(1, limit));
    const [priorityRows, broadResult] = await Promise.all([
      prisma.food.findMany({
        where: {
          status: "ACTIVE",
          normalizedName: { startsWith: normalizedQuery },
        },
        include: foodInclude,
        orderBy: [{ officialName: "asc" }, { source: { name: "asc" } }],
        take: safeLimit,
      }),
      foodRepository.search({
        query,
        pageSize: safeLimit,
        source: "ALL",
        status: "ACTIVE",
      }),
    ]);
    const unique = new Map<string, ProfessionalFood>();
    for (const food of [
      ...priorityRows.map(mapFood),
      ...broadResult.items,
    ]) unique.set(food.id, food);
    return [...unique.values()].slice(0, safeLimit);
  },

  async findDuplicates(
    draft: ClinicFoodDraft,
  ): Promise<readonly FoodDuplicateCandidate[]> {
    const sourceCode = draft.sourceCode?.trim() || null;
    const rows = await prisma.food.findMany({
      where: {
        normalizedName: normalizeFoodSearchText(draft.officialName),
        preparationState: draft.preparationState ?? null,
        sourceCode,
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
      const sourceCode = draft.sourceCode?.trim() || undefined;
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
          sourceCode,
          preparationState: draft.preparationState,
          presentation: draft.presentation,
          referenceServingGrams: draft.referenceServingGrams,
          referenceServingUnit: draft.referenceServingUnit,
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
