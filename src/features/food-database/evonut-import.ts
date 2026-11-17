import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import {
  compareEvonutWithMaster,
  EVONUT_SOURCE_VERSION,
  type EvonutAuditParseResult,
  type EvonutFoodRow,
  type MasterFoodAuditSnapshot,
} from "./evonut-audit";
import { normalizeFoodSearchText } from "./normalization";

export const EVONUT_IMPORTED_FROM = "EVONUT";
export const EVONUT_EXPECTED_SHA256 =
  "DC2D9F78AD34205D4734DC656B54F30EB26752711B8A083B5E63F4B5C1A0CE81";
export const EVONUT_EXCLUDED_FOOD_SOURCES = new Set(["Receitas"]);

const NUTRIENT_MAPPING = {
  Energia: "energyKcal",
  "Proteína": "proteinGrams",
  "Lipídeos totais": "fatsGrams",
  Carboidrato: "carbohydratesGrams",
  "Fibra alimentar": "fiberGrams",
  Cálcio: "calciumMg",
  Magnésio: "magnesiumMg",
  Manganês: "manganeseMg",
  Fósforo: "phosphorusMg",
  Ferro: "ironMg",
  Sódio: "sodiumMg",
  Potássio: "potassiumMg",
  Cobre: "copperMg",
  Zinco: "zincMg",
  Selênio: "seleniumMcg",
  "Vitamina A (RE)": "vitaminAMcg",
  "Vitamina B1 (Tiamina)": "thiamineMg",
  "Vitamina B2 (Riboflavina)": "riboflavinMg",
  "Vitamina B3 (Niacina)": "niacinMg",
  "Vitamina B6 (Piridoxina)": "vitaminB6Mg",
  "Vitamina B12 (Cobalamina)": "vitaminB12Mcg",
  "Vitamina B9 (Folato)": "folateMcg",
  "Vitamina D (Calciferol)": "vitaminDMcg",
  "Vitamina E (Tocoferol)": "vitaminEMg",
  "Vitamina C (Ácido ascórbico)": "vitaminCMg",
  Colesterol: "cholesterolMg",
  "G. saturada": "saturatedFatsGrams",
  "G. monoinsaturada": "monounsaturatedFatsGrams",
  "G. poliinsaturada": "polyunsaturatedFatsGrams",
  "Açúcar total": "sugarsGrams",
} as const;

type NutrientField = (typeof NUTRIENT_MAPPING)[keyof typeof NUTRIENT_MAPPING];
type ImportClient = PrismaClient | Prisma.TransactionClient;

export type EvonutImportCounts = {
  foodsFound: number;
  foodsCreated: number;
  foodsUpdated: number;
  foodsIgnored: number;
  conflicts: number;
  measuresNormalized: number;
  measuresCreated: number;
  measuresUpdated: number;
  measuresIgnored: number;
  measuresConfirmed: number;
  measuresUnlinked: number;
  rejectedFoods: number;
  rejectedMeasures: number;
  rejectedByReason: Readonly<Record<string, number>>;
};

export type EvonutImportResult = {
  mode: "dry-run" | "apply";
  sourceSha256: string;
  sourceVersion: string;
  sources: readonly string[];
  counts: EvonutImportCounts;
  databaseBefore: DatabaseFingerprint;
  databaseAfter: DatabaseFingerprint;
  databaseUnchanged: boolean;
  transactionApplied: boolean;
};

type DatabaseFingerprint = {
  foods: number;
  nutrients: number;
  clinicalMeasures: number;
  measureReferences: number;
  evonutFoods: number;
  evonutMeasureReferences: number;
  evonutConflicts: number;
};

function fingerprint(parts: readonly (string | number | null | undefined)[]) {
  return createHash("sha256").update(parts.map((part) => part ?? "").join("\u001f")).digest("hex");
}

function increment(target: Record<string, number>, reason: string) {
  target[reason] = (target[reason] ?? 0) + 1;
}

