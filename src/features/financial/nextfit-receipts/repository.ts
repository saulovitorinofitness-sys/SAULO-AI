import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import type {
  ConfirmedNextFitReceiptsBatch,
  NextFitReceiptDuplicateBatch,
  NextFitReceiptsManifest,
  ValidatedNextFitReceiptRow,
} from "./contracts";
import {
  NEXTFIT_RECEIPTS_MANIFEST_VERSION,
  NextFitReceiptsError,
} from "./contracts";

export interface NextFitReceiptsReferences {
  readonly businessUnit: { readonly id: string; readonly code: string; readonly status: string } | null;
  readonly category: {
    readonly id: string;
    readonly code: string;
    readonly type: string;
    readonly businessUnitId: string | null;
    readonly status: string;
  } | null;
  readonly accounts: readonly {
    readonly id: string;
    readonly code: string;
    readonly businessUnitId: string;
    readonly status: string;
  }[];
  readonly paymentMethods: readonly {
    readonly id: string;
    readonly code: string;
    readonly status: string;
  }[];
}

export interface PersistableNextFitReceiptRow extends ValidatedNextFitReceiptRow {
  readonly financialAccountId: string;
  readonly paymentMethodId: string;
}

export interface ConfirmNextFitReceiptsInput {
  readonly fileName: string;
  readonly fileHash: string;
  readonly importedByUserId: string;
  readonly businessUnitId: string;
  readonly financialCategoryId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly rowCount: number;
  readonly invalidCount: number;
  readonly rows: readonly PersistableNextFitReceiptRow[];
  readonly buildManifest: (input: {
    readonly importedAt: string;
    readonly importedRows: readonly PersistableNextFitReceiptRow[];
    readonly duplicateCount: number;
  }) => NextFitReceiptsManifest;
}

export interface NextFitReceiptsRepository {
  findByHash(fileHash: string): Promise<NextFitReceiptDuplicateBatch | null>;
  findExistingFingerprints(
    businessUnitId: string,
    fingerprints: readonly string[],
  ): Promise<readonly string[]>;
  getReferences(): Promise<NextFitReceiptsReferences>;
  confirm(input: ConfirmNextFitReceiptsInput): Promise<ConfirmedNextFitReceiptsBatch>;
}

function isReceiptsManifest(value: unknown): value is NextFitReceiptsManifest {
  return Boolean(
    value &&
      typeof value === "object" &&
      "kind" in value &&
      value.kind === "NEXTFIT_RECEIPTS" &&
      "manifestVersion" in value &&
      value.manifestVersion === NEXTFIT_RECEIPTS_MANIFEST_VERSION,
  );
}

function duplicateView(batch: {
  id: string;
  fileName: string;
  importedAt: Date;
  status: string;
  snapshot: unknown;
}): NextFitReceiptDuplicateBatch | null {
  if (batch.status !== "IMPORTED" || !isReceiptsManifest(batch.snapshot)) return null;
  return {
    id: batch.id,
    fileName: batch.fileName,
    importedAt: batch.importedAt.toISOString(),
    status: "IMPORTED",
    kind: "NEXTFIT_RECEIPTS",
  };
}

function jsonValue(value: NextFitReceiptsManifest): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function replayedView(batch: {
  id: string;
  fileName: string;
  fileHash: string;
  importedAt: Date;
  snapshot: unknown;
}): ConfirmedNextFitReceiptsBatch {
  if (!isReceiptsManifest(batch.snapshot)) {
    throw new NextFitReceiptsError(
      "DUPLICATE_FILE",
      "O hash do arquivo já pertence a outro tipo de importação NextFit.",
    );
  }
  return {
    id: batch.id,
    fileName: batch.fileName,
    fileHash: batch.fileHash,
    periodStart: batch.snapshot.periodStart,
    periodEnd: batch.snapshot.periodEnd,
    importedAt: batch.importedAt.toISOString(),
    status: "IMPORTED",
    operation: "REPLAYED",
    importedCount: 0,
    duplicateCount: batch.snapshot.importedCount,
    totalAmount: "0.00",
  };
}

