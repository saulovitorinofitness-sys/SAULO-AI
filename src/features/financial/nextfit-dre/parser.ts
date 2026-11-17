import type {
  NextFitDreKeyFigure,
  NextFitDreLine,
  NextFitDreValue,
  NextFitDreWarning,
} from "./contracts";
import { NextFitDreError } from "./contracts";

type Cell = string | number | boolean | Date | null | undefined;
export type NextFitDreMatrix = readonly (readonly Cell[])[];

export interface ParsedNextFitDre {
  readonly sheetNames: readonly string[];
  readonly year: number;
  readonly competences: readonly string[];
  readonly groups: readonly string[];
  readonly keyFigures: readonly NextFitDreKeyFigure[];
  readonly lines: readonly NextFitDreLine[];
  readonly warnings: readonly NextFitDreWarning[];
}

export interface NextFitDreParserOptions {
  readonly baseYear?: number;
}

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
};

const KEY_FIGURE_PATTERNS = [
  /receitas? operacionais?/,
  /receita de vendas/,
  /outras receitas/,
  /receita bruta/,
  /deducoes da receita bruta|descontos/,
  /receita liquida/,
  /custos? operacionais?|custo dos produtos vendidos|custo das vendas de produtos|custo dos servicos prestados/,
  /lucro bruto/,
  /despesas? comerciais?/,
  /despesas? administrativas?/,
  /despesas? operacionais?/,
  /receitas? e despesas? financeiras?|receitas? e rendimentos? financeiros?|despesas? financeiras?/,
  /outras receitas? e despesas? nao operacionais?|outras receitas? nao operacionais?|outras despesas? nao operacionais?/,
  /investimentos? em imobilizado/,
  /emprestimos?|dividas?/,
  /resultado|lucro|prejuizo/,
];

const NEXTFIT_CHARACTERISTIC_PATTERNS = [
  /receitas? operacionais?/,
  /receita bruta de vendas/,
  /deducoes da receita bruta/,
  /receita liquida de vendas/,
  /custos? operacionais?/,
  /lucro bruto/,
  /despesas? operacionais?/,
  /lucro.*prejuizo operacional/,
  /receitas? e despesas? financeiras?/,
  /lucro.*prejuizo liquido/,
  /investimentos? em imobilizado/,
  /lucro.*prejuizo final/,
];

const NEXTFIT_GROUP_PATTERNS = [
  /^receitas operacionais$/,
  /^deducoes da receita bruta$/,
  /^custos operacionais$/,
  /^despesas operacionais$/,
  /^receitas e despesas financeiras$/,
  /^outras receitas e despesas nao operacionais$/,
  /^despesas com investimentos e emprestimos$/,
];

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isoMonth(year: number, month: number) {
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function originalCellValue(cell: Cell) {
  if (cell instanceof Date) return cell.toISOString();
  return String(cell ?? "").trim();
}

function monthFromHeader(cell: Cell) {
  const name = normalized(String(cell ?? "")).replace(/[^a-z]/g, "");
  return MONTHS[name] ?? null;
}

export function parseCompetenceCell(cell: Cell): string | null {
  if (cell instanceof Date && Number.isFinite(cell.getTime())) {
    return isoMonth(cell.getUTCFullYear(), cell.getUTCMonth() + 1);
  }
  if (typeof cell === "number" && cell >= 20_000 && cell <= 80_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + cell * 86_400_000);
    return isoMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
  }
  const raw = String(cell ?? "").trim();
  if (!raw) return null;
  const text = normalized(raw).replace(/\bcompetencia\b\s*:?/g, "").trim();

  let match = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])(?:[-/.]\d{1,2})?\b/);
  if (match) return isoMonth(Number(match[1]), Number(match[2]));
  match = text.match(/\b(0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (match) return isoMonth(Number(match[2]), Number(match[1]));
  match = text.match(/\b([a-z]+)[\s/.-]+(20\d{2})\b/);
  if (match && MONTHS[match[1]]) return isoMonth(Number(match[2]), MONTHS[match[1]]);
  return null;
}

function metadataYear(matrix: NextFitDreMatrix) {
  for (const cell of matrix.slice(0, 20).flat()) {
    const match = String(cell ?? "").match(/\b(20\d{2})\b/);
    if (match) return Number(match[1]);
  }
  return null;
}

function parseHeaderCompetence(cell: Cell, year: number | null) {
  const complete = parseCompetenceCell(cell);
  if (complete || !year) return complete;
  const monthName = normalized(String(cell ?? "")).replace(/[^a-z]/g, "");
  return MONTHS[monthName] ? isoMonth(year, MONTHS[monthName]) : null;
}

export function parseFinancialCell(cell: Cell): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const original = String(cell ?? "").trim();
  if (!original || original.endsWith("%")) return null;
  let text = original.replace(/R\$/gi, "").replace(/\s/g, "");
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-") || text.endsWith("-");
  text = text.replace(/[()\-]/g, "");
  if (!/[0-9]/.test(text)) return null;

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma > dot) text = text.replace(/\./g, "").replace(",", ".");
  else if (dot > comma && comma >= 0) text = text.replace(/,/g, "");
  else if (comma >= 0) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  else text = text.replace(/,/g, "");

  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -Math.abs(value) : value;
}

function findMetadataCompetences(matrix: NextFitDreMatrix) {
  return matrix
    .slice(0, 20)
    .flatMap((row) => row.map(parseCompetenceCell))
    .filter((value): value is string => Boolean(value));
}

function descriptionFromRow(row: readonly Cell[], valueColumns: readonly number[]) {
  const firstValueColumn = Math.min(...valueColumns);
  for (let index = 0; index < Math.max(firstValueColumn, 1); index += 1) {
    const value = String(row[index] ?? "").trim();
    if (value && parseFinancialCell(value) === null && !parseCompetenceCell(value)) return value;
  }
  return String(row[0] ?? "").trim();
}

function isStructuralGroup(description: string, hasValues: boolean) {
  const value = normalized(description);
  return (
    !hasValues ||
    /^(receitas?|deducoes?|custos?|despesas?|investimentos?|emprestimos?|dividas?|resultado|lucro|prejuizo)/.test(value)
  );
}

function horizontalHeader(matrix: NextFitDreMatrix) {
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    if (normalized(String(row[0] ?? "")) !== "categoria") continue;
    const monthColumns = row
      .map((cell, columnIndex) => ({ columnIndex, month: monthFromHeader(cell) }))
      .filter((item): item is { columnIndex: number; month: number } => item.month !== null);
    if (monthColumns.length < 6) continue;
    const totalColumn = row.findIndex((cell) => normalized(String(cell ?? "")) === "total");
    return { rowIndex, monthColumns, totalColumn: totalColumn >= 0 ? totalColumn : undefined };
  }
  return null;
}

function characteristicLineCount(matrix: NextFitDreMatrix, start: number) {
  return matrix.slice(start).filter((row) => {
    const description = normalized(String(row[0] ?? "")).replace(/^\(=\)\s*/, "");
    return NEXTFIT_CHARACTERISTIC_PATTERNS.some((pattern) => pattern.test(description));
  }).length;
}

