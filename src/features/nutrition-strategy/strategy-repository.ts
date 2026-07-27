import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import {
  canApproveNutritionStrategy,
  type MacronutrientDraftInput,
  type NutritionStrategyMealAllocation,
  type NutritionStrategyDraft,
  type NutritionStrategyRecordView,
  type NutritionStrategySupplement,
} from "./strategy-record";

const STRATEGY_ENTRY_TYPE = "NUTRITION_STRATEGY";
const strategyEntrySelect = {
  id: true,
  masterRecordId: true,
  attendanceId: true,
  status: true,
  revision: true,
  payload: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.MasterRecordEntrySelect;

interface StoredStrategyPayload extends NutritionStrategyDraft {
  readonly schemaVersion: 1 | 2;
  readonly approvedAt?: string;
  readonly approvedByUserId?: string;
  readonly approvedByName?: string;
}

function toJson(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function macroInput(
  value: unknown,
  fallbackMode: MacronutrientDraftInput["mode"],
): MacronutrientDraftInput {
  const source = objectValue(value);
  const mode =
    source.mode === "GRAMS_PER_KG" ||
    source.mode === "PERCENTAGE" ||
    source.mode === "GRAMS"
      ? source.mode
      : fallbackMode;
  const inputValue =
    typeof source.value === "number" &&
    Number.isFinite(source.value) &&
    source.value > 0
      ? source.value
      : undefined;
  return { mode, value: inputValue };
}

function storedPayload(value: unknown): StoredStrategyPayload | null {
  const source = objectValue(value);
  if (source.schemaVersion !== 1 && source.schemaVersion !== 2) {
    return null;
  }
  const secondaryObjectives = Array.isArray(source.secondaryObjectives)
    ? source.secondaryObjectives.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
  const mealDistribution = Array.isArray(source.mealDistribution)
    ? (source.mealDistribution as NutritionStrategyMealAllocation[])
    : [];
  const supplementation = Array.isArray(source.supplementation)
    ? (source.supplementation as NutritionStrategySupplement[])
    : [];
  const method =
    source.method === "STANDARD" ||
    source.method === "LOW_CARB" ||
    source.method === "CARB_CYCLING"
      ? source.method
      : undefined;

  return {
    ...(source as unknown as StoredStrategyPayload),
    secondaryObjectives,
    method,
    protein: macroInput(source.protein, "GRAMS_PER_KG"),
    carbohydrates: macroInput(source.carbohydrates, "GRAMS"),
    fats: macroInput(source.fats, "PERCENTAGE"),
    mealDistribution,
    supplementation,
    clinicalObservations:
      typeof source.clinicalObservations === "string"
        ? source.clinicalObservations
        : "",
  };
}

async function findStrategy(patientId: string, attendanceId: string) {
  return prisma.masterRecordEntry.findFirst({
    where: {
      type: STRATEGY_ENTRY_TYPE,
      attendanceId,
      deletedAt: null,
      masterRecord: {
        patientId,
        status: "ACTIVE",
        patient: { deletedAt: null },
      },
    },
    select: strategyEntrySelect,
    orderBy: { createdAt: "asc" },
  });
}

async function findLatestApprovedStrategy(patientId: string) {
  return prisma.masterRecordEntry.findFirst({
    where: {
      type: STRATEGY_ENTRY_TYPE,
      status: "FINALIZED",
      deletedAt: null,
      attendanceId: { not: null },
      masterRecord: {
        patientId,
        status: "ACTIVE",
        patient: { deletedAt: null },
      },
    },
    select: strategyEntrySelect,
    orderBy: [{ occurredAt: "desc" }, { updatedAt: "desc" }],
  });
}

function toRecordView(
  patientId: string,
  entry: NonNullable<Awaited<ReturnType<typeof findStrategy>>>,
): NutritionStrategyRecordView | null {
  if (!entry.attendanceId) return null;
  const payload = storedPayload(entry.payload);
  if (!payload) return null;

  return {
    ...payload,
    id: entry.id,
    patientId,
    masterRecordId: entry.masterRecordId,
    attendanceId: entry.attendanceId,
    status: entry.status === "FINALIZED" ? "APPROVED" : "DRAFT",
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    responsibleUserId: entry.updatedBy.id,
    responsibleName: entry.updatedBy.fullName,
    approvedAt: payload.approvedAt,
    approvedByUserId: payload.approvedByUserId,
    approvedByName: payload.approvedByName,
    version: entry.revision,
  };
}

export const nutritionStrategyRepository = {
  async get(
    patientId: string,
    attendanceId: string,
  ): Promise<NutritionStrategyRecordView | null> {
    const entry = await findStrategy(patientId, attendanceId);
    return entry ? toRecordView(patientId, entry) : null;
  },

  async getLatestApproved(
    patientId: string,
  ): Promise<NutritionStrategyRecordView | null> {
    const entry = await findLatestApprovedStrategy(patientId);
    return entry ? toRecordView(patientId, entry) : null;
  },

  async save(
    patientId: string,
    attendanceId: string,
    strategy: NutritionStrategyDraft,
    professionalUserId: string,
  ) {
    return persistStrategy({
      patientId,
      attendanceId,
      strategy,
      professionalUserId,
      approve: false,
    });
  },

  async approve(
    patientId: string,
    attendanceId: string,
    strategy: NutritionStrategyDraft,
    professionalUserId: string,
  ) {
    if (!canApproveNutritionStrategy(strategy)) {
      throw new Error("STRATEGY_INCOMPLETE");
    }
    return persistStrategy({
      patientId,
      attendanceId,
      strategy,
      professionalUserId,
      approve: true,
    });
  },

  async reopen(
    patientId: string,
    attendanceId: string,
    professionalUserId: string,
  ) {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${attendanceId}))
      `;
      const entry = await transaction.masterRecordEntry.findFirst({
        where: {
          type: STRATEGY_ENTRY_TYPE,
          attendanceId,
          status: "FINALIZED",
          deletedAt: null,
          masterRecord: { patientId, status: "ACTIVE" },
        },
        select: {
          id: true,
          revision: true,
          moduleId: true,
          payload: true,
        },
      });
      if (!entry) throw new Error("STRATEGY_NOT_APPROVED");

      const payload = storedPayload(entry.payload);
      if (!payload) throw new Error("STRATEGY_INVALID");
      const revision = entry.revision + 1;
      const nextPayload: StoredStrategyPayload = {
        ...payload,
        approvedAt: undefined,
        approvedByUserId: undefined,
        approvedByName: undefined,
      };
      const now = new Date();

      await transaction.masterRecordEntry.update({
        where: { id: entry.id },
        data: {
          status: "DRAFT",
          revision,
          updatedByUserId: professionalUserId,
          payload: toJson(nextPayload),
        },
      });
      await transaction.recordVersion.create({
        data: {
          entityType: STRATEGY_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: entry.moduleId,
          responsibleUserId: professionalUserId,
          version: revision,
          status: "DRAFT",
          snapshot: toJson(nextPayload),
          reason: "Estratégia reaberta para edição profissional.",
        },
      });
      await transaction.auditEvent.create({
        data: {
          entityType: STRATEGY_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: entry.moduleId,
          action: "STATUS_CHANGE",
          createdByUserId: professionalUserId,
          changedByUserId: professionalUserId,
          occurredAt: now,
          reason: "Estratégia reaberta para edição.",
          changes: {
            create: {
              fieldPath: "status",
              previousValue: "APPROVED",
              newValue: "DRAFT",
            },
          },
        },
      });
    });

    return this.get(patientId, attendanceId);
  },
};

async function persistStrategy(input: {
  readonly patientId: string;
  readonly attendanceId: string;
  readonly strategy: NutritionStrategyDraft;
  readonly professionalUserId: string;
  readonly approve: boolean;
}) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))
    `;

    const attendance = await transaction.attendance.findFirst({
      where: {
        id: input.attendanceId,
        deletedAt: null,
        masterRecord: {
          patientId: input.patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      select: { id: true, masterRecordId: true },
    });
    const strategyModule = await transaction.systemModule.findUnique({
      where: { key: "NUTRITION_STRATEGY" },
      select: { id: true },
    });
    const professional = await transaction.user.findUnique({
      where: { id: input.professionalUserId },
      select: { id: true, fullName: true },
    });

    if (!attendance || !strategyModule || !professional) {
      throw new Error("STRATEGY_CONTEXT_NOT_FOUND");
    }

    if (input.strategy.evaluationEntryId) {
      const evaluation = await transaction.masterRecordEntry.findFirst({
        where: {
          id: input.strategy.evaluationEntryId,
          masterRecordId: attendance.masterRecordId,
          type: "ASSESSMENT",
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!evaluation) throw new Error("STRATEGY_EVALUATION_NOT_FOUND");
    }

    const existing = await transaction.masterRecordEntry.findFirst({
      where: {
        type: STRATEGY_ENTRY_TYPE,
        attendanceId: attendance.id,
        masterRecordId: attendance.masterRecordId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        revision: true,
        moduleId: true,
      },
      orderBy: { createdAt: "asc" },
    });
    if (existing?.status === "FINALIZED" && !input.approve) {
      throw new Error("STRATEGY_APPROVED");
    }

    const now = new Date();
    const payload: StoredStrategyPayload = {
      ...input.strategy,
      schemaVersion: 2,
      approvedAt: input.approve ? now.toISOString() : undefined,
      approvedByUserId: input.approve ? professional.id : undefined,
      approvedByName: input.approve ? professional.fullName : undefined,
    };
    const status = input.approve ? "FINALIZED" : "DRAFT";
    const revision = existing ? existing.revision + 1 : 1;
    const entry = existing
      ? await transaction.masterRecordEntry.update({
          where: { id: existing.id },
          data: {
            status,
            revision,
            payload: toJson(payload),
            occurredAt: now,
            updatedByUserId: professional.id,
          },
          select: { id: true },
        })
      : await transaction.masterRecordEntry.create({
          data: {
            masterRecordId: attendance.masterRecordId,
            moduleId: strategyModule.id,
            authorUserId: professional.id,
            updatedByUserId: professional.id,
            attendanceId: attendance.id,
            aggregateId: randomUUID(),
            type: STRATEGY_ENTRY_TYPE,
            status,
            occurredAt: now,
            revision,
            payload: toJson(payload),
          },
          select: { id: true },
        });

    await transaction.recordVersion.create({
      data: {
        entityType: STRATEGY_ENTRY_TYPE,
        entityId: entry.id,
        moduleId: strategyModule.id,
        responsibleUserId: professional.id,
        version: revision,
        status,
        snapshot: toJson(payload),
        reason: input.approve
          ? "Estratégia nutricional aprovada."
          : "Estratégia nutricional salva.",
      },
    });
    await transaction.auditEvent.create({
      data: {
        entityType: STRATEGY_ENTRY_TYPE,
        entityId: entry.id,
        moduleId: strategyModule.id,
        action: existing
          ? input.approve
            ? "STATUS_CHANGE"
            : "UPDATE"
          : "CREATE",
        createdByUserId: professional.id,
        changedByUserId: professional.id,
        occurredAt: now,
        reason: input.approve
          ? "Aprovação profissional da estratégia nutricional."
          : "Atualização profissional da estratégia nutricional.",
        changes: {
          create: {
            fieldPath: "status",
            previousValue: existing?.status ?? "NONE",
            newValue: input.approve ? "APPROVED" : "DRAFT",
          },
        },
      },
    });

    if (input.approve) {
      const continuity = await transaction.masterRecordContinuity.findUnique({
        where: { masterRecordId: attendance.masterRecordId },
        select: { id: true },
      });
      if (continuity) {
        await transaction.continuityStep.upsert({
          where: {
            continuityId_key: {
              continuityId: continuity.id,
              key: "NUTRITION_STRATEGY",
            },
          },
          update: {
            status: "COMPLETED",
            responsibleUserId: professional.id,
            completedByUserId: professional.id,
            completedAt: now,
            updatedByUserId: professional.id,
            version: { increment: 1 },
          },
          create: {
            continuityId: continuity.id,
            moduleId: strategyModule.id,
            key: "NUTRITION_STRATEGY",
            title: "Estratégia nutricional",
            status: "COMPLETED",
            sortOrder: 3,
            responsibleUserId: professional.id,
            completedByUserId: professional.id,
            completedAt: now,
            createdByUserId: professional.id,
            updatedByUserId: professional.id,
          },
        });
        await transaction.masterRecordContinuity.update({
          where: { id: continuity.id },
          data: {
            lastCompletedStepKey: "NUTRITION_STRATEGY",
            lastActivityAt: now,
            nextSuggestedStepKey: "MEAL_PLAN",
            suggestionSource: "WORKFLOW",
            responsibleUserId: professional.id,
            updatedByUserId: professional.id,
          },
        });
      }
    }
  });

  return nutritionStrategyRepository.get(input.patientId, input.attendanceId);
}
