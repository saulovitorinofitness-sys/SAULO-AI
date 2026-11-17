import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";

import type {
  ConfirmedNextFitReceiptsBatch,
  NextFitReceiptIssue,
  NextFitReceiptPreview,
  NextFitReceiptPreviewRow,
  NextFitReceiptsManifest,
} from "./contracts";
import {
  NEXTFIT_RECEIPTS_MANIFEST_VERSION,
  NEXTFIT_RECEIPTS_PARSER_VERSION,
  NextFitReceiptsError,
} from "./contracts";
import { getNextFitReceiptsReportFamily } from "./mapping";
import { readNextFitReceiptsWorkbook } from "./parser";
import {
  nextFitReceiptsRepository,
  type NextFitReceiptsReferences,
  type NextFitReceiptsRepository,
  type PersistableNextFitReceiptRow,
} from "./repository";
import { validateNextFitReceiptRows } from "./validation";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["xls", "xlsx"]);

function validateFile(fileName: string, bytes: Uint8Array) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || !ACCEPTED_EXTENSIONS.has(extension)) {
    throw new NextFitReceiptsError(
      "INVALID_FILE_FORMAT",
      "Selecione um relatório de recebimentos NextFit nos formatos XLS ou XLSX.",
    );
  }
  if (!bytes.byteLength) {
    throw new NextFitReceiptsError("INVALID_WORKBOOK", "O arquivo selecionado está vazio.");
  }
  if (bytes.byteLength > MAX_FILE_SIZE) {
    throw new NextFitReceiptsError("FILE_TOO_LARGE", "O arquivo excede o limite de 10 MB.");
  }
}