function parseHorizontalNextFitDre(
  matrix: NextFitDreMatrix,
  sheetName: string,
  header: NonNullable<ReturnType<typeof horizontalHeader>>,
  options: NextFitDreParserOptions,
): Omit<ParsedNextFitDre, "sheetNames"> {
  if (characteristicLineCount(matrix, header.rowIndex + 1) < 2) {
    throw new NextFitDreError(
      "UNEXPECTED_STRUCTURE",
      "A planilha possui meses em colunas, mas não contém linhas características da DRE NextFit.",
    );
  }

  const headerYears = (matrix[header.rowIndex] ?? [])
    .map(parseCompetenceCell)
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value.slice(0, 4)));
  const year = headerYears[0] ?? metadataYear(matrix.slice(0, header.rowIndex + 1)) ?? options.baseYear;
  if (!year || !isoMonth(year, 1)) {
    throw new NextFitDreError(
      "YEAR_REQUIRED",
      "A estrutura da DRE NextFit foi reconhecida, mas o ano não está no arquivo. Informe o ano da DRE para gerar a prévia.",
    );
  }

  const warnings: NextFitDreWarning[] = [];
  const lines: NextFitDreLine[] = [];
  let currentContext: string | undefined;

  for (let rowIndex = header.rowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const description = String(row[0] ?? "").trim();
    if (!description) continue;
    const normalizedDescription = normalized(description).replace(/^\(=\)\s*/, "");
    const matchesGroup = NEXTFIT_GROUP_PATTERNS.some((pattern) => pattern.test(normalizedDescription));
    const startsNewGroup = matchesGroup && normalizedDescription !== normalized(currentContext ?? "");
    if (startsNewGroup) {
      currentContext = description;
    }

    const values: NextFitDreValue[] = [];
    for (const column of header.monthColumns) {
      const cell = row[column.columnIndex];
      const originalValue = originalCellValue(cell);
      const amount = parseFinancialCell(cell);
      if (amount !== null) {
        values.push({
          competence: isoMonth(year, column.month)!,
          amount: amount.toFixed(2),
          originalValue,
        });
      } else if (originalValue) {
        warnings.push({
          code: "MISSING_VALUE",
          message: `A linha “${description}” possui valor não numérico em ${String(matrix[header.rowIndex]?.[column.columnIndex] ?? "mês")}.`,
          severity: "WARNING",
          sheetName,
          rowNumber: rowIndex + 1,
        });
      }
    }

    if (values.length < header.monthColumns.length) {
      warnings.push({
        code: "EMPTY_CELL",
        message: `A linha “${description}” possui ${header.monthColumns.length - values.length} competência(s) sem valor.`,
        severity: "INFO",
        sheetName,
        rowNumber: rowIndex + 1,
      });
    }

    const totalCell = header.totalColumn === undefined ? undefined : row[header.totalColumn];
    const totalOriginalValue = originalCellValue(totalCell);
    const totalAmount = parseFinancialCell(totalCell);
    const monthlySum = values.reduce((sum, value) => sum + Number(value.amount), 0);
    const difference = totalAmount === null ? null : monthlySum - totalAmount;
    const total = totalAmount === null ? undefined : {
      amount: totalAmount.toFixed(2),
      originalValue: totalOriginalValue,
      monthlySum: monthlySum.toFixed(2),
      difference: difference!.toFixed(2),
      matches: Math.abs(difference!) < 0.01,
    };
    if (total && !total.matches) {
      warnings.push({
        code: "TOTAL_MISMATCH",
        message: `A soma mensal de “${description}” (${monthlySum.toFixed(2)}) diverge do Total (${total.amount}).`,
        severity: "WARNING",
        sheetName,
        rowNumber: rowIndex + 1,
      });
    }

    lines.push({
      sheetName,
      rowNumber: rowIndex + 1,
      description,
      values,
      isGroup: startsNewGroup,
      kind: /^\(=\)/.test(description) ? "RESULT" : startsNewGroup ? "GROUP" : "DETAIL",
      context: currentContext,
      total,
    });
  }

  if (!lines.length || !lines.some((line) => line.values.length || line.total)) {
    throw new NextFitDreError("UNEXPECTED_STRUCTURE", "Nenhuma linha financeira foi identificada na DRE.");
  }

  const competences = header.monthColumns
    .map((column) => isoMonth(year, column.month)!)
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();
  const groups = lines.filter((line) => line.isGroup).map((line) => line.description);
  const keyFigures = lines
    .filter((line) => KEY_FIGURE_PATTERNS.some((pattern) => pattern.test(normalized(line.description))))
    .map((line) => ({ description: line.description, values: line.values }));

  return { year, competences, groups, keyFigures, lines, warnings };
}

