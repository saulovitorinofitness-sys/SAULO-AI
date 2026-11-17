import { createHash } from "node:crypto";

import * as XLSX from "@e965/xlsx";

import { normalizeFoodSearchText } from "./normalization";

export const EVONUT_AUTHORIZED_SHEETS = ["BD_Alimentos", "BD_Medidas"] as const;
export const EVONUT_SOURCE_VERSION = "Evonut 011";
export const EVONUT_MISSING_SOURCE_GROUP = "Grupo não informado na origem";

const FOOD_LAST_COLUMN = 44; // AS; ignora areas auxiliares da planilha.
const MEASURE_LAST_COLUMN = 38; // AM.

export const EVONUT_NUTRIENT_COLUMNS = [
  "Energia",
  "Proteína",
  "Lipídeos totais",
  "Carboidrato",
  "Fibra alimentar",
  "Cálcio",
  "Magnésio",
  "Manganês",
  "Fósforo",
  "Ferro",
  "Sódio",
  "Sódio de adição",
  "Potássio",
  "Cobre",
  "Zinco",
  "Selênio",
  "Retinol",
  "Vitamina A (RE)",
  "Vitamina B1 (Tiamina)",
  "Vitamina B2 (Riboflavina)",
  "Vitamina B3 (Niacina)",
  "Equivalente a Vitamina B3",
  "Vitamina B6 (Piridoxina)",
  "Vitamina B12 (Cobalamina)",
  "Vitamina B9 (Folato)",
  "Vitamina D (Calciferol)",
  "Vitamina E (Tocoferol)",
  "Vitamina C (Ácido ascórbico)",
  "Colesterol",
  "G. saturada",
  "G. monoinsaturada",
  "G. poliinsaturada",
  "G. poliinsaturada 18:2",
  "G. poliinsaturada 18:3",
  "G. trans total",
  "Açúcar total",
  "Açúcar de adição",
] as const;

type CellValue = string | number | boolean | null;
type SheetRow = readonly CellValue[];

export interface EvonutFoodRow {
  readonly spreadsheetRow: number;
  readonly sourceCode: string;
  readonly originalName: string;
  readonly normalizedName: string;
  readonly originalSource: string;
  readonly group: string;
  readonly referenceQuantity: number | null;
  readonly referenceUnit: "g" | "ml";
  readonly standardMeasure: string | null;
  readonly nutrients: Readonly<Record<string, number | null>>;
  readonly missingNutrients: readonly string[];
}

export interface EvonutInvalidFoodRow {
  readonly spreadsheetRow: number;
  readonly sourceCode: string;
  readonly originalName: string;
  readonly originalSource: string;
  readonly group: string;
  readonly reasons: readonly string[];
}

export interface EvonutMeasureRow {
  readonly spreadsheetRow: number;
  readonly foodSourceCode: string;
  readonly foodName: string;
  readonly measureName: string;
  readonly measureValue: number;
  readonly measureUnit: "g" | "ml";
  readonly source: string;
  readonly originalNutritionSource: string;
  readonly sourceVersion: string;
}

export interface EvonutInvalidMeasureRow {
  readonly spreadsheetRow: number;
  readonly foodSourceCode: string;
  readonly measureName: string;
  readonly rawValue: string;
  readonly reason: string;
}

export interface EvonutAuditParseResult {
  readonly sourceSha256: string;
  readonly foodHeaderRow: number;
  readonly measureHeaderRow: number;
  readonly foodHeaders: readonly string[];
  readonly measureHeaders: readonly string[];
  readonly validFoods: readonly EvonutFoodRow[];
  readonly invalidFoods: readonly EvonutInvalidFoodRow[];
  readonly measures: readonly EvonutMeasureRow[];
  readonly invalidMeasures: readonly EvonutInvalidMeasureRow[];
  readonly rawFoodRowCount: number;
  readonly rawMeasureRowCount: number;
  readonly distinctMeasureFoodCodes: number;
  readonly missingMeasureFoodCodes: number;
  readonly duplicateMeasureFoodCodes: number;
  readonly measureFoodCodesWithoutFoodRow: number;
  readonly emptyMeasureCellCount: number;
  readonly measureFilledByType: Readonly<Record<string, number>>;
  readonly missingNutrientsByName: Readonly<Record<string, number>>;
  readonly decimalCommaTextCount: number;
  readonly decimalPointTextCount: number;
}

export interface MasterFoodAuditSnapshot {
  readonly id: string;
  readonly sourceCode: string | null;
  readonly officialName: string;
  readonly normalizedName: string;
  readonly foodGroup: string;
  readonly sourceName: string;
  readonly sourceKind: string;
  readonly nutrients: Readonly<Record<string, number | null>>;
}

