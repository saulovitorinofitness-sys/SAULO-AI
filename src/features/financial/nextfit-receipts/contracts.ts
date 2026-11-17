export type NextFitReceiptMethod =
  | "PIX_DEPOSIT"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CASH";

export type NextFitReceiptReportFamily =
  | "PIX_DEPOSIT"
  | "CARDS"
  | "CASH"
  | "MIXED";

export type NextFitReceiptSeverity = "INFO" | "WARNING" | "ERROR";

export interface NextFitReceiptIssue {
  readonly code:
    | "DUPLICATE_FILE"
    | "DUPLICATE_ROW"
    | "EMPTY_FILE"
    | "INVALID_AMOUNT"
    | "INVALID_DATE"
    | "INVALID_ROW_TYPE"
    | "MISSING_REFERENCE"
    | "UNRECOGNIZED_METHOD"
    | "UNEXPECTED_STRUCTURE";
  readonly message: string;
  readonly severity: NextFitReceiptSeverity;
  readonly sheetName?: string;
  readonly rowNumber?: number;
}

export interface ParsedNextFitReceiptRow {
  readonly sheetName: string;
  readonly rowNumber: number;
  readonly cashRegister?: string;
  readonly openingDate?: string;
  readonly closingDate?: string;
  readonly receiptDate?: string;
  readonly origin?: string;
  readonly rawMethod?: string;
  readonly rawType?: string;
  readonly rawAmount?: string;
  readonly amount?: string;
}

export interface ValidatedNextFitReceiptRow
  extends ParsedNextFitReceiptRow {
  readonly receiptDate: string;
  readonly rawMethod: string;
  readonly rawType: string;
  readonly amount: string;
  readonly method: NextFitReceiptMethod;
  readonly fingerprint: string;
  readonly occurrence: number;
  readonly destinationAccountCode: string;
  readonly paymentMethodCode: string;
}

export interface NextFitReceiptPreviewRow {
  readonly sheetName: string;
  readonly rowNumber: number;
  readonly receiptDate?: string;
  readonly cashRegister?: string;
  readonly origin?: string;
  readonly rawMethod?: string;
  readonly method?: NextFitReceiptMethod;
  readonly amount?: string;
  readonly destinationAccountCode?: string;
  readonly paymentMethodCode?: string;
  readonly fingerprint?: string;
  readonly status: "VALID" | "DUPLICATE" | "INVALID";
  readonly issues: readonly NextFitReceiptIssue[];
}

export interface NextFitReceiptDuplicateBatch {
  readonly id: string;
  readonly fileName: string;
  readonly importedAt: string;
  readonly status: "IMPORTED";
  readonly kind: "NEXTFIT_RECEIPTS";
}

export interface NextFitReceiptPreview {
  readonly fileName: string;
  readonly fileHash: string;
  readonly source: "NEXTFIT";
  readonly reportFamily: NextFitReceiptReportFamily;
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly rowCount: number;
  readonly validCount: number;
  readonly duplicateCount: number;
  readonly invalidCount: number;
  readonly validAmount: string;
  readonly methods: readonly NextFitReceiptMethod[];
  readonly destinationAccounts: readonly string[];
  readonly rows: readonly NextFitReceiptPreviewRow[];
  readonly issues: readonly NextFitReceiptIssue[];
  readonly duplicateBatch?: NextFitReceiptDuplicateBatch;
  readonly canConfirm: boolean;
}

export const NEXTFIT_RECEIPTS_MANIFEST_VERSION =
  "nextfit-receipts-manifest@1" as const;
export const NEXTFIT_RECEIPTS_PARSER_VERSION =
  "nextfit-receipts-tabular@1" as const;

export interface NextFitReceiptsManifest {
  readonly kind: "NEXTFIT_RECEIPTS";
  readonly manifestVersion: typeof NEXTFIT_RECEIPTS_MANIFEST_VERSION;
  readonly parserVersion: typeof NEXTFIT_RECEIPTS_PARSER_VERSION;
  readonly source: "NEXTFIT";
  readonly fileName: string;
  readonly fileHash: string;
  readonly reportFamily: NextFitReceiptReportFamily;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly recordCount: number;
  readonly validCount: number;
  readonly duplicateCount: number;
  readonly invalidCount: number;
  readonly importedCount: number;
  readonly totalAmount: string;
  readonly methods: readonly NextFitReceiptMethod[];
  readonly destinationAccounts: readonly string[];
  readonly importedAt: string;
  readonly status: "IMPORTED";
  readonly records: readonly {
    readonly fingerprint: string;
    readonly rowNumber: number;
    readonly sheetName: string;
    readonly receiptDate: string;
    readonly amount: string;
    readonly method: NextFitReceiptMethod;
    readonly cashRegister?: string;
    readonly openingDate?: string;
    readonly closingDate?: string;
    readonly origin?: string;
  }[];
}

export interface ConfirmedNextFitReceiptsBatch {
  readonly id: string;
  readonly fileName: string;
  readonly fileHash: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly importedAt: string;
  readonly status: "IMPORTED";
  readonly operation: "CREATED" | "REPLAYED";
  readonly importedCount: number;
  readonly duplicateCount: number;
  readonly totalAmount: string;
}

export class NextFitReceiptsError extends Error {
  constructor(
    readonly code:
      | "DUPLICATE_FILE"
      | "FILE_CHANGED"
      | "FILE_TOO_LARGE"
      | "INVALID_FILE_FORMAT"
      | "INVALID_WORKBOOK"
      | "MISSING_REFERENCE"
      | "NO_VALID_RECEIPTS"
      | "UNEXPECTED_STRUCTURE",
    message: string,
  ) {
    super(message);
    this.name = "NextFitReceiptsError";
  }
}