export function parseNextFitDreMatrix(
  matrix: NextFitDreMatrix,
  sheetName = "DRE",
  options: NextFitDreParserOptions = {},
): Omit<ParsedNextFitDre, "sheetNames"> {
  const nextFitHeader = horizontalHeader(matrix);
  if (nextFitHeader) {
    return parseHorizontalNextFitDre(matrix, sheetName, nextFitHeader, options);
  }
  const warnings: NextFitDreWarning[] = [];
  const reportYear = metadataYear(matrix) ?? options.baseYear ?? null;
  const candidates = matrix.map((row, rowIndex) => ({
    rowIndex,
    competences: row.map((cell, columnIndex) => ({
      columnIndex,
      competence: parseHeaderCompetence(cell, reportYear),
    })).filter((item): item is { columnIndex: number; competence: string } => Boolean(item.competence)),
  }));
  const header = candidates.sort((a, b) => b.competences.length - a.competences.length)[0];
  const metadataCompetences = findMetadataCompetences(matrix);
  const headerHasDescriptor = header
    ? matrix[header.rowIndex].some((cell) =>
        /descricao|conta|grupo|categoria/i.test(normalized(String(cell ?? ""))),
      )
    : false;
  const headerHasCompetence = Boolean(
    header?.competences.length &&
      (header.competences.length > 1 || headerHasDescriptor),
  );

  let valueColumns = headerHasCompetence
    ? header.competences
    : [];
  let dataStart = headerHasCompetence ? header.rowIndex + 1 : 0;

  if (!valueColumns.length && metadataCompetences.length) {
    const labelHeader = matrix.findIndex((row) =>
      row.some((cell) => /descricao|conta|grupo|categoria/i.test(normalized(String(cell ?? "")))) &&
      row.some((cell) => /valor|total/i.test(normalized(String(cell ?? "")))),
    );
    if (labelHeader >= 0) {
      const valueColumn = matrix[labelHeader].findIndex((cell) =>
        /valor|total/i.test(normalized(String(cell ?? ""))),
      );
      valueColumns = [{ columnIndex: valueColumn, competence: metadataCompetences[0] }];
      dataStart = labelHeader + 1;
    }
  }

  if (!valueColumns.length) {
    throw new NextFitDreError(
      "UNEXPECTED_STRUCTURE",
      "A planilha não contém competência e colunas de valores reconhecíveis da DRE.",
    );
  }

  const lines: NextFitDreLine[] = [];
  for (let rowIndex = dataStart; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const description = descriptionFromRow(
      row,
      valueColumns.map((item) => item.columnIndex),
    );
    if (!description || parseCompetenceCell(description)) continue;

    const values: NextFitDreValue[] = [];
    let nonEmptyValueCells = 0;
    for (const column of valueColumns) {
      const cell = row[column.columnIndex];
      if (String(cell ?? "").trim()) nonEmptyValueCells += 1;
      const amount = parseFinancialCell(cell);
      if (amount !== null) {
        values.push({
          competence: column.competence,
          amount: amount.toFixed(2),
          originalValue: originalCellValue(cell),
        });
      }
    }
    if (!values.length && nonEmptyValueCells > 0) {
      warnings.push({
        code: "MISSING_VALUE",
        message: `A linha “${description}” possui valor não numérico.`,
        severity: "WARNING",
        sheetName,
        rowNumber: rowIndex + 1,
      });
    } else if (values.length < valueColumns.length) {
      warnings.push({
        code: "EMPTY_CELL",
        message: `A linha “${description}” possui competência sem valor.`,
        severity: "WARNING",
        sheetName,
        rowNumber: rowIndex + 1,
      });
    }
    lines.push({
      sheetName,
      rowNumber: rowIndex + 1,
      description,
      values,
      isGroup: isStructuralGroup(description, values.length > 0),
      kind: /^\(=\)/.test(description) ? "RESULT" : isStructuralGroup(description, values.length > 0) ? "GROUP" : "DETAIL",
    });
  }

  const financialLines = lines.filter((line) => line.values.length > 0);
  if (!financialLines.length) {
    throw new NextFitDreError(
      "UNEXPECTED_STRUCTURE",
      "Nenhuma linha financeira foi identificada na DRE.",
    );
  }

  const competences = [...new Set(valueColumns.map((item) => item.competence))].sort();
  if (competences.length > 1) {
    warnings.push({
      code: "MULTIPLE_COMPETENCES",
      message: `Foram encontradas ${competences.length} competências. A primeira será a competência inicial do lote anual.`,
      severity: "INFO",
      sheetName,
    });
  }
  const groups = [...new Set(lines.filter((line) => line.isGroup).map((line) => line.description))];
  const keyFigures = financialLines
    .filter((line) => KEY_FIGURE_PATTERNS.some((pattern) => pattern.test(normalized(line.description))))
    .map((line) => ({ description: line.description, values: line.values }));

  return {
    year: Number(competences[0].slice(0, 4)),
    competences,
    groups,
    keyFigures,
    lines,
    warnings,
  };
}

export async function readNextFitDreWorkbook(
  bytes: ArrayBuffer | Uint8Array,
  options: NextFitDreParserOptions = {},
): Promise<ParsedNextFitDre> {
  try {
    const XLSX = await import("@e965/xlsx");
    const workbook = XLSX.read(bytes, { type: "array", raw: true, cellDates: true, codepage: 65001 });
    const parsedSheets = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<Cell[]>(sheet, {
        header: 1,
        defval: null,
        raw: false,
      });
      try {
        return parseNextFitDreMatrix(matrix, sheetName, options);
      } catch (error) {
        if (error instanceof NextFitDreError && error.code === "UNEXPECTED_STRUCTURE") return null;
        throw error;
      }
    }).filter((value): value is Omit<ParsedNextFitDre, "sheetNames"> => Boolean(value));

    if (!parsedSheets.length) {
      throw new NextFitDreError(
        "UNEXPECTED_STRUCTURE",
        "Nenhuma aba contém uma estrutura reconhecível de DRE Gerencial.",
      );
    }
    return {
      sheetNames: workbook.SheetNames,
      year: parsedSheets[0].year,
      competences: [...new Set(parsedSheets.flatMap((sheet) => sheet.competences))].sort(),
      groups: [...new Set(parsedSheets.flatMap((sheet) => sheet.groups))],
      keyFigures: parsedSheets.flatMap((sheet) => sheet.keyFigures),
      lines: parsedSheets.flatMap((sheet) => sheet.lines),
      warnings: parsedSheets.flatMap((sheet) => sheet.warnings),
    };
  } catch (error) {
    if (error instanceof NextFitDreError) throw error;
    throw new NextFitDreError(
      "INVALID_WORKBOOK",
      "O arquivo não pôde ser lido como uma planilha XLS/XLSX válida.",
    );
  }
}
