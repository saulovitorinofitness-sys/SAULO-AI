import { createHash } from "node:crypto";

import * as XLSX from "@e965/xlsx";

import {
  EVONUT_NUTRIENT_COLUMNS,
  EVONUT_SOURCE_VERSION,
} from "../food-database/evonut-audit";

const SOURCE_PATH = "data/imports/food/raw/Evonut.xlsm";
const REQUIRED_SHEETS = [
  "BD_Cadastros",
  "BD_Cad_Dietas",
  "BD_Alimentos",
  "BD_Medidas",
] as const;

const SOURCE_RANGES = {
  recipes: "BD_Cadastros!A3:H91",
  ingredients: "BD_Cad_Dietas!A3:M244",
  foodHeader: "BD_Alimentos!A3:AS3",
  foodCodeIndex: "BD_Alimentos!A4:A7892",
  measureHeader: "BD_Medidas!A3:AM3",
  measureCodeIndex: "BD_Medidas!A4:A7892",
} as const;

const RECIPE_HEADERS = [
  "Código",
  "Descrição",
  "Tipo de Cadastro",
  "Informação nutricional / SubTipo",
  "Info / Categoria",
  "Anamnese / Modo de preparo / Prescrição / Orientação",
  "Foto",
  "Cód Alimento/receita",
] as const;

const INGREDIENT_HEADERS = [
  "Código Cadastro",
  "Observações",
  "Nº Refeição",
  "Horário Refeição",
  "Desc. Refeição",
  "Cat. Refeição",
  "Código Alimento",
  "Medida",
  "Qtde",
  "ID",
  "Chave",
  "Desc Alimento",
  "Total (g)",
] as const;

type CellValue = string | number | boolean | null;
type ResolvedUnit = "g" | "ml";
type NutrientName = (typeof EVONUT_NUTRIENT_COLUMNS)[number];

export interface EvonutSourceLocation {
  readonly sheet: (typeof REQUIRED_SHEETS)[number];
  readonly row: number;
  readonly range: string;
}

export interface EvonutRecipePending {
  readonly code:
    | "PREPARATION_ABSENT"
    | "PREPARATION_TIME_ABSENT"
    | "YIELD_ABSENT"
    | "YIELD_WEIGHT_NOT_EXPLICIT"
    | "MULTIPLE_YIELD_OPTIONS"
    | "YIELD_MEASURE_NOT_FOUND_IN_DERIVED_REFERENCE"
    | "YIELD_RECONCILIATION_BLOCKED_BY_MIXED_UNITS"
    | "YIELD_WEIGHT_CONFLICT"
    | "FOOD_LINK_UNRESOLVED"
    | "DERIVED_RECIPE_FOOD_EXCLUDED"
    | "HOUSEHOLD_MEASURE_UNRESOLVED"
    | "INGREDIENT_QUANTITY_ABSENT"
    | "INGREDIENT_QUANTITY_INVALID"
    | "FOOD_REFERENCE_QUANTITY_ABSENT"
    | "FOOD_REFERENCE_QUANTITY_INVALID"
    | "FOOD_REFERENCE_UNIT_INVALID"
    | "DERIVED_RECIPE_REFERENCE_UNRESOLVED"
    | "DERIVED_RECIPE_REFERENCE_CONFLICT";
  readonly message: string;
  readonly sourceLocations: readonly string[];
  readonly details?: Readonly<Record<string, string | number | null>>;
}

export interface EvonutExplicitYieldOption {
  readonly portions: number;
  readonly portionLabel: string;
  readonly portionWeight: {
    readonly value: number;
    readonly unit: ResolvedUnit;
  } | null;
  readonly totalWeight: {
    readonly value: number;
    readonly unit: ResolvedUnit;
  } | null;
}

export interface EvonutRecipeYield {
  readonly originalText: string | null;
  readonly portions: number | null;
  readonly portionLabel: string | null;
  readonly portionWeight: {
    readonly value: number;
    readonly unit: ResolvedUnit;
  } | null;
  readonly totalWeight: {
    readonly value: number;
    readonly unit: ResolvedUnit;
  } | null;
  readonly options: readonly EvonutExplicitYieldOption[];
}

