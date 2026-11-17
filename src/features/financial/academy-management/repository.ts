import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

export interface AcademyDreSnapshotBatchRecord {
  readonly id: string;
  readonly sourceSystem: "NEXTFIT";
  readonly competence: string;
  readonly fileName: string;
  readonly fileHash: string;
  readonly importedAt: string;
  readonly status: "VALIDATED" | "IMPORTED";
  readonly snapshot: unknown;
}

export interface AcademyManagementRepository {
  listDreSnapshots(year: number): Promise<readonly AcademyDreSnapshotBatchRecord[]>;
}

export const academyManagementRepository: AcademyManagementRepository = {
  async listDreSnapshots(year) {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    const batches = await prisma.financialImportBatch.findMany({
      where: {
        sourceSystem: "NEXTFIT",
        status: { in: ["VALIDATED", "IMPORTED"] },
        competence: { gte: start, lt: end },
        AND: [
          { snapshot: { not: Prisma.DbNull } },
          { snapshot: { path: ["kind"], equals: "NEXTFIT_DRE" } },
          { snapshot: { path: ["year"], equals: year } },
        ],
      },
      orderBy: [{ competence: "desc" }, { importedAt: "desc" }],
      select: {
        id: true,
        sourceSystem: true,
        competence: true,
        fileName: true,
        fileHash: true,
        importedAt: true,
        status: true,
        snapshot: true,
      },
    });

    return batches.map((batch) => ({
      id: batch.id,
      sourceSystem: "NEXTFIT",
      competence: batch.competence.toISOString().slice(0, 10),
      fileName: batch.fileName,
      fileHash: batch.fileHash,
      importedAt: batch.importedAt.toISOString(),
      status: batch.status === "IMPORTED" ? "IMPORTED" : "VALIDATED",
      snapshot: batch.snapshot,
    }));
  },
};
