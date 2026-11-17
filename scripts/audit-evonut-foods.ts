import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  compareEvonutWithMaster,
  EVONUT_AUTHORIZED_SHEETS,
  EVONUT_NUTRIENT_COLUMNS,
  parseEvonutWorkbook,
  type MasterFoodAuditSnapshot,
} from "../src/features/food-database/evonut-audit";
import { normalizeFoodSearchText } from "../src/features/food-database/normalization";
import { prisma } from "../src/lib/database/prisma";

const SOURCE_PATH = resolve("data/imports/food/raw/Evonut.xlsm");
const OUTPUT_DIRECTORY = resolve("data/imports/food/evonut-audit");

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  return /[",\r\n;]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
}

function csv(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function counts(values: readonly string[]) {
  return Object.fromEntries(
    [...new Set(values)]
      .sort((left, right) => left.localeCompare(right, "pt-BR"))
      .map((value) => [value || "<ausente>", values.filter((item) => item === value).length]),
  );
}

function numberValue(value: { toString(): string } | null | undefined) {
  return value === null || value === undefined ? null : Number(value.toString());
}

async function masterSnapshot(): Promise<MasterFoodAuditSnapshot[]> {
  const rows = await prisma.food.findMany({
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
  return rows.map((row) => ({
    id: row.id,
    sourceCode: row.sourceCode,
    officialName: row.officialName,
    normalizedName: row.normalizedName,
    foodGroup: row.foodGroup,
    sourceName: row.source.name,
    sourceKind: row.source.kind,
    nutrients: Object.fromEntries(
      Object.entries(row.nutrients ?? {})
        .filter(([key]) => key !== "foodId" && key !== "createdAt" && key !== "updatedAt")
        .map(([key, value]) => [
          key,
          typeof value === "object" && value !== null && "toString" in value
            ? numberValue(value as { toString(): string })
            : null,
        ]),
    ),
  }));
}

async function databaseFingerprint() {
  const [foodCount, nutrientCount, measureCount, referenceCount, latestFood] =
    await Promise.all([
      prisma.food.count(),
      prisma.foodNutrients.count(),
      prisma.foodHouseholdMeasure.count(),
      prisma.foodHouseholdMeasureReference.count(),
      prisma.food.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    ]);
  return {
    foodCount,
    nutrientCount,
    measureCount,
    referenceCount,
    latestFoodUpdatedAt: latestFood?.updatedAt.toISOString() ?? null,
  };
}

async function main() {
  const sourceBefore = await stat(SOURCE_PATH);
  const bytes = await readFile(SOURCE_PATH);
  const sourceHashBefore = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  const databaseBefore = await databaseFingerprint();
  const parsed = parseEvonutWorkbook(bytes);
  const masterFoods = await masterSnapshot();
  const comparisons = compareEvonutWithMaster(parsed.validFoods, masterFoods);
  const databaseAfter = await databaseFingerprint();
  const sourceAfter = await stat(SOURCE_PATH);
  const sourceHashAfter = createHash("sha256")
    .update(await readFile(SOURCE_PATH))
    .digest("hex")
    .toUpperCase();

  const safeMatches = comparisons.filter((row) => row.safe);
  const probableMatches = comparisons.filter(
    (row) => !row.safe && row.method !== "NONE",
  );
  const unmatched = comparisons.filter((row) => row.method === "NONE");
  const conflicts = comparisons.filter((row) => row.conflict !== null);
  const safeCodes = new Set(safeMatches.map((row) => row.food.sourceCode));
  const safeMeasures = parsed.measures.filter((measure) =>
    safeCodes.has(measure.foodSourceCode),
  );

  const allFoodIdentities = [
    ...parsed.validFoods.map((food) => ({
      code: food.sourceCode,
      name: food.originalName,
      source: food.originalSource,
      group: food.group,
    })),
    ...parsed.invalidFoods.map((food) => ({
      code: food.sourceCode,
      name: food.originalName,
      source: food.originalSource,
      group: food.group,
    })),
  ];
  const normalizedNameSources = new Map<string, Set<string>>();
  for (const food of allFoodIdentities) {
    const key = normalizeFoodSearchText(food.name);
    if (!key) continue;
    const sources = normalizedNameSources.get(key) ?? new Set<string>();
    sources.add(food.source);
    normalizedNameSources.set(key, sources);
  }
  const repeatedAcrossSources = [...normalizedNameSources.values()].filter(
    (sources) => sources.size > 1,
  ).length;
  const duplicateSourceCodes = allFoodIdentities.length - new Set(
    allFoodIdentities.map((food) => `${normalizeFoodSearchText(food.source)}:${food.code}`),
  ).size;
  const duplicateNamesWithinSource = allFoodIdentities.length - new Set(
    allFoodIdentities.map(
      (food) => `${normalizeFoodSearchText(food.source)}:${normalizeFoodSearchText(food.name)}`,
    ),
  ).size;
  const supportedSources = new Set(["taco", "tbca", "ibge"]);
  const plannedCreates = unmatched.filter((row) =>
    supportedSources.has(normalizeFoodSearchText(row.food.originalSource)),
  );
  const plannedRejects = comparisons.filter(
    (row) =>
      Boolean(row.conflict) ||
      (!row.safe &&
        !supportedSources.has(normalizeFoodSearchText(row.food.originalSource))),
  );

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(OUTPUT_DIRECTORY, "alimentos-validos.csv"),
      csv(
        [
          "spreadsheetRow",
          "sourceCode",
          "originalName",
          "normalizedName",
          "originalSource",
          "group",
          "referenceQuantity",
          "referenceUnit",
          "standardMeasure",
          ...EVONUT_NUTRIENT_COLUMNS,
          "missingNutrients",
        ],
        parsed.validFoods.map((food) => [
          food.spreadsheetRow,
          food.sourceCode,
          food.originalName,
          food.normalizedName,
          food.originalSource,
          food.group,
          food.referenceQuantity,
          food.referenceUnit,
          food.standardMeasure,
          ...EVONUT_NUTRIENT_COLUMNS.map((name) => food.nutrients[name]),
          food.missingNutrients.join("|"),
        ]),
      ),
      "utf8",
    ),
    writeFile(
      resolve(OUTPUT_DIRECTORY, "alimentos-invalidos.csv"),
      csv(
        ["spreadsheetRow", "sourceCode", "originalName", "originalSource", "group", "reasons"],
        parsed.invalidFoods.map((food) => [
          food.spreadsheetRow,
          food.sourceCode,
          food.originalName,
          food.originalSource,
          food.group,
          food.reasons.join("|"),
        ]),
      ),
      "utf8",
    ),
    writeFile(
      resolve(OUTPUT_DIRECTORY, "medidas-normalizadas.csv"),
      csv(
        [
          "spreadsheetRow",
          "foodSourceCode",
          "foodName",
          "measureName",
          "measureValue",
          "measureUnit",
          "source",
          "originalNutritionSource",
          "sourceVersion",
        ],
        parsed.measures.map((measure) => [
          measure.spreadsheetRow,
          measure.foodSourceCode,
          measure.foodName,
          measure.measureName,
          measure.measureValue,
          measure.measureUnit,
          measure.source,
          measure.originalNutritionSource,
          measure.sourceVersion,
        ]),
      ),
      "utf8",
    ),
    writeFile(
      resolve(OUTPUT_DIRECTORY, "medidas-invalidas.csv"),
      csv(
        ["spreadsheetRow", "foodSourceCode", "measureName", "rawValue", "reason"],
        parsed.invalidMeasures.map((measure) => [
          measure.spreadsheetRow,
          measure.foodSourceCode,
          measure.measureName,
          measure.rawValue,
          measure.reason,
        ]),
      ),
      "utf8",
    ),
    writeFile(
      resolve(OUTPUT_DIRECTORY, "conflitos-banco-mestre.csv"),
      csv(
        [
          "spreadsheetRow",
          "sourceCode",
          "evonutName",
          "evonutSource",
          "masterFoodId",
          "masterFoodName",
          "masterSource",
          "matchMethod",
          "conflict",
        ],
        conflicts.map((row) => [
          row.food.spreadsheetRow,
          row.food.sourceCode,
          row.food.originalName,
          row.food.originalSource,
          row.masterFoodId,
          row.masterFoodName,
          row.masterSource,
          row.method,
          row.conflict,
        ]),
      ),
      "utf8",
    ),
    writeFile(
      resolve(OUTPUT_DIRECTORY, "registros-sem-correspondencia.csv"),
      csv(
        [
          "spreadsheetRow",
          "sourceCode",
          "originalName",
          "originalSource",
          "group",
          "analysis",
        ],
        unmatched.map((row) => [
          row.food.spreadsheetRow,
          row.food.sourceCode,
          row.food.originalName,
          row.food.originalSource,
          row.food.group,
          "SEM_CORRESPONDENCIA_AUTOMATICA",
        ]),
      ),
      "utf8",
    ),
  ]);

  const summary = {
    auditGeneratedAt: new Date().toISOString(),
    scope: {
      authorizedSheets: EVONUT_AUTHORIZED_SHEETS,
      extractedSheets: EVONUT_AUTHORIZED_SHEETS,
      clinicalOrPersonalSheetsExtracted: false,
      macrosExecuted: false,
      workbookWritten: false,
    },
    sourceFile: {
      path: SOURCE_PATH,
      sizeBytes: sourceBefore.size,
      lastModifiedAt: sourceBefore.mtime.toISOString(),
      readAt: new Date().toISOString(),
      sha256Before: sourceHashBefore,
      sha256After: sourceHashAfter,
      unchanged:
        sourceHashBefore === sourceHashAfter &&
        sourceBefore.size === sourceAfter.size &&
        sourceBefore.mtimeMs === sourceAfter.mtimeMs,
      workbookProtectionObserved: true,
      vbaProjectPresent: true,
    },
    workbookOrigin: {
      title: "Evonut Planilha de Nutrição",
      version: "011",
      creatorMetadata: "Joilson Aguiar",
      explicitLicenseFound: false,
      licenseStatus: "PENDING_LEGAL_REVIEW",
      restriction:
        "Não redistribuir o arquivo nem copiar VBA, macros, telas, fórmulas ou elementos visuais. Uso dos dados tabulares internos depende de validação da licença/origem.",
    },
    foods: {
      headerRow: parsed.foodHeaderRow,
      rawRecords: parsed.rawFoodRowCount,
      validRecords: parsed.validFoods.length,
      invalidRecords: parsed.invalidFoods.length,
      distinctCodes: new Set(allFoodIdentities.map((food) => food.code).filter(Boolean)).size,
      distinctOriginalNames: new Set(allFoodIdentities.map((food) => food.name).filter(Boolean)).size,
      distinctNormalizedNames: normalizedNameSources.size,
      missingCode: allFoodIdentities.filter((food) => !food.code).length,
      missingName: allFoodIdentities.filter((food) => !food.name).length,
      missingSource: allFoodIdentities.filter((food) => !food.source).length,
      duplicateSourceCodes,
      duplicateNamesWithinSource,
      repeatedNamesAcrossSources: repeatedAcrossSources,
      sources: counts(allFoodIdentities.map((food) => food.source)),
      groups: counts(allFoodIdentities.map((food) => food.group)),
      nutrientColumns: EVONUT_NUTRIENT_COLUMNS,
      missingNutrientsByName: parsed.missingNutrientsByName,
      invalidReasons: counts(parsed.invalidFoods.flatMap((food) => [...food.reasons])),
      decimals: {
        ooxmlNumericStorage: "ponto decimal",
        textWithComma: parsed.decimalCommaTextCount,
        textWithPoint: parsed.decimalPointTextCount,
      },
    },
    measures: {
      headerRow: parsed.measureHeaderRow,
      rawFoodRows: parsed.rawMeasureRowCount,
      distinctFoodCodes: parsed.distinctMeasureFoodCodes,
      foodCodesWithAtLeastOneFilledMeasure: new Set(
        [...parsed.measures, ...parsed.invalidMeasures].map((measure) => measure.foodSourceCode),
      ).size,
      missingFoodCodes: parsed.missingMeasureFoodCodes,
      duplicateFoodCodes: parsed.duplicateMeasureFoodCodes,
      foodCodesWithoutCorrespondenceInBdAlimentos:
        parsed.measureFoodCodesWithoutFoodRow,
      columns: parsed.measureHeaders.slice(1),
      filledByType: parsed.measureFilledByType,
      emptyCells: parsed.emptyMeasureCellCount,
      normalizedRecords: parsed.measures.length,
      invalidRecords: parsed.invalidMeasures.length,
      invalidReasons: counts(parsed.invalidMeasures.map((measure) => measure.reason)),
      zeroValues: parsed.invalidMeasures.filter((measure) => measure.reason === "VALOR_ZERO").length,
      negativeValues: parsed.invalidMeasures.filter(
        (measure) => measure.reason === "VALOR_NEGATIVO",
      ).length,
      nonNumericValues: parsed.invalidMeasures.filter(
        (measure) => measure.reason === "VALOR_NAO_NUMERICO",
      ).length,
      unitCounts: counts(parsed.measures.map((measure) => measure.measureUnit)),
      unitRule:
        "ml somente quando BD_Alimentos marca Unidade=ml; nos demais casos g, conforme o cabeçalho Quantidade (G). Não há conversão entre g e ml.",
    },
    masterDatabaseComparison: {
      masterFoodsAtAudit: masterFoods.length,
      alreadyExistingSafeMatches: safeMatches.length,
      exactSourceAndCodeAndName: safeMatches.filter(
        (row) => row.method === "SOURCE_CODE_AND_NAME",
      ).length,
      sameSourceAndCodeDifferentName: comparisons.filter(
        (row) =>
          row.method === "SOURCE_CODE_AND_NAME" &&
          !row.safe &&
          row.conflict === "CODIGO_COINCIDE_MAS_NOME_DIVERGE",
      ).length,
      sourceAndNormalizedName: safeMatches.filter(
        (row) => row.method === "SOURCE_NORMALIZED_NAME",
      ).length,
      possibleMatchesAnalysisOnly: probableMatches.length,
      noCorrespondence: unmatched.length,
      nutritionalConflictsOrIdentityConflicts: conflicts.length,
      nutritionalConflicts: safeMatches.filter((row) => row.conflict !== null).length,
      nonSafeIdentityCandidates: probableMatches.length,
      safelyLinkableMeasures: safeMeasures.length,
      sameNameDifferentSource: comparisons.filter(
        (row) => row.method === "NAME_DIFFERENT_SOURCE_ANALYSIS_ONLY",
      ).length,
      dryRunProposal: {
        create: plannedCreates.length,
        update: 0,
        ignoreExistingWithoutConflict: safeMatches.filter((row) => !row.conflict).length,
        rejectOrRequireReview: plannedRejects.length,
        note:
          "INSA, Tucunduva, Receitas e Meus Alimentos exigem decisão explícita de licença e modelagem de fonte antes de qualquer carga.",
      },
    },
    databaseIntegrity: {
      before: databaseBefore,
      after: databaseAfter,
      unchanged: JSON.stringify(databaseBefore) === JSON.stringify(databaseAfter),
    },
    safeImportProposal: {
      currentPhase: "AUDIT_ONLY",
      persistenceEnabled: false,
      supportedSourceKindsWithoutSchemaChange: ["TACO", "TBCA", "IBGE"],
      idempotencyKey: "originalNutritionSource + sourceCode, condicionado à validação da semântica do código Evonut",
      automaticMatchRules: [
        "fonte + código + nome normalizado concordantes",
        "fonte + nome normalizado único",
      ],
      forbiddenAutomaticMatch: "semelhança genérica de nome",
      missingValuesRemainNull: true,
      rollbackPlan:
        "Uma carga futura deverá registrar batchId e chaves criadas; rollback removerá somente registros desse batch. O modo atual não grava e, portanto, não requer rollback.",
    },
  };
  await writeFile(
    resolve(OUTPUT_DIRECTORY, "resumo-auditoria.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(summary, null, 2));
}

await main().finally(() => prisma.$disconnect());
