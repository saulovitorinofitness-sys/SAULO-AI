import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import type {
  ConfirmedNextFitDreBatch,
  NextFitDreDuplicateBatch,
  NextFitDreSnapshot,
} from "./contracts";
import { NextFitDreError } from "./contracts";

export interface NextFitDreBatchRepository {
  findByHash(fileHash: string): Promise<NextFitDreDuplicateBatch | null>;
  createValidated(input: {
    readonly fileName: string;
    readonly fileHash: string;
    readonly competence: string;
    readonly importedByUserId: string;
    readonly snapshot: NextFitDreSnapshot;
  }): Promise<ConfirmedNextFitDreBatch>;
  attachSnapshot(input: {
    readonly batchId: string;
    readonly fileHash: string;
    readonly competence: string;
    readonly snapshot: NextFitDreSnapshot;
  }): Promise<ConfirmedNextFitDreBatch>;
}

function duplicateView(batch: {
  id: string;
  fileName: string;
  competence: Date;
  importedAt: Date;
  status: "PENDING" | "VALIDATED" | "IMPORTED" | "FAILED" | "CANCELLED";
  snapshot: unknown;
}): NextFitDreDuplicateBatch {
  return {
    id: batch.id,
    fileName: batch.fileName,
    competence: batch.competence.toISOString().slice(0, 10),
    importedAt: batch.importedAt.toISOString(),
    status: batch.status,
    hasSnapshot: batch.snapshot !== null,
  };
}

function jsonValue(snapshot: NextFitDreSnapshot): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
}

function confirmedView(
  batch: {
    id: string;
    fileName: string;
    fileHash: string;
    competence: Date;
    importedAt: Date;
  },
  operation: ConfirmedNextFitDreBatch["operation"],
): ConfirmedNextFitDreBatch {
  return {
    id: batch.id,
    fileName: batch.fileName,
    fileHash: batch.fileHash,
    competence: batch.competence.toISOString().slice(0, 10),
    status: "VALIDATED",
    importedAt: batch.importedAt.toISOString(),
    operation,
  };
}

export const nextFitDreBatchRepository: NextFitDreBatchRepository = {
  async findByHash(fileHash) {
    const batch = await prisma.financialImportBatch.findUnique({
      where: { sourceSystem_fileHash: { sourceSystem: "NEXTFIT", fileHash } },
      select: {
        id: true,
        fileName: true,
        competence: true,
        importedAt: true,
        status: true,
        snapshot: true,
      },
    });
    return batch ? duplicateView(batch) : null;
  },

  async createValidated(input) {
    try {
      const batch = await prisma.financialImportBatch.create({
        data: {
          sourceSystem: "NEXTFIT",
          competence: new Date(`${input.competence}T00:00:00.000Z`),
          fileName: input.fileName,
          fileHash: input.fileHash,
          importedByUserId: input.importedByUserId,
          status: "VALIDATED",
          snapshot: jsonValue(input.snapshot),
        },
        select: {
          id: true,
          fileName: true,
          fileHash: true,
          competence: true,
          status: true,
          importedAt: true,
        },
      });
      return confirmedView(batch, "CREATED");
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new NextFitDreError(
          "DUPLICATE_FILE",
          "Este arquivo da DRE NextFit já possui um lote registrado.",
        );
      }
      throw error;
    }
  },

  async attachSnapshot(input) {
    const competence = new Date(`${input.competence}T00:00:00.000Z`);
    const updated = await prisma.financialImportBatch.updateMany({
      where: {
        id: input.batchId,
        sourceSystem: "NEXTFIT",
        fileHash: input.fileHash,
        competence,
        status: "VALIDATED",
        snapshot: { equals: Prisma.DbNull },
      },
      data: { snapshot: jsonValue(input.snapshot) },
    });
    if (updated.count !== 1) {
      const current = await prisma.financialImportBatch.findUnique({
        where: { id: input.batchId },
        select: { snapshot: true },
      });
      if (current && current.snapshot !== null) {
        throw new NextFitDreError(
          "SNAPSHOT_ALREADY_EXISTS",
          "Este lote já possui uma fotografia DRE e não foi sobrescrito.",
        );
      }
      throw new NextFitDreError(
        "SNAPSHOT_CONFLICT",
        "O arquivo ou a competência diverge do lote histórico. Nenhuma fotografia foi anexada.",
      );
    }
    const batch = await prisma.financialImportBatch.findUniqueOrThrow({
      where: { id: input.batchId },
      select: {
        id: true,
        fileName: true,
        fileHash: true,
        competence: true,
        status: true,
        importedAt: true,
      },
    });
    return confirmedView(batch, "SNAPSHOT_ATTACHED");
  },
};