export type EvonutMatchMethod =
  | "SOURCE_CODE_AND_NAME"
  | "SOURCE_NORMALIZED_NAME"
  | "NAME_GROUP_ANALYSIS_ONLY"
  | "NAME_DIFFERENT_SOURCE_ANALYSIS_ONLY"
  | "NONE";

export interface EvonutMasterComparisonRow {
  readonly food: EvonutFoodRow;
  readonly masterFoodId: string | null;
  readonly masterFoodName: string | null;
  readonly masterSource: string | null;
  readonly method: EvonutMatchMethod;
  readonly safe: boolean;
  readonly conflict: string | null;
}

const MASTER_NUTRIENT_MAPPING: Readonly<Record<string, string>> = {
  Energia: "energyKcal",
  "Proteína": "proteinGrams",
  "Lipídeos totais": "fatsGrams",
  Carboidrato: "carbohydratesGrams",
  "Fibra alimentar": "fiberGrams",
  "Cálcio": "calciumMg",
  "Magnésio": "magnesiumMg",
  "Manganês": "manganeseMg",
  "Fósforo": "phosphorusMg",
  Ferro: "ironMg",
  "Sódio": "sodiumMg",
  "Potássio": "potassiumMg",
  Cobre: "copperMg",
  Zinco: "zincMg",
  "Selênio": "seleniumMcg",
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
};

function normalizedSourceValues(food: MasterFoodAuditSnapshot) {
  return new Set([
    normalizeFoodSearchText(food.sourceName),
    normalizeFoodSearchText(food.sourceKind),
  ]);
}

function nutrientConflict(food: EvonutFoodRow, master: MasterFoodAuditSnapshot) {
  const differences: string[] = [];
  for (const [evonutName, masterName] of Object.entries(MASTER_NUTRIENT_MAPPING)) {
    const left = food.nutrients[evonutName];
    const right = master.nutrients[masterName];
    if (left === null || right === null || left === undefined || right === undefined) continue;
    const absolute = Math.abs(left - right);
    const relative = absolute / Math.max(Math.abs(left), Math.abs(right), 1);
    if (absolute > 0.1 && relative > 0.01) {
      differences.push(`${evonutName}:${left}!=${right}`);
    }
  }
  return differences.length ? differences.join("|") : null;
}

export function compareEvonutWithMaster(
  foods: readonly EvonutFoodRow[],
  masterFoods: readonly MasterFoodAuditSnapshot[],
): readonly EvonutMasterComparisonRow[] {
  return foods.map((food) => {
    const source = normalizeFoodSearchText(food.originalSource);
    const sameSource = masterFoods.filter((candidate) =>
      normalizedSourceValues(candidate).has(source),
    );
    const codeCandidates = sameSource.filter(
      (candidate) => candidate.sourceCode === food.sourceCode,
    );
    const exactCodeAndName = codeCandidates.find(
      (candidate) => candidate.normalizedName === food.normalizedName,
    );
    if (exactCodeAndName) {
      return {
        food,
        masterFoodId: exactCodeAndName.id,
        masterFoodName: exactCodeAndName.officialName,
        masterSource: exactCodeAndName.sourceName,
        method: "SOURCE_CODE_AND_NAME" as const,
        safe: true,
        conflict: nutrientConflict(food, exactCodeAndName),
      };
    }
    if (codeCandidates.length) {
      const candidate = codeCandidates[0];
      return {
        food,
        masterFoodId: candidate.id,
        masterFoodName: candidate.officialName,
        masterSource: candidate.sourceName,
        method: "SOURCE_CODE_AND_NAME" as const,
        safe: false,
        conflict: "CODIGO_COINCIDE_MAS_NOME_DIVERGE",
      };
    }
    const sourceNameCandidates = sameSource.filter(
      (candidate) => candidate.normalizedName === food.normalizedName,
    );
    if (sourceNameCandidates.length === 1) {
      const candidate = sourceNameCandidates[0];
      return {
        food,
        masterFoodId: candidate.id,
        masterFoodName: candidate.officialName,
        masterSource: candidate.sourceName,
        method: "SOURCE_NORMALIZED_NAME" as const,
        safe: true,
        conflict: nutrientConflict(food, candidate),
      };
    }
    const sameNameAndGroup = masterFoods.filter(
      (candidate) =>
        candidate.normalizedName === food.normalizedName &&
        normalizeFoodSearchText(candidate.foodGroup) === normalizeFoodSearchText(food.group),
    );
    if (sameNameAndGroup.length) {
      const candidate = sameNameAndGroup[0];
      return {
        food,
        masterFoodId: candidate.id,
        masterFoodName: candidate.officialName,
        masterSource: candidate.sourceName,
        method: "NAME_GROUP_ANALYSIS_ONLY" as const,
        safe: false,
        conflict: "CORRESPONDENCIA_ANALITICA_SEM_FONTE_COMPATIVEL",
      };
    }
    const sameName = masterFoods.find(
      (candidate) => candidate.normalizedName === food.normalizedName,
    );
    if (sameName) {
      return {
        food,
        masterFoodId: sameName.id,
        masterFoodName: sameName.officialName,
        masterSource: sameName.sourceName,
        method: "NAME_DIFFERENT_SOURCE_ANALYSIS_ONLY" as const,
        safe: false,
        conflict: "NOME_SEMELHANTE_MAS_FONTE_DIFERENTE",
      };
    }
    return {
      food,
      masterFoodId: null,
      masterFoodName: null,
      masterSource: null,
      method: "NONE" as const,
      safe: false,
      conflict: null,
    };
  });
}

