import { createHash } from "node:crypto";

import { prisma } from "@/lib/database/prisma";

import {
  IBGE_MEASURE_SOURCE_VERSION,
  type IbgeHouseholdMeasureRow,
  type IbgeMeasureExtraction,
  readIbgeHouseholdMeasures,
} from "./ibge-household-measures";
import { normalizeFoodSearchText } from "./normalization";

type TacoLinkCandidate = {
  id: string;
  sourceCode: string | null;
  officialName: string;
  normalizedName: string;
  foodGroup: string;
  preparationState: string | null;
};

export type IbgeMeasureMatch = {
  foodId: string | null;
  status: "CONFIRMED" | "PROBABLE" | "UNMATCHED";
  reason: string;
};

const PREPARATION_TOKENS: Record<string, readonly string[]> = {
  "1": ["cru", "crua"],
  "2": ["cozido", "cozida"],
  "3": ["grelhado", "grelhada", "churrasco", "brasa"],
  "4": ["assado", "assada"],
  "5": ["frito", "frita"],
  "6": ["empanado", "empanada", "milanesa"],
  "7": ["refogado", "refogada"],
  "13": ["ensopado", "ensopada"],
};

const STATE_WORDS = new Set([
  "cru", "crua", "cozido", "cozida", "grelhado", "grelhada", "assado", "assada",
  "frito", "frita", "empanado", "empanada", "refogado", "refogada", "ensopado", "ensopada",
]);

const REVIEWED_SOURCE_CODE_CROSSWALK: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  "6300201": { "99": "1" },
  "8000105": { "99": "53" },
  "7803301": { "1": "489", "2": "488", "5": "490" },
  "8501302": { "99": "471" },
};

