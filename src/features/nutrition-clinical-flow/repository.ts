import { prisma } from "@/lib/database/prisma";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";

import {
  buildNutritionClinicalFlow,
  findNutritionClinicalFlowResumeStep,
  type NutritionClinicalFlowContext,
  type NutritionClinicalFlowStepId,
  type NutritionClinicalFlowStepStatus,
} from "./flow";

function continuityStatus(
  status:
    | "PENDING"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "SKIPPED"
    | "BLOCKED"
    | undefined,
): NutritionClinicalFlowStepStatus {
  if (status === "COMPLETED" || status === "SKIPPED") {
    return "COMPLETED";
  }

  if (status === "IN_PROGRESS") {
    return "IN_PROGRESS";
  }

  if (status === "BLOCKED") {
    return "BLOCKED";
  }

  return "NOT_STARTED";
}

function isFlowStepId(
  value: string | null,
): value is NutritionClinicalFlowStepId {
  return [
    "PATIENT_REGISTRATION",
    "ANAMNESIS",
    "ANTHROPOMETRY",
    "PERIMETRY",
    "BIOIMPEDANCE",
    "POSTURAL_ASSESSMENT",
    "ASSESSMENT_SUMMARY",
    "PERFORMANCE",
    "NUTRITION_STRATEGY",
    "MEAL_PLAN",
    "DELIVERABLES",
    "FINALIZE_ATTENDANCE",
  ].includes(value ?? "");
}

export const nutritionClinicalFlowRepository = {
  async getFlow(context: NutritionClinicalFlowContext) {
    const [collection, continuity, clinicalEntries] = await Promise.all([
      clinicalCollectionRepository.getCollection(
        context.patientId,
        context.attendanceId,
      ),

      prisma.masterRecordContinuity.findFirst({
        where: {
          masterRecord: {
            patientId: context.patientId,
            attendances: {
              some: {
                id: context.attendanceId,
                deletedAt: null,
              },
            },
          },
        },
        select: {
          nextSuggestedStepKey: true,
          steps: {
            select: {
              key: true,
              status: true,
            },
          },
        },
      }),

      prisma.masterRecordEntry.findMany({
        where: {
          attendanceId: context.attendanceId,
          type: {
            in: [
              "CLINICAL_ANAMNESIS",
              "NUTRITION_STRATEGY",
              "MEAL_PLAN",
            ],
          },
          deletedAt: null,
          masterRecord: {
            patientId: context.patientId,
            status: "ACTIVE",
          },
        },
        select: {
          type: true,
          status: true,
        },
      }),
    ]);

    if (!collection || !continuity) {
      return null;
    }

    const continuitySteps = new Map(
      continuity.steps.map((step) => [
        step.key,
        step.status,
      ]),
    );

    const finalizedAnamnesis = clinicalEntries.some(
      (entry) =>
        entry.type === "CLINICAL_ANAMNESIS" &&
        entry.status === "FINALIZED",
    );

    const anamnesisDraft = clinicalEntries.some(
      (entry) =>
        entry.type === "CLINICAL_ANAMNESIS" &&
        entry.status !== "FINALIZED",
    );

    const approvedStrategy = clinicalEntries.some(
      (entry) =>
        entry.type === "NUTRITION_STRATEGY" &&
        entry.status === "FINALIZED",
    );

    const strategyDraft = clinicalEntries.some(
      (entry) =>
        entry.type === "NUTRITION_STRATEGY" &&
        entry.status !== "FINALIZED",
    );

    const persistedMealPlan = clinicalEntries.some(
      (entry) => entry.type === "MEAL_PLAN",
    );

    const mealPlanContinuityStatus = continuityStatus(
      continuitySteps.get("MEAL_PLAN"),
    );

    const performanceContinuityStatus = continuityStatus(
      continuitySteps.get("PERFORMANCE"),
    );

    const statuses: Partial<
      Record<
        NutritionClinicalFlowStepId,
        NutritionClinicalFlowStepStatus
      >
    > = {
      PATIENT_REGISTRATION: continuityStatus(
        continuitySteps.get("PATIENT_REGISTRATION"),
      ),

      ANAMNESIS: finalizedAnamnesis
        ? "COMPLETED"
        : anamnesisDraft
          ? "IN_PROGRESS"
          : "NOT_STARTED",

      ANTHROPOMETRY:
        collection.records.anthropometry.status,

      PERIMETRY:
        collection.records.perimetry.status,

      BIOIMPEDANCE:
        collection.records.bioimpedance.status,

      POSTURAL_ASSESSMENT:
        collection.records.posturalAssessment.status,

      ASSESSMENT_SUMMARY:
        collection.completed
          ? "COMPLETED"
          : "NOT_STARTED",

      PERFORMANCE:
        performanceContinuityStatus,

      NUTRITION_STRATEGY:
        approvedStrategy
          ? "COMPLETED"
          : strategyDraft
            ? "IN_PROGRESS"
            : "NOT_STARTED",

      MEAL_PLAN:
        mealPlanContinuityStatus === "COMPLETED"
          ? "COMPLETED"
          : approvedStrategy || persistedMealPlan
            ? "IN_PROGRESS"
            : mealPlanContinuityStatus,

      DELIVERABLES: continuityStatus(
        continuitySteps.get("DELIVERABLES"),
      ),

      FINALIZE_ATTENDANCE: continuityStatus(
        continuitySteps.get("FINALIZATION"),
      ),
    };

    const flow = buildNutritionClinicalFlow(
      context,
      statuses,
    );

    const suggestedStepId = isFlowStepId(
      continuity.nextSuggestedStepKey,
    )
      ? continuity.nextSuggestedStepKey
      : undefined;

    return {
      collection,
      flow,
      resumeStep: findNutritionClinicalFlowResumeStep(
        flow,
        suggestedStepId,
      ),
    };
  },
};