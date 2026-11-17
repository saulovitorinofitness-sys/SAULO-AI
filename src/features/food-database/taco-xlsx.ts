import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import * as XLSX from "@e965/xlsx";

import type {
  FoodNutrientIdentifier,
  FoodNutrientObservationDraft,
  FoodNutrientUnit,
} from "./contracts";
import type { LocalFoodPackage } from "./local-import";

const PRIMARY_SHEET = "CMVCol taco3";
const FATTY_ACIDS_SHEET = "AGtaco3";
const AMINO_ACIDS_SHEET = "Aminoácidos TACO3";
const NON_CATEGORY_LABELS = new Set(["numero do", "legenda"]);
const DATA_ORIGIN = "TACO, 4ª edição";

type SheetRow = readonly unknown[];

interface TacoNutrientColumn {
  readonly column: number;
  readonly nutrientKey: FoodNutrientIdentifier;
  readonly sourceNutrientName: string;
  readonly unit: FoodNutrientUnit;
}

const PRIMARY_NUTRIENT_COLUMNS = [
  { column: 2, nutrientKey: "additional:moisture", sourceNutrientName: "Umidade", unit: "source:%" },
  { column: 3, nutrientKey: "energyKcal", sourceNutrientName: "Energia", unit: "kcal" },
  { column: 4, nutrientKey: "additional:energyKj", sourceNutrientName: "Energia", unit: "kJ" },
  { column: 5, nutrientKey: "proteinGrams", sourceNutrientName: "Proteína", unit: "g" },
  { column: 6, nutrientKey: "fatsGrams", sourceNutrientName: "Lipídeos", unit: "g" },
  { column: 7, nutrientKey: "cholesterolMg", sourceNutrientName: "Colesterol", unit: "mg" },
  { column: 8, nutrientKey: "carbohydratesGrams", sourceNutrientName: "Carboidrato", unit: "g" },
  { column: 9, nutrientKey: "fiberGrams", sourceNutrientName: "Fibra alimentar", unit: "g" },
  { column: 10, nutrientKey: "additional:ash", sourceNutrientName: "Cinzas", unit: "g" },
  { column: 11, nutrientKey: "calciumMg", sourceNutrientName: "Cálcio", unit: "mg" },
  { column: 12, nutrientKey: "magnesiumMg", sourceNutrientName: "Magnésio", unit: "mg" },
  { column: 14, nutrientKey: "manganeseMg", sourceNutrientName: "Manganês", unit: "mg" },
  { column: 15, nutrientKey: "phosphorusMg", sourceNutrientName: "Fósforo", unit: "mg" },
  { column: 16, nutrientKey: "ironMg", sourceNutrientName: "Ferro", unit: "mg" },
  { column: 17, nutrientKey: "sodiumMg", sourceNutrientName: "Sódio", unit: "mg" },
  { column: 18, nutrientKey: "potassiumMg", sourceNutrientName: "Potássio", unit: "mg" },
  { column: 19, nutrientKey: "copperMg", sourceNutrientName: "Cobre", unit: "mg" },
  { column: 20, nutrientKey: "zincMg", sourceNutrientName: "Zinco", unit: "mg" },
  { column: 21, nutrientKey: "additional:retinol", sourceNutrientName: "Retinol", unit: "mcg" },
  { column: 22, nutrientKey: "additional:vitaminARe", sourceNutrientName: "Vitamina A (RE)", unit: "mcg" },
  { column: 23, nutrientKey: "vitaminAMcg", sourceNutrientName: "Vitamina A (RAE)", unit: "mcg" },
  { column: 24, nutrientKey: "thiamineMg", sourceNutrientName: "Tiamina", unit: "mg" },
  { column: 25, nutrientKey: "riboflavinMg", sourceNutrientName: "Riboflavina", unit: "mg" },
  { column: 26, nutrientKey: "vitaminB6Mg", sourceNutrientName: "Piridoxina", unit: "mg" },
  { column: 27, nutrientKey: "niacinMg", sourceNutrientName: "Niacina", unit: "mg" },
  { column: 28, nutrientKey: "vitaminCMg", sourceNutrientName: "Vitamina C", unit: "mg" },
] as const satisfies readonly TacoNutrientColumn[];

