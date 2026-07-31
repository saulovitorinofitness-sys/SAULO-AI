import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import { prisma } from "@/lib/database/prisma";

import {
  calculateMealPlanTotals,
  compareMealPlanNutrition,
} from "./nutrition-calculations";
import { calculateNutritionAdequacy } from "./adequacy-engine";
import {
  parseStoredMealPlanPayload,
  type MealPlanRecordDraft,
  type MealPlanRecordMeal,
  type MealPlanRecordSupplement,
  type StoredMealPlanPayload,
} from "./record";
import {
  detectPrescriptionChanges,
  PRESCRIPTION_ACTION_LABELS,
  type PrescriptionActionType,
  type PrescriptionHistoryEntry,
} from "./prescription-history";

const MEAL_PLAN_ENTRY_TYPE = "MEAL_PLAN";

const mealPlanEntrySelect = {
  id: true,
  masterRecordId: true,
  attendanceId: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: { select: { id: true, fullName: true } },
  mealPlan: { select: { content: true } },
  masterRecord: {
    select: {
      patient: { select: { fullName: true } },
    },
  },
} satisfies Prisma.MasterRecordEntrySelect;

export interface PersistedMealPlanView {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly strategyEntryId: string;
  readonly status: MealPlanRecordDraft["status"];
  readonly responsibleUserId: string;
  readonly responsibleProfessional: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
  readonly strategyApprovedAt?: string;
  readonly strategySnapshot?: MealPlanStrategyInheritance;
  readonly totals?: StoredMealPlanPayload["totals"];
  readonly comparison?: StoredMealPlanPayload["comparison"];
  readonly aiDecision?: StoredMealPlanPayload["aiDecision"];
  readonly adequacy?: StoredMealPlanPayload["adequacy"];
  readonly meals: readonly MealPlanRecordMeal[];
  readonly supplements: readonly MealPlanRecordSupplement[];
  readonly history: readonly PrescriptionHistoryEntry[];
}