function text(value: CellValue | undefined) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function finiteNumber(value: CellValue | undefined) {
  if (value === null || value === undefined || text(value) === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const parsed = Number(text(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function rowsFromSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  lastColumn: number,
) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`A aba obrigatória ${sheetName} não foi encontrada.`);
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    range: { s: { r: 0, c: 0 }, e: { r: range.e.r, c: lastColumn } },
  }) as SheetRow[];
}

function headerIndex(rows: readonly SheetRow[], expected: string) {
  const index = rows.findIndex((row) => text(row[0]) === expected);
  if (index < 0) throw new Error(`Cabeçalho "${expected}" não encontrado.`);
  return index;
}

function countDecimalText(value: CellValue | undefined) {
  if (typeof value !== "string") return { comma: 0, point: 0 };
  const compact = value.trim();
  return {
    comma: /^-?\d+,\d+$/.test(compact) ? 1 : 0,
    point: /^-?\d+\.\d+$/.test(compact) ? 1 : 0,
  };
}

export function parseEvonutWorkbook(
  bytes: Uint8Array,
  options: { readonly allowMissingGroupForSourceCodes?: readonly string[] } = {},
): EvonutAuditParseResult {
  const workbook = XLSX.read(bytes, {
    type: "buffer",
    raw: true,
    bookVBA: false,
    cellFormula: false,
    sheets: [...EVONUT_AUTHORIZED_SHEETS],
  });
  const foodRows = rowsFromSheet(workbook, "BD_Alimentos", FOOD_LAST_COLUMN);
  const measureRows = rowsFromSheet(workbook, "BD_Medidas", MEASURE_LAST_COLUMN);
  const foodHeaderIndex = headerIndex(foodRows, "Código");
  const measureHeaderIndex = headerIndex(measureRows, "Código do alimento");
  const foodHeaders = foodRows[foodHeaderIndex].map(text);
  const measureHeaders = measureRows[measureHeaderIndex].map(text);
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  const validFoods: EvonutFoodRow[] = [];
  const invalidFoods: EvonutInvalidFoodRow[] = [];
  const allowedMissingGroupCodes = new Set(options.allowMissingGroupForSourceCodes ?? []);
  const missingNutrientsByName: Record<string, number> = {};
  let decimalCommaTextCount = 0;
  let decimalPointTextCount = 0;

  const populatedFoodRows = foodRows
    .slice(foodHeaderIndex + 1)
    .map((row, offset) => ({ row, spreadsheetRow: foodHeaderIndex + offset + 2 }))
    .filter(({ row }) => row.some((value) => text(value) !== ""));

  for (const { row, spreadsheetRow } of populatedFoodRows) {
    const sourceCode = text(row[0]);
    const originalName = text(row[1]);
    const originalSource = text(row[2]);
    const sourceGroup = text(row[3]);
    const group = sourceGroup || (
      allowedMissingGroupCodes.has(sourceCode) ? EVONUT_MISSING_SOURCE_GROUP : ""
    );
    const reasons: string[] = [];
    if (!sourceCode) reasons.push("CODIGO_AUSENTE");
    if (!originalName) reasons.push("NOME_AUSENTE");
    if (!originalSource) reasons.push("FONTE_AUSENTE");
    if (!group) reasons.push("GRUPO_AUSENTE");

    const referenceQuantity = finiteNumber(row[5]);
    if (referenceQuantity === null) reasons.push("QUANTIDADE_REFERENCIA_AUSENTE");
    else if (!Number.isFinite(referenceQuantity) || referenceQuantity <= 0) {
      reasons.push("QUANTIDADE_REFERENCIA_INVALIDA");
    }

    const nutrients: Record<string, number | null> = {};
    const missingNutrients: string[] = [];
    EVONUT_NUTRIENT_COLUMNS.forEach((name, nutrientIndex) => {
      const value = row[6 + nutrientIndex];
      const decimal = countDecimalText(value);
      decimalCommaTextCount += decimal.comma;
      decimalPointTextCount += decimal.point;
      const parsed = finiteNumber(value);
      if (parsed === null) {
        nutrients[name] = null;
        missingNutrients.push(name);
        missingNutrientsByName[name] = (missingNutrientsByName[name] ?? 0) + 1;
      } else if (!Number.isFinite(parsed) || parsed < 0) {
        nutrients[name] = null;
        reasons.push(`NUTRIENTE_INVALIDO:${name}`);
      } else {
        nutrients[name] = parsed;
      }
    });

    if (reasons.length) {
      invalidFoods.push({
        spreadsheetRow,
        sourceCode,
        originalName,
        originalSource,
        group,
        reasons,
      });
      continue;
    }
    validFoods.push({
      spreadsheetRow,
      sourceCode,
      originalName,
      normalizedName: normalizeFoodSearchText(originalName),
      originalSource,
      group,
      referenceQuantity,
      referenceUnit: text(row[44]).toLocaleLowerCase("pt-BR") === "ml" ? "ml" : "g",
      standardMeasure: text(row[43]) || null,
      nutrients,
      missingNutrients,
    });
  }

  const foodByCode = new Map(validFoods.map((food) => [food.sourceCode, food]));
  const invalidCodeSet = new Set(invalidFoods.map((food) => food.sourceCode).filter(Boolean));
  const measures: EvonutMeasureRow[] = [];
  const invalidMeasures: EvonutInvalidMeasureRow[] = [];
  const measureFilledByType: Record<string, number> = {};
  let emptyMeasureCellCount = 0;
  const populatedMeasureRows = measureRows
    .slice(measureHeaderIndex + 1)
    .map((row, offset) => ({ row, spreadsheetRow: measureHeaderIndex + offset + 2 }))
    .filter(({ row }) => row.some((value) => text(value) !== ""));
  const rawMeasureFoodCodes = populatedMeasureRows.map(({ row }) => text(row[0]));
  const allFoodCodes = new Set(
    [...validFoods, ...invalidFoods].map((food) => food.sourceCode).filter(Boolean),
  );

  for (const { row, spreadsheetRow } of populatedMeasureRows) {
    const foodSourceCode = text(row[0]);
    for (let column = 1; column <= MEASURE_LAST_COLUMN; column += 1) {
      const measureName = measureHeaders[column];
      const rawValue = row[column];
      if (text(rawValue) === "") {
        emptyMeasureCellCount += 1;
        continue;
      }
      measureFilledByType[measureName] = (measureFilledByType[measureName] ?? 0) + 1;
      const parsed = finiteNumber(rawValue);
      let reason = "";
      if (!foodSourceCode) reason = "CODIGO_ALIMENTO_AUSENTE";
      else if (!foodByCode.has(foodSourceCode)) {
        reason = invalidCodeSet.has(foodSourceCode)
          ? "ALIMENTO_INVALIDO_NA_BD_ALIMENTOS"
          : "CODIGO_SEM_CORRESPONDENCIA_NA_BD_ALIMENTOS";
      } else if (parsed === null || !Number.isFinite(parsed)) reason = "VALOR_NAO_NUMERICO";
      else if (parsed === 0) reason = "VALOR_ZERO";
      else if (parsed < 0) reason = "VALOR_NEGATIVO";
      if (reason) {
        invalidMeasures.push({
          spreadsheetRow,
          foodSourceCode,
          measureName,
          rawValue: text(rawValue),
          reason,
        });
        continue;
      }
      const food = foodByCode.get(foodSourceCode)!;
      measures.push({
        spreadsheetRow,
        foodSourceCode,
        foodName: food.originalName,
        measureName,
        measureValue: parsed!,
        measureUnit: food.referenceUnit,
        source: `EVONUT + ${food.originalSource}`,
        originalNutritionSource: food.originalSource,
        sourceVersion: EVONUT_SOURCE_VERSION,
      });
    }
  }

  return {
    sourceSha256,
    foodHeaderRow: foodHeaderIndex + 1,
    measureHeaderRow: measureHeaderIndex + 1,
    foodHeaders,
    measureHeaders,
    validFoods,
    invalidFoods,
    measures,
    invalidMeasures,
    rawFoodRowCount: populatedFoodRows.length,
    rawMeasureRowCount: populatedMeasureRows.length,
    distinctMeasureFoodCodes: new Set(rawMeasureFoodCodes.filter(Boolean)).size,
    missingMeasureFoodCodes: rawMeasureFoodCodes.filter((code) => !code).length,
    duplicateMeasureFoodCodes:
      rawMeasureFoodCodes.filter(Boolean).length -
      new Set(rawMeasureFoodCodes.filter(Boolean)).size,
    measureFoodCodesWithoutFoodRow: new Set(
      rawMeasureFoodCodes.filter((code) => code && !allFoodCodes.has(code)),
    ).size,
    emptyMeasureCellCount,
    measureFilledByType,
    missingNutrientsByName,
    decimalCommaTextCount,
    decimalPointTextCount,
  };
}