const FATTY_ACID_COLUMNS = [
  { column: 2, nutrientKey: "saturatedFatsGrams", sourceNutrientName: "Ácidos graxos saturados", unit: "g" },
  { column: 3, nutrientKey: "monounsaturatedFatsGrams", sourceNutrientName: "Ácidos graxos monoinsaturados", unit: "g" },
  { column: 4, nutrientKey: "polyunsaturatedFatsGrams", sourceNutrientName: "Ácidos graxos poli-insaturados", unit: "g" },
  { column: 5, nutrientKey: "additional:fattyAcid12_0", sourceNutrientName: "Ácido graxo 12:0", unit: "g" },
  { column: 6, nutrientKey: "additional:fattyAcid14_0", sourceNutrientName: "Ácido graxo 14:0", unit: "g" },
  { column: 7, nutrientKey: "additional:fattyAcid16_0", sourceNutrientName: "Ácido graxo 16:0", unit: "g" },
  { column: 8, nutrientKey: "additional:fattyAcid18_0", sourceNutrientName: "Ácido graxo 18:0", unit: "g" },
  { column: 9, nutrientKey: "additional:fattyAcid20_0", sourceNutrientName: "Ácido graxo 20:0", unit: "g" },
  { column: 10, nutrientKey: "additional:fattyAcid22_0", sourceNutrientName: "Ácido graxo 22:0", unit: "g" },
  { column: 11, nutrientKey: "additional:fattyAcid24_0", sourceNutrientName: "Ácido graxo 24:0", unit: "g" },
  { column: 13, nutrientKey: "additional:fattyAcid14_1", sourceNutrientName: "Ácido graxo 14:1", unit: "g" },
  { column: 14, nutrientKey: "additional:fattyAcid16_1", sourceNutrientName: "Ácido graxo 16:1", unit: "g" },
  { column: 15, nutrientKey: "additional:fattyAcid18_1", sourceNutrientName: "Ácido graxo 18:1", unit: "g" },
  { column: 16, nutrientKey: "additional:fattyAcid20_1", sourceNutrientName: "Ácido graxo 20:1", unit: "g" },
  { column: 17, nutrientKey: "additional:fattyAcid18_2n6", sourceNutrientName: "Ácido graxo 18:2 n-6", unit: "g" },
  { column: 18, nutrientKey: "additional:fattyAcid18_3n3", sourceNutrientName: "Ácido graxo 18:3 n-3", unit: "g" },
  { column: 19, nutrientKey: "additional:fattyAcid20_4", sourceNutrientName: "Ácido graxo 20:4", unit: "g" },
  { column: 20, nutrientKey: "additional:fattyAcid20_5", sourceNutrientName: "Ácido graxo 20:5", unit: "g" },
  { column: 21, nutrientKey: "additional:fattyAcid22_5", sourceNutrientName: "Ácido graxo 22:5", unit: "g" },
  { column: 22, nutrientKey: "additional:fattyAcid22_6", sourceNutrientName: "Ácido graxo 22:6", unit: "g" },
  { column: 23, nutrientKey: "additional:fattyAcid18_1t", sourceNutrientName: "Ácido graxo 18:1t", unit: "g" },
  { column: 24, nutrientKey: "additional:fattyAcid18_2t", sourceNutrientName: "Ácido graxo 18:2t", unit: "g" },
] as const satisfies readonly TacoNutrientColumn[];

const AMINO_ACID_COLUMNS = [
  { column: 2, nutrientKey: "additional:tryptophan", sourceNutrientName: "Triptofano", unit: "g" },
  { column: 3, nutrientKey: "additional:threonine", sourceNutrientName: "Treonina", unit: "g" },
  { column: 4, nutrientKey: "additional:isoleucine", sourceNutrientName: "Isoleucina", unit: "g" },
  { column: 5, nutrientKey: "additional:leucine", sourceNutrientName: "Leucina", unit: "g" },
  { column: 6, nutrientKey: "additional:lysine", sourceNutrientName: "Lisina", unit: "g" },
  { column: 7, nutrientKey: "additional:methionine", sourceNutrientName: "Metionina", unit: "g" },
  { column: 8, nutrientKey: "additional:cystine", sourceNutrientName: "Cistina", unit: "g" },
  { column: 9, nutrientKey: "additional:phenylalanine", sourceNutrientName: "Fenilalanina", unit: "g" },
  { column: 10, nutrientKey: "additional:tyrosine", sourceNutrientName: "Tirosina", unit: "g" },
  { column: 12, nutrientKey: "additional:valine", sourceNutrientName: "Valina", unit: "g" },
  { column: 13, nutrientKey: "additional:arginine", sourceNutrientName: "Arginina", unit: "g" },
  { column: 14, nutrientKey: "additional:histidine", sourceNutrientName: "Histidina", unit: "g" },
  { column: 15, nutrientKey: "additional:alanine", sourceNutrientName: "Alanina", unit: "g" },
  { column: 16, nutrientKey: "additional:asparticAcid", sourceNutrientName: "Ácido aspártico", unit: "g" },
  { column: 17, nutrientKey: "additional:glutamicAcid", sourceNutrientName: "Ácido glutâmico", unit: "g" },
  { column: 18, nutrientKey: "additional:glycine", sourceNutrientName: "Glicina", unit: "g" },
  { column: 19, nutrientKey: "additional:proline", sourceNutrientName: "Prolina", unit: "g" },
  { column: 20, nutrientKey: "additional:serine", sourceNutrientName: "Serina", unit: "g" },
] as const satisfies readonly TacoNutrientColumn[];