function toJson(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function initialMeals(
  distribution: MealPlanStrategyInheritance["mealDistribution"],
): readonly MealPlanRecordMeal[] {
  return distribution.map((meal) => ({
    id: randomUUID(),
    name: meal.name,
    order: meal.mealNumber,
    time: meal.time,
    vetPercentage: meal.vetPercentage,
    plannedEnergyKcal: meal.plannedCaloriesKcal,
    items: [],
  }));
}

function adequacyFor(
  strategy: MealPlanStrategyInheritance,
  totals: StoredMealPlanPayload["totals"],
  updatedAt: string,
) {
  return calculateNutritionAdequacy({
    target: {
      energyKcal: strategy.caloriesKcal,
      proteinGrams: strategy.proteinGrams,
      carbohydratesGrams: strategy.carbohydratesGrams,
      fatsGrams: strategy.fatsGrams,
      fiberGrams: strategy.fiberGrams,
      waterMl: strategy.waterMl,
    },
    actual: {
      ...totals,
      waterMl: strategy.waterMl,
    },
    updatedAt,
  });
}

async function findPlan(patientId: string, attendanceId: string) {
  return prisma.masterRecordEntry.findFirst({
    where: {
      type: MEAL_PLAN_ENTRY_TYPE,
      attendanceId,
      deletedAt: null,
      masterRecord: {
        patientId,
        status: "ACTIVE",
        patient: { deletedAt: null },
      },
    },
    select: mealPlanEntrySelect,
    orderBy: { createdAt: "asc" },
  });
}

async function findPrescriptionHistory(
  entryId: string,
): Promise<readonly PrescriptionHistoryEntry[]> {
  const events = await prisma.auditEvent.findMany({
    where: {
      entityType: MEAL_PLAN_ENTRY_TYPE,
      entityId: entryId,
      changes: { some: { fieldPath: { startsWith: "prescription." } } },
    },
    select: {
      id: true,
      occurredAt: true,
      reason: true,
      changedBy: { select: { id: true, fullName: true } },
      changes: {
        where: { fieldPath: { startsWith: "prescription." } },
        select: {
          id: true,
          fieldPath: true,
          previousValue: true,
          newValue: true,
        },
      },
    },
    orderBy: { occurredAt: "asc" },
  });

  return events.flatMap((event) =>
    event.changes.flatMap((change) => {
      const type = change.fieldPath.slice(
        "prescription.".length,
      ) as PrescriptionActionType;
      if (!(type in PRESCRIPTION_ACTION_LABELS)) return [];
      return [
        {
          id: change.id || event.id,
          type,
          occurredAt: event.occurredAt.toISOString(),
          professionalUserId: event.changedBy.id,
          professionalName: event.changedBy.fullName,
          clinicalJustification: event.reason || undefined,
          previousValue:
            typeof change.previousValue === "string"
              ? change.previousValue
              : null,
          currentValue:
            typeof change.newValue === "string" ? change.newValue : null,
        },
      ];
    }),
  );
}

function toView(
  patientId: string,
  entry: NonNullable<Awaited<ReturnType<typeof findPlan>>>,
  history: readonly PrescriptionHistoryEntry[],
): PersistedMealPlanView | null {
  if (!entry.attendanceId || !entry.mealPlan) return null;
  const content = parseStoredMealPlanPayload(entry.mealPlan.content);
  if (!content) return null;

  return {
    id: entry.id,
    patientId,
    patientName: entry.masterRecord.patient.fullName,
    masterRecordId: entry.masterRecordId,
    attendanceId: entry.attendanceId,
    strategyEntryId: content.strategyEntryId,
    status: content.status,
    responsibleUserId: entry.updatedBy.id,
    responsibleProfessional: entry.updatedBy.fullName,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    revision: entry.revision,
    strategyApprovedAt: content.strategyApprovedAt,
    strategySnapshot: content.strategySnapshot,
    totals: content.totals,
    comparison: content.comparison,
    aiDecision: content.aiDecision,
    adequacy: content.adequacy,
    meals: [...content.meals].sort((left, right) => left.order - right.order),
    supplements: content.supplements,
    history,
  };
}

export const mealPlanRepository = {
  async get(
    patientId: string,
    attendanceId: string,
  ): Promise<PersistedMealPlanView | null> {
    const entry = await findPlan(patientId, attendanceId);
    if (!entry) return null;
    const history = await findPrescriptionHistory(entry.id);
    return toView(patientId, entry, history);
  },

  async getOrCreateDraft(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly strategy: MealPlanStrategyInheritance;
    readonly professionalUserId: string;
  }): Promise<PersistedMealPlanView> {
    const existing = await this.get(input.patientId, input.attendanceId);
    if (existing) {
      if (existing.strategyEntryId !== input.strategy.sourceStrategyId) {
        throw new Error("MEAL_PLAN_STRATEGY_MISMATCH");
      }
      return existing;
    }

    await persistNewPlan(input);
    const created = await this.get(input.patientId, input.attendanceId);
    if (!created) throw new Error("MEAL_PLAN_NOT_CREATED");
    return created;
  },

  async save(
    patientId: string,
    attendanceId: string,
    draft: MealPlanRecordDraft,
    professionalUserId: string,
    strategy: MealPlanStrategyInheritance,
    clinicalJustification?: string,
  ): Promise<PersistedMealPlanView> {
    await persistExistingPlan({
      patientId,
      attendanceId,
      draft,
      professionalUserId,
      strategy,
      clinicalJustification,
    });
    const saved = await this.get(patientId, attendanceId);
    if (!saved) throw new Error("MEAL_PLAN_NOT_FOUND");
    return saved;
  },
};