function chunks<T>(items: readonly T[], size = 1_000) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function evonutFoodKey(source: string, sourceCode: string) {
  return `${normalizeFoodSearchText(source)}\u0000${sourceCode.trim()}`;
}

export function evonutMeasureCode(measureName: string) {
  return normalizeFoodSearchText(measureName).replace(/\s+/g, "_").toUpperCase();
}

export function evonutNutrientData(food: EvonutFoodRow) {
  const mapped: Partial<Record<NutrientField, number | null>> = {};
  const additional: Record<string, number | null> = {};
  for (const [name, value] of Object.entries(food.nutrients)) {
    const field = NUTRIENT_MAPPING[name as keyof typeof NUTRIENT_MAPPING];
    if (field) mapped[field] = value;
    else additional[name] = value;
  }
  return {
    energyKcal: mapped.energyKcal ?? null,
    proteinGrams: mapped.proteinGrams ?? null,
    carbohydratesGrams: mapped.carbohydratesGrams ?? null,
    fatsGrams: mapped.fatsGrams ?? null,
    fiberGrams: mapped.fiberGrams ?? null,
    sugarsGrams: mapped.sugarsGrams ?? null,
    cholesterolMg: mapped.cholesterolMg ?? null,
    saturatedFatsGrams: mapped.saturatedFatsGrams ?? null,
    monounsaturatedFatsGrams: mapped.monounsaturatedFatsGrams ?? null,
    polyunsaturatedFatsGrams: mapped.polyunsaturatedFatsGrams ?? null,
    sodiumMg: mapped.sodiumMg ?? null,
    calciumMg: mapped.calciumMg ?? null,
    ironMg: mapped.ironMg ?? null,
    magnesiumMg: mapped.magnesiumMg ?? null,
    phosphorusMg: mapped.phosphorusMg ?? null,
    potassiumMg: mapped.potassiumMg ?? null,
    zincMg: mapped.zincMg ?? null,
    copperMg: mapped.copperMg ?? null,
    manganeseMg: mapped.manganeseMg ?? null,
    seleniumMcg: mapped.seleniumMcg ?? null,
    vitaminAMcg: mapped.vitaminAMcg ?? null,
    vitaminCMg: mapped.vitaminCMg ?? null,
    vitaminDMcg: mapped.vitaminDMcg ?? null,
    vitaminEMg: mapped.vitaminEMg ?? null,
    vitaminKMcg: null,
    thiamineMg: mapped.thiamineMg ?? null,
    riboflavinMg: mapped.riboflavinMg ?? null,
    niacinMg: mapped.niacinMg ?? null,
    vitaminB6Mg: mapped.vitaminB6Mg ?? null,
    folateMcg: mapped.folateMcg ?? null,
    vitaminB12Mcg: mapped.vitaminB12Mcg ?? null,
    additionalNutrients: additional as Prisma.InputJsonValue,
  };
}

export function validateEvonutSource(parsed: EvonutAuditParseResult) {
  if (parsed.sourceSha256.toUpperCase() !== EVONUT_EXPECTED_SHA256) {
    throw new Error(
      `Hash do Evonut.xlsm divergente. Esperado ${EVONUT_EXPECTED_SHA256}; encontrado ${parsed.sourceSha256}.`,
    );
  }
}

async function databaseFingerprint(client: ImportClient): Promise<DatabaseFingerprint> {
  const [foods, nutrients, clinicalMeasures, measureReferences, evonutFoods, evonutMeasureReferences, evonutConflicts] =
    await Promise.all([
      client.food.count(),
      client.foodNutrients.count(),
      client.foodHouseholdMeasure.count(),
      client.foodHouseholdMeasureReference.count(),
      client.food.count({ where: { importedFrom: EVONUT_IMPORTED_FROM } }),
      client.foodHouseholdMeasureReference.count({ where: { importedFrom: EVONUT_IMPORTED_FROM } }),
      client.foodImportConflict.count({ where: { importedFrom: EVONUT_IMPORTED_FROM } }),
    ]);
  return { foods, nutrients, clinicalMeasures, measureReferences, evonutFoods, evonutMeasureReferences, evonutConflicts };
}

function decimalNumber(value: { toString(): string } | null | undefined) {
  return value === null || value === undefined ? null : Number(value.toString());
}

function jsonRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as Record<string, Prisma.JsonValue>;
}

async function masterSnapshot(client: ImportClient): Promise<MasterFoodAuditSnapshot[]> {
  const foods = await client.food.findMany({
    where: {
      OR: [
        { importedFrom: null },
        { importedFrom: { not: EVONUT_IMPORTED_FROM } },
      ],
    },
    select: {
      id: true,
      sourceCode: true,
      officialName: true,
      normalizedName: true,
      foodGroup: true,
      source: { select: { name: true, kind: true } },
      nutrients: true,
    },
  });
  return foods.map((food) => ({
    id: food.id,
    sourceCode: food.sourceCode,
    officialName: food.officialName,
    normalizedName: food.normalizedName,
    foodGroup: food.foodGroup,
    sourceName: food.source.name,
    sourceKind: food.source.kind,
    nutrients: Object.fromEntries(
      Object.entries(food.nutrients ?? {})
        .filter(([key]) => !["foodId", "createdAt", "updatedAt", "additionalNutrients"].includes(key))
        .map(([key, value]) => [key, decimalNumber(value as { toString(): string } | null)]),
    ),
  }));
}

async function existingEvonutState(client: ImportClient) {
  const sources = await client.nutritionSource.findMany({
    where: { kind: "EVONUT", version: EVONUT_SOURCE_VERSION },
  });
  const sourceByName = new Map(sources.map((source) => [source.name, source]));
  const foods = sources.length
    ? await client.food.findMany({
        where: { sourceId: { in: sources.map((source) => source.id) }, importedFrom: EVONUT_IMPORTED_FROM },
        include: { nutrients: true },
      })
    : [];
  const sourceNameById = new Map(sources.map((source) => [source.id, source.name]));
  const foodByKey = new Map(
    foods.map((food) => [evonutFoodKey(sourceNameById.get(food.sourceId) ?? "", food.sourceCode ?? ""), food]),
  );
  const measureSource = sourceByName.get("EVONUT");
  const measures = measureSource
    ? await client.foodHouseholdMeasureReference.findMany({ where: { sourceId: measureSource.id } })
    : [];
  const measureByKey = new Map(
    measures.map((measure) => [
      `${measure.sourceFoodCode}\u0000${measure.preparationCode}\u0000${measure.measureCode}`,
      measure,
    ]),
  );
  const conflictFingerprints = new Set(
    (await client.foodImportConflict.findMany({
      where: { importedFrom: EVONUT_IMPORTED_FROM },
      select: { fingerprint: true },
    })).map((row) => row.fingerprint),
  );
  return { sourceByName, foodByKey, measureSource, measureByKey, conflictFingerprints };
}

function rejectionSummary(parsed: EvonutAuditParseResult) {
  const rejectedByReason: Record<string, number> = {};
  for (const food of parsed.invalidFoods) {
    for (const reason of food.reasons) increment(rejectedByReason, `ALIMENTO:${reason}`);
  }
  for (const measure of parsed.invalidMeasures) increment(rejectedByReason, `MEDIDA:${measure.reason}`);
  return rejectedByReason;
}