export interface TacoRejectedRow {
  readonly row: number;
  readonly code?: string;
  readonly reason: string;
}

export type TacoParsedFood = LocalFoodPackage["foods"][number] & {
  readonly nutrientObservations: readonly FoodNutrientObservationDraft[];
};

export type TacoFoodPackage = LocalFoodPackage & {
  readonly foods: TacoParsedFood[];
};

export interface TacoWorkbookResult {
  readonly package: TacoFoodPackage;
  readonly rejected: readonly TacoRejectedRow[];
  readonly warnings: readonly TacoRejectedRow[];
}

function normalizedMarker(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function rawCellValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function nutrientObservation(
  value: unknown,
  definition: TacoNutrientColumn,
  onWarning?: (reason: string) => void,
): FoodNutrientObservationDraft {
  const base = {
    nutrientKey: definition.nutrientKey,
    sourceNutrientName: definition.sourceNutrientName,
    rawValue: rawCellValue(value),
    unit: definition.unit,
    dataOrigin: DATA_ORIGIN,
  } as const;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(
        `${definition.sourceNutrientName} possui valor numérico inválido.`,
      );
    }
    return { ...base, qualifier: "VALUE", numericValue: value };
  }
  if (value !== null && value !== undefined && typeof value !== "string") {
    throw new Error(`${definition.sourceNutrientName} possui tipo inválido.`);
  }

  const text = rawCellValue(value).trim();
  const marker = normalizedMarker(text);
  if (!marker) {
    return { ...base, qualifier: "NOT_ANALYZED", numericValue: null };
  }
  if (marker === "tr") {
    return { ...base, qualifier: "TRACE", numericValue: null };
  }
  if (marker === "na") {
    return { ...base, qualifier: "NOT_APPLICABLE", numericValue: null };
  }
  if (marker === "*") {
    return { ...base, qualifier: "MISSING", numericValue: null };
  }

  const normalized = text.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    onWarning?.(
      `${definition.sourceNutrientName} possui valor não reconhecido: ${text}; preservado como ausente.`,
    );
    return { ...base, qualifier: "MISSING", numericValue: null };
  }
  return { ...base, qualifier: "VALUE", numericValue: parsed };
}

function rowsFromSheet(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`A planilha TACO não contém a aba obrigatória "${sheetName}".`);
  }
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as SheetRow[];
}

function foodCode(row: SheetRow) {
  const value = typeof row[0] === "number" ? row[0] : Number(String(row[0]));
  return Number.isInteger(value) && value > 0 ? String(value) : null;
}

function isFoodRow(row: SheetRow) {
  return Boolean(
    foodCode(row) &&
      typeof row[1] === "string" &&
      row[1].trim().length > 0,
  );
}

function categoryName(row: SheetRow) {
  if (typeof row[0] !== "string") return null;
  if (row[1] !== null && row[1] !== undefined && String(row[1]).trim()) {
    return null;
  }
  const name = row[0].trim();
  return name && !NON_CATEGORY_LABELS.has(normalizedMarker(name)) ? name : null;
}

function observationsForRow(
  row: SheetRow,
  definitions: readonly TacoNutrientColumn[],
  onWarning?: (reason: string) => void,
) {
  return definitions.map((definition) =>
    nutrientObservation(row[definition.column], definition, onWarning),
  );
}

function supplementalObservationsByCode(
  workbook: XLSX.WorkBook,
  sheetName: string,
  definitions: readonly TacoNutrientColumn[],
  warnings: TacoRejectedRow[],
) {
  const result = new Map<string, readonly FoodNutrientObservationDraft[]>();
  rowsFromSheet(workbook, sheetName).forEach((row, index) => {
    if (!isFoodRow(row)) return;
    const code = foodCode(row)!;
    result.set(
      code,
      observationsForRow(row, definitions, (reason) =>
        warnings.push({
          row: index + 1,
          code,
          reason: `${sheetName}: ${reason}`,
        }),
      ),
    );
  });
  return result;
}

function numericNutrient(
  observations: readonly FoodNutrientObservationDraft[],
  nutrientKey: FoodNutrientIdentifier,
) {
  const observation = observations.find(
    (candidate) => candidate.nutrientKey === nutrientKey,
  );
  return observation?.qualifier === "VALUE" ? observation.numericValue : null;
}