async function persistNewPlan(input: {
  readonly patientId: string;
  readonly attendanceId: string;
  readonly strategy: MealPlanStrategyInheritance;
  readonly professionalUserId: string;
}) {
  if (
    input.strategy.patientId !== input.patientId ||
    input.strategy.attendanceId !== input.attendanceId ||
    input.strategy.status !== "APPROVED"
  ) {
    throw new Error("MEAL_PLAN_STRATEGY_MISMATCH");
  }

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
    const mealPlanModule = await transaction.systemModule.findUnique({
      where: { key: "MEAL_PLAN" },
      select: { id: true },
    });
    const professional = await transaction.user.findUnique({
      where: { id: input.professionalUserId },
      select: { id: true },
    });
    const existing = await transaction.masterRecordEntry.findFirst({
      where: {
        type: MEAL_PLAN_ENTRY_TYPE,
        attendanceId: input.attendanceId,
        deletedAt: null,
        masterRecord: { patientId: input.patientId, status: "ACTIVE" },
      },
      select: { id: true },
    });
    if (existing) return;
    if (!attendance || !mealPlanModule || !professional) {
      throw new Error("MEAL_PLAN_CONTEXT_NOT_FOUND");
    }
    if (attendance.masterRecordId !== input.strategy.masterRecordId) {
      throw new Error("MEAL_PLAN_STRATEGY_MISMATCH");
    }

    const approvedStrategy = await transaction.masterRecordEntry.findFirst({
      where: {
        id: input.strategy.sourceStrategyId,
        masterRecordId: attendance.masterRecordId,
        attendanceId: attendance.id,
        type: "NUTRITION_STRATEGY",
        status: "FINALIZED",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!approvedStrategy && process.env.NODE_ENV !== "development") {
      throw new Error("MEAL_PLAN_STRATEGY_NOT_APPROVED");
    }

    const strategyEntryId =
      approvedStrategy?.id ?? input.strategy.sourceStrategyId;

    const now = new Date();
    const initialTotals = {
      energyKcal: 0,
      proteinGrams: 0,
      carbohydratesGrams: 0,
      fatsGrams: 0,
      fiberGrams: 0,
    };
    const payload: StoredMealPlanPayload = {
      schemaVersion: 6,
      strategyEntryId,
      strategyApprovedAt: input.strategy.approvedAt,
      strategySnapshot: input.strategy,
      status: "DRAFT",
      aiDecision: "IDLE",
      meals: initialMeals(input.strategy.mealDistribution),
      supplements: [],
      totals: initialTotals,
      comparison: {
        energyKcal: "BELOW",
        proteinGrams: "BELOW",
        carbohydratesGrams: "BELOW",
        fatsGrams: "BELOW",
        fiberGrams: "BELOW",
      },
      adequacy: adequacyFor(
        input.strategy,
        initialTotals,
        now.toISOString(),
      ),
    };
    const entry = await transaction.masterRecordEntry.create({
      data: {
        masterRecordId: attendance.masterRecordId,
        moduleId: mealPlanModule.id,
        authorUserId: professional.id,
        updatedByUserId: professional.id,
        attendanceId: attendance.id,
        aggregateId: randomUUID(),
        type: MEAL_PLAN_ENTRY_TYPE,
        status: "DRAFT",
        occurredAt: now,
        revision: 1,
        payload: toJson({
          schemaVersion: 6,
          strategyEntryId,
          status: "DRAFT",
        }),
        mealPlan: {
          create: {
            title: "Plano Alimentar",
            content: toJson(payload),
          },
        },
      },
      select: { id: true },
    });
    await transaction.recordVersion.create({
      data: {
        entityType: MEAL_PLAN_ENTRY_TYPE,
        entityId: entry.id,
        moduleId: mealPlanModule.id,
        responsibleUserId: professional.id,
        version: 1,
        status: "DRAFT",
        snapshot: toJson(payload),
        reason: "Estrutura inicial do Plano Alimentar criada.",
      },
    });
    await transaction.auditEvent.create({
      data: {
        entityType: MEAL_PLAN_ENTRY_TYPE,
        entityId: entry.id,
        moduleId: mealPlanModule.id,
        action: "CREATE",
        createdByUserId: professional.id,
        changedByUserId: professional.id,
        occurredAt: now,
        reason: "Plano vinculado à Estratégia Nutricional aprovada.",
        changes: {
          create: {
            fieldPath: "strategyEntryId",
            previousValue: "NONE",
            newValue: approvedStrategy?.id ?? "DEV_STRATEGY",
          },
        },
      },
    });

    const continuity = await transaction.masterRecordContinuity.findUnique({
      where: { masterRecordId: attendance.masterRecordId },
      select: { id: true },
    });
    if (continuity) {
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
          moduleId: mealPlanModule.id,
          key: "MEAL_PLAN",
          title: "Plano alimentar",
          status: "IN_PROGRESS",
          sortOrder: 4,
          responsibleUserId: professional.id,
          createdByUserId: professional.id,
          updatedByUserId: professional.id,
        },
      });
      await transaction.masterRecordContinuity.update({
        where: { id: continuity.id },
        data: {
          lastActivityAt: now,
          nextSuggestedStepKey: "MEAL_PLAN",
          suggestionSource: "WORKFLOW",
          responsibleUserId: professional.id,
          updatedByUserId: professional.id,
          version: { increment: 1 },
        },
      });
    }
  });
}