export interface EvonutRecipeIngredient {
  readonly order: number;
  readonly originalKey: string | null;
  readonly originalId: string | null;
  readonly originalFoodName: string;
  readonly observation: string | null;
  readonly foodCode: string;
  readonly foodSource: string | null;
  readonly catalogFoodName: string | null;
  readonly informedQuantity: {
    readonly raw: CellValue;
    readonly value: number | null;
  };
  readonly householdMeasure: string;
  readonly resolvedEquivalence: {
    readonly amount: number | null;
    readonly unit: ResolvedUnit | null;
    readonly measureValue: number | null;
    readonly method: "DIRECT_SOURCE_UNIT" | "BD_MEDIDAS" | null;
    readonly sourceLocation: string | null;
  };
  readonly nutritionReference: {
    readonly quantity: number | null;
    readonly unit: ResolvedUnit | null;
    readonly rawUnit: string | null;
    readonly sourceLocation: string | null;
  };
  readonly sourceLocation: EvonutSourceLocation;
  readonly foodSourceLocation: EvonutSourceLocation | null;
}

export interface EvonutLegacyNutritionComparison {
  readonly comparisonOnly: true;
  readonly validatedCalculation: false;
  readonly originalText: string | null;
  readonly textTotals: {
    readonly energyKcal: number | null;
    readonly proteinGrams: number | null;
    readonly proteinPercent: number | null;
    readonly fatsGrams: number | null;
    readonly fatsPercent: number | null;
    readonly carbohydratesGrams: number | null;
    readonly carbohydratesPercent: number | null;
  };
  readonly derivedFood: {
    readonly sourceCode: string;
    readonly sourceName: string;
    readonly referenceQuantity: number | null;
    readonly referenceUnit: ResolvedUnit | null;
    readonly rawReferenceUnit: string | null;
    readonly nutrients: Readonly<Record<NutrientName, number | null>>;
    readonly sourceLocation: EvonutSourceLocation;
  } | null;
  readonly derivedMeasures: readonly {
    readonly measure: string;
    readonly value: number;
    readonly unit: ResolvedUnit | null;
    readonly sourceLocation: string;
  }[];
}

export interface EvonutRecipe {
  readonly originalCode: string;
  readonly name: string;
  readonly derivedFoodCode: string | null;
  readonly ingredients: readonly EvonutRecipeIngredient[];
  readonly detailsText: string | null;
  readonly preparationText: string | null;
  readonly preparationTimeText: string | null;
  readonly yield: EvonutRecipeYield;
  readonly legacyNutrition: EvonutLegacyNutritionComparison;
  readonly pendings: readonly EvonutRecipePending[];
  readonly sourceLocation: EvonutSourceLocation;
  readonly contentSha256: string;
}

export interface EvonutRecipeParseResult {
  readonly metadata: {
    readonly sourcePath: string;
    readonly sourceVersion: string;
    readonly sourceSha256: string;
    readonly contentSha256: string;
    readonly sheetsRead: readonly (typeof REQUIRED_SHEETS)[number][];
    readonly sourceRanges: typeof SOURCE_RANGES;
    readonly macrosExecuted: false;
  };
  readonly recipes: readonly EvonutRecipe[];
  readonly counts: {
    readonly recipes: number;
    readonly ingredients: number;
    readonly distinctFoodCodes: number;
    readonly grams: number;
    readonly milliliters: number;
    readonly unresolvedFoodLinks: number;
    readonly unresolvedEquivalences: number;
    readonly excludedDerivedRecipeIngredients: number;
  };
}

interface IndexedFood {
  readonly row: number;
  readonly code: string;
  readonly name: string;
  readonly source: string;
  readonly referenceQuantity: number | null;
  readonly referenceUnit: ResolvedUnit | null;
  readonly rawReferenceUnit: string | null;
  readonly nutrients: Readonly<Record<NutrientName, number | null>>;
}

function cellText(value: CellValue | undefined) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function nullableText(value: CellValue | undefined) {
  const valueText = cellText(value);
  return valueText || null;
}

