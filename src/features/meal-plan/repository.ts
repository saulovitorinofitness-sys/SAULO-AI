import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import { prisma } from "@/lib/database/prisma";

import {
  calculateMealPlanTotals,
  compareMealPlanNutrition,
} from "./nutrition-calculations";
import {
  calculateNutritionAdequacy,
} from "./adequacy-engine";
import {
  calculateMealPlanTargetDeviations,
  evaluateMealPlanCompletion,
  targetDeviationAuthorizationMatches,
} from "./completion-policy";
import {
  deriveDietaryReferenceProfile,
  selectDietaryReferences,
} from "./dietary-reference";
import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  parseStoredMealPlanPayload,
  type MealPlanNutritionValues,
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
  status: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: { select: { id: true, fullName: true } },
  mealPlan: { select: { content: true } },
  masterRecord: {
    select: {
      patient: { select: { fullName: true, birthDate: true, sex: true } },
    },
  },
  attendance: { select: { receivedAt: true, startedAt: true } },
} satisfies Prisma.MasterRecordEntrySelect;

export interface PersistedMealPlanView {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientBirthDate?: string;
  readonly patientSex?: "FEMALE" | "MALE" | "INTERSEX" | "NOT_INFORMED";
  readonly attendanceDate?: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly strategyEntryId?: string;
  readonly status: MealPlanRecordDraft["status"];
  readonly responsibleUserId: string;
  readonly responsibleProfessional: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
  readonly schemaVersion?: StoredMealPlanPayload["schemaVersion"];
  readonly strategyApprovedAt?: string;
  readonly strategySnapshot?: MealPlanStrategyInheritance;
  readonly totals?: StoredMealPlanPayload["totals"];
  readonly comparison?: StoredMealPlanPayload["comparison"];
  readonly aiDecision?: StoredMealPlanPayload["aiDecision"];
  readonly smartGenerationVersion?: StoredMealPlanPayload["smartGenerationVersion"];
  readonly adequacy?: StoredMealPlanPayload["adequacy"];
  readonly meals: readonly MealPlanRecordMeal[];
  readonly supplements: readonly MealPlanRecordSupplement[];
  readonly history: readonly PrescriptionHistoryEntry[];
  readonly sourcePlanEntryId?: string;
  readonly sourcePlanAttendanceId?: string;
  readonly sourcePlanRevision?: number;
  readonly reuseMode?: StoredMealPlanPayload["reuseMode"];
  readonly dietaryReferenceProfile?: StoredMealPlanPayload["dietaryReferenceProfile"];
  readonly dietaryReferences?: StoredMealPlanPayload["dietaryReferences"];
  readonly professionalReview?: StoredMealPlanPayload["professionalReview"];
  readonly targetDeviationAuthorization?: StoredMealPlanPayload["targetDeviationAuthorization"];
}

export async function findOrCreateMealPlanForAttendance<
  T extends { readonly strategyEntryId?: string },
>(input: {
  readonly patientId: string;
  readonly attendanceId: string;
  readonly expectedStrategyEntryId?: string;
  readonly find: (
    patientId: string,
    attendanceId: string,
  ) => Promise<T | null>;
  readonly create: () => Promise<void>;
}): Promise<T> {
  const validateStrategy = (plan: T) => {
    if (
      input.expectedStrategyEntryId !== undefined &&
      plan.strategyEntryId !== input.expectedStrategyEntryId
    ) {
      throw new Error("MEAL_PLAN_STRATEGY_MISMATCH");
    }
    return plan;
  };

  const existing = await input.find(input.patientId, input.attendanceId);
  if (existing) return validateStrategy(existing);

  await input.create();
  const created = await input.find(input.patientId, input.attendanceId);
  if (!created) throw new Error("MEAL_PLAN_NOT_CREATED");
  return validateStrategy(created);
}