async function persistExistingPlan(input: {
  readonly patientId: string;
  readonly attendanceId: string;
  readonly draft: MealPlanRecordDraft;
  readonly professionalUserId: string;
  readonly strategy: MealPlanStrategyInheritance;
  readonly clinicalJustification?: string;
}) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))
    `;
    const entry = await transaction.masterRecordEntry.findFirst({
      where: {
        type: MEAL_PLAN_ENTRY_TYPE,
        attendanceId: input.attendanceId,
        deletedAt: null,
        masterRecord: {
          patientId: input.patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      select: {
        id: true,
        moduleId: true,
        masterRecordId: true,
        revision: true,
        mealPlan: { select: { content: true } },
      },
    });
    if (!entry?.mealPlan) throw new Error("MEAL_PLAN_NOT_FOUND");
    const current = parseStoredMealPlanPayload(entry.mealPlan.content);
    if (!current) throw new Error("MEAL_PLAN_INVALID");
    if (current.strategyEntryId !== input.draft.strategyEntryId) {
      throw new Error("MEAL_PLAN_STRATEGY_MISMATCH");
    }

    const approvedStrategy = await transaction.masterRecordEntry.findFirst({
      where: {
        id: current.strategyEntryId,
        masterRecordId: entry.masterRecordId,
        attendanceId: input.attendanceId,
        type: "NUTRITION_STRATEGY",
        status: "FINALIZED",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!approvedStrategy) throw new Error("MEAL_PLAN_STRATEGY_NOT_APPROVED");

    const strategyChanged =
      current.strategyApprovedAt !== input.strategy.approvedAt;
    if (strategyChanged && !input.draft.strategyUpdateDecision) {
      throw new Error("MEAL_PLAN_STRATEGY_UPDATE_DECISION_REQUIRED");
    }
    const strategySnapshot =
      input.draft.strategyUpdateDecision === "UPDATE" ||
      !current.strategySnapshot
        ? input.strategy
        : current.strategySnapshot;
    const totals = calculateMealPlanTotals(input.draft.meals);
    const comparison = compareMealPlanNutrition(
      {
        energyKcal: strategySnapshot.caloriesKcal,
        proteinGrams: strategySnapshot.proteinGrams,
        carbohydratesGrams: strategySnapshot.carbohydratesGrams,
        fatsGrams: strategySnapshot.fatsGrams,
        fiberGrams: strategySnapshot.fiberGrams,
      },
      totals,
    );
    const now = new Date();
    const completing = input.draft.status === "APPROVED";
    const adequacy = adequacyFor(
      strategySnapshot,
      totals,
      now.toISOString(),
    );
    const revision = entry.revision + 1;
    const prescriptionChanges = detectPrescriptionChanges(
      current,
      input.draft,
    );
    const payload: StoredMealPlanPayload = {
      ...input.draft,
      strategyUpdateDecision: undefined,
      schemaVersion: 6,
      strategyApprovedAt: strategySnapshot.approvedAt,
      strategySnapshot,
      totals,
      comparison,
      adequacy,
    };
    await transaction.masterRecordEntry.update({
      where: { id: entry.id },
      data: {
        status: completing ? "FINALIZED" : "DRAFT",
        revision,
        occurredAt: now,
        updatedByUserId: input.professionalUserId,
        payload: toJson({
          schemaVersion: 6,
          strategyEntryId: payload.strategyEntryId,
          status: payload.status,
        }),
        mealPlan: {
          update: {
            content: toJson(payload),
          },
        },
      },
    });
    await transaction.recordVersion.create({
      data: {
        entityType: MEAL_PLAN_ENTRY_TYPE,
        entityId: entry.id,
        moduleId: entry.moduleId,
        responsibleUserId: input.professionalUserId,
        version: revision,
        status: completing ? "FINALIZED" : "DRAFT",
        snapshot: toJson(payload),
        reason: completing
          ? "Plano Alimentar concluído."
          : "Rascunho do Plano Alimentar salvo.",
      },
    });
    if (prescriptionChanges.length) {
      for (const change of prescriptionChanges) {
        await transaction.auditEvent.create({
          data: {
            entityType: MEAL_PLAN_ENTRY_TYPE,
            entityId: entry.id,
            moduleId: entry.moduleId,
            action:
              change.type === "FOOD_ADDED" ||
              change.type === "SUPPLEMENT_ADDED"
                ? "CREATE"
                : "UPDATE",
            createdByUserId: input.professionalUserId,
            changedByUserId: input.professionalUserId,
            occurredAt: now,
            reason: input.clinicalJustification,
            changes: {
              create: {
                fieldPath: `prescription.${change.type}`,
                previousValue: change.previousValue ?? Prisma.JsonNull,
                newValue: change.currentValue ?? Prisma.JsonNull,
              },
            },
          },
        });
      }
    }
    if (completing) {
      const continuity = await transaction.masterRecordContinuity.findUnique({
        where: { masterRecordId: entry.masterRecordId },
        select: { id: true },
      });
      const deliverablesModule = await transaction.systemModule.findUnique({
        where: { key: "DELIVERABLES" },
        select: { id: true },
      });
      if (!continuity || !deliverablesModule) {
        throw new Error("MEAL_PLAN_FLOW_CONTEXT_NOT_FOUND");
      }
      await transaction.continuityStep.upsert({
        where: {
          continuityId_key: {
            continuityId: continuity.id,
            key: "MEAL_PLAN",
          },
        },
        update: {
          status: "COMPLETED",
          responsibleUserId: input.professionalUserId,
          completedByUserId: input.professionalUserId,
          completedAt: now,
          updatedByUserId: input.professionalUserId,
          version: { increment: 1 },
        },
        create: {
          continuityId: continuity.id,
          moduleId: entry.moduleId,
          key: "MEAL_PLAN",
          title: "Plano alimentar",
          status: "COMPLETED",
          sortOrder: 4,
          responsibleUserId: input.professionalUserId,
          completedByUserId: input.professionalUserId,
          completedAt: now,
          createdByUserId: input.professionalUserId,
          updatedByUserId: input.professionalUserId,
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
          status: "PENDING",
          responsibleUserId: input.professionalUserId,
          completedByUserId: null,
          completedAt: null,
          updatedByUserId: input.professionalUserId,
          version: { increment: 1 },
        },
        create: {
          continuityId: continuity.id,
          moduleId: deliverablesModule.id,
          key: "DELIVERABLES",
          title: "Entregáveis",
          status: "PENDING",
          sortOrder: 5,
          responsibleUserId: input.professionalUserId,
          createdByUserId: input.professionalUserId,
          updatedByUserId: input.professionalUserId,
        },
      });
      await transaction.masterRecordContinuity.update({
        where: { id: continuity.id },
        data: {
          lastCompletedStepKey: "MEAL_PLAN",
          lastActivityAt: now,
          nextSuggestedStepKey: "DELIVERABLES",
          suggestionSource: "WORKFLOW",
          responsibleUserId: input.professionalUserId,
          updatedByUserId: input.professionalUserId,
          version: { increment: 1 },
        },
      });
    }
  });
}
