import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { householdMeasureRepository } from "@/features/food-database/household-measure-repository";
import { foodRepository } from "@/features/food-database/repository";
import { prisma } from "@/lib/database/prisma";

import {
  emptyNutritionReturnAnamnesisData,
  NUTRITION_RETURN_ANAMNESIS_ENTRY_TYPE,
  type LocalDatabaseRecallFood,
  type NutritionReturnAnamnesisData,
  type NutritionReturnAnamnesisSaveMode,
  type NutritionReturnAnamnesisView,
  type ReturnRecallFood,
  type ReturnRecallMeal,
} from "./contracts";
import { returnAnamnesisEntryStatus } from "./policy";
import {
  buildPreviousClinicalReference,
  type PreviousClinicalEntrySnapshot,
} from "./previous-reference";
import { officialFoodPreparation } from "./recall-food-selection";
import {
  parseNutritionReturnAnamnesisData,
  pruneEmptyOptionalReturnBlocks,
} from "./validation";

const PREVIOUS_REFERENCE_ENTRY_TYPES = [
  "CLINICAL_ANAMNESIS",
  "NUTRITION_STRATEGY",
  "ASSESSMENT",
] as const;

async function findLatestCompletedMealPlanReference(
  masterRecordId: string,
  currentAttendanceId: string,
): Promise<PreviousClinicalEntrySnapshot | undefined> {
  const candidates = await prisma.masterRecordEntry.findMany({
    where: {
      masterRecordId,
      attendanceId: { not: currentAttendanceId },
      type: "MEAL_PLAN",
      status: { in: ["DRAFT", "FINALIZED", "SUPERSEDED"] },
      deletedAt: null,
      mealPlan: { isNot: null },
    },
    orderBy: [{ occurredAt: "desc" }, { revision: "desc" }],
    take: 50,
    select: {
      id: true,
      type: true,
      status: true,
      occurredAt: true,
      payload: true,
      mealPlan: { select: { title: true, content: true } },
    },
  });
  if (!candidates.length) return undefined;

  const officialVersions = await prisma.recordVersion.findMany({
    where: {
      entityType: "MEAL_PLAN",
      entityId: { in: candidates.map((entry) => entry.id) },
      status: "FINALIZED",
    },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    select: {
      entityId: true,
      snapshot: true,
      createdAt: true,
    },
  });
  const latestOfficialByEntry = new Map<
    string,
    (typeof officialVersions)[number]
  >();
  for (const version of officialVersions) {
    if (!latestOfficialByEntry.has(version.entityId)) {
      latestOfficialByEntry.set(version.entityId, version);
    }
  }

  return candidates
    .flatMap((entry) => {
      if (!entry.mealPlan) return [];
      const official = latestOfficialByEntry.get(entry.id);
      if (!official && entry.status !== "FINALIZED" && entry.status !== "SUPERSEDED") {
        return [];
      }
      const completedContent = official?.snapshot ?? entry.mealPlan.content;
      return [{
        id: entry.id,
        type: entry.type,
        status: "FINALIZED" as const,
        occurredAt: official?.createdAt ?? entry.occurredAt,
        payload: completedContent,
        mealPlan: {
          title: entry.mealPlan.title,
          content: completedContent,
        },
      }];
    })
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    )[0];
}