function parseNumber(value: CellValue | undefined) {
  if (value === null || value === undefined || cellText(value) === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = cellText(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePtBrDecimal(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

function singularMeasure(value: string) {
  return normalizeText(value)
    .replace(/oes$/u, "ao")
    .replace(/([a-z])s$/u, "$1");
}

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sheetLocation(
  sheet: EvonutSourceLocation["sheet"],
  row: number,
  firstColumn: string,
  lastColumn: string,
): EvonutSourceLocation {
  return { sheet, row, range: `${sheet}!${firstColumn}${row}:${lastColumn}${row}` };
}

function requiredSheet(workbook: XLSX.WorkBook, sheetName: EvonutSourceLocation["sheet"]) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`A aba obrigatória ${sheetName} não foi encontrada.`);
  return sheet;
}

function matrixFromRange(sheet: XLSX.WorkSheet, range: string) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    range,
  }) as CellValue[][];
}

function rowFromSheet(
  sheet: XLSX.WorkSheet,
  row: number,
  firstColumn: string,
  lastColumn: string,
) {
  return matrixFromRange(sheet, `${firstColumn}${row}:${lastColumn}${row}`)[0] ?? [];
}

function assertHeaders(actual: readonly CellValue[], expected: readonly string[], sheet: string) {
  expected.forEach((header, index) => {
    if (cellText(actual[index]) !== header) {
      throw new Error(
        `Cabeçalho inesperado em ${sheet}: esperado "${header}" na coluna ${index + 1}.`,
      );
    }
  });
}

function buildCodeRowIndex(sheet: XLSX.WorkSheet, firstRow: number, lastRow: number) {
  const rows = matrixFromRange(sheet, `A${firstRow}:A${lastRow}`);
  const result = new Map<string, number>();
  rows.forEach((row, offset) => {
    const code = cellText(row[0]);
    if (code && !result.has(code)) result.set(code, firstRow + offset);
  });
  return result;
}

function resolveReferenceUnit(rawUnit: string | null): ResolvedUnit | null {
  if (!rawUnit) return "g";
  const normalized = normalizeText(rawUnit);
  if (normalized === "g" || normalized === "ml") return normalized;
  return null;
}

function indexedFoodFromRow(row: readonly CellValue[], spreadsheetRow: number): IndexedFood {
  const nutrients = Object.fromEntries(
    EVONUT_NUTRIENT_COLUMNS.map((name, index) => [name, parseNumber(row[6 + index])]),
  ) as Record<NutrientName, number | null>;
  const rawReferenceUnit = nullableText(row[44]);
  return {
    row: spreadsheetRow,
    code: cellText(row[0]),
    name: cellText(row[1]),
    source: cellText(row[2]),
    referenceQuantity: parseNumber(row[5]),
    referenceUnit: resolveReferenceUnit(rawReferenceUnit),
    rawReferenceUnit,
    nutrients,
  };
}

function parseLegacyNutritionText(originalText: string | null) {
  const total = (pattern: RegExp) => parsePtBrDecimal(originalText?.match(pattern)?.[1]);
  return {
    energyKcal: total(/([\d.,]+)\s*kcal/i),
    proteinGrams: total(/Ptn:\s*([\d.,]+)\s*g/i),
    proteinPercent: total(/Ptn:[^()]*\(([\d.,]+)%\)/i),
    fatsGrams: total(/Lip:\s*([\d.,]+)\s*g/i),
    fatsPercent: total(/Lip:[^()]*\(([\d.,]+)%\)/i),
    carbohydratesGrams: total(/Cho:\s*([\d.,]+)\s*g/i),
    carbohydratesPercent: total(/Cho:[^()]*\(([\d.,]+)%\)/i),
  };
}

