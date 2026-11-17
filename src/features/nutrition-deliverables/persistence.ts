import type { Prisma } from "@/generated/prisma/client";
import { parseStoredMealPlanPayload } from "@/features/meal-plan/record";
import { prisma } from "@/lib/database/prisma";

import type { NutritionDeliverableDraft } from "./contracts";

export const NUTRITION_REPORT_KIND = "NUTRITION_REPORT";

const OFFICIAL_METADATA_SCHEMA_VERSION = 1;

interface NutritionReportMetadata {
  readonly schemaVersion: typeof OFFICIAL_METADATA_SCHEMA_VERSION;
  readonly attendanceId: string;
  readonly sourceEntryId: string;
  readonly sourceVersionId: string;
  readonly sourceVersion: number;
  readonly approvedAt: string;
  readonly approvedByUserId: string;
  readonly snapshot: NutritionDeliverableDraft;
}

export interface OfficialNutritionDeliverable {
  readonly id: string;
  readonly masterRecordId: string;
  readonly version: number;
  readonly status: "PUBLISHED";
  readonly approvedAt: string;
  readonly approvedByUserId: string;
  readonly approvedByName: string;
  readonly sourceEntryId: string;
  readonly sourceVersionId: string;
  readonly sourceVersion: number;
  readonly snapshot: NutritionDeliverableDraft;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isNutritionDeliverableSnapshot(
  value: unknown,
): value is NutritionDeliverableDraft {
  const snapshot = objectValue(value);
  const cover = objectValue(snapshot?.cover);
  const diagnosis = objectValue(snapshot?.clinicalDiagnosis);
  return Boolean(
    snapshot &&
      typeof snapshot.deliverableId === "string" &&
      typeof snapshot.patientId === "string" &&
      typeof snapshot.attendanceId === "string" &&
      snapshot.status === "APPROVED" &&
      typeof snapshot.approvedAt === "string" &&
      cover &&
      typeof cover.patientName === "string" &&
      diagnosis &&
      typeof diagnosis.content === "string" &&
      objectValue(snapshot.mealPlan) &&
      objectValue(snapshot.nutritionStrategy) &&
      Array.isArray(snapshot.optionalSectionOrder),
  );
}

export function parseNutritionReportMetadata(
  value: unknown,
): NutritionReportMetadata | null {
  const metadata = objectValue(value);
  if (
    !metadata ||
    metadata.schemaVersion !== OFFICIAL_METADATA_SCHEMA_VERSION ||
    typeof metadata.attendanceId !== "string" ||
    typeof metadata.sourceEntryId !== "string" ||
    typeof metadata.sourceVersionId !== "string" ||
    typeof metadata.sourceVersion !== "number" ||
    !Number.isSafeInteger(metadata.sourceVersion) ||
    metadata.sourceVersion < 1 ||
    typeof metadata.approvedAt !== "string" ||
    typeof metadata.approvedByUserId !== "string" ||
    !isNutritionDeliverableSnapshot(metadata.snapshot)
  ) {
    return null;
  }
  if (
    metadata.snapshot.attendanceId !== metadata.attendanceId ||
    metadata.snapshot.mealPlan?.planId !== metadata.sourceEntryId
  ) {
    return null;
  }
  return metadata as unknown as NutritionReportMetadata;
}

function asInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function officialFromRow(row: {
  id: string;
  masterRecordId: string;
  version: number;
  status: string;
  metadata: unknown;
  createdBy: { id: string; fullName: string };
}): OfficialNutritionDeliverable | null {
  if (row.status !== "PUBLISHED") return null;
  const metadata = parseNutritionReportMetadata(row.metadata);
  if (!metadata) return null;
  return {
    id: row.id,
    masterRecordId: row.masterRecordId,
    version: row.version,
    status: "PUBLISHED",
    approvedAt: metadata.approvedAt,
    approvedByUserId: metadata.approvedByUserId,
    approvedByName: row.createdBy.fullName,
    sourceEntryId: metadata.sourceEntryId,
    sourceVersionId: metadata.sourceVersionId,
    sourceVersion: metadata.sourceVersion,
    snapshot: metadata.snapshot,
  };
}

async function finalizedPlanSource(patientId: string, attendanceId: string) {
  const entry = await prisma.masterRecordEntry.findFirst({
    where: {
      type: "MEAL_PLAN",
      attendanceId,
      status: "FINALIZED",
      deletedAt: null,
      masterRecord: {
        patientId,
        status: "ACTIVE",
        patient: { status: "ACTIVE", deletedAt: null },
      },
      mealPlan: { isNot: null },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, masterRecordId: true },
  });
  if (!entry) return null;

  const version = await prisma.recordVersion.findFirst({
    where: {
      entityType: "MEAL_PLAN",
      entityId: entry.id,
      status: "FINALIZED",
    },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    select: { id: true, version: true, snapshot: true },
  });
  if (!version) return null;
  const plan = parseStoredMealPlanPayload(version.snapshot);
  return plan?.status === "APPROVED" ? { entry, version } : null;
}

export const nutritionDeliverablePersistence = {
  async listOfficial(input: {
    readonly patientId: string;
    readonly attendanceId: string;
  }): Promise<readonly OfficialNutritionDeliverable[]> {
    const rows = await prisma.deliverable.findMany({
      where: {
        kind: NUTRITION_REPORT_KIND,
        status: "PUBLISHED",
        deletedAt: null,
        masterRecord: {
          patientId: input.patientId,
          status: "ACTIVE",
          patient: { status: "ACTIVE", deletedAt: null },
        },
        metadata: { path: ["attendanceId"], equals: input.attendanceId },
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        masterRecordId: true,
        version: true,
        status: true,
        metadata: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    return rows.flatMap((row) => {
      const official = officialFromRow(row);
      return official ? [official] : [];
    });
  },

  async getOfficial(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly deliverableId: string;
  }): Promise<OfficialNutritionDeliverable | null> {
    const row = await prisma.deliverable.findFirst({
      where: {
        id: input.deliverableId,
        kind: NUTRITION_REPORT_KIND,
        status: "PUBLISHED",
        deletedAt: null,
        masterRecord: {
          patientId: input.patientId,
          status: "ACTIVE",
          patient: { status: "ACTIVE", deletedAt: null },
        },
        metadata: { path: ["attendanceId"], equals: input.attendanceId },
      },
      select: {
        id: true,
        masterRecordId: true,
        version: true,
        status: true,
        metadata: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    return row ? officialFromRow(row) : null;
  },

  async saveOfficial(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly professionalUserId: string;
    readonly draft: NutritionDeliverableDraft;
  }): Promise<OfficialNutritionDeliverable> {
    if (
      input.draft.patientId !== input.patientId ||
      input.draft.attendanceId !== input.attendanceId
    ) {
      throw new Error("NUTRITION_DELIVERABLE_CONTEXT_MISMATCH");
    }
    if (input.draft.status === "APPROVED") {
      throw new Error("NUTRITION_DELIVERABLE_ALREADY_OFFICIAL");
    }
    if (!input.draft.nutritionStrategy || !input.draft.mealPlan) {
      throw new Error("NUTRITION_DELIVERABLE_INCOMPLETE_DRAFT");
    }

    const source = await finalizedPlanSource(
      input.patientId,
      input.attendanceId,
    );
    if (!source || input.draft.mealPlan.planId !== source.entry.id) {
      throw new Error("NUTRITION_DELIVERABLE_SOURCE_NOT_FINALIZED");
    }

    const existing = await prisma.deliverable.findFirst({
      where: {
        masterRecordId: source.entry.masterRecordId,
        kind: NUTRITION_REPORT_KIND,
        status: "PUBLISHED",
        deletedAt: null,
        metadata: {
          path: ["sourceVersionId"],
          equals: source.version.id,
        },
      },
      select: {
        id: true,
        masterRecordId: true,
        version: true,
        status: true,
        metadata: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    const existingOfficial = existing ? officialFromRow(existing) : null;
    if (existingOfficial) return existingOfficial;

    const approvedAt = new Date().toISOString();
    const snapshot: NutritionDeliverableDraft = {
      ...input.draft,
      status: "APPROVED",
      approvedAt,
      savedAt: approvedAt,
      includeClinicalDiagnosis: Boolean(
        (input.draft.includeClinicalDiagnosis ??
          Boolean(input.draft.clinicalDiagnosis.content.trim())) &&
          input.draft.clinicalDiagnosis.content.trim(),
      ),
    };
    const metadata: NutritionReportMetadata = {
      schemaVersion: OFFICIAL_METADATA_SCHEMA_VERSION,
      attendanceId: input.attendanceId,
      sourceEntryId: source.entry.id,
      sourceVersionId: source.version.id,
      sourceVersion: source.version.version,
      approvedAt,
      approvedByUserId: input.professionalUserId,
      snapshot,
    };

    const created = await prisma.$transaction(async (transaction) => {
      const deliverablesModule = await transaction.systemModule.findUnique({
        where: { key: "DELIVERABLES" },
        select: { id: true },
      });
      if (!deliverablesModule) throw new Error("DELIVERABLES_MODULE_NOT_FOUND");

      const existingInTransaction = await transaction.deliverable.findFirst({
        where: {
          masterRecordId: source.entry.masterRecordId,
          kind: NUTRITION_REPORT_KIND,
          status: "PUBLISHED",
          deletedAt: null,
          metadata: {
            path: ["sourceVersionId"],
            equals: source.version.id,
          },
        },
        select: {
          id: true,
          masterRecordId: true,
          version: true,
          status: true,
          metadata: true,
          createdBy: { select: { id: true, fullName: true } },
        },
      });
      if (existingInTransaction) return existingInTransaction;

      const latest = await transaction.deliverable.findFirst({
        where: {
          masterRecordId: source.entry.masterRecordId,
          kind: NUTRITION_REPORT_KIND,
        },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      return transaction.deliverable.create({
        data: {
          masterRecordId: source.entry.masterRecordId,
          moduleId: deliverablesModule.id,
          createdByUserId: input.professionalUserId,
          updatedByUserId: input.professionalUserId,
          kind: NUTRITION_REPORT_KIND,
          title: snapshot.cover.documentTitle,
          version: (latest?.version ?? 0) + 1,
          status: "PUBLISHED",
          metadata: asInputJson(metadata),
        },
        select: {
          id: true,
          masterRecordId: true,
          version: true,
          status: true,
          metadata: true,
          createdBy: { select: { id: true, fullName: true } },
        },
      });
    });
    const official = officialFromRow(created);
    if (!official) throw new Error("NUTRITION_DELIVERABLE_PERSISTENCE_FAILED");
    return official;
  },
};