async function calculatePlan(client: ImportClient, parsed: EvonutAuditParseResult) {
  const importableFoods = parsed.validFoods.filter(
    (food) => !EVONUT_EXCLUDED_FOOD_SOURCES.has(food.originalSource),
  );
  const state = await existingEvonutState(client);
  const comparisons = compareEvonutWithMaster(importableFoods, await masterSnapshot(client));
  const conflictRows = comparisons
    .filter((comparison) => comparison.conflict)
    .map((comparison) => ({
      importedFrom: EVONUT_IMPORTED_FROM,
      foodSource: comparison.food.originalSource,
      sourceFoodCode: comparison.food.sourceCode,
      incomingFoodName: comparison.food.originalName,
      existingFoodId: comparison.masterFoodId,
      conflictType: comparison.conflict!.split("|")[0].includes("!=")
        ? "NUTRITIONAL_DIVERGENCE"
        : comparison.conflict!,
      details: comparison.conflict,
      fingerprint: fingerprint([
        EVONUT_IMPORTED_FROM,
        comparison.food.originalSource,
        comparison.food.sourceCode,
        comparison.masterFoodId,
        comparison.conflict,
      ]),
    }));
  const newConflicts = conflictRows.filter((row) => !state.conflictFingerprints.has(row.fingerprint));

  const foodsToCreate: EvonutFoodRow[] = [];
  const foodsToUpdate: Array<{ food: EvonutFoodRow; existing: (typeof state.foodByKey extends Map<string, infer V> ? V : never) }> = [];
  let foodsIgnored = 0;
  for (const food of importableFoods) {
    const existing = state.foodByKey.get(evonutFoodKey(food.originalSource, food.sourceCode));
    if (!existing) {
      foodsToCreate.push(food);
      continue;
    }
    if (existing.normalizedName !== food.normalizedName) {
      foodsIgnored += 1;
      continue;
    }
    const incomingNutrients = evonutNutrientData(food);
    const hasMissingNutrients = !existing.nutrients || Object.entries(incomingNutrients).some(([key, value]) => {
      if (key === "additionalNutrients") {
        const current = jsonRecord(existing.nutrients?.additionalNutrients);
        return Object.entries(value as Record<string, number | null>).some(
          ([name, nutrientValue]) => !(name in current) && nutrientValue !== null,
        );
      }
      return existing.nutrients?.[key as keyof typeof existing.nutrients] === null && value !== null;
    });
    const hasMissingFoodData =
      existing.referenceServingUnit === null || existing.importedFrom === null || existing.importedAt === null;
    if (hasMissingNutrients || hasMissingFoodData) foodsToUpdate.push({ food, existing });
    else foodsIgnored += 1;
  }

  let measuresCreated = 0;
  let measuresUpdated = 0;
  let measuresIgnored = 0;
  let measuresConfirmed = 0;
  let measuresUnlinked = 0;
  for (const measure of parsed.measures) {
    const linked = !EVONUT_EXCLUDED_FOOD_SOURCES.has(measure.originalNutritionSource);
    if (linked) measuresConfirmed += 1;
    else measuresUnlinked += 1;
    const key = `${measure.foodSourceCode}\u0000\u0000${evonutMeasureCode(measure.measureName)}`;
    const existing = state.measureByKey.get(key);
    if (!existing) measuresCreated += 1;
    else if (
      existing.foodId === null && linked ||
      existing.normalizedMeasureName === null ||
      existing.foodSource === null ||
      existing.linkMethod === null ||
      existing.importedFrom === null
    ) measuresUpdated += 1;
    else measuresIgnored += 1;
  }

  return {
    importableFoods,
    state,
    conflictRows,
    newConflicts,
    foodsToCreate,
    foodsToUpdate,
    counts: {
      foodsFound: parsed.validFoods.length,
      foodsCreated: foodsToCreate.length,
      foodsUpdated: foodsToUpdate.length,
      foodsIgnored: foodsIgnored + parsed.validFoods.length - importableFoods.length,
      conflicts: newConflicts.length,
      measuresNormalized: parsed.measures.length,
      measuresCreated,
      measuresUpdated,
      measuresIgnored,
      measuresConfirmed,
      measuresUnlinked,
      rejectedFoods: parsed.invalidFoods.length,
      rejectedMeasures: parsed.invalidMeasures.length,
      rejectedByReason: rejectionSummary(parsed),
    } satisfies EvonutImportCounts,
  };
}