function labeledLine(text: string | null, label: string) {
  if (!text) return null;
  const match = text.match(new RegExp(`${label}:\\s*([^\\r\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
}

function yieldOptions(originalText: string | null): readonly EvonutExplicitYieldOption[] {
  if (!originalText) return [];
  const clean = originalText.replace(/\s+aproximadamente\s*$/i, "").trim();
  const weightedPattern =
    /(\d+(?:[.,]\d+)?)\s+(.+?)\s+de\s+(\d+(?:[.,]\d+)?)\s*(g|ml)(?=\s+ou\s+|$)/giu;
  const weighted = [...clean.matchAll(weightedPattern)].map((match) => {
    const portions = parsePtBrDecimal(match[1]) ?? 0;
    const value = parsePtBrDecimal(match[3]) ?? 0;
    const unit = normalizeText(match[4]) as ResolvedUnit;
    return {
      portions,
      portionLabel: match[2].trim(),
      portionWeight: { value, unit },
      totalWeight: { value: portions * value, unit },
    };
  });
  if (weighted.length) return weighted;
  const countOnly = clean.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/u);
  if (!countOnly) return [];
  const portions = parsePtBrDecimal(countOnly[1]);
  if (portions === null) return [];
  return [
    {
      portions,
      portionLabel: countOnly[2].trim(),
      portionWeight: null,
      totalWeight: null,
    },
  ];
}

function recipeYield(detailsText: string | null): EvonutRecipeYield {
  const originalText = labeledLine(detailsText, "Rendimento");
  const options = yieldOptions(originalText);
  const single = options.length === 1 ? options[0] : null;
  return {
    originalText,
    portions: single?.portions ?? null,
    portionLabel: single?.portionLabel ?? null,
    portionWeight: single?.portionWeight ?? null,
    totalWeight: single?.totalWeight ?? null,
    options,
  };
}

function pending(
  code: EvonutRecipePending["code"],
  message: string,
  sourceLocations: readonly string[],
  details?: Readonly<Record<string, string | number | null>>,
): EvonutRecipePending {
  return { code, message, sourceLocations, ...(details ? { details } : {}) };
}

function derivedMeasures(
  measureRow: readonly CellValue[] | null,
  measureHeaders: readonly CellValue[],
  spreadsheetRow: number | null,
  unit: ResolvedUnit | null,
) {
  if (!measureRow || spreadsheetRow === null) return [];
  const measures: EvonutLegacyNutritionComparison["derivedMeasures"][number][] = [];
  for (let column = 1; column < measureHeaders.length; column += 1) {
    const value = parseNumber(measureRow[column]);
    if (value === null) continue;
    measures.push({
      measure: cellText(measureHeaders[column]),
      value,
      unit,
      sourceLocation: `BD_Medidas!${XLSX.utils.encode_col(column)}${spreadsheetRow}`,
    });
  }
  return measures;
}

function addYieldPendings(
  recipe: { name: string; sourceLocation: EvonutSourceLocation },
  parsedYield: EvonutRecipeYield,
  ingredients: readonly EvonutRecipeIngredient[],
  legacyMeasures: EvonutLegacyNutritionComparison["derivedMeasures"],
  pendings: EvonutRecipePending[],
) {
  if (!parsedYield.originalText) {
    pendings.push(
      pending("YIELD_ABSENT", "Rendimento não informado na origem.", [recipe.sourceLocation.range]),
    );
    return;
  }
  if (parsedYield.options.length > 1) {
    pendings.push(
      pending(
        "MULTIPLE_YIELD_OPTIONS",
        "A origem informa alternativas de rendimento; nenhuma foi escolhida automaticamente.",
        [recipe.sourceLocation.range],
      ),
    );
  }
  for (const option of parsedYield.options) {
    const matchingLegacyMeasure = legacyMeasures.find(
      (measure) => singularMeasure(measure.measure) === singularMeasure(option.portionLabel),
    );
    if (!matchingLegacyMeasure) {
      pendings.push(
        pending(
          "YIELD_MEASURE_NOT_FOUND_IN_DERIVED_REFERENCE",
          `A medida do rendimento "${option.portionLabel}" não tem correspondência literal na referência derivada.`,
          [recipe.sourceLocation.range],
          { portionLabel: option.portionLabel },
        ),
      );
    }
    if (!option.portionWeight) {
      pendings.push(
        pending(
          "YIELD_WEIGHT_NOT_EXPLICIT",
          "A origem informa a quantidade de porções, mas não explicita o peso por porção.",
          [recipe.sourceLocation.range],
          { portions: option.portions, portionLabel: option.portionLabel },
        ),
      );
      continue;
    }
    if (
      matchingLegacyMeasure?.unit === option.portionWeight.unit &&
      Math.abs(matchingLegacyMeasure.value - option.portionWeight.value) > 0.01
    ) {
      pendings.push(
        pending(
          "YIELD_WEIGHT_CONFLICT",
          "O peso textual por porção diverge da medida legada da preparação.",
          [recipe.sourceLocation.range, matchingLegacyMeasure.sourceLocation],
          {
            textWeight: option.portionWeight.value,
            legacyMeasureWeight: matchingLegacyMeasure.value,
            unit: option.portionWeight.unit,
          },
        ),
      );
    }
    const ingredientUnits = new Set(
      ingredients
        .map((ingredient) => ingredient.resolvedEquivalence.unit)
        .filter((unit): unit is ResolvedUnit => unit !== null),
    );
    const allIngredientsResolved = ingredients.every(
      (ingredient) => ingredient.resolvedEquivalence.amount !== null,
    );
    if (ingredientUnits.size !== 1 || !ingredientUnits.has(option.portionWeight.unit)) {
      pendings.push(
        pending(
          "YIELD_RECONCILIATION_BLOCKED_BY_MIXED_UNITS",
          "O rendimento não foi reconciliado porque os ingredientes usam unidades diferentes da unidade do rendimento.",
          [recipe.sourceLocation.range, ...ingredients.map((ingredient) => ingredient.sourceLocation.range)],
          {
            yieldUnit: option.portionWeight.unit,
            ingredientUnits: [...ingredientUnits].sort().join(","),
          },
        ),
      );
      continue;
    }
    if (!allIngredientsResolved || !option.totalWeight) continue;
    const ingredientTotal = ingredients.reduce(
      (total, ingredient) => total + (ingredient.resolvedEquivalence.amount ?? 0),
      0,
    );
    if (Math.abs(ingredientTotal - option.totalWeight.value) > 0.01) {
      pendings.push(
        pending(
          "YIELD_WEIGHT_CONFLICT",
          "O peso total explícito do rendimento diverge da soma das equivalências dos ingredientes.",
          [recipe.sourceLocation.range, ...ingredients.map((ingredient) => ingredient.sourceLocation.range)],
          {
            explicitYieldWeight: option.totalWeight.value,
            resolvedIngredientTotal: ingredientTotal,
            unit: option.totalWeight.unit,
          },
        ),
      );
    }
  }
}

export function parseEvonutRecipesWorkbook(
  bytes: Uint8Array,
  options: { readonly sourcePath?: string } = {},
): EvonutRecipeParseResult {
  const workbook = XLSX.read(bytes, {
    type: "buffer",
    raw: true,
    bookVBA: false,
    cellFormula: false,
    sheets: [...REQUIRED_SHEETS],
  });
  const cadastroSheet = requiredSheet(workbook, "BD_Cadastros");
  const dietSheet = requiredSheet(workbook, "BD_Cad_Dietas");
  const foodSheet = requiredSheet(workbook, "BD_Alimentos");
  const measureSheet = requiredSheet(workbook, "BD_Medidas");

  const cadastroRows = matrixFromRange(cadastroSheet, "A3:H91");
  const dietRows = matrixFromRange(dietSheet, "A3:M244");
  const foodHeaders = rowFromSheet(foodSheet, 3, "A", "AS");
  const measureHeaders = rowFromSheet(measureSheet, 3, "A", "AM");
  assertHeaders(cadastroRows[0] ?? [], RECIPE_HEADERS, "BD_Cadastros");
  assertHeaders(dietRows[0] ?? [], INGREDIENT_HEADERS, "BD_Cad_Dietas");
  assertHeaders(foodHeaders, ["Código", "Alimento", "Tabela", "Grupo"], "BD_Alimentos");
  if (cellText(measureHeaders[0]) !== "Código do alimento") {
    throw new Error("Cabeçalho inesperado em BD_Medidas.");
  }

  const recipeSourceRows = cadastroRows
    .slice(1)
    .map((row, index) => ({ row, spreadsheetRow: index + 4 }))
    .filter(({ row }) => cellText(row[2]) === "Receita");
  const recipeCodes = new Set(recipeSourceRows.map(({ row }) => cellText(row[0])));
  const ingredientSourceRows = dietRows
    .slice(1)
    .map((row, index) => ({ row, spreadsheetRow: index + 4 }))
    .filter(({ row }) => recipeCodes.has(cellText(row[0])));
  const ingredientFoodCodes = new Set(
    ingredientSourceRows.map(({ row }) => cellText(row[6])).filter(Boolean),
  );
  const derivedFoodCodes = new Set(
    recipeSourceRows.map(({ row }) => cellText(row[7])).filter(Boolean),
  );
  const neededFoodCodes = new Set([...ingredientFoodCodes, ...derivedFoodCodes]);
  const foodRowIndex = buildCodeRowIndex(foodSheet, 4, 7892);
  const measureRowIndex = buildCodeRowIndex(measureSheet, 4, 7892);
  const foodByCode = new Map<string, IndexedFood>();
  const measureRowByCode = new Map<string, readonly CellValue[]>();
  for (const code of neededFoodCodes) {
    const foodRow = foodRowIndex.get(code);
    if (foodRow !== undefined) {
      foodByCode.set(code, indexedFoodFromRow(rowFromSheet(foodSheet, foodRow, "A", "AS"), foodRow));
    }
    const measureRow = measureRowIndex.get(code);
    if (measureRow !== undefined) {
      measureRowByCode.set(code, rowFromSheet(measureSheet, measureRow, "A", "AM"));
    }
  }
  const measureColumnByName = new Map(
    measureHeaders.map((header, index) => [normalizeText(cellText(header)), index]),
  );

  let excludedDerivedRecipeIngredients = 0;
  const recipesWithoutHashes = recipeSourceRows.map(({ row, spreadsheetRow }) => {
    const originalCode = cellText(row[0]);
    const name = cellText(row[1]);
    const originalNutritionText = nullableText(row[3]);
    const detailsText = nullableText(row[4]);
    const preparationText = nullableText(row[5]);
    const derivedFoodCode = nullableText(row[7]);
    const sourceLocation = sheetLocation("BD_Cadastros", spreadsheetRow, "A", "H");
    const pendings: EvonutRecipePending[] = [];
    if (!preparationText) {
      pendings.push(
        pending("PREPARATION_ABSENT", "Modo de preparo ausente na origem.", [sourceLocation.range]),
      );
    }
    const preparationTimeText = labeledLine(detailsText, "Tempo de preparo");
    if (!preparationTimeText) {
      pendings.push(
        pending(
          "PREPARATION_TIME_ABSENT",
          "Tempo de preparo ausente na origem.",
          [sourceLocation.range],
        ),
      );
    }

    const ingredients: EvonutRecipeIngredient[] = [];
    const rowsForRecipe = ingredientSourceRows.filter(
      ({ row: ingredientRow }) => cellText(ingredientRow[0]) === originalCode,
    );
    for (const { row: ingredientRow, spreadsheetRow: ingredientSpreadsheetRow } of rowsForRecipe) {
      const ingredientLocation = sheetLocation(
        "BD_Cad_Dietas",
        ingredientSpreadsheetRow,
        "A",
        "M",
      );
      const foodCode = cellText(ingredientRow[6]);
      const food = foodByCode.get(foodCode) ?? null;
      if (food?.source === "Receitas") {
        excludedDerivedRecipeIngredients += 1;
        pendings.push(
          pending(
            "DERIVED_RECIPE_FOOD_EXCLUDED",
            "Alimento derivado da fonte Receitas excluído da lista de ingredientes independentes.",
            [ingredientLocation.range, `BD_Alimentos!A${food.row}:AS${food.row}`],
            { foodCode },
          ),
        );
        continue;
      }
      if (!food) {
        pendings.push(
          pending(
            "FOOD_LINK_UNRESOLVED",
            "Código do alimento sem vínculo na BD_Alimentos.",
            [ingredientLocation.range],
            { foodCode },
          ),
        );
      }
      const rawQuantity = ingredientRow[8] ?? null;
      const quantity = parseNumber(rawQuantity);
      if (cellText(rawQuantity) === "") {
        pendings.push(
          pending(
            "INGREDIENT_QUANTITY_ABSENT",
            "Quantidade do ingrediente ausente.",
            [ingredientLocation.range],
            { foodCode },
          ),
        );
      } else if (quantity === null || quantity < 0) {
        pendings.push(
          pending(
            "INGREDIENT_QUANTITY_INVALID",
            "Quantidade do ingrediente inválida.",
            [ingredientLocation.range],
            { foodCode, rawQuantity: cellText(rawQuantity) },
          ),
        );
      }
      if (food?.referenceQuantity === null) {
        pendings.push(
          pending(
            "FOOD_REFERENCE_QUANTITY_ABSENT",
            "Quantidade nutricional de referência ausente na BD_Alimentos.",
            [ingredientLocation.range, `BD_Alimentos!F${food.row}`],
            { foodCode },
          ),
        );
      } else if (food && food.referenceQuantity <= 0) {
        pendings.push(
          pending(
            "FOOD_REFERENCE_QUANTITY_INVALID",
            "Quantidade nutricional de referência inválida na BD_Alimentos.",
            [ingredientLocation.range, `BD_Alimentos!F${food.row}`],
            { foodCode, referenceQuantity: food.referenceQuantity },
          ),
        );
      }
      if (food && food.referenceUnit === null) {
        pendings.push(
          pending(
            "FOOD_REFERENCE_UNIT_INVALID",
            "Unidade nutricional de referência não reconhecida.",
            [ingredientLocation.range, `BD_Alimentos!AS${food.row}`],
            { foodCode, rawUnit: food.rawReferenceUnit },
          ),
        );
      }

      const householdMeasure = cellText(ingredientRow[7]);
      let measureValue: number | null = null;
      let equivalenceMethod: EvonutRecipeIngredient["resolvedEquivalence"]["method"] = null;
      let measureSourceLocation: string | null = null;
      const normalizedMeasure = normalizeText(householdMeasure);
      if (normalizedMeasure === "gramas" && food?.referenceUnit === "g") {
        measureValue = 1;
        equivalenceMethod = "DIRECT_SOURCE_UNIT";
        measureSourceLocation = `BD_Cad_Dietas!H${ingredientSpreadsheetRow}:I${ingredientSpreadsheetRow}`;
      } else if (normalizedMeasure === "mililitros" && food?.referenceUnit === "ml") {
        measureValue = 1;
        equivalenceMethod = "DIRECT_SOURCE_UNIT";
        measureSourceLocation = `BD_Cad_Dietas!H${ingredientSpreadsheetRow}:I${ingredientSpreadsheetRow}`;
      } else {
        const measureColumn = measureColumnByName.get(normalizedMeasure);
        const measureRow = measureRowByCode.get(foodCode);
        const measureSpreadsheetRow = measureRowIndex.get(foodCode);
        if (measureColumn !== undefined && measureRow && measureSpreadsheetRow !== undefined) {
          measureValue = parseNumber(measureRow[measureColumn]);
          if (measureValue !== null) {
            equivalenceMethod = "BD_MEDIDAS";
            measureSourceLocation = `BD_Medidas!${XLSX.utils.encode_col(measureColumn)}${measureSpreadsheetRow}`;
          }
        }
      }
      if (measureValue === null) {
        pendings.push(
          pending(
            "HOUSEHOLD_MEASURE_UNRESOLVED",
            "Medida caseira sem equivalência resolvida na BD_Medidas.",
            [ingredientLocation.range],
            { foodCode, householdMeasure },
          ),
        );
      }
      ingredients.push({
        order: ingredients.length + 1,
        originalKey: nullableText(ingredientRow[10]),
        originalId: nullableText(ingredientRow[9]),
        originalFoodName: cellText(ingredientRow[11]),
        observation: nullableText(ingredientRow[1]),
        foodCode,
        foodSource: food?.source ?? null,
        catalogFoodName: food?.name ?? null,
        informedQuantity: { raw: rawQuantity, value: quantity },
        householdMeasure,
        resolvedEquivalence: {
          amount: quantity !== null && measureValue !== null ? quantity * measureValue : null,
          unit: food?.referenceUnit ?? null,
          measureValue,
          method: equivalenceMethod,
          sourceLocation: measureSourceLocation,
        },
        nutritionReference: {
          quantity: food?.referenceQuantity ?? null,
          unit: food?.referenceUnit ?? null,
          rawUnit: food?.rawReferenceUnit ?? null,
          sourceLocation: food ? `BD_Alimentos!F${food.row}:AS${food.row}` : null,
        },
        sourceLocation: ingredientLocation,
        foodSourceLocation: food
          ? sheetLocation("BD_Alimentos", food.row, "A", "AS")
          : null,
      });
    }

    const derivedFood = derivedFoodCode ? foodByCode.get(derivedFoodCode) ?? null : null;
    if (!derivedFood) {
      pendings.push(
        pending(
          "DERIVED_RECIPE_REFERENCE_UNRESOLVED",
          "Referência alimentar derivada da receita não localizada.",
          [sourceLocation.range],
          { derivedFoodCode },
        ),
      );
    } else if (derivedFood.source !== "Receitas") {
      pendings.push(
        pending(
          "DERIVED_RECIPE_REFERENCE_CONFLICT",
          "A referência alimentar derivada não pertence à fonte Receitas.",
          [sourceLocation.range, `BD_Alimentos!A${derivedFood.row}:AS${derivedFood.row}`],
          { derivedFoodCode, source: derivedFood.source },
        ),
      );
    }
    const derivedMeasureRow = derivedFoodCode
      ? measureRowByCode.get(derivedFoodCode) ?? null
      : null;
    const derivedMeasureSpreadsheetRow = derivedFoodCode
      ? measureRowIndex.get(derivedFoodCode) ?? null
      : null;
    const legacyMeasures = derivedMeasures(
      derivedMeasureRow,
      measureHeaders,
      derivedMeasureSpreadsheetRow,
      derivedFood?.referenceUnit ?? null,
    );
    const parsedYield = recipeYield(detailsText);
    addYieldPendings(
      { name, sourceLocation },
      parsedYield,
      ingredients,
      legacyMeasures,
      pendings,
    );
    return {
      originalCode,
      name,
      derivedFoodCode,
      ingredients,
      detailsText,
      preparationText,
      preparationTimeText,
      yield: parsedYield,
      legacyNutrition: {
        comparisonOnly: true as const,
        validatedCalculation: false as const,
        originalText: originalNutritionText,
        textTotals: parseLegacyNutritionText(originalNutritionText),
        derivedFood: derivedFood
          ? {
              sourceCode: derivedFood.code,
              sourceName: derivedFood.source,
              referenceQuantity: derivedFood.referenceQuantity,
              referenceUnit: derivedFood.referenceUnit,
              rawReferenceUnit: derivedFood.rawReferenceUnit,
              nutrients: derivedFood.nutrients,
              sourceLocation: sheetLocation("BD_Alimentos", derivedFood.row, "A", "AS"),
            }
          : null,
        derivedMeasures: legacyMeasures,
      },
      pendings,
      sourceLocation,
    };
  });

  const recipes: EvonutRecipe[] = recipesWithoutHashes.map((recipe) => ({
    ...recipe,
    contentSha256: sha256(JSON.stringify(recipe)),
  }));
  const ingredients = recipes.flatMap((recipe) => recipe.ingredients);
  const contentSha256 = sha256(JSON.stringify(recipes));
  return {
    metadata: {
      sourcePath: options.sourcePath ?? SOURCE_PATH,
      sourceVersion: EVONUT_SOURCE_VERSION,
      sourceSha256: sha256(bytes),
      contentSha256,
      sheetsRead: REQUIRED_SHEETS,
      sourceRanges: SOURCE_RANGES,
      macrosExecuted: false,
    },
    recipes,
    counts: {
      recipes: recipes.length,
      ingredients: ingredients.length,
      distinctFoodCodes: new Set(ingredients.map((ingredient) => ingredient.foodCode)).size,
      grams: ingredients.filter((ingredient) => ingredient.resolvedEquivalence.unit === "g").length,
      milliliters: ingredients.filter(
        (ingredient) => ingredient.resolvedEquivalence.unit === "ml",
      ).length,
      unresolvedFoodLinks: ingredients.filter((ingredient) => ingredient.foodSource === null).length,
      unresolvedEquivalences: ingredients.filter(
        (ingredient) => ingredient.resolvedEquivalence.amount === null,
      ).length,
      excludedDerivedRecipeIngredients,
    },
  };
}