function hashFile(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function missingReferenceIssues(
  references: NextFitReceiptsReferences,
  accountCodes: readonly string[],
  paymentMethodCodes: readonly string[],
): NextFitReceiptIssue[] {
  const issues: NextFitReceiptIssue[] = [];
  const push = (message: string) => issues.push({
    code: "MISSING_REFERENCE",
    message,
    severity: "ERROR",
  });
  if (!references.businessUnit || references.businessUnit.status !== "ACTIVE") {
    push("A unidade ativa ACADEMIA não foi encontrada.");
  }
  if (
    !references.category ||
    references.category.status !== "ACTIVE" ||
    references.category.type !== "REVENUE" ||
    references.category.businessUnitId !== references.businessUnit?.id
  ) {
    push("A categoria ativa ACADEMIA_MENSALIDADES não está vinculada à Academia.");
  }
  for (const code of accountCodes) {
    const account = references.accounts.find((item) => item.code === code);
    if (
      !account ||
      account.status !== "ACTIVE" ||
      account.businessUnitId !== references.businessUnit?.id
    ) {
      push(`A conta financeira ativa ${code} não foi encontrada na Academia.`);
    }
  }
  for (const code of paymentMethodCodes) {
    const method = references.paymentMethods.find((item) => item.code === code);
    if (!method || method.status !== "ACTIVE") {
      push(`A forma de pagamento ativa ${code} não foi encontrada.`);
    }
  }
  return issues;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function previewRow(
  row: PersistableNextFitReceiptRow,
  status: "VALID" | "DUPLICATE",
): NextFitReceiptPreviewRow {
  const issues: NextFitReceiptIssue[] = status === "DUPLICATE" ? [{
    code: "DUPLICATE_ROW",
    message: "Esta linha já foi confirmada em uma importação anterior.",
    severity: "WARNING",
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
  }] : [];
  return {
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    receiptDate: row.receiptDate,
    cashRegister: row.cashRegister,
    origin: row.origin,
    rawMethod: row.rawMethod,
    method: row.method,
    amount: row.amount,
    destinationAccountCode: row.destinationAccountCode,
    paymentMethodCode: row.paymentMethodCode,
    fingerprint: row.fingerprint,
    status,
    issues,
  };
}

export function createNextFitReceiptsService(
  repository: NextFitReceiptsRepository = nextFitReceiptsRepository,
) {
  async function analyze(fileName: string, bytes: Uint8Array) {
    validateFile(fileName, bytes);
    const fileHash = hashFile(bytes);
    const parsed = await readNextFitReceiptsWorkbook(bytes);
    const validated = validateNextFitReceiptRows(parsed.rows);
    const references = await repository.getReferences();
    const accountCodes = unique(validated.validRows.map((row) => row.destinationAccountCode));
    const paymentMethodCodes = unique(validated.validRows.map((row) => row.paymentMethodCode));
    const referenceIssues = missingReferenceIssues(references, accountCodes, paymentMethodCodes);
    const businessUnitId = references.businessUnit?.id;
    const [duplicateBatch, existingFingerprints] = await Promise.all([
      repository.findByHash(fileHash),
      businessUnitId
        ? repository.findExistingFingerprints(
            businessUnitId,
            validated.validRows.map((row) => row.fingerprint),
          )
        : Promise.resolve([]),
    ]);
    const duplicateSet = new Set(existingFingerprints);
    const accountByCode = new Map(references.accounts.map((item) => [item.code, item]));
    const paymentMethodByCode = new Map(references.paymentMethods.map((item) => [item.code, item]));
    const resolvedRows = validated.validRows.flatMap((row): PersistableNextFitReceiptRow[] => {
      const account = accountByCode.get(row.destinationAccountCode);
      const method = paymentMethodByCode.get(row.paymentMethodCode);
      return account && method
        ? [{ ...row, financialAccountId: account.id, paymentMethodId: method.id }]
        : [];
    });
    const importableRows = resolvedRows.filter((row) => !duplicateSet.has(row.fingerprint));
    const duplicateRows = resolvedRows.filter((row) => duplicateSet.has(row.fingerprint));
    const methods = unique(validated.validRows.map((row) => row.method)).sort();
    const destinationAccounts = unique(accountCodes).sort();
    const dates = validated.validRows.map((row) => row.receiptDate).sort();
    const duplicateFileIssue: NextFitReceiptIssue[] = duplicateBatch ? [{
      code: "DUPLICATE_FILE",
      message: `Este arquivo já foi importado em ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(duplicateBatch.importedAt))}.`,
      severity: "ERROR",
    }] : [];
    const issues = [
      ...duplicateFileIssue,
      ...parsed.issues,
      ...validated.issues,
      ...duplicateRows.flatMap((row) => previewRow(row, "DUPLICATE").issues),
      ...referenceIssues,
    ];
    const preview: NextFitReceiptPreview = {
      fileName,
      fileHash,
      source: "NEXTFIT",
      reportFamily: getNextFitReceiptsReportFamily(methods),
      periodStart: dates[0],
      periodEnd: dates.at(-1),
      rowCount: parsed.rows.length,
      validCount: importableRows.length,
      duplicateCount: duplicateRows.length,
      invalidCount: validated.invalidRows.length,
      validAmount: importableRows
        .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
        .toFixed(2),
      methods,
      destinationAccounts,
      rows: [
        ...importableRows.map((row) => previewRow(row, "VALID")),
        ...duplicateRows.map((row) => previewRow(row, "DUPLICATE")),
        ...validated.invalidRows,
      ].sort((left, right) => left.rowNumber - right.rowNumber),
      issues,
      duplicateBatch: duplicateBatch ?? undefined,
      canConfirm: !duplicateBatch && importableRows.length > 0 && referenceIssues.length === 0,
    };
    return { preview, importableRows, references };
  }

  return {
    async inspect(fileName: string, bytes: Uint8Array): Promise<NextFitReceiptPreview> {
      return (await analyze(fileName, bytes)).preview;
    },

    async confirm(input: {
      readonly fileName: string;
      readonly bytes: Uint8Array;
      readonly expectedHash: string;
      readonly importedByUserId: string;
    }): Promise<ConfirmedNextFitReceiptsBatch> {
      const analysis = await analyze(input.fileName, input.bytes);
      const { preview, importableRows, references } = analysis;
      if (preview.fileHash !== input.expectedHash) {
        throw new NextFitReceiptsError(
          "FILE_CHANGED",
          "O arquivo mudou depois da prévia. Gere uma nova prévia antes de confirmar.",
        );
      }
      if (!preview.periodStart || !preview.periodEnd) {
        throw new NextFitReceiptsError("NO_VALID_RECEIPTS", "Nenhum recebimento válido foi encontrado.");
      }
      if (!preview.duplicateBatch && !preview.canConfirm) {
        const missingReference = preview.issues.some((issue) => issue.code === "MISSING_REFERENCE");
        throw new NextFitReceiptsError(
          missingReference ? "MISSING_REFERENCE" : "NO_VALID_RECEIPTS",
          missingReference
            ? "Cadastros financeiros necessários não estão disponíveis."
            : "Nenhum recebimento novo e válido foi encontrado.",
        );
      }
      if (!references.businessUnit || !references.category) {
        throw new NextFitReceiptsError("MISSING_REFERENCE", "Unidade ou categoria financeira ausente.");
      }
      const initialDuplicateCount = preview.duplicateCount;
      return repository.confirm({
        fileName: preview.fileName,
        fileHash: preview.fileHash,
        importedByUserId: input.importedByUserId,
        businessUnitId: references.businessUnit.id,
        financialCategoryId: references.category.id,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        rowCount: preview.rowCount,
        invalidCount: preview.invalidCount,
        rows: importableRows,
        buildManifest: ({ importedAt, importedRows, duplicateCount }) => {
          const methods = unique(importedRows.map((row) => row.method)).sort();
          const destinations = unique(importedRows.map((row) => row.destinationAccountCode)).sort();
          return {
            kind: "NEXTFIT_RECEIPTS",
            manifestVersion: NEXTFIT_RECEIPTS_MANIFEST_VERSION,
            parserVersion: NEXTFIT_RECEIPTS_PARSER_VERSION,
            source: "NEXTFIT",
            fileName: preview.fileName,
            fileHash: preview.fileHash,
            reportFamily: getNextFitReceiptsReportFamily(methods),
            periodStart: preview.periodStart!,
            periodEnd: preview.periodEnd!,
            recordCount: preview.rowCount,
            validCount: importedRows.length,
            duplicateCount: initialDuplicateCount + duplicateCount,
            invalidCount: preview.invalidCount,
            importedCount: importedRows.length,
            totalAmount: importedRows
              .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
              .toFixed(2),
            methods,
            destinationAccounts: destinations,
            importedAt,
            status: "IMPORTED",
            records: importedRows.map((row) => ({
              fingerprint: row.fingerprint,
              rowNumber: row.rowNumber,
              sheetName: row.sheetName,
              receiptDate: row.receiptDate,
              amount: row.amount,
              method: row.method,
              cashRegister: row.cashRegister,
              openingDate: row.openingDate,
              closingDate: row.closingDate,
              origin: row.origin,
            })),
          } satisfies NextFitReceiptsManifest;
        },
      });
    },
  };
}

export const nextFitReceiptsService = createNextFitReceiptsService();
