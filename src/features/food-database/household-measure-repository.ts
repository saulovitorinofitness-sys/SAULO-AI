import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import { normalizeFoodSearchText } from "./normalization";

export type HouseholdMeasureSearchInput = {
  foodId?: string;
  sourceFoodCode?: string;
  query?: string;
  limit?: number;
};

export type ConfirmedHouseholdMeasureOption = {
  id: string;
  measureId: string;
  label: string;
  measureName: string;
  preparationCode: string;
  preparationName: string;
  amountPerMeasure: number;
  unit: "g" | "ml";
  quantityValue: number;
  quantityUnit: "g" | "ml";
  source: "IBGE" | "EVONUT";
  sourceFoodCode: string;
  confidence: "CONFIRMED";
  linkMethod: string;
};

function linkMethod(reason: string | null) {
  if (reason?.startsWith("CROSSWALK_CODIGO_OFICIAL_REVISADO:")) {
    return "REVIEWED_SOURCE_CODE_CROSSWALK";
  }
  if (reason?.startsWith("Nome oficial normalizado idêntico")) {
    return "EXACT_NORMALIZED_NAME";
  }
  return "NORMALIZED_IDENTITY_AND_PREPARATION";
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

function confirmedOptions(rows: readonly {
  id: string;
  foodId: string | null;
  preparationCode: string;
  preparationName: string;
  measureName: string;
  sourceFoodCode: string;
  matchReason: string | null;
  linkMethod: string | null;
  source: { kind: string };
  quantityValue: { toString(): string } | null;
  quantityUnit: string | null;
}[]) {
  const preparationsByFood = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.foodId) continue;
    const preparations = preparationsByFood.get(row.foodId) ?? new Set<string>();
    preparations.add(row.preparationCode);
    preparationsByFood.set(row.foodId, preparations);
  }
  const optionsByFood = new Map<string, ConfirmedHouseholdMeasureOption[]>();
  const labelsByFood = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.foodId || row.quantityValue === null || !row.quantityUnit) continue;
    if (row.source.kind !== "IBGE" && row.source.kind !== "EVONUT") continue;
    const quantity = Number(row.quantityValue.toString());
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const showPreparation = (preparationsByFood.get(row.foodId)?.size ?? 0) > 1;
    const unit = row.quantityUnit as "g" | "ml";
    const label = [
      `1 ${row.measureName.toLocaleLowerCase("pt-BR")}`,
      showPreparation ? row.preparationName : null,
      `${formatQuantity(quantity)} ${unit}`,
    ].filter(Boolean).join(" — ");
    const knownLabels = labelsByFood.get(row.foodId) ?? new Set<string>();
    if (knownLabels.has(label)) continue;
    knownLabels.add(label);
    labelsByFood.set(row.foodId, knownLabels);
    const options = optionsByFood.get(row.foodId) ?? [];
    options.push({
      id: row.id,
      measureId: row.id,
      label,
      measureName: row.measureName,
      preparationCode: row.preparationCode,
      preparationName: row.preparationName,
      amountPerMeasure: quantity,
      unit,
      quantityValue: quantity,
      quantityUnit: unit,
      source: row.source.kind,
      sourceFoodCode: row.sourceFoodCode,
      confidence: "CONFIRMED",
      linkMethod: row.linkMethod ?? linkMethod(row.matchReason),
    });
    optionsByFood.set(row.foodId, options);
  }
  return optionsByFood;
}

export const householdMeasureRepository = {
  async findConfirmedOptionsByFoodIds(foodIds: readonly string[]) {
    const ids = [...new Set(foodIds.filter(Boolean))];
    if (!ids.length) return new Map<string, ConfirmedHouseholdMeasureOption[]>();
    const rows = await prisma.foodHouseholdMeasureReference.findMany({
      where: {
        source: { kind: { in: ["IBGE", "EVONUT"] } },
        foodId: { in: ids },
        matchStatus: "CONFIRMED",
        quantityValue: { gt: 0 },
        quantityUnit: { in: ["g", "ml"] },
      },
      select: {
        id: true,
        foodId: true,
        preparationCode: true,
        preparationName: true,
        measureName: true,
        sourceFoodCode: true,
        matchReason: true,
        linkMethod: true,
        source: { select: { kind: true } },
        quantityValue: true,
        quantityUnit: true,
      },
      orderBy: [
        { foodId: "asc" },
        { preparationCode: "asc" },
        { measureCode: "asc" },
      ],
    });
    return confirmedOptions(rows);
  },

  async findConfirmedOptionsByFoodId(foodId: string) {
    return (await this.findConfirmedOptionsByFoodIds([foodId])).get(foodId) ?? [];
  },

  async findByFood(input: HouseholdMeasureSearchInput) {
    const normalizedQuery = normalizeFoodSearchText(input.query?.trim() ?? "");
    if (!input.foodId && !input.sourceFoodCode && !normalizedQuery) {
      throw new Error("Informe foodId, sourceFoodCode ou query para consultar medidas caseiras.");
    }

    const where: Prisma.FoodHouseholdMeasureReferenceWhereInput = {
      source: { kind: "IBGE" },
      foodId: input.foodId,
      sourceFoodCode: input.sourceFoodCode,
      normalizedFoodName: normalizedQuery
        ? { contains: normalizedQuery }
        : undefined,
    };
    const rows = await prisma.foodHouseholdMeasureReference.findMany({
      where,
      include: {
        source: { select: { kind: true, name: true, version: true } },
        food: { select: { id: true, officialName: true, sourceCode: true } },
      },
      orderBy: [
        { foodName: "asc" },
        { preparationCode: "asc" },
        { measureCode: "asc" },
      ],
      take: Math.min(500, Math.max(1, input.limit ?? 200)),
    });

    return rows.map((row) => ({
      id: row.id,
      source: row.source.kind,
      sourceName: row.source.name,
      sourceVersion: row.source.version,
      sourceFoodCode: row.sourceFoodCode,
      foodName: row.foodName,
      preparation: {
        code: row.preparationCode,
        name: row.preparationName,
      },
      measure: {
        code: row.measureCode,
        name: row.measureName,
      },
      standardMeasure: {
        code: row.standardMeasureCode,
        name: row.standardMeasureName,
      },
      quantity: row.quantityValue === null ? null : Number(row.quantityValue),
      quantityUnit: row.quantityUnit,
      reference: row.referenceDescription
        ? { code: row.referenceCode, description: row.referenceDescription }
        : null,
      tacoLink: {
        status: row.matchStatus,
        reason: row.matchReason,
        food: row.food,
      },
      sourcePage: row.sourcePage,
      importedAt: row.importedAt.toISOString(),
    }));
  },
};