export const nextFitReceiptsRepository: NextFitReceiptsRepository = {
  async findByHash(fileHash) {
    const batch = await prisma.financialImportBatch.findUnique({
      where: { sourceSystem_fileHash: { sourceSystem: "NEXTFIT", fileHash } },
      select: { id: true, fileName: true, importedAt: true, status: true, snapshot: true },
    });
    return batch ? duplicateView(batch) : null;
  },

  async findExistingFingerprints(businessUnitId, fingerprints) {
    if (!fingerprints.length) return [];
    const entries = await prisma.financialEntry.findMany({
      where: {
        businessUnitId,
        sourceType: "NEXTFIT_RECEBIMENTO",
        sourceId: { in: [...fingerprints] },
      },
      select: { sourceId: true },
    });
    return entries.flatMap((entry) => entry.sourceId ? [entry.sourceId] : []);
  },

  async getReferences() {
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { code: "ACADEMIA" },
      select: { id: true, code: true, status: true },
    });
    const [category, accounts, paymentMethods] = await Promise.all([
      prisma.financialCategory.findUnique({
        where: { code: "ACADEMIA_MENSALIDADES" },
        select: { id: true, code: true, type: true, businessUnitId: true, status: true },
      }),
      businessUnit
        ? prisma.financialAccount.findMany({
            where: {
              businessUnitId: businessUnit.id,
              code: { in: ["NUBANK", "SUMUP", "CAIXA_FISICO"] },
            },
            select: { id: true, code: true, businessUnitId: true, status: true },
          })
        : Promise.resolve([]),
      prisma.paymentMethod.findMany({
        where: { code: { in: ["PIX", "CREDITO", "DEBITO", "DINHEIRO"] } },
        select: { id: true, code: true, status: true },
      }),
    ]);
    return { businessUnit, category, accounts, paymentMethods };
  },

  async confirm(input) {
    return prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`nextfit-receipts:file:${input.fileHash}`}))
        `;
        for (const fingerprint of [...input.rows].map((row) => row.fingerprint).sort()) {
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtext(${`nextfit-receipts:row:${fingerprint}`}))
          `;
        }

        const existingBatch = await transaction.financialImportBatch.findUnique({
          where: { sourceSystem_fileHash: { sourceSystem: "NEXTFIT", fileHash: input.fileHash } },
          select: { id: true, fileName: true, fileHash: true, importedAt: true, snapshot: true },
        });
        if (existingBatch) return replayedView(existingBatch);

        const existingEntries = input.rows.length
          ? await transaction.financialEntry.findMany({
              where: {
                businessUnitId: input.businessUnitId,
                sourceType: "NEXTFIT_RECEBIMENTO",
                sourceId: { in: input.rows.map((row) => row.fingerprint) },
              },
              select: { sourceId: true },
            })
          : [];
        const existingFingerprints = new Set(existingEntries.flatMap((entry) =>
          entry.sourceId ? [entry.sourceId] : [],
        ));
        const importedRows = input.rows.filter((row) => !existingFingerprints.has(row.fingerprint));
        const importedAt = new Date();
        const manifest = input.buildManifest({
          importedAt: importedAt.toISOString(),
          importedRows,
          duplicateCount: input.rows.length - importedRows.length,
        });

        const batch = await transaction.financialImportBatch.create({
          data: {
            sourceSystem: "NEXTFIT",
            competence: new Date(`${input.periodStart}T00:00:00.000Z`),
            fileName: input.fileName,
            fileHash: input.fileHash,
            importedAt,
            importedByUserId: input.importedByUserId,
            status: "IMPORTED",
            snapshot: jsonValue(manifest),
          },
          select: { id: true },
        });

        for (const row of importedRows) {
          const receiptDate = new Date(`${row.receiptDate}T00:00:00.000Z`);
          const sourceMetadata = JSON.stringify({
            nextFitCashRegister: row.cashRegister,
            nextFitOpeningDate: row.openingDate,
            nextFitClosingDate: row.closingDate,
            nextFitOrigin: row.origin,
            nextFitMethod: row.rawMethod,
            sourceSheet: row.sheetName,
            sourceRow: row.rowNumber,
          });
          await transaction.financialEntry.create({
            data: {
              type: "REVENUE",
              competence: receiptDate,
              dueDate: receiptDate,
              amount: new Prisma.Decimal(row.amount),
              description: `Recebimento NextFit — ${row.rawMethod}`,
              observation: sourceMetadata,
              status: "SETTLED",
              origin: "EXTERNAL_IMPORT",
              sourceSystem: "NEXTFIT",
              managementNature: "REALIZED",
              sourceType: "NEXTFIT_RECEBIMENTO",
              sourceId: row.fingerprint,
              importBatchId: batch.id,
              businessUnitId: input.businessUnitId,
              financialCategoryId: input.financialCategoryId,
              settlements: {
                create: {
                  amount: new Prisma.Decimal(row.amount),
                  settlementDate: receiptDate,
                  financialAccountId: row.financialAccountId,
                  paymentMethodId: row.paymentMethodId,
                  observation: sourceMetadata,
                  idempotencyKey: `nextfit-receipt:${row.fingerprint}`,
                },
              },
            },
          });
        }

        return {
          id: batch.id,
          fileName: input.fileName,
          fileHash: input.fileHash,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          importedAt: importedAt.toISOString(),
          status: "IMPORTED",
          operation: "CREATED",
          importedCount: importedRows.length,
          duplicateCount: input.rows.length - importedRows.length,
          totalAmount: importedRows
            .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
            .toFixed(2),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },
};