function inputJson(data: NutritionReturnAnamnesisData) {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

function isReturnAttendanceWhere() {
  return {
    OR: [
      { clinicalType: "RETURN" as const },
      {
        clinicalType: null,
        consultationType: "FOLLOW_UP" as const,
      },
    ],
  };
}

function hasCompleteCoreComposition(nutrients: {
  readonly energyKcal: number | null;
  readonly proteinGrams: number | null;
  readonly carbohydratesGrams: number | null;
  readonly fatsGrams: number | null;
}) {
  return [
    nutrients.energyKcal,
    nutrients.proteinGrams,
    nutrients.carbohydratesGrams,
    nutrients.fatsGrams,
  ].every((value) => typeof value === "number" && Number.isFinite(value));
}

async function canonicalizeFoodComposition(
  data: NutritionReturnAnamnesisData,
): Promise<NutritionReturnAnamnesisData> {
  if (!data.recall24h) return data;
  const localItems = data.recall24h.meals.flatMap((meal) =>
    (meal.items ?? meal.foods).filter(
      (food): food is LocalDatabaseRecallFood =>
        food.source === "LOCAL_DATABASE",
    ),
  );
  const foodIds = [...new Set(localItems.map((food) => food.catalogFoodId))];
  const [foods, confirmedMeasuresByFood] = await Promise.all([
    foodRepository.findManyByIds(foodIds),
    householdMeasureRepository.findConfirmedOptionsByFoodIds(foodIds),
  ]);
  const foodById = new Map(foods.map((food) => [food.id, food]));

  if (foods.length !== foodIds.length) {
    throw new Error("RETURN_RECALL_FOOD_NOT_FOUND");
  }

  function canonicalizeFood(item: ReturnRecallFood): ReturnRecallFood {
    if (item.source === "UNSELECTED") return item;
    if (item.source === "MANUAL") {
      const nutritionBasis = item.nutritionBasis ?? "NONE";
      const hasComposition = Boolean(
        nutritionBasis !== "NONE" &&
          item.nutrients &&
          hasCompleteCoreComposition(item.nutrients),
      );
      return {
        id: item.id,
        source: "MANUAL",
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        preparation: item.preparation,
        preparationOption: item.preparationOption,
        brand: item.brand,
        observations: item.observations,
        previousPlanComparison: item.previousPlanComparison,
        consumedWeight: item.consumedWeight,
        consumedWeightUnit: item.consumedWeightUnit,
        nutritionBasis,
        nutrients: hasComposition ? item.nutrients : undefined,
        compositionStatus: hasComposition
          ? "MANUAL_WITH_COMPOSITION"
          : "MANUAL",
      };
    }

          const food = foodById.get(item.catalogFoodId);
          if (!food) throw new Error("RETURN_RECALL_FOOD_NOT_FOUND");
          const confirmedMeasure = item.householdMeasureId
            ? (confirmedMeasuresByFood.get(food.id) ?? []).find(
                (candidate) => candidate.id === item.householdMeasureId,
              )
            : undefined;
          const directMeasure = item.householdMeasureId
            ? food.householdMeasures.find(
                (candidate) => candidate.id === item.householdMeasureId,
              )
            : undefined;
          if (item.householdMeasureId && !confirmedMeasure && !directMeasure) {
            throw new Error("RETURN_RECALL_MEASURE_NOT_FOUND");
          }

          const nutrients = food.nutrients
            ? {
                energyKcal: food.nutrients.energyKcal,
                proteinGrams: food.nutrients.proteinGrams,
                carbohydratesGrams: food.nutrients.carbohydratesGrams,
                fatsGrams: food.nutrients.fatsGrams,
                fiberGrams: food.nutrients.fiberGrams,
                sodiumMg: food.nutrients.sodiumMg,
              }
            : undefined;
          const hasCompleteComposition =
            nutrients !== undefined &&
            hasCompleteCoreComposition(nutrients);
          const referenceUnit: "g" | "ml" =
            food.referenceServingUnit === "ml" ? "ml" : "g";
          const directAmount = directMeasure
            ? directMeasure.grams / directMeasure.quantity
            : undefined;
          const measureAmountPerUnit =
            confirmedMeasure?.amountPerMeasure ?? directAmount ?? 1;
          const measureUnit =
            confirmedMeasure?.unit ??
            (directMeasure ? "g" : referenceUnit);
          const unit =
            confirmedMeasure?.measureName ??
            directMeasure?.name ??
            referenceUnit;

          return {
            id: item.id,
            source: "LOCAL_DATABASE",
            catalogFoodId: food.id,
            catalogSource: food.source.name,
            catalogSourceKind: food.source.kind,
            catalogSourceCode: food.sourceCode,
            name: food.officialName,
            quantity: item.quantity,
            unit,
            householdMeasureId:
              confirmedMeasure?.id ?? directMeasure?.id,
            measureAmountPerUnit,
            measureUnit,
            measureSource:
              confirmedMeasure?.source ??
              (directMeasure ? food.source.name : "Medida técnica"),
            nutritionReferenceAmount: 100,
            nutritionReferenceUnit: referenceUnit,
            officialPreparation: officialFoodPreparation(food),
            preparation: item.preparation,
            preparationOption: item.preparationOption,
            brand: item.brand,
            observations: item.observations,
            previousPlanComparison: item.previousPlanComparison,
            compositionStatus: hasCompleteComposition
              ? "AVAILABLE"
              : "UNAVAILABLE",
            nutrientsPer100g: nutrients,
          };
  }

  function canonicalizeMeal(meal: ReturnRecallMeal): ReturnRecallMeal {
    if (meal.items) {
      return {
        ...meal,
        items: meal.items.map((item) =>
          item.source === "RECIPE" ? item : canonicalizeFood(item),
        ),
        ...(meal.foods
          ? { foods: meal.foods.map((food) => canonicalizeFood(food)) }
          : {}),
      };
    }
    return {
      ...meal,
      foods: meal.foods.map((food) => canonicalizeFood(food)),
    };
  }

  return {
    ...data,
    recall24h: {
      ...data.recall24h,
      meals: data.recall24h.meals.map(canonicalizeMeal),
    },
  };
}

export const nutritionReturnAnamnesisRepository = {
  async getView(
    patientId: string,
    attendanceId: string,
  ): Promise<NutritionReturnAnamnesisView | null> {
    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        deletedAt: null,
        ...isReturnAttendanceWhere(),
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      select: {
        id: true,
        masterRecordId: true,
        status: true,
        startedAt: true,
        receivedAt: true,
        updatedAt: true,
        previousAttendance: {
          select: {
            startedAt: true,
            receivedAt: true,
            endedAt: true,
          },
        },
        professional: { select: { id: true, fullName: true } },
        masterRecord: {
          select: {
            patient: {
              select: { fullName: true, clinicalCode: true },
            },
          },
        },
      },
    });
    if (!attendance) return null;

    const [
      currentEntry,
      previousEntries,
      previousMealPlan,
      fallbackPreviousAttendance,
    ] =
      await Promise.all([
        prisma.masterRecordEntry.findFirst({
          where: {
            masterRecordId: attendance.masterRecordId,
            attendanceId: attendance.id,
            type: NUTRITION_RETURN_ANAMNESIS_ENTRY_TYPE,
            status: { not: "VOIDED" },
            deletedAt: null,
          },
          orderBy: [{ revision: "desc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            status: true,
            revision: true,
            payload: true,
            updatedAt: true,
            author: { select: { id: true, fullName: true } },
          },
        }),
        prisma.masterRecordEntry.findMany({
          where: {
            masterRecordId: attendance.masterRecordId,
            type: { in: [...PREVIOUS_REFERENCE_ENTRY_TYPES] },
            status: { in: ["DRAFT", "FINALIZED", "SUPERSEDED"] },
            deletedAt: null,
            OR: [
              { attendanceId: null },
              { attendanceId: { not: attendance.id } },
            ],
          },
          orderBy: [{ occurredAt: "desc" }, { revision: "desc" }],
          take: 100,
          select: {
            id: true,
            type: true,
            status: true,
            occurredAt: true,
            payload: true,
            mealPlan: { select: { title: true, content: true } },
            bioimpedance: {
              select: {
                measuredAt: true,
                measurements: true,
                notes: true,
              },
            },
            perimetry: {
              select: {
                measuredAt: true,
                measurements: true,
                notes: true,
              },
            },
            physicalAssessment: {
              select: {
                assessedAt: true,
                observations: true,
                notes: true,
              },
            },
            posturalAssessment: {
              select: {
                assessedAt: true,
                observations: true,
                notes: true,
              },
            },
          },
        }),
        findLatestCompletedMealPlanReference(
          attendance.masterRecordId,
          attendance.id,
        ),
        prisma.attendance.findFirst({
          where: {
            masterRecordId: attendance.masterRecordId,
            id: { not: attendance.id },
            status: "COMPLETED",
            deletedAt: null,
          },
          orderBy: [{ endedAt: "desc" }, { createdAt: "desc" }],
          select: { startedAt: true, receivedAt: true, endedAt: true },
        }),
      ]);

    const storedData = parseNutritionReturnAnamnesisData(
      currentEntry?.payload,
    );
    const lastAttendance =
      attendance.previousAttendance ?? fallbackPreviousAttendance;
    const auditUser = currentEntry?.author ?? attendance.professional;

    return {
      patientId,
      masterRecordId: attendance.masterRecordId,
      attendanceId: attendance.id,
      patientName: attendance.masterRecord.patient.fullName,
      patientCode: attendance.masterRecord.patient.clinicalCode,
      attendanceType: "RETURN",
      attendanceStatus: attendance.status,
      attendanceStartedAt: (
        attendance.startedAt ?? attendance.receivedAt
      ).toISOString(),
      status:
        currentEntry?.status === "FINALIZED" ||
        currentEntry?.status === "SUPERSEDED"
          ? "COMPLETED"
          : "DRAFT",
      version: currentEntry?.revision ?? 1,
      data: storedData ?? emptyNutritionReturnAnamnesisData(),
      previousReference: buildPreviousClinicalReference({
        lastConsultationAt:
          lastAttendance?.endedAt ??
          lastAttendance?.startedAt ??
          lastAttendance?.receivedAt,
        entries: previousMealPlan
          ? [previousMealPlan, ...previousEntries]
          : previousEntries,
      }),
      audit: {
        professionalUserId: auditUser.id,
        professionalName: auditUser.fullName,
        updatedAt: (
          currentEntry?.updatedAt ?? attendance.updatedAt
        ).toISOString(),
      },
      canEdit:
        attendance.status === "IN_PROGRESS" &&
        currentEntry?.status !== "FINALIZED" &&
        currentEntry?.status !== "SUPERSEDED",
    };
  },

  async save(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly professionalUserId: string;
    readonly data: NutritionReturnAnamnesisData;
    readonly saveMode: NutritionReturnAnamnesisSaveMode;
  }) {
    const data = await canonicalizeFoodComposition(
      pruneEmptyOptionalReturnBlocks(input.data),
    );
    const targetStatus = returnAnamnesisEntryStatus(input.saveMode);

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))
      `;

      const [attendance, module, professional] = await Promise.all([
        transaction.attendance.findFirst({
          where: {
            id: input.attendanceId,
            status: "IN_PROGRESS",
            deletedAt: null,
            ...isReturnAttendanceWhere(),
            masterRecord: {
              patientId: input.patientId,
              status: "ACTIVE",
              patient: { deletedAt: null },
            },
          },
          select: { id: true, masterRecordId: true },
        }),
        transaction.systemModule.findUnique({
          where: { key: "MASTER_RECORD" },
          select: { id: true },
        }),
        transaction.user.findUnique({
          where: { id: input.professionalUserId, status: "ACTIVE" },
          select: { id: true },
        }),
      ]);

      if (!attendance || !module || !professional) {
        throw new Error("RETURN_ANAMNESIS_CONTEXT_NOT_FOUND");
      }

      const currentEntries = await transaction.masterRecordEntry.findMany({
        where: {
          masterRecordId: attendance.masterRecordId,
          attendanceId: attendance.id,
          type: NUTRITION_RETURN_ANAMNESIS_ENTRY_TYPE,
          status: { not: "VOIDED" },
          deletedAt: null,
        },
        orderBy: [{ revision: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          status: true,
          revision: true,
          aggregateId: true,
        },
      });
      if (
        currentEntries.some(
          (entry) =>
            entry.status === "FINALIZED" || entry.status === "SUPERSEDED",
        )
      ) {
        throw new Error("RETURN_ANAMNESIS_COMPLETED");
      }

      const draft = currentEntries.find((entry) => entry.status === "DRAFT");
      if (draft) {
        await transaction.masterRecordEntry.update({
          where: { id: draft.id },
          data: {
            status: targetStatus,
            payload: inputJson(data),
            occurredAt: new Date(),
            updatedByUserId: professional.id,
          },
        });
        return;
      }

      await transaction.masterRecordEntry.create({
        data: {
          masterRecordId: attendance.masterRecordId,
          moduleId: module.id,
          authorUserId: professional.id,
          updatedByUserId: professional.id,
          attendanceId: attendance.id,
          aggregateId: randomUUID(),
          type: NUTRITION_RETURN_ANAMNESIS_ENTRY_TYPE,
          status: targetStatus,
          occurredAt: new Date(),
          revision: 1,
          payload: inputJson(data),
        },
      });
    });

    const view = await this.getView(input.patientId, input.attendanceId);
    if (!view) throw new Error("RETURN_ANAMNESIS_CONTEXT_NOT_FOUND");
    return view;
  },
};