function foodCreateData(
  food: EvonutFoodRow,
  sourceId: string,
  categoryId: string,
  importedAt: Date,
) {
  return {
    officialName: food.originalName,
    normalizedName: food.normalizedName,
    categoryId,
    foodGroup: food.group,
    sourceId,
    sourceCode: food.sourceCode,
    referenceServingGrams: food.referenceQuantity!,
    referenceServingUnit: food.referenceUnit,
    status: "ACTIVE" as const,
    importedFrom: EVONUT_IMPORTED_FROM,
    importedAt,
  };
}

async function applyPlan(transaction: Prisma.TransactionClient, parsed: EvonutAuditParseResult) {
  const plan = await calculatePlan(transaction, parsed);
  const importedAt = new Date();
  const sourceNames = [...new Set(plan.importableFoods.map((food) => food.originalSource))];
  const requiredSourceNames = [...sourceNames, "EVONUT"];
  const existingSources = await transaction.nutritionSource.findMany({
    where: { kind: "EVONUT", version: EVONUT_SOURCE_VERSION, name: { in: requiredSourceNames } },
  });
  const existingSourceNames = new Set(existingSources.map((source) => source.name));
  for (const name of requiredSourceNames.filter((sourceName) => !existingSourceNames.has(sourceName))) {
    await transaction.nutritionSource.create({
      data: {
        kind: "EVONUT",
        name,
        version: EVONUT_SOURCE_VERSION,
        reference: "Evonut.xlsm — leitura tabular interna, sem execução de macros",
        origin: "OFFICIAL",
        editable: false,
        active: true,
      },
    });
  }
  const sources = await transaction.nutritionSource.findMany({
    where: { kind: "EVONUT", version: EVONUT_SOURCE_VERSION, name: { in: [...sourceNames, "EVONUT"] } },
  });
  const sourceByName = new Map(sources.map((source) => [source.name, source]));

  const groups = [...new Set(plan.importableFoods.map((food) => food.group))];
  const normalizedGroups = groups.map(normalizeFoodSearchText);
  const existingCategories = await transaction.foodCategory.findMany({
    where: { normalizedName: { in: normalizedGroups } },
  });
  const existingCategoryNames = new Set(existingCategories.map((category) => category.normalizedName));
  for (const group of groups.filter((name) => !existingCategoryNames.has(normalizeFoodSearchText(name)))) {
    await transaction.foodCategory.create({
      data: { name: group, normalizedName: normalizeFoodSearchText(group) },
    });
  }
  const categories = await transaction.foodCategory.findMany({
    where: { normalizedName: { in: groups.map(normalizeFoodSearchText) } },
  });
  const categoryByName = new Map(categories.map((category) => [category.normalizedName, category]));

  for (const batch of chunks(plan.foodsToCreate)) {
    await transaction.food.createMany({
      data: batch.map((food) =>
        foodCreateData(
          food,
          sourceByName.get(food.originalSource)!.id,
          categoryByName.get(normalizeFoodSearchText(food.group))!.id,
          importedAt,
        ),
      ),
      skipDuplicates: true,
    });
  }

  const importedFoods = await transaction.food.findMany({
    where: {
      importedFrom: EVONUT_IMPORTED_FROM,
      sourceId: { in: sourceNames.map((name) => sourceByName.get(name)!.id) },
    },
    include: { nutrients: true, source: { select: { name: true } } },
  });
  const foodByKey = new Map(
    importedFoods.map((food) => [evonutFoodKey(food.source.name, food.sourceCode ?? ""), food]),
  );
  const newNutrients = plan.foodsToCreate
    .map((food) => ({ food, saved: foodByKey.get(evonutFoodKey(food.originalSource, food.sourceCode)) }))
    .filter((row) => row.saved && !row.saved.nutrients);
  for (const batch of chunks(newNutrients)) {
    await transaction.foodNutrients.createMany({
      data: batch.map(({ food, saved }) => ({ foodId: saved!.id, ...evonutNutrientData(food) })),
      skipDuplicates: true,
    });
  }

  for (const { food, existing } of plan.foodsToUpdate) {
    const saved = foodByKey.get(evonutFoodKey(food.originalSource, food.sourceCode)) ?? existing;
    await transaction.food.update({
      where: { id: saved.id },
      data: {
        referenceServingUnit: saved.referenceServingUnit ?? food.referenceUnit,
        importedFrom: saved.importedFrom ?? EVONUT_IMPORTED_FROM,
        importedAt: saved.importedAt ?? importedAt,
      },
    });
    const incoming = evonutNutrientData(food);
    if (!saved.nutrients) {
      await transaction.foodNutrients.create({ data: { foodId: saved.id, ...incoming } });
    } else {
      const updates = Object.fromEntries(
        Object.entries(incoming).filter(([key, value]) =>
          key !== "additionalNutrients" &&
          saved.nutrients![key as keyof typeof saved.nutrients] === null &&
          value !== null,
        ),
      );
      const currentAdditional = jsonRecord(saved.nutrients.additionalNutrients);
      const incomingAdditional = incoming.additionalNutrients as Record<string, number | null>;
      const mergedAdditional = { ...currentAdditional };
      let additionalChanged = false;
      for (const [name, value] of Object.entries(incomingAdditional)) {
        if (!(name in mergedAdditional) && value !== null) {
          mergedAdditional[name] = value;
          additionalChanged = true;
        }
      }
      if (additionalChanged) updates.additionalNutrients = mergedAdditional;
      if (Object.keys(updates).length) {
        await transaction.foodNutrients.update({ where: { foodId: saved.id }, data: updates });
      }
    }
  }

  if (plan.newConflicts.length) {
    await transaction.foodImportConflict.createMany({ data: plan.newConflicts, skipDuplicates: true });
  }

  const measureSource = sourceByName.get("EVONUT")!;
  const existingReferences = await transaction.foodHouseholdMeasureReference.findMany({
    where: { sourceId: measureSource.id },
  });
  const existingByKey = new Map(
    existingReferences.map((measure) => [
      `${measure.sourceFoodCode}\u0000${measure.preparationCode}\u0000${measure.measureCode}`,
      measure,
    ]),
  );
  const measuresToCreate = parsed.measures.filter((measure) => {
    const key = `${measure.foodSourceCode}\u0000\u0000${evonutMeasureCode(measure.measureName)}`;
    return !existingByKey.has(key);
  });
  for (const batch of chunks(measuresToCreate)) {
    await transaction.foodHouseholdMeasureReference.createMany({
      data: batch.map((measure) => {
        const food = foodByKey.get(evonutFoodKey(measure.originalNutritionSource, measure.foodSourceCode));
        const measureCode = evonutMeasureCode(measure.measureName);
        return {
          sourceId: measureSource.id,
          foodId: food?.id,
          sourceFoodCode: measure.foodSourceCode,
          foodName: measure.foodName,
          normalizedFoodName: normalizeFoodSearchText(measure.foodName),
          preparationCode: "",
          preparationName: "",
          measureCode,
          measureName: measure.measureName,
          normalizedMeasureName: normalizeFoodSearchText(measure.measureName),
          standardMeasureCode: measureCode,
          standardMeasureName: measure.measureName,
          quantityValue: measure.measureValue,
          quantityUnit: measure.measureUnit,
          referenceCode: `BD_Medidas:${measure.spreadsheetRow}`,
          referenceDescription: `Evonut.xlsm / BD_Medidas / linha ${measure.spreadsheetRow}`,
          sourceVersion: measure.sourceVersion,
          matchStatus: food ? "CONFIRMED" as const : "UNLINKED" as const,
          matchReason: food
            ? "Fonte nutricional original + código interno Evonut idênticos."
            : "Alimento fora do escopo desta fase ou sem correspondência segura.",
          foodSource: measure.originalNutritionSource,
          linkMethod: food ? "EVONUT_SOURCE_AND_CODE" : "NO_SAFE_SOURCE_CODE_MATCH",
          importedFrom: EVONUT_IMPORTED_FROM,
          sourcePage: measure.spreadsheetRow,
          importedAt,
        };
      }),
      skipDuplicates: true,
    });
  }

  for (const measure of parsed.measures) {
    const key = `${measure.foodSourceCode}\u0000\u0000${evonutMeasureCode(measure.measureName)}`;
    const existing = existingByKey.get(key);
    if (!existing) continue;
    const food = foodByKey.get(evonutFoodKey(measure.originalNutritionSource, measure.foodSourceCode));
    const shouldUpdate =
      existing.normalizedMeasureName === null ||
      existing.foodSource === null ||
      existing.linkMethod === null ||
      existing.importedFrom === null ||
      (existing.foodId === null && Boolean(food));
    if (!shouldUpdate) continue;
    await transaction.foodHouseholdMeasureReference.update({
      where: { id: existing.id },
      data: {
        foodId: existing.foodId ?? food?.id,
        normalizedMeasureName: existing.normalizedMeasureName ?? normalizeFoodSearchText(measure.measureName),
        foodSource: existing.foodSource ?? measure.originalNutritionSource,
        linkMethod: existing.linkMethod ?? (food ? "EVONUT_SOURCE_AND_CODE" : "NO_SAFE_SOURCE_CODE_MATCH"),
        importedFrom: existing.importedFrom ?? EVONUT_IMPORTED_FROM,
        matchStatus: food ? "CONFIRMED" : "UNLINKED",
      },
    });
  }

  const rejectionData = parsed.invalidMeasures.map((measure) => ({
    sourceId: measureSource.id,
    sourcePage: measure.spreadsheetRow,
    rawText: JSON.stringify(measure),
    reason: measure.reason,
    fingerprint: fingerprint([
      measure.spreadsheetRow,
      measure.foodSourceCode,
      measure.measureName,
      measure.rawValue,
      measure.reason,
    ]),
  }));
  for (const batch of chunks(rejectionData)) {
    await transaction.foodMeasureImportRejection.createMany({ data: batch, skipDuplicates: true });
  }
  return plan.counts;
}

