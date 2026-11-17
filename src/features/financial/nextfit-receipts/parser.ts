import type {
  NextFitReceiptIssue,
  ParsedNextFitReceiptRow,
} from "./contracts";
import { NextFitReceiptsError } from "./contracts";
import { normalizeNextFitText } from "./mapping";

type Cell = string | number | boolean | Date | null | undefined;
export type NextFitReceiptsMatrix = readonly (readonly Cell[])[];

export interface ParsedNextFitReceiptsWorkbook {
  readonly sheetNames: readonly string[];
  readonly rows: readonly ParsedNextFitReceiptRow[];
  readonly issues: readonly NextFitReceiptIssue[];
}

type ColumnKey =
  | "cashRegister"
  | "openingDate"
  | "closingDate"
  | "receiptDate"
  | "origin"
  | "rawMethod"
  | "rawType"
  | "rawAmount";

const HEADER_ALIASES: Readonly<Record<string, ColumnKey>> = {
  caixa: "cashRegister",
  "data de abertura": "openingDate",
  "data abertura": "openingDate",
  abertura: "openingDate",
  "data de fechamento": "closingDate",
  "data fechamento": "closingDate",
  fechamento: "closingDate",
  data: "receiptDate",
  "data do recebimento": "receiptDate",
  origem: "origin",
  metodo: "rawMethod",
  "metodo de pagamento": "rawMethod",
  tipo: "rawType",
  valor: "rawAmount",
};

const REQUIRED_COLUMNS: readonly ColumnKey[] = [
  "receiptDate",
  "rawMethod",
  "rawType",
  "rawAmount",
];

function displayCell(cell: Cell): string | undefined {
  if (cell instanceof Date && Number.isFinite(cell.getTime())) {
    return cell.toISOString();
  }
  const value = String(cell ?? "").trim();
  return value || undefined;
}

function validIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

export function parseNextFitReceiptDate(cell: Cell): string | undefined {
  if (cell instanceof Date && Number.isFinite(cell.getTime())) {
    return validIsoDate(
      cell.getUTCFullYear(),
      cell.getUTCMonth() + 1,
      cell.getUTCDate(),
    );
  }
  if (typeof cell === "number" && cell >= 20_000 && cell <= 80_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(cell) * 86_400_000);
    return validIsoDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
  }

  const value = String(cell ?? "").trim();
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (match) return validIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s].*)?$/);
  if (match) return validIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));
  return undefined;
}

export function parseNextFitReceiptAmount(cell: Cell): string | undefined {
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? cell.toFixed(2) : undefined;
  }
  const original = String(cell ?? "").trim();
  if (!original) return undefined;

  let value = original.replace(/R\$/gi, "").replace(/\s/g, "");
  const negative = /^\(.*\)$/.test(value) || value.startsWith("-") || value.endsWith("-");
  value = value.replace(/[()\-]/g, "");
  if (!/\d/.test(value)) return undefined;

  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  if (comma > dot) value = value.replace(/\./g, "").replace(",", ".");
  else if (dot > comma && comma >= 0) value = value.replace(/,/g, "");
  else if (comma >= 0) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  else value = value.replace(/,/g, "");

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return (negative ? -Math.abs(parsed) : parsed).toFixed(2);
}

function findHeader(matrix: NextFitReceiptsMatrix) {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 30); rowIndex += 1) {
    const columns = new Map<ColumnKey, number>();
    (matrix[rowIndex] ?? []).forEach((cell, columnIndex) => {
      const key = HEADER_ALIASES[normalizeNextFitText(cell)];
      if (key && !columns.has(key)) columns.set(key, columnIndex);
    });
    if (REQUIRED_COLUMNS.every((key) => columns.has(key))) return { rowIndex, columns };
  }
  return null;
}

export function parseNextFitReceiptsMatrix(
  matrix: NextFitReceiptsMatrix,
  sheetName = "Recebimentos",
): ParsedNextFitReceiptsWorkbook {
  const header = findHeader(matrix);
  if (!header) {
    return {
      sheetNames: [sheetName],
      rows: [],
      issues: [{
        code: "UNEXPECTED_STRUCTURE",
        message: "A aba não contém as colunas Data, Método, Tipo e Valor.",
        severity: "ERROR",
        sheetName,
      }],
    };
  }

  const rows: ParsedNextFitReceiptRow[] = [];
  for (let rowIndex = header.rowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const source = matrix[rowIndex] ?? [];
    if (!source.some((cell) => displayCell(cell))) continue;
    const cell = (key: ColumnKey) => {
      const column = header.columns.get(key);
      return column === undefined ? undefined : source[column];
    };
    const rawAmount = displayCell(cell("rawAmount"));
    rows.push({
      sheetName,
      rowNumber: rowIndex + 1,
      cashRegister: displayCell(cell("cashRegister")),
      openingDate: parseNextFitReceiptDate(cell("openingDate")) ?? displayCell(cell("openingDate")),
      closingDate: parseNextFitReceiptDate(cell("closingDate")) ?? displayCell(cell("closingDate")),
      receiptDate: parseNextFitReceiptDate(cell("receiptDate")),
      origin: displayCell(cell("origin")),
      rawMethod: displayCell(cell("rawMethod")),
      rawType: displayCell(cell("rawType")),
      rawAmount,
      amount: parseNextFitReceiptAmount(cell("rawAmount")),
    });
  }

  return {
    sheetNames: [sheetName],
    rows,
    issues: rows.length ? [] : [{
      code: "EMPTY_FILE",
      message: "Nenhuma linha de recebimento foi encontrada na aba.",
      severity: "ERROR",
      sheetName,
    }],
  };
}

export async function readNextFitReceiptsWorkbook(
  bytes: ArrayBuffer | Uint8Array,
): Promise<ParsedNextFitReceiptsWorkbook> {
  try {
    const XLSX = await import("@e965/xlsx");
    const workbook = XLSX.read(bytes, {
      type: "array",
      raw: true,
      cellDates: true,
      codepage: 65001,
    });
    const parsed = workbook.SheetNames.map((sheetName) => {
      const matrix = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[sheetName], {
        header: 1,
        defval: null,
        raw: true,
      });
      return parseNextFitReceiptsMatrix(matrix, sheetName);
    });
    const rows = parsed.flatMap((sheet) => sheet.rows);
    const issues = parsed.flatMap((sheet) => sheet.issues);
    if (!rows.length && !issues.length) {
      throw new NextFitReceiptsError("UNEXPECTED_STRUCTURE", "Nenhuma aba reconhecível foi encontrada.");
    }
    return { sheetNames: workbook.SheetNames, rows, issues };
  } catch (error) {
    if (error instanceof NextFitReceiptsError) throw error;
    throw new NextFitReceiptsError(
      "INVALID_WORKBOOK",
      "O arquivo não pôde ser lido como uma planilha XLS/XLSX válida.",
    );
  }
}
