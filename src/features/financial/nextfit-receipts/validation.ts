import type {
  NextFitReceiptIssue,
  NextFitReceiptPreviewRow,
  ParsedNextFitReceiptRow,
  ValidatedNextFitReceiptRow,
} from "./contracts";
import { fingerprintNextFitReceiptRows } from "./fingerprint";
import {
  getNextFitReceiptDestination,
  normalizeNextFitReceiptMethod,
  normalizeNextFitText,
} from "./mapping";

export interface ValidatedNextFitReceipts {
  readonly validRows: readonly ValidatedNextFitReceiptRow[];
  readonly invalidRows: readonly NextFitReceiptPreviewRow[];
  readonly issues: readonly NextFitReceiptIssue[];
}

function rowIssue(
  row: ParsedNextFitReceiptRow,
  code: NextFitReceiptIssue["code"],
  message: string,
): NextFitReceiptIssue {
  return {
    code,
    message,
    severity: "ERROR",
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
  };
}

export function validateNextFitReceiptRows(
  rows: readonly ParsedNextFitReceiptRow[],
): ValidatedNextFitReceipts {
  const candidates: Omit<ValidatedNextFitReceiptRow, "fingerprint" | "occurrence">[] = [];
  const invalidRows: NextFitReceiptPreviewRow[] = [];
  const issues: NextFitReceiptIssue[] = [];

  for (const row of rows) {
    const rowIssues: NextFitReceiptIssue[] = [];
    const type = normalizeNextFitText(row.rawType);
    if (type !== "entrada") {
      rowIssues.push(rowIssue(
        row,
        "INVALID_ROW_TYPE",
        `Tipo “${row.rawType ?? "não informado"}” não representa uma entrada confirmada.`,
      ));
    }
    if (!row.receiptDate) {
      rowIssues.push(rowIssue(row, "INVALID_DATE", "A data do recebimento é inválida ou não foi informada."));
    }
    const method = normalizeNextFitReceiptMethod(row.rawMethod);
    if (!method) {
      rowIssues.push(rowIssue(
        row,
        "UNRECOGNIZED_METHOD",
        `Método “${row.rawMethod ?? "não informado"}” não é reconhecido nesta etapa.`,
      ));
    }
    if (!row.amount || Number(row.amount) <= 0) {
      rowIssues.push(rowIssue(
        row,
        "INVALID_AMOUNT",
        "O valor precisa ser numérico e maior que zero; saídas e estornos não são importados.",
      ));
    }

    if (rowIssues.length || !method || !row.receiptDate || !row.amount) {
      issues.push(...rowIssues);
      invalidRows.push({
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        receiptDate: row.receiptDate,
        cashRegister: row.cashRegister,
        origin: row.origin,
        rawMethod: row.rawMethod,
        amount: row.amount,
        status: "INVALID",
        issues: rowIssues,
      });
      continue;
    }

    const destination = getNextFitReceiptDestination(method);
    candidates.push({
      ...row,
      receiptDate: row.receiptDate,
      rawMethod: row.rawMethod ?? "",
      rawType: row.rawType ?? "",
      amount: row.amount,
      method,
      destinationAccountCode: destination.accountCode,
      paymentMethodCode: destination.paymentMethodCode,
    });
  }

  return {
    validRows: fingerprintNextFitReceiptRows(candidates),
    invalidRows,
    issues,
  };
}