export async function importEvonutFoodsAndMeasures(
  client: PrismaClient,
  parsed: EvonutAuditParseResult,
  mode: "dry-run" | "apply",
): Promise<EvonutImportResult> {
  validateEvonutSource(parsed);
  const before = await databaseFingerprint(client);
  const sources = [...new Set(parsed.validFoods.map((food) => food.originalSource))].sort();
  if (mode === "dry-run") {
    const plan = await calculatePlan(client, parsed);
    const after = await databaseFingerprint(client);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error("O dry-run alterou inesperadamente o PostgreSQL.");
    }
    return {
      mode,
      sourceSha256: parsed.sourceSha256,
      sourceVersion: EVONUT_SOURCE_VERSION,
      sources,
      counts: plan.counts,
      databaseBefore: before,
      databaseAfter: after,
      databaseUnchanged: true,
      transactionApplied: false,
    };
  }

  const counts = await client.$transaction(
    (transaction) => applyPlan(transaction, parsed),
    { isolationLevel: "Serializable", maxWait: 30_000, timeout: 600_000 },
  );
  const after = await databaseFingerprint(client);
  return {
    mode,
    sourceSha256: parsed.sourceSha256,
    sourceVersion: EVONUT_SOURCE_VERSION,
    sources,
    counts,
    databaseBefore: before,
    databaseAfter: after,
    databaseUnchanged: JSON.stringify(before) === JSON.stringify(after),
    transactionApplied: true,
  };
}
