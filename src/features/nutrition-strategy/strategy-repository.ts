import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import {
  canApproveNutritionStrategy,
  shouldCreateNutritionStrategyVersion,
  type MacronutrientDraftInput,
  type NutritionStrategyMealAllocation,
  type NutritionStrategyDraft,
  type NutritionStrategyRecordView,
  type NutritionStrategySupplement,
} from "./strategy-record";
import { NUTRITION_METHOD_OPTIONS } from "./prescription";
import { presentMealSchedules } from "./meal-schedule";

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

export interface StoredStrategyPayload extends NutritionStrategyDraft {
  readonly schemaVersion: 1 | 2 | 3 | 4 | 5;
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

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function mealDistribution(
  value: unknown,
  mealCount: number | undefined,
  finalCaloriesKcal: number | undefined,
): readonly NutritionStrategyMealAllocation[] {
  const source = Array.isArray(value) ? value.map(objectValue) : [];
  const count =
    mealCount && Number.isInteger(mealCount) && mealCount > 0
      ? mealCount
      : source.length;
  if (!count) return [];
  const base = Math.floor((100 / count) * 100) / 100;
  const fallbackPercentages = Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? Number((100 - base * (count - 1)).toFixed(2))
      : base,
  );
  const storedPercentages = source.map((meal) => {
    const percentage =
      typeof meal.vetPercentage === "number"
        ? meal.vetPercentage
        : typeof meal.energyPercentage === "number"
          ? meal.energyPercentage
          : undefined;
    return percentage !== undefined && Number.isFinite(percentage)
      ? percentage
      : undefined;
  });
  const storedTotal = storedPercentages.reduce<number>(
    (total, percentage) => total + (percentage ?? 0),
    0,
  );
  const percentages =
    storedPercentages.length === count &&
    storedPercentages.every((percentage) => percentage !== undefined) &&
    Math.abs(storedTotal - 100) < 0.1
      ? (storedPercentages as number[])
      : fallbackPercentages;

  return Array.from({ length: count }, (_, index) => {
    const meal = source[index] ?? {};
    const percentage = percentages[index];
    return {
      mealNumber: index + 1,
      name:
        typeof meal.name === "string" && meal.name.trim()
          ? meal.name.trim()
          : "",
      time:
        typeof meal.time === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(meal.time)
          ? meal.time
          : "",
      vetPercentage: percentage,
      plannedCaloriesKcal:
        finalCaloriesKcal && finalCaloriesKcal > 0
          ? rounded(finalCaloriesKcal * (percentage / 100))
          : undefined,
    };
  });
}

