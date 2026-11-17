import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { ConsultationType } from "@/modules/attendance";
import {
  NUTRITION_REPORT_KIND,
  parseNutritionReportMetadata,
} from "@/features/nutrition-deliverables/persistence";

export type DocumentIndexType = "nutrition" | "postural" | "performance";
export type DocumentIndexStatus =
  | "nutrition-approved"
  | "nutrition-ready"
  | "postural-completed"
  | "performance-finalized";

export interface DocumentIndexFilters {
  readonly patient?: string;
  readonly type?: DocumentIndexType;
  readonly status?: DocumentIndexStatus;
  readonly from?: Date;
  readonly toExclusive?: Date;
  readonly page: number;
  readonly allowedTypes: readonly DocumentIndexType[];
}

export interface DocumentIndexItem {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientCode: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly attendanceDate: Date;
  readonly consultationType?: ConsultationType;
  readonly type: DocumentIndexType;
  readonly status: DocumentIndexStatus;
  readonly version?: number;
  readonly versionId?: string;
  readonly documentId?: string;
  readonly professionalName: string;
  readonly updatedAt: Date;
}

export interface DocumentIndexPage {
  readonly items: readonly DocumentIndexItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

const PAGE_SIZE = 20;

const entryTypeByDocumentType = {
  nutrition: "MEAL_PLAN",
  postural: "ASSESSMENT",
  performance: "WORKOUT_PLAN",
} as const;

const statusByType = {
  nutrition: "nutrition-ready",
  postural: "postural-completed",
  performance: "performance-finalized",
} as const satisfies Record<DocumentIndexType, DocumentIndexStatus>;

function isSkipped(
  entry: {
    attendance: {
      pendingCheck: {
        continuityId: string;
        items: readonly {
          status: string;
          continuityStep: { key: string; status: string };
        }[];
      } | null;
    };
    masterRecord: { continuity: { id: string } | null };
  },
  type: DocumentIndexType,
) {
  const pendingCheck = entry.attendance.pendingCheck;
  if (!pendingCheck) return false;
  if (pendingCheck.continuityId !== entry.masterRecord.continuity?.id) {
    return true;
  }

  const keys =
    type === "nutrition"
      ? ["NUTRITION_STRATEGY", "MEAL_PLAN"]
      : type === "postural"
        ? ["POSTURAL_ASSESSMENT"]
        : ["PERFORMANCE"];

  return pendingCheck.items.some(
    (item) =>
      item.status === "SKIPPED" &&
      item.continuityStep.status !== "COMPLETED" &&
      keys.includes(item.continuityStep.key),
  );
}

export const documentIndexRepository = {
  async list(filters: DocumentIndexFilters): Promise<DocumentIndexPage> {
    const page = Number.isSafeInteger(filters.page) && filters.page > 0
      ? filters.page
      : 1;
    const allowedTypes = filters.allowedTypes.filter(
      (type) => !filters.type || type === filters.type,
    );
    if (allowedTypes.length === 0) {
      return { items: [], page, pageSize: PAGE_SIZE, total: 0, totalPages: 0 };
    }

    const search = filters.patient?.trim().slice(0, 180);
    const where = {
      type: { in: allowedTypes.map((type) => entryTypeByDocumentType[type]) },
      attendanceId: { not: null },
      deletedAt: null,
      status: { not: "VOIDED" },
      masterRecord: {
        status: "ACTIVE",
        patient: {
          deletedAt: null,
          status: "ACTIVE",
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" } },
                  { clinicalCode: { contains: search.toUpperCase() } },
                ],
              }
            : {}),
        },
      },
      attendance: { is: { deletedAt: null } },
      OR: [
        { type: "MEAL_PLAN", mealPlan: { isNot: null } },
        { type: "ASSESSMENT", posturalAssessment: { isNot: null } },
        { type: "WORKOUT_PLAN", workoutPlan: { isNot: null } },
      ],
    } satisfies Prisma.MasterRecordEntryWhereInput;

    const entries = await prisma.masterRecordEntry.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        type: true,
        status: true,
        revision: true,
        masterRecordId: true,
        attendanceId: true,
        createdAt: true,
        updatedAt: true,
        updatedBy: { select: { fullName: true } },
        masterRecord: {
          select: {
            id: true,
            patient: {
              select: { id: true, fullName: true, clinicalCode: true },
            },
            continuity: { select: { id: true } },
          },
        },
        attendance: {
          select: {
            id: true,
            masterRecordId: true,
            consultationType: true,
            receivedAt: true,
            startedAt: true,
            pendingCheck: {
              select: {
                continuityId: true,
                items: {
                  select: {
                    status: true,
                    continuityStep: { select: { key: true, status: true } },
                  },
                },
              },
            },
          },
        },
        mealPlan: { select: { entryId: true, updatedAt: true } },
        posturalAssessment: {
          select: { entryId: true, assessedAt: true, updatedAt: true },
        },
        workoutPlan: { select: { entryId: true, updatedAt: true } },
      },
    });

    const ids = entries.map((entry) => entry.id);
    const mealIds = entries
      .filter((entry) => entry.type === "MEAL_PLAN")
      .map((entry) => entry.id);
    const posturalIds = entries
      .filter((entry) => entry.type === "ASSESSMENT")
      .map((entry) => entry.id);
    const workoutIds = entries
      .filter((entry) => entry.type === "WORKOUT_PLAN")
      .map((entry) => entry.id);
    const [versions, approvedPlans, completedPosturalRecords, officialWorkouts, nutritionDocuments] =
      await Promise.all([
        ids.length
          ? prisma.recordVersion.findMany({
              where: {
                entityId: { in: ids },
                entityType: {
                  in: ["MEAL_PLAN", "ASSESSMENT_POSTURAL_ASSESSMENT", "WORKOUT_PLAN"],
                },
              },
              orderBy: [{ version: "desc" }, { createdAt: "desc" }],
              select: {
                id: true,
                entityId: true,
                entityType: true,
                status: true,
                version: true,
                createdAt: true,
                responsible: { select: { fullName: true } },
              },
            })
          : [],
        mealIds.length
          ? prisma.mealPlanRecord.findMany({
              where: {
                entryId: { in: mealIds },
                content: { path: ["status"], equals: "APPROVED" },
              },
              select: { entryId: true },
            })
          : [],
        posturalIds.length
          ? prisma.posturalAssessmentRecord.findMany({
              where: {
                entryId: { in: posturalIds },
                observations: { path: ["completionStatus"], equals: "COMPLETED" },
              },
              select: { entryId: true },
            })
          : [],
        workoutIds.length
          ? prisma.workoutPlanRecord.findMany({
              where: {
                entryId: { in: workoutIds },
                content: { path: ["status"], equals: "FINALIZED" },
              },
              select: { entryId: true },
            })
          : [],
        allowedTypes.includes("nutrition")
          ? prisma.deliverable.findMany({
              where: {
                kind: NUTRITION_REPORT_KIND,
                status: "PUBLISHED",
                deletedAt: null,
                masterRecord: {
                  status: "ACTIVE",
                  patient: {
                    deletedAt: null,
                    status: "ACTIVE",
                    ...(search
                      ? {
                          OR: [
                            { fullName: { contains: search, mode: "insensitive" } },
                            { clinicalCode: { contains: search.toUpperCase() } },
                          ],
                        }
                      : {}),
                  },
                },
              },
              orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
              select: {
                id: true,
                masterRecordId: true,
                version: true,
                status: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
                createdBy: { select: { fullName: true } },
                masterRecord: {
                  select: {
                    id: true,
                    patient: {
                      select: { id: true, fullName: true, clinicalCode: true },
                    },
                    attendances: {
                      where: { deletedAt: null },
                      select: {
                        id: true,
                        masterRecordId: true,
                        consultationType: true,
                        receivedAt: true,
                        startedAt: true,
                      },
                    },
                  },
                },
              },
            })
          : [],
      ]);

    const completedPosturalVersion = new Map<string, (typeof versions)[number]>();
    const officialVersion = new Map<string, (typeof versions)[number]>();
    for (const version of versions) {
      const key = `${version.entityType}:${version.entityId}`;
      if (
        version.entityType === "ASSESSMENT_POSTURAL_ASSESSMENT" &&
        version.status === "COMPLETED" &&
        !completedPosturalVersion.has(key)
      ) {
        completedPosturalVersion.set(key, version);
      }
      if (
        version.status === "FINALIZED" &&
        !officialVersion.has(key)
      ) {
        officialVersion.set(key, version);
      }
    }
    const approvedPlanIds = new Set(approvedPlans.map((row) => row.entryId));
    const completedPosturalIds = new Set(
      completedPosturalRecords.map((row) => row.entryId),
    );
    const officialWorkoutIds = new Set(
      officialWorkouts.map((row) => row.entryId),
    );
    const selectedEntries = new Map<
      string,
      { item: DocumentIndexItem; priorityDate: Date }
    >();
    for (const document of nutritionDocuments) {
      const metadata = parseNutritionReportMetadata(document.metadata);
      if (!metadata || document.masterRecordId !== document.masterRecord.id) {
        continue;
      }
      const attendance = document.masterRecord.attendances.find(
        (candidate) => candidate.id === metadata.attendanceId,
      );
      if (
        !attendance ||
        attendance.masterRecordId !== document.masterRecordId
      ) continue;
      const status: DocumentIndexStatus = "nutrition-approved";
      if (filters.status && filters.status !== status) continue;
      const approvedAt = new Date(metadata.approvedAt);
      if (Number.isNaN(approvedAt.valueOf())) continue;
      const item: DocumentIndexItem = {
        id: document.id,
        documentId: document.id,
        patientId: document.masterRecord.patient.id,
        patientName: document.masterRecord.patient.fullName,
        patientCode: document.masterRecord.patient.clinicalCode,
        masterRecordId: document.masterRecordId,
        attendanceId: attendance.id,
        attendanceDate: attendance.startedAt ?? attendance.receivedAt,
        consultationType: attendance.consultationType,
        type: "nutrition",
        status,
        version: document.version,
        professionalName: document.createdBy.fullName,
        updatedAt: approvedAt,
      };
      selectedEntries.set(`nutrition-document:${document.id}`, {
        item,
        priorityDate: document.createdAt,
      });
    }

    for (const entry of entries) {
      if (!entry.attendanceId || !entry.attendance) continue;
      if (
        entry.masterRecordId !== entry.masterRecord.id ||
        entry.attendanceId !== entry.attendance.id ||
        entry.masterRecordId !== entry.attendance.masterRecordId
      ) continue;
      const type =
        entry.type === "MEAL_PLAN"
          ? "nutrition"
          : entry.type === "ASSESSMENT"
            ? "postural"
            : "performance";
      const attendance = entry.attendance;
      const status = statusByType[type];
      if (filters.status && filters.status !== status) continue;
      if (isSkipped({ attendance, masterRecord: entry.masterRecord }, type)) {
        continue;
      }

      const versionType =
        type === "postural" ? "ASSESSMENT_POSTURAL_ASSESSMENT" : entry.type;
      const versionKey = `${versionType}:${entry.id}`;
      const completedVersion = completedPosturalVersion.get(versionKey);
      const finalVersion = officialVersion.get(versionKey);
      if (type === "nutrition") {
        if (
          entry.status !== "FINALIZED" ||
          !entry.mealPlan ||
          !approvedPlanIds.has(entry.id) ||
          !finalVersion
        ) continue;
      } else if (type === "postural") {
        if (
          !entry.posturalAssessment ||
          (!completedVersion &&
            !completedPosturalIds.has(entry.id))
        ) continue;
      } else if (
        !entry.workoutPlan ||
        !officialWorkoutIds.has(entry.id) ||
        !finalVersion
      ) {
        continue;
      }

      const responsibleVersion =
        type === "performance" ? finalVersion : completedVersion;
      const item: DocumentIndexItem = {
        id: entry.id,
        patientId: entry.masterRecord.patient.id,
        patientName: entry.masterRecord.patient.fullName,
        patientCode: entry.masterRecord.patient.clinicalCode,
        masterRecordId: entry.masterRecordId,
        attendanceId: attendance.id,
        attendanceDate: attendance.startedAt ?? attendance.receivedAt,
        consultationType: attendance.consultationType,
        type,
        status,
        version:
          type === "nutrition" ? finalVersion?.version : responsibleVersion?.version,
        versionId:
          type === "nutrition" ? finalVersion?.id : responsibleVersion?.id,
        professionalName:
          (type === "nutrition" ? finalVersion : responsibleVersion)
            ?.responsible.fullName ?? entry.updatedBy.fullName,
        updatedAt:
          type === "nutrition"
            ? entry.mealPlan!.updatedAt
            : type === "postural"
              ? completedVersion?.createdAt ?? entry.posturalAssessment!.updatedAt
              : finalVersion!.createdAt,
      };
      const key = `${item.patientId}:${item.masterRecordId}:${item.attendanceId}:${type}`;
      const priorityDate = type === "postural"
        ? entry.posturalAssessment?.assessedAt ?? entry.createdAt
        : entry.createdAt;
      const existing = selectedEntries.get(key);
      if (
        !existing ||
        (type === "postural"
          ? priorityDate > existing.priorityDate
          : priorityDate < existing.priorityDate)
      ) {
        selectedEntries.set(key, { item, priorityDate });
      }
    }

    const items = Array.from(selectedEntries.values(), ({ item }) => item);
    items.sort((left, right) =>
      right.updatedAt.getTime() - left.updatedAt.getTime() ||
      left.id.localeCompare(right.id),
    );
    const filteredItems = items.filter((item) =>
      (!filters.from || item.updatedAt >= filters.from) &&
      (!filters.toExclusive || item.updatedAt < filters.toExclusive),
    );
    const total = filteredItems.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    return {
      items: filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
    };
  },
};