export function parseTacoWorkbook(
  bytes: Uint8Array,
  originalFileName = "Taco-4a-Edicao.xlsx",
): TacoWorkbookResult {
  const workbook = XLSX.read(bytes, { type: "buffer", raw: true });
  const rejected: TacoRejectedRow[] = [];
  const warnings: TacoRejectedRow[] = [];
  const fattyAcids = supplementalObservationsByCode(
    workbook,
    FATTY_ACIDS_SHEET,
    FATTY_ACID_COLUMNS,
    warnings,
  );
  const aminoAcids = supplementalObservationsByCode(
    workbook,
    AMINO_ACIDS_SHEET,
    AMINO_ACID_COLUMNS,
    warnings,
  );
  const foods: TacoParsedFood[] = [];
  let currentGroup: string | null = null;

  rowsFromSheet(workbook, PRIMARY_SHEET).forEach((row, index) => {
    const category = categoryName(row);
    if (category) {
      currentGroup = category;
      return;
    }
    if (!isFoodRow(row)) return;

    const code = foodCode(row)!;
    try {
      if (!currentGroup) throw new Error("grupo alimentar não identificado.");
      const officialName = String(row[1]).trim();
      const nutrientObservations = [
        ...observationsForRow(row, PRIMARY_NUTRIENT_COLUMNS, (reason) =>
          warnings.push({ row: index + 1, code, reason }),
        ),
        ...(fattyAcids.get(code) ?? []),
        ...(aminoAcids.get(code) ?? []),
      ];
      foods.push({
        sourceCode: code,
        officialName,
        category: currentGroup,
        foodGroup: currentGroup,
        referenceServingGrams: 100,
        referenceServingUnit: "g",
        nutrients: {
          energyKcal: numericNutrient(nutrientObservations, "energyKcal"),
          proteinGrams: numericNutrient(nutrientObservations, "proteinGrams"),
          fatsGrams: numericNutrient(nutrientObservations, "fatsGrams"),
          cholesterolMg: numericNutrient(nutrientObservations, "cholesterolMg"),
          carbohydratesGrams: numericNutrient(
            nutrientObservations,
            "carbohydratesGrams",
          ),
          fiberGrams: numericNutrient(nutrientObservations, "fiberGrams"),
          calciumMg: numericNutrient(nutrientObservations, "calciumMg"),
          magnesiumMg: numericNutrient(nutrientObservations, "magnesiumMg"),
          manganeseMg: numericNutrient(nutrientObservations, "manganeseMg"),
          phosphorusMg: numericNutrient(nutrientObservations, "phosphorusMg"),
          ironMg: numericNutrient(nutrientObservations, "ironMg"),
          sodiumMg: numericNutrient(nutrientObservations, "sodiumMg"),
          potassiumMg: numericNutrient(nutrientObservations, "potassiumMg"),
          copperMg: numericNutrient(nutrientObservations, "copperMg"),
          zincMg: numericNutrient(nutrientObservations, "zincMg"),
          vitaminAMcg: numericNutrient(nutrientObservations, "vitaminAMcg"),
          thiamineMg: numericNutrient(nutrientObservations, "thiamineMg"),
          riboflavinMg: numericNutrient(nutrientObservations, "riboflavinMg"),
          vitaminB6Mg: numericNutrient(nutrientObservations, "vitaminB6Mg"),
          niacinMg: numericNutrient(nutrientObservations, "niacinMg"),
          vitaminCMg: numericNutrient(nutrientObservations, "vitaminCMg"),
          saturatedFatsGrams: numericNutrient(
            nutrientObservations,
            "saturatedFatsGrams",
          ),
          monounsaturatedFatsGrams: numericNutrient(
            nutrientObservations,
            "monounsaturatedFatsGrams",
          ),
          polyunsaturatedFatsGrams: numericNutrient(
            nutrientObservations,
            "polyunsaturatedFatsGrams",
          ),
        },
        nutrientObservations,
        householdMeasures: [],
        synonyms: [],
      });
    } catch (error) {
      rejected.push({
        row: index + 1,
        code,
        reason: error instanceof Error ? error.message : "linha inválida.",
      });
    }
  });

  if (!foods.length) {
    throw new Error("Nenhum alimento válido foi encontrado na planilha TACO.");
  }

  return {
    package: {
      source: {
        kind: "TACO",
        name: "TACO",
        version: "4ª edição",
        reference: originalFileName,
        origin: "OFFICIAL",
      },
      foods,
    },
    rejected,
    warnings,
  };
}

export async function readTacoWorkbook(filePath: string) {
  return parseTacoWorkbook(await readFile(filePath), basename(filePath));
}