export function parseStoredNutritionStrategyPayload(
  value: unknown,
): StoredStrategyPayload | null {
  const source = objectValue(value);
  if (
    source.schemaVersion !== 1 &&
    source.schemaVersion !== 2 &&
    source.schemaVersion !== 3 &&
    source.schemaVersion !== 4 &&
    source.schemaVersion !== 5
  ) {
    return null;
  }
  const secondaryObjectives = Array.isArray(source.secondaryObjectives)
    ? source.secondaryObjectives.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
  const normalizedMealDistribution = mealDistribution(
    source.mealDistribution,
    typeof source.mealCount === "number" ? source.mealCount : undefined,
    typeof source.finalCaloriesKcal === "number"
      ? source.finalCaloriesKcal
      : undefined,
  );
  const supplementation = Array.isArray(source.supplementation)
    ? (source.supplementation as NutritionStrategySupplement[])
    : [];
  const method = NUTRITION_METHOD_OPTIONS.some(
    ([code]) => code === source.method,
  )
    ? (source.method as NutritionStrategyDraft["method"])
    : undefined;

  return {
    ...(source as unknown as StoredStrategyPayload),
    secondaryObjectives,
    method,
    activityFactor:
      typeof source.activityFactor === "number" &&
      Number.isFinite(source.activityFactor) &&
      source.activityFactor > 0
        ? source.activityFactor
        : undefined,
    protein: macroInput(source.protein, "PERCENTAGE"),
    carbohydrates: macroInput(source.carbohydrates, "PERCENTAGE"),
    fats: macroInput(source.fats, "PERCENTAGE"),
    mealDistribution: normalizedMealDistribution,
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
      status: { in: ["DRAFT", "FINALIZED"] },
      deletedAt: null,
      masterRecord: {
        patientId,
        status: "ACTIVE",
        patient: { deletedAt: null },
      },
    },
    select: strategyEntrySelect,
    // Uma versão oficial nunca pode ser encoberta por um rascunho legado
    // duplicado. Entre registros no mesmo estado, usa o mais recentemente
    // persistido como registro canônico do atendimento.
    orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
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
  const payload = parseStoredNutritionStrategyPayload(entry.payload);
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

  async getForClinicalAttendance(
    patientId: string,
    attendanceId: string,
  ): Promise<NutritionStrategyRecordView | null> {
    // O estado operacional do atendimento não herda a conclusão de outra
    // consulta. Todas as telas devem observar a mesma entrada e attendanceId.
    return this.get(patientId, attendanceId);
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

  async prepareForEditing(
    patientId: string,
    attendanceId: string,
    professionalUserId: string,
  ): Promise<NutritionStrategyRecordView | null> {
    const currentEntry = await findStrategy(patientId, attendanceId);
    if (currentEntry) {
      const current = toRecordView(patientId, currentEntry);
      if (!current) throw new Error("STRATEGY_INVALID");
      if (current.status === "DRAFT") return current;
      return this.reopen(patientId, attendanceId, professionalUserId);
    }

    throw new Error("STRATEGY_NOT_FOUND");
  },

  async updateApprovedMealSchedules(
    patientId: string,
    attendanceId: string,
    schedules: readonly { readonly mealNumber: number; readonly time: string }[],
    professionalUserId: string,
  ): Promise<NutritionStrategyRecordView> {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${attendanceId}))
      `;
      const [entry, professional] = await Promise.all([
        transaction.masterRecordEntry.findFirst({
          where: {
            type: STRATEGY_ENTRY_TYPE,
            attendanceId,
            status: "FINALIZED",
            deletedAt: null,
            masterRecord: {
              patientId,
              status: "ACTIVE",
              patient: { deletedAt: null },
            },
          },
          select: {
            id: true,
            moduleId: true,
            revision: true,
            payload: true,
          },
        }),
        transaction.user.findUnique({
          where: { id: professionalUserId },
          select: { id: true },
        }),
      ]);
      if (!entry) throw new Error("STRATEGY_NOT_APPROVED");
      if (!professional) throw new Error("STRATEGY_CONTEXT_NOT_FOUND");

      const current = parseStoredNutritionStrategyPayload(entry.payload);
      if (!current) throw new Error("STRATEGY_INVALID");
      const presentedMeals = presentMealSchedules(current.mealDistribution);
      const scheduleByNumber = new Map(
        schedules.map((schedule) => [schedule.mealNumber, schedule.time]),
      );
      if (
        schedules.length !== presentedMeals.length ||
        scheduleByNumber.size !== presentedMeals.length ||
        presentedMeals.some((meal) => !scheduleByNumber.has(meal.mealNumber))
      ) {
        throw new Error("STRATEGY_MEAL_SCHEDULE_MISMATCH");
      }

      const updatedMeals = presentedMeals.map((meal) => ({
        ...meal,
        time: scheduleByNumber.get(meal.mealNumber)!,
      }));
      const changes = updatedMeals.flatMap((meal, index) => {
        const previous = current.mealDistribution[index];
        return [
          ...(previous.name !== meal.name
            ? [{
                fieldPath: `mealDistribution.${meal.mealNumber}.name`,
                previousValue: previous.name,
                newValue: meal.name,
              }]
            : []),
          ...(previous.time !== meal.time
            ? [{
                fieldPath: `mealDistribution.${meal.mealNumber}.time`,
                previousValue: previous.time,
                newValue: meal.time,
              }]
            : []),
        ];
      });
      if (!changes.length) return;

      const revision = entry.revision + 1;
      const payload: StoredStrategyPayload = {
        ...current,
        schemaVersion: 5,
        mealDistribution: updatedMeals,
      };
      const now = new Date();
      await transaction.masterRecordEntry.update({
        where: { id: entry.id },
        data: {
          revision,
          occurredAt: now,
          updatedByUserId: professional.id,
          payload: toJson(payload),
        },
      });
      await transaction.recordVersion.create({
        data: {
          entityType: STRATEGY_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: entry.moduleId,
          responsibleUserId: professional.id,
          version: revision,
          status: "FINALIZED",
          snapshot: toJson(payload),
          reason: "Atualização auditável dos horários das refeições.",
        },
      });
      await transaction.auditEvent.create({
        data: {
          entityType: STRATEGY_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: entry.moduleId,
          action: "UPDATE",
          createdByUserId: professional.id,
          changedByUserId: professional.id,
          occurredAt: now,
          reason: "Correção dos horários da distribuição diária.",
          changes: { create: changes },
        },
      });
    });

    const updated = await this.get(patientId, attendanceId);
    if (!updated) throw new Error("STRATEGY_NOT_FOUND");
    return updated;
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

      const payload = parseStoredNutritionStrategyPayload(entry.payload);
      if (!payload) throw new Error("STRATEGY_INVALID");
      const revision = entry.revision + 1;
      const nextPayload: StoredStrategyPayload = {
        ...payload,
        vetDecisionState: "EDITED",
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
          attendanceId: attendance.id,
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
        status: { in: ["DRAFT", "FINALIZED"] },
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        revision: true,
        moduleId: true,
      },
      orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
    });
    if (existing?.status === "FINALIZED") {
      throw new Error("STRATEGY_APPROVED");
    }

    const now = new Date();
    const payload: StoredStrategyPayload = {
      ...input.strategy,
      schemaVersion: 5,
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

    if (shouldCreateNutritionStrategyVersion(input.approve)) {
      await transaction.recordVersion.create({
        data: {
          entityType: STRATEGY_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: strategyModule.id,
          responsibleUserId: professional.id,
          version: revision,
          status,
          snapshot: toJson(payload),
          reason: "Estratégia nutricional aprovada.",
        },
      });
    }
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
        const downstreamModules = await transaction.systemModule.findMany({
          where: { key: { in: ["MEAL_PLAN", "DELIVERABLES"] } },
          select: { id: true, key: true },
        });
        const mealPlanModuleId = downstreamModules.find(
          (module) => module.key === "MEAL_PLAN",
        )?.id;
        const deliverablesModuleId = downstreamModules.find(
          (module) => module.key === "DELIVERABLES",
        )?.id;
        if (!mealPlanModuleId || !deliverablesModuleId) {
          throw new Error("STRATEGY_FLOW_MODULES_NOT_FOUND");
        }
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
        await transaction.continuityStep.upsert({
          where: {
            continuityId_key: {
              continuityId: continuity.id,
              key: "MEAL_PLAN",
            },
          },
          update: {
            status: "IN_PROGRESS",
            responsibleUserId: professional.id,
            completedByUserId: null,
            completedAt: null,
            updatedByUserId: professional.id,
            version: { increment: 1 },
          },
          create: {
            continuityId: continuity.id,
            moduleId: mealPlanModuleId,
            key: "MEAL_PLAN",
            title: "Plano alimentar",
            status: "IN_PROGRESS",
            sortOrder: 4,
            responsibleUserId: professional.id,
            createdByUserId: professional.id,
            updatedByUserId: professional.id,
          },
        });
        await transaction.continuityStep.upsert({
          where: {
            continuityId_key: {
              continuityId: continuity.id,
              key: "DELIVERABLES",
            },
          },
          update: {
            status: "BLOCKED",
            responsibleUserId: professional.id,
            completedByUserId: null,
            completedAt: null,
            updatedByUserId: professional.id,
            version: { increment: 1 },
          },
          create: {
            continuityId: continuity.id,
            moduleId: deliverablesModuleId,
            key: "DELIVERABLES",
            title: "Entregáveis",
            status: "BLOCKED",
            sortOrder: 5,
            responsibleUserId: professional.id,
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