function foodTokens(value: string) {
  return normalizeFoodSearchText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function coreIdentity(value: string) {
  return foodTokens(value).filter((token) => !STATE_WORDS.has(token)).sort().join(" ");
}

function preparationMatches(candidate: TacoLinkCandidate, preparationCode: string) {
  const expected = PREPARATION_TOKENS[preparationCode];
  if (!expected) return preparationCode === "99";
  const candidateText = normalizeFoodSearchText(
    `${candidate.officialName} ${candidate.preparationState ?? ""}`,
  );
  return expected.some((token) => candidateText.includes(token));
}

function similarity(left: string, right: string) {
  const leftTokens = new Set(foodTokens(left).filter((token) => !STATE_WORDS.has(token)));
  const rightTokens = new Set(foodTokens(right).filter((token) => !STATE_WORDS.has(token)));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

export function matchIbgeFoodToTaco(
  row: Pick<IbgeHouseholdMeasureRow, "sourceFoodCode" | "foodName" | "normalizedFoodName" | "preparationCode">,
  tacoFoods: readonly TacoLinkCandidate[],
): IbgeMeasureMatch {
  const reviewedTacoCode =
    REVIEWED_SOURCE_CODE_CROSSWALK[row.sourceFoodCode]?.[row.preparationCode];
  if (reviewedTacoCode) {
    const reviewed = tacoFoods.filter(
      (food) => food.sourceCode === reviewedTacoCode,
    );
    if (reviewed.length === 1) {
      return {
        foodId: reviewed[0].id,
        status: "CONFIRMED",
        reason: `CROSSWALK_CODIGO_OFICIAL_REVISADO: IBGE ${row.sourceFoodCode}/${row.preparationCode} → TACO ${reviewedTacoCode}; identidade e preparação validadas explicitamente.`,
      };
    }
  }
  const exact = tacoFoods.filter(
    (food) => food.normalizedName === row.normalizedFoodName,
  );
  if (exact.length === 1) {
    return {
      foodId: exact[0].id,
      status: "CONFIRMED",
      reason: "Nome oficial normalizado idêntico e único na fonte TACO.",
    };
  }

  const core = coreIdentity(row.foodName);
  const identityCandidates = tacoFoods.filter(
    (food) => coreIdentity(food.officialName) === core,
  );
  const preparedIdentityCandidates = identityCandidates.filter((food) =>
    preparationMatches(food, row.preparationCode),
  );
  if (preparedIdentityCandidates.length === 1) {
    return {
      foodId: preparedIdentityCandidates[0].id,
      status: "CONFIRMED",
      reason: "Identidade nominal única após retirar apenas o estado de preparação, com preparação compatível.",
    };
  }

  const scored = tacoFoods
    .map((food) => ({ food, score: similarity(row.foodName, food.officialName) }))
    .filter((candidate) => candidate.score >= 0.65)
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  const second = scored[1];
  if (best && (!second || best.score - second.score >= 0.15)) {
    return {
      foodId: best.food.id,
      status: "PROBABLE",
      reason: `Candidato único por sobreposição lexical (${best.score.toFixed(2)}); requer confirmação profissional.`,
    };
  }

  return {
    foodId: null,
    status: "UNMATCHED",
    reason: exact.length > 1 || identityCandidates.length > 1
      ? "Correspondência ambígua entre múltiplos alimentos TACO; nenhum vínculo automático criado."
      : "Nenhuma correspondência suficientemente confiável na TACO.",
  };
}

function chunks<T>(values: readonly T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function fingerprint(sourcePage: number, rawText: string, reason: string) {
  return createHash("sha256")
    .update(`${sourcePage}\n${rawText}\n${reason}`)
    .digest("hex");
}

export async function importIbgeHouseholdMeasures(
  filePath: string,
  suppliedExtraction?: IbgeMeasureExtraction,
) {
  const extraction = suppliedExtraction ?? await readIbgeHouseholdMeasures(filePath);
  const source =
    (await prisma.nutritionSource.findFirst({
      where: {
        kind: "IBGE",
        name: "IBGE - Tabela de Medidas Referidas",
        version: IBGE_MEASURE_SOURCE_VERSION,
      },
    })) ??
    (await prisma.nutritionSource.create({
      data: {
        kind: "IBGE",
        name: "IBGE - Tabela de Medidas Referidas",
        version: IBGE_MEASURE_SOURCE_VERSION,
        reference: "data/imports/food/raw/liv50000.pdf",
        origin: "OFFICIAL",
        editable: false,
        active: true,
      },
    }));

  const tacoFoods = await prisma.food.findMany({
    where: { source: { kind: "TACO" }, status: "ACTIVE" },
    select: {
      id: true,
      sourceCode: true,
      officialName: true,
      normalizedName: true,
      foodGroup: true,
      preparationState: true,
    },
  });

  const matches = new Map<string, IbgeMeasureMatch>();
  for (const row of extraction.rows) {
    const key = `${row.sourceFoodCode}:${row.preparationCode}`;
    if (!matches.has(key)) matches.set(key, matchIbgeFoodToTaco(row, tacoFoods));
  }

  let created = 0;
  for (const batch of chunks(extraction.rows, 750)) {
    const result = await prisma.foodHouseholdMeasureReference.createMany({
      data: batch.map((row) => {
        const match = matches.get(`${row.sourceFoodCode}:${row.preparationCode}`)!;
        return {
          sourceId: source.id,
          foodId: match.foodId,
          sourceFoodCode: row.sourceFoodCode,
          foodName: row.foodName,
          normalizedFoodName: row.normalizedFoodName,
          preparationCode: row.preparationCode,
          preparationName: row.preparationName,
          measureCode: row.measureCode,
          measureName: row.measureName,
          standardMeasureCode: row.standardMeasureCode,
          standardMeasureName: row.standardMeasureName,
          quantityValue: row.quantityValue,
          quantityUnit: row.quantityUnit,
          referenceCode: row.referenceCode,
          referenceDescription: row.referenceDescription,
          sourceVersion: row.sourceVersion,
          matchStatus: match.status,
          matchReason: match.reason,
          sourcePage: row.sourcePage,
        };
      }),
      skipDuplicates: true,
    });
    created += result.count;
  }

  const updateGroups = new Map<string, {
    match: IbgeMeasureMatch;
    preparationCode: string;
    sourceFoodCodes: Set<string>;
  }>();
  for (const [key, match] of matches) {
    const separator = key.lastIndexOf(":");
    const sourceFoodCode = key.slice(0, separator);
    const preparationCode = key.slice(separator + 1);
    const groupKey = `${match.foodId ?? "null"}:${match.status}:${match.reason}:${preparationCode}`;
    const group = updateGroups.get(groupKey) ?? {
      match,
      preparationCode,
      sourceFoodCodes: new Set<string>(),
    };
    group.sourceFoodCodes.add(sourceFoodCode);
    updateGroups.set(groupKey, group);
  }
  for (const group of updateGroups.values()) {
    await prisma.foodHouseholdMeasureReference.updateMany({
      where: {
        sourceId: source.id,
        preparationCode: group.preparationCode,
        sourceFoodCode: { in: [...group.sourceFoodCodes] },
      },
      data: {
        foodId: group.match.foodId,
        matchStatus: group.match.status,
        matchReason: group.match.reason,
      },
    });
  }

  let rejectedCreated = 0;
  for (const batch of chunks(extraction.rejected, 750)) {
    const result = await prisma.foodMeasureImportRejection.createMany({
      data: batch.map((row) => ({
        sourceId: source.id,
        sourcePage: row.sourcePage,
        rawText: row.rawText,
        reason: row.reason,
        fingerprint: fingerprint(row.sourcePage, row.rawText, row.reason),
      })),
      skipDuplicates: true,
    });
    rejectedCreated += result.count;
  }

  const persisted = await prisma.foodHouseholdMeasureReference.findMany({
    where: { sourceId: source.id },
    select: { sourceFoodCode: true, matchStatus: true },
  });
  const foodStatuses = new Map<string, Set<string>>();
  for (const row of persisted) {
    const statuses = foodStatuses.get(row.sourceFoodCode) ?? new Set<string>();
    statuses.add(row.matchStatus);
    foodStatuses.set(row.sourceFoodCode, statuses);
  }
  const linkTotals = { confirmed: 0, probable: 0, unmatched: 0 };
  for (const statuses of foodStatuses.values()) {
    if (statuses.has("CONFIRMED")) linkTotals.confirmed++;
    else if (statuses.has("PROBABLE")) linkTotals.probable++;
    else linkTotals.unmatched++;
  }

  return {
    sourceId: source.id,
    parsedMeasures: extraction.rows.length,
    createdMeasures: created,
    totalMeasures: persisted.length,
    ibgeFoods: foodStatuses.size,
    ...linkTotals,
    rejectedInDocument: extraction.rejected.length,
    rejectedCreated,
    pagesRead: extraction.pagesRead,
  };
}