function toJson(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function containsRecipe(meals: readonly MealPlanRecordMeal[]) {
  return meals.some((meal) => meal.items.some(isMealPlanRecipeItem));
}

export function mealPlanSchemaVersion(
  meals: readonly MealPlanRecordMeal[],
  fallback: StoredMealPlanPayload["schemaVersion"],
): StoredMealPlanPayload["schemaVersion"] {
  return fallback === 9 ? 9 : containsRecipe(meals) ? 8 : fallback;
}

export function calculatePersistedMealPlanTotals(
  meals: readonly MealPlanRecordMeal[],
): MealPlanNutritionValues {
  const foodMeals = meals.map((meal) => ({
    ...meal,
    items: meal.items.filter(isMealPlanFoodItem),
  }));
  const totals = { ...calculateMealPlanTotals(foodMeals) };
  const keys = [
    "energyKcal",
    "proteinGrams",
    "carbohydratesGrams",
    "fatsGrams",
    "fiberGrams",
  ] as const satisfies readonly (keyof MealPlanNutritionValues)[];

  for (const meal of meals) {
    for (const recipe of meal.items.filter(isMealPlanRecipeItem)) {
      for (const key of keys) {
        const value = recipe.prescribedNutrients[key];
        if (value !== null) totals[key] += value;
      }
    }
  }
  for (const key of keys) {
    totals[key] = Math.round(totals[key] * 100) / 100;
  }
  return totals;
}

export function initialMeals(
  distribution: MealPlanStrategyInheritance["mealDistribution"],
): readonly MealPlanRecordMeal[] {
  return distribution.map((meal) => ({
    id: randomUUID(),
    // A Estratégia define quantidade e distribuição; nomes e horários
    // podem ser preenchidos somente no Plano. O rótulo ordinal é estrutural
    // e evita persistir um payload que o próprio Plano não consegue ler.
    name: meal.name.trim() || `Refeição ${meal.mealNumber}`,
    order: meal.mealNumber,
    ...(meal.time ? { time: meal.time } : {}),
    vetPercentage: meal.vetPercentage,
    plannedEnergyKcal: meal.plannedCaloriesKcal,
    items: [],
  }));
}

export function clonePreviousMeals(
  meals: readonly MealPlanRecordMeal[],
): readonly MealPlanRecordMeal[] {
  return meals.map((meal) => ({
    ...meal,
    id: randomUUID(),
    items: meal.items.map((item) =>
      isMealPlanRecipeItem(item)
        ? { ...item, id: randomUUID() }
        : { ...item, id: randomUUID(), substitutions: [] },
    ),
  }));
}

function foodOnlyPrescriptionDraft(
  draft: Pick<MealPlanRecordDraft, "meals" | "supplements">,
) {
  return {
    meals: draft.meals.map((meal) => ({
      ...meal,
      items: meal.items.filter(isMealPlanFoodItem),
    })),
    supplements: draft.supplements,
  };
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

function hasSameOfficialContent(
  left: StoredMealPlanPayload,
  right: StoredMealPlanPayload,
) {
  const semanticContent = (value: StoredMealPlanPayload) => ({
    strategyEntryId: value.strategyEntryId,
    strategyApprovedAt: value.strategyApprovedAt,
    meals: value.meals,
    supplements: value.supplements,
    aiDecision: value.aiDecision,
    smartGenerationVersion: value.smartGenerationVersion,
    dietaryReferenceProfile: value.dietaryReferenceProfile,
    dietaryReferences: value.dietaryReferences,
    professionalReview: value.professionalReview,
    targetDeviationAuthorization: value.targetDeviationAuthorization,
  });
  return (
    JSON.stringify(semanticContent(left)) ===
    JSON.stringify(semanticContent(right))
  );
}

export function hasSameMealPlanDraftContent(
  current: StoredMealPlanPayload,
  draft: MealPlanRecordDraft,
) {
  const persistedDraft = (value: MealPlanRecordDraft) => ({
    strategyEntryId: value.strategyEntryId,
    status: value.status,
    strategyUpdateDecision: value.strategyUpdateDecision,
    aiDecision: value.aiDecision,
    smartGenerationVersion: value.smartGenerationVersion,
    meals: value.meals,
    supplements: value.supplements,
    sourcePlanEntryId: value.sourcePlanEntryId,
    sourcePlanAttendanceId: value.sourcePlanAttendanceId,
    sourcePlanRevision: value.sourcePlanRevision,
    reuseMode: value.reuseMode,
    dietaryReferenceProfile: value.dietaryReferenceProfile,
    dietaryReferences: value.dietaryReferences,
    professionalReview: value.professionalReview,
    targetDeviationAuthorization: value.targetDeviationAuthorization,
  });

  return JSON.stringify(persistedDraft(current)) === JSON.stringify(persistedDraft(draft));
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

async function findLatestDeliveredPlanForAttendanceMasterRecord(
  patientId: string,
  attendanceId: string,
) {
  const candidates = await prisma.masterRecordEntry.findMany({
    where: {
      type: MEAL_PLAN_ENTRY_TYPE,
      status: "FINALIZED",
      attendanceId: { not: attendanceId },
      deletedAt: null,
      masterRecord: {
        patientId,
        status: "ACTIVE",
        patient: { deletedAt: null },
        attendances: {
          some: {
            id: attendanceId,
            deletedAt: null,
          },
        },
      },
    },
    select: mealPlanEntrySelect,
    orderBy: [{ occurredAt: "desc" }, { updatedAt: "desc" }],
    take: 20,
  });
  if (!candidates.length) return null;

  const officialVersions = await prisma.recordVersion.findMany({
    where: {
      entityType: MEAL_PLAN_ENTRY_TYPE,
      entityId: { in: candidates.map((entry) => entry.id) },
      status: "FINALIZED",
    },
    select: { entityId: true },
    distinct: ["entityId"],
  });
  const deliveredEntryIds = new Set(
    officialVersions.map((version) => version.entityId),
  );
  return candidates.find((entry) => deliveredEntryIds.has(entry.id)) ?? null;
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
  const status: MealPlanRecordDraft["status"] =
    entry.status === "FINALIZED"
      ? "APPROVED"
      : content.status === "IN_REVIEW" || content.status === "REJECTED"
        ? content.status
        : "DRAFT";

  return {
    id: entry.id,
    patientId,
    patientName: entry.masterRecord.patient.fullName,
    patientBirthDate: entry.masterRecord.patient.birthDate.toISOString().slice(0, 10),
    patientSex: entry.masterRecord.patient.sex,
    attendanceDate: (entry.attendance?.startedAt ?? entry.attendance?.receivedAt ?? entry.createdAt).toISOString(),
    masterRecordId: entry.masterRecordId,
    attendanceId: entry.attendanceId,
    strategyEntryId: content.strategyEntryId,
    status,
    responsibleUserId: entry.updatedBy.id,
    responsibleProfessional: entry.updatedBy.fullName,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    revision: entry.revision,
    schemaVersion: content.schemaVersion,
    strategyApprovedAt: content.strategyApprovedAt,
    strategySnapshot: content.strategySnapshot,
    totals: content.totals,
    comparison: content.comparison,
    aiDecision: content.aiDecision,
    smartGenerationVersion: content.smartGenerationVersion,
    adequacy: content.adequacy,
    meals: [...content.meals].sort((left, right) => left.order - right.order),
    supplements: content.supplements,
    history,
    sourcePlanEntryId: content.sourcePlanEntryId,
    sourcePlanAttendanceId: content.sourcePlanAttendanceId,
    sourcePlanRevision: content.sourcePlanRevision,
    reuseMode: content.reuseMode,
    dietaryReferenceProfile: content.dietaryReferenceProfile,
    dietaryReferences: content.dietaryReferences,
    professionalReview: content.professionalReview,
    targetDeviationAuthorization: content.targetDeviationAuthorization,
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
    const view = toView(patientId, entry, history);
    if (!view) throw new Error("MEAL_PLAN_INVALID");
    return view;
  },

  async getLatestDeliveredForAttendanceMasterRecord(
    patientId: string,
    attendanceId: string,
  ): Promise<PersistedMealPlanView | null> {
    const entry =
      await findLatestDeliveredPlanForAttendanceMasterRecord(
        patientId,
        attendanceId,
      );
    if (!entry) return null;
    const history = await findPrescriptionHistory(entry.id);
    return toView(patientId, entry, history);
  },

  async reopenForAdjustment(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly professionalUserId: string;
    readonly reason: string;
    readonly expectedRevision: number;
  }): Promise<PersistedMealPlanView | null> {
    const reason = input.reason.trim();
    if (!reason) throw new Error("MEAL_PLAN_ADJUST_REASON_REQUIRED");
    if (
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 1
    ) {
      throw new Error("MEAL_PLAN_REVISION_CONFLICT");
    }

    const reopened = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))
      `;
      const [attendance, professional] = await Promise.all([
        transaction.attendance.findFirst({
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
        }),
        transaction.user.findUnique({
          where: { id: input.professionalUserId },
          select: { id: true },
        }),
      ]);
      if (!attendance) return false;
      if (!professional) throw new Error("MEAL_PLAN_CONTEXT_NOT_FOUND");

      const entry = await transaction.masterRecordEntry.findFirst({
        where: {
          type: MEAL_PLAN_ENTRY_TYPE,
          attendanceId: attendance.id,
          masterRecordId: attendance.masterRecordId,
          deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          moduleId: true,
          status: true,
          revision: true,
          payload: true,
          mealPlan: { select: { content: true } },
        },
      });
      if (!entry?.mealPlan) return false;
      if (entry.status === "DRAFT") {
        throw new Error("MEAL_PLAN_ALREADY_DRAFT");
      }
      if (entry.status !== "FINALIZED") {
        throw new Error("MEAL_PLAN_NOT_FINALIZED");
      }
      if (entry.revision !== input.expectedRevision) {
        throw new Error("MEAL_PLAN_REVISION_CONFLICT");
      }

      const current = parseStoredMealPlanPayload(entry.mealPlan.content);
      if (!current) throw new Error("MEAL_PLAN_INVALID");
      const reopenedContent: StoredMealPlanPayload = {
        ...current,
        status: "DRAFT",
      };
      const storedEntryPayload =
        entry.payload &&
        typeof entry.payload === "object" &&
        !Array.isArray(entry.payload)
          ? entry.payload
          : {};
      const now = new Date();

      await transaction.masterRecordEntry.update({
        where: { id: entry.id },
        data: {
          status: "DRAFT",
          revision: { increment: 1 },
          occurredAt: now,
          updatedByUserId: professional.id,
          payload: toJson({ ...storedEntryPayload, status: "DRAFT" }),
          mealPlan: {
            update: { content: toJson(reopenedContent) },
          },
        },
      });
      await transaction.auditEvent.create({
        data: {
          entityType: MEAL_PLAN_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: entry.moduleId,
          action: "STATUS_CHANGE",
          createdByUserId: professional.id,
          changedByUserId: professional.id,
          occurredAt: now,
          reason,
          changes: {
            create: {
              fieldPath: "status",
              previousValue: "FINALIZED",
              newValue: "DRAFT",
            },
          },
        },
      });

      return true;
    });

    return reopened
      ? this.get(input.patientId, input.attendanceId)
      : null;
  },

  async getOrCreateDraft(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly strategy: MealPlanStrategyInheritance;
    readonly professionalUserId: string;
    readonly sourcePlan?: PersistedMealPlanView;
  }): Promise<PersistedMealPlanView> {
    return findOrCreateMealPlanForAttendance({
      patientId: input.patientId,
      attendanceId: input.attendanceId,
      expectedStrategyEntryId: input.strategy.sourceStrategyId,
      find: (patientId, attendanceId) => this.get(patientId, attendanceId),
      create: () => persistNewPlan(input),
    });
  },

  async getOrCreateManualDraft(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly professionalUserId: string;
    readonly sourcePlan?: PersistedMealPlanView;
  }): Promise<PersistedMealPlanView> {
    return findOrCreateMealPlanForAttendance({
      patientId: input.patientId,
      attendanceId: input.attendanceId,
      find: (patientId, attendanceId) => this.get(patientId, attendanceId),
      create: () => persistNewPlan({ ...input, strategy: undefined }),
    });
  },

  async save(
    patientId: string,
    attendanceId: string,
    draft: MealPlanRecordDraft,
    professionalUserId: string,
    strategy: MealPlanStrategyInheritance | undefined,
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
  readonly strategy?: MealPlanStrategyInheritance;
  readonly professionalUserId: string;
  readonly sourcePlan?: PersistedMealPlanView;
}) {
  if (input.strategy && (
    input.strategy.patientId !== input.patientId ||
    input.strategy.attendanceId !== input.attendanceId ||
    input.strategy.status !== "APPROVED"
  )) {
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
      select: {
        id: true,
        masterRecordId: true,
        receivedAt: true,
        startedAt: true,
        masterRecord: { select: { patient: { select: { birthDate: true, sex: true } } } },
      },
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
    if (input.strategy && attendance.masterRecordId !== input.strategy.masterRecordId) {
      throw new Error("MEAL_PLAN_STRATEGY_MISMATCH");
    }

    const approvedStrategy = input.strategy ? await transaction.masterRecordEntry.findFirst({
      where: {
        id: input.strategy.sourceStrategyId,
        masterRecordId: attendance.masterRecordId,
        attendanceId: attendance.id,
        type: "NUTRITION_STRATEGY",
        status: "FINALIZED",
        deletedAt: null,
      },
      select: { id: true },
    }) : null;
    if (input.strategy && !approvedStrategy) {
      throw new Error("MEAL_PLAN_STRATEGY_NOT_APPROVED");
    }

    const strategyEntryId = approvedStrategy?.id;

    const now = new Date();
    const meals = input.sourcePlan
      ? clonePreviousMeals(input.sourcePlan.meals)
      : input.strategy
        ? initialMeals(input.strategy.mealDistribution)
        : [{ id: randomUUID(), name: "Refeição 1", order: 1, items: [] }];
    const schemaVersion = 9 as const;
    const initialTotals = calculatePersistedMealPlanTotals(meals);
    const referenceDate = attendance.startedAt ?? attendance.receivedAt;
    const dietaryReferenceProfile = deriveDietaryReferenceProfile({
      patientSex: attendance.masterRecord.patient.sex,
      birthDate: attendance.masterRecord.patient.birthDate.toISOString().slice(0, 10),
      attendanceDate: referenceDate.toISOString(),
      clinicalProtocols: input.strategy?.clinicalProtocols,
    }) ?? undefined;
    const dietaryReferences = dietaryReferenceProfile
      ? selectDietaryReferences(dietaryReferenceProfile) ?? undefined
      : undefined;
    const payload: StoredMealPlanPayload = {
      schemaVersion,
      strategyEntryId,
      strategyApprovedAt: input.strategy?.approvedAt,
      status: "DRAFT",
      aiDecision: "IDLE",
      meals,
      supplements: input.sourcePlan
        ? input.sourcePlan.supplements.map((supplement) => ({
            ...supplement,
            id: randomUUID(),
          }))
        : [],
      sourcePlanEntryId: input.sourcePlan?.id,
      sourcePlanAttendanceId: input.sourcePlan?.attendanceId,
      sourcePlanRevision: input.sourcePlan?.revision,
      reuseMode: input.sourcePlan ? "KEEP_PREVIOUS" : undefined,
      dietaryReferenceProfile,
      dietaryReferences,
      totals: initialTotals,
      comparison: input.strategy ? compareMealPlanNutrition(
        {
          energyKcal: input.strategy.caloriesKcal,
          proteinGrams: input.strategy.proteinGrams,
          carbohydratesGrams: input.strategy.carbohydratesGrams,
          fatsGrams: input.strategy.fatsGrams,
          fiberGrams: input.strategy.fiberGrams,
        },
        initialTotals,
      ) : undefined,
      adequacy: input.strategy ? adequacyFor(
        input.strategy,
        initialTotals,
        now.toISOString(),
      ) : undefined,
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
          schemaVersion,
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
    await transaction.auditEvent.create({
      data: {
        entityType: MEAL_PLAN_ENTRY_TYPE,
        entityId: entry.id,
        moduleId: mealPlanModule.id,
        action: "CREATE",
        createdByUserId: professional.id,
        changedByUserId: professional.id,
        occurredAt: now,
        reason: input.sourcePlan
          ? "Nova versão criada a partir do plano anterior, que permanece preservado."
          : input.strategy
            ? "Plano vinculado à Estratégia Nutricional aprovada."
            : "Plano manual iniciado após Estratégia Nutricional não realizada.",
        changes: {
          create: {
            fieldPath: "strategyEntryId",
            previousValue: "NONE",
            newValue: approvedStrategy?.id ?? "SKIPPED",
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
  readonly strategy?: MealPlanStrategyInheritance;
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
        status: true,
        revision: true,
        mealPlan: { select: { content: true } },
      },
    });
    if (!entry?.mealPlan) throw new Error("MEAL_PLAN_NOT_FOUND");
    const current = parseStoredMealPlanPayload(entry.mealPlan.content);
    if (!current) throw new Error("MEAL_PLAN_INVALID");
    if (entry.status === "FINALIZED" || current.status === "APPROVED") {
      throw new Error("MEAL_PLAN_FINALIZED");
    }
    const manualPlan =
      !current.strategyEntryId && !input.draft.strategyEntryId && !input.strategy;
    if (!manualPlan && (
      current.strategyEntryId !== input.draft.strategyEntryId ||
      !input.strategy ||
      input.strategy.sourceStrategyId !== current.strategyEntryId ||
      input.strategy.patientId !== input.patientId ||
      input.strategy.attendanceId !== input.attendanceId ||
      input.strategy.masterRecordId !== entry.masterRecordId
    )) {
      throw new Error("MEAL_PLAN_STRATEGY_MISMATCH");
    }

    const approvedStrategy = current.strategyEntryId ? await transaction.masterRecordEntry.findFirst({
      where: {
        id: current.strategyEntryId,
        masterRecordId: entry.masterRecordId,
        attendanceId: input.attendanceId,
        type: "NUTRITION_STRATEGY",
        status: "FINALIZED",
        deletedAt: null,
      },
      select: { id: true },
    }) : null;
    if (!manualPlan && !approvedStrategy) throw new Error("MEAL_PLAN_STRATEGY_NOT_APPROVED");
    if (hasSameMealPlanDraftContent(current, input.draft)) return;

    const totals = calculatePersistedMealPlanTotals(input.draft.meals);
    const comparison = input.strategy ? compareMealPlanNutrition(
      {
        energyKcal: input.strategy.caloriesKcal,
        proteinGrams: input.strategy.proteinGrams,
        carbohydratesGrams: input.strategy.carbohydratesGrams,
        fatsGrams: input.strategy.fatsGrams,
        fiberGrams: input.strategy.fiberGrams,
      },
      totals,
    ) : undefined;
    const now = new Date();
    const completing = input.draft.status === "APPROVED";
    const targetDeviations = input.strategy
      ? calculateMealPlanTargetDeviations({
          target: {
            energyKcal: input.strategy.caloriesKcal,
            proteinGrams: input.strategy.proteinGrams,
            carbohydratesGrams: input.strategy.carbohydratesGrams,
            fatsGrams: input.strategy.fatsGrams,
          },
          actual: totals,
        })
      : undefined;
    const targetDeviationAuthorization =
      targetDeviations?.some((deviation) => deviation.outsideTolerance) &&
      targetDeviationAuthorizationMatches({
        authorization: input.draft.targetDeviationAuthorization,
        deviations: targetDeviations,
      })
        ? input.draft.targetDeviationAuthorization
        : undefined;
    if (
      completing &&
      targetDeviations?.some((deviation) => deviation.outsideTolerance) &&
      !targetDeviationAuthorization
    ) {
      throw new Error("MEAL_PLAN_TARGET_DEVIATION_AUTHORIZATION_REQUIRED");
    }
    if (completing) {
      const eligibility = evaluateMealPlanCompletion({
        meals: input.draft.meals,
        planRevision: entry.revision,
        review: input.draft.professionalReview,
        targetDeviations,
        targetDeviationAuthorization,
      });
      if (!eligibility.allowed) throw new Error("MEAL_PLAN_COMPLETION_REVIEW_REQUIRED");
    }
    if (
      completing &&
      (input.draft.smartGenerationVersion ?? 0) > 0 &&
      input.draft.aiDecision !== "APPROVED"
    ) {
      throw new Error("MEAL_PLAN_PREVIEW_NOT_APPROVED");
    }
    const adequacy = input.strategy ? adequacyFor(
      input.strategy,
      totals,
      now.toISOString(),
    ) : undefined;
    const revision = entry.revision + 1;
    const prescriptionChanges = detectPrescriptionChanges(
      foodOnlyPrescriptionDraft(current),
      foodOnlyPrescriptionDraft(input.draft),
    );
    const schemaVersion = 9 as const;
    const payload: StoredMealPlanPayload = {
      ...input.draft,
      targetDeviationAuthorization: targetDeviationAuthorization
        ? { ...targetDeviationAuthorization, planRevision: revision }
        : undefined,
      strategyUpdateDecision: undefined,
      schemaVersion,
      strategyApprovedAt: input.strategy?.approvedAt,
      strategySnapshot: completing && input.strategy
        ? input.strategy
        : current.strategySnapshot,
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
          schemaVersion,
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
    if (completing) {
      const latestOfficialVersion = await transaction.recordVersion.findFirst({
        where: {
          entityType: MEAL_PLAN_ENTRY_TYPE,
          entityId: entry.id,
          status: "FINALIZED",
        },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        select: { snapshot: true },
      });
      const latestOfficial = latestOfficialVersion
        ? parseStoredMealPlanPayload(latestOfficialVersion.snapshot)
        : null;
      const shouldCreateOfficialVersion =
        !latestOfficial || !hasSameOfficialContent(latestOfficial, payload);

      if (shouldCreateOfficialVersion) {
      const previousVersion = await transaction.recordVersion.aggregate({
        where: {
          entityType: MEAL_PLAN_ENTRY_TYPE,
          entityId: entry.id,
        },
        _max: { version: true },
      });
      await transaction.recordVersion.create({
        data: {
          entityType: MEAL_PLAN_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: entry.moduleId,
          responsibleUserId: input.professionalUserId,
          version: (previousVersion._max.version ?? 0) + 1,
          status: "FINALIZED",
          snapshot: toJson(payload),
          reason: "Plano Alimentar concluído.",
        },
      });
      }
    }
    if (prescriptionChanges.length) {
      await transaction.auditEvent.create({
        data: {
          entityType: MEAL_PLAN_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: entry.moduleId,
          action: "UPDATE",
          createdByUserId: input.professionalUserId,
          changedByUserId: input.professionalUserId,
          occurredAt: now,
          reason: input.clinicalJustification,
          changes: {
            create: prescriptionChanges.map((change) => ({
              fieldPath: `prescription.${change.type}`,
              previousValue: change.previousValue ?? Prisma.JsonNull,
              newValue: change.currentValue ?? Prisma.JsonNull,
            })),
          },
        },
      });
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
          nextSuggestedStepKey: "FINALIZE_ATTENDANCE",
          suggestionSource: "WORKFLOW",
          responsibleUserId: input.professionalUserId,
          updatedByUserId: input.professionalUserId,
          version: { increment: 1 },
        },
      });
    }
  });
}
