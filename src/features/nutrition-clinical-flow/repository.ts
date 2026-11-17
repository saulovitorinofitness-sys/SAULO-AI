import { prisma } from "@/lib/database/prisma";
import {
  type ClinicalReturnInput,
  upsertClinicalReturn,
} from "@/features/scheduling/clinical-return";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { nutritionStrategyRepository } from "@/features/nutrition-strategy/strategy-repository";
import {
  flowForAttendanceAnamnesis,
  isNutritionReturnAttendance,
} from "@/features/nutrition-return-anamnesis/policy";
import { NUTRITION_RETURN_ANAMNESIS_ENTRY_TYPE } from "@/features/nutrition-return-anamnesis/contracts";
import {
  completedAttendanceState,
  validateAttendanceCompletion,
} from "@/features/patient-registration/attendance-state-machine";
import type { Prisma } from "@/generated/prisma/client";

import {
  NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
  NUTRITION_CLINICAL_FLOW_STEP_IDS,
  buildNutritionClinicalFlow,
  evaluateNutritionClinicalFlowClosureEligibility,
  findNutritionClinicalFlowResumeStep,
  nutritionClinicalFlowDefinitions,
  type NutritionClinicalFlowContext,
  type NutritionClinicalFlowDecisionStep,
  type NutritionClinicalFlowStep,
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
  if (status === "COMPLETED") {
    return "COMPLETED";
  }

  if (status === "SKIPPED") {
    return "SKIPPED";
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
  return NUTRITION_CLINICAL_FLOW_STEP_IDS.some(
    (stepId) => stepId === value,
  );
}

function continuityStepKey(stepId: NutritionClinicalFlowStepId) {
  return stepId === "FINALIZE_ATTENDANCE" ? "FINALIZATION" : stepId;
}

function flowStepIdFromContinuityKey(key: string) {
  const stepId = key === "FINALIZATION" ? "FINALIZE_ATTENDANCE" : key;

  return isFlowStepId(stepId) ? stepId : undefined;
}

type OperationalStep = {
  continuityStep: { key: string };
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED";
  skippedByUserId: string | null;
  skippedAt: Date | null;
  skipReason: string | null;
};

const clinicalContentStepIds = new Set<NutritionClinicalFlowStepId>([
  "ANAMNESIS",
  "ANTHROPOMETRY",
  "PERIMETRY",
  "BIOIMPEDANCE",
  "POSTURAL_ASSESSMENT",
  "PERFORMANCE",
  "NUTRITION_STRATEGY",
  "MEAL_PLAN",
]);

function completedClinicalStepIds(
  flow: readonly NutritionClinicalFlowStep[],
) {
  return new Set(
    flow
      .filter(
        (step) =>
          step.status === "COMPLETED" && clinicalContentStepIds.has(step.id),
      )
      .map((step) => step.id),
  );
}

async function ensureAttendancePendingCheck(
  transaction: Prisma.TransactionClient,
  attendanceId: string,
  completedStepIds: ReadonlySet<NutritionClinicalFlowStepId>,
) {
  const attendance = await transaction.attendance.findFirst({
    where: {
      id: attendanceId,
      deletedAt: null,
      masterRecord: {
        status: "ACTIVE",
        patient: { deletedAt: null },
      },
    },
    select: {
      id: true,
      moduleId: true,
      professionalUserId: true,
      masterRecord: {
        select: {
          continuity: {
            select: {
              id: true,
              version: true,
            },
          },
        },
      },
    },
  });

  if (!attendance) {
    throw new Error("ATTENDANCE_NOT_FOUND");
  }

  const continuity = attendance.masterRecord.continuity;
  if (!continuity) {
    throw new Error("ATTENDANCE_CONTINUITY_NOT_FOUND");
  }

  const continuitySteps = await Promise.all(
    nutritionClinicalFlowDefinitions.map((definition) =>
      transaction.continuityStep.upsert({
        where: {
          continuityId_key: {
            continuityId: continuity.id,
            key: continuityStepKey(definition.id),
          },
        },
        update: {},
        create: {
          continuityId: continuity.id,
          moduleId: attendance.moduleId,
          key: continuityStepKey(definition.id),
          title: definition.title,
          sortOrder: definition.order,
          responsibleUserId: attendance.professionalUserId,
          createdByUserId: attendance.professionalUserId,
          updatedByUserId: attendance.professionalUserId,
        },
        select: {
          id: true,
          key: true,
        },
      }),
    ),
  );

  const pendingCheck = await transaction.attendancePendingCheck.upsert({
    where: {
      attendanceId: attendance.id,
    },
    update: {},
    create: {
      attendanceId: attendance.id,
      continuityId: continuity.id,
      moduleId: attendance.moduleId,
      performedByUserId: attendance.professionalUserId,
      continuityVersion: continuity.version,
    },
    select: {
      id: true,
    },
  });

  const items: Prisma.AttendancePendingCheckItemCreateManyInput[] =
    continuitySteps.flatMap((step) => {
      const stepId = flowStepIdFromContinuityKey(step.key);
      if (!stepId) return [];

      return [
        {
          pendingCheckId: pendingCheck.id,
          continuityStepId: step.id,
          status: completedStepIds.has(stepId) ? "COMPLETED" : "PENDING",
        },
      ];
    });

  if (items.length > 0) {
    await transaction.attendancePendingCheckItem.createMany({
      data: items,
      skipDuplicates: true,
    });
  }

  return pendingCheck;
}

function mergeAttendanceStepStatus(
  contentStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
  operationalStatus: NutritionClinicalFlowStepStatus,
  allowOperationalCompletion = false,
): NutritionClinicalFlowStepStatus {
  if (contentStatus === "COMPLETED" || contentStatus === "IN_PROGRESS") {
    return contentStatus;
  }

  if (operationalStatus === "SKIPPED") {
    return "SKIPPED";
  }

  if (allowOperationalCompletion && operationalStatus === "COMPLETED") {
    return "COMPLETED";
  }

  if (
    operationalStatus === "IN_PROGRESS" ||
    operationalStatus === "BLOCKED"
  ) {
    return operationalStatus;
  }

  return "NOT_STARTED";
}

function toDecisionStep(
  step: NutritionClinicalFlowStep,
  operationalStep: OperationalStep | undefined,
): NutritionClinicalFlowDecisionStep | undefined {
  if (step.status === "SKIPPED") {
    const reason = operationalStep?.skipReason?.trim();

    if (
      !operationalStep?.skippedByUserId ||
      !operationalStep.skippedAt ||
      !reason
    ) {
      return undefined;
    }

    return {
      ...step,
      status: "SKIPPED",
      skipMetadata: {
        responsibleProfessionalUserId: operationalStep.skippedByUserId,
        decidedAt: operationalStep.skippedAt.toISOString(),
        reason,
      },
    };
  }

  return { ...step, status: step.status };
}

export const nutritionClinicalFlowRepository = {
  async getFlow(context: NutritionClinicalFlowContext) {
    const [
      collection,
      attendance,
      pendingCheck,
      clinicalEntries,
      persistedStrategy,
    ] =
      await Promise.all([
        clinicalCollectionRepository.getCollection(
          context.patientId,
          context.attendanceId,
        ),

        prisma.attendance.findFirst({
          where: {
            id: context.attendanceId,
            deletedAt: null,
            masterRecord: {
              patientId: context.patientId,
              status: "ACTIVE",
              patient: { deletedAt: null },
            },
          },
          select: {
            status: true,
            clinicalType: true,
            consultationType: true,
            masterRecord: {
              select: {
                continuity: {
                  select: {
                    id: true,
                    steps: {
                      select: {
                        key: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),

        prisma.attendancePendingCheck.findUnique({
          where: {
            attendanceId: context.attendanceId,
          },
          select: {
            continuityId: true,
            items: {
              select: {
                status: true,
                skippedByUserId: true,
                skippedAt: true,
                skipReason: true,
                continuityStep: {
                  select: {
                    key: true,
                  },
                },
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
                NUTRITION_RETURN_ANAMNESIS_ENTRY_TYPE,
                "MEAL_PLAN",
                "WORKOUT_PLAN",
              ],
            },
            status: {
              not: "VOIDED",
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

        nutritionStrategyRepository.getForClinicalAttendance(
          context.patientId,
          context.attendanceId,
        ),
      ]);

    if (
      !collection ||
      !attendance ||
      (pendingCheck &&
        pendingCheck.continuityId !== attendance.masterRecord.continuity?.id)
    ) {
      return null;
    }

    const operationalSteps = new Map<
      NutritionClinicalFlowStepId,
      OperationalStep
    >();
    for (const item of pendingCheck?.items ?? []) {
      const stepId = flowStepIdFromContinuityKey(item.continuityStep.key);
      if (!stepId) continue;

      operationalSteps.set(stepId, item);
    }

    const operationalStatus = (stepId: NutritionClinicalFlowStepId) =>
      continuityStatus(operationalSteps.get(stepId)?.status);

    const anamnesisEntryType = isNutritionReturnAttendance(attendance)
      ? NUTRITION_RETURN_ANAMNESIS_ENTRY_TYPE
      : "CLINICAL_ANAMNESIS";
    const finalizedAnamnesis = clinicalEntries.some(
      (entry) =>
        entry.type === anamnesisEntryType &&
        entry.status === "FINALIZED",
    );

    const anamnesisDraft = clinicalEntries.some(
      (entry) =>
        entry.type === anamnesisEntryType &&
        entry.status !== "FINALIZED",
    );

    const finalizedMealPlan = clinicalEntries.some(
      (entry) =>
        entry.type === "MEAL_PLAN" && entry.status === "FINALIZED",
    );

    const mealPlanDraft = clinicalEntries.some(
      (entry) =>
        entry.type === "MEAL_PLAN" && entry.status !== "FINALIZED",
    );

    const finalizedWorkout = clinicalEntries.some(
      (entry) =>
        entry.type === "WORKOUT_PLAN" && entry.status === "FINALIZED",
    );
    const workoutDraft = clinicalEntries.some(
      (entry) =>
        entry.type === "WORKOUT_PLAN" && entry.status !== "FINALIZED",
    );

    const contentStatus = (
      finalized: boolean,
      draft: boolean,
    ): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" =>
      finalized ? "COMPLETED" : draft ? "IN_PROGRESS" : "NOT_STARTED";

    const registrationStatus = continuityStatus(
      attendance.masterRecord.continuity?.steps.find(
        (step) => step.key === "PATIENT_REGISTRATION",
      )?.status,
    );
    const mealPlanContentStatus = contentStatus(
      finalizedMealPlan,
      mealPlanDraft,
    );

    const performanceStatus: NutritionClinicalFlowStepStatus =
      mergeAttendanceStepStatus(
        contentStatus(finalizedWorkout, workoutDraft),
        operationalStatus("PERFORMANCE"),
      );

    const deliverablesContinuityStatus = operationalStatus("DELIVERABLES");

    /*
     * O Plano Alimentar usa a entrada oficial como fonte canônica. A
     * continuidade permanece apenas como apoio para o estado de Entregáveis.
     *
     * - Se já foi concluído, preserva COMPLETED.
     * - Se o Plano Alimentar foi concluído, libera Entregáveis em andamento.
     * - Se existe um rascunho, permite abrir a prévia para revisão.
     * - Antes disso, preserva o estado real registrado na continuidade.
     */
    const deliverablesStatus: NutritionClinicalFlowStepStatus =
      mergeAttendanceStepStatus(
        mealPlanContentStatus === "NOT_STARTED"
          ? "NOT_STARTED"
          : "IN_PROGRESS",
        deliverablesContinuityStatus,
        true,
      );

    const statuses: Partial<
      Record<
        NutritionClinicalFlowStepId,
        NutritionClinicalFlowStepStatus
      >
    > = {
      PATIENT_REGISTRATION: registrationStatus,

      ANAMNESIS: mergeAttendanceStepStatus(
        contentStatus(finalizedAnamnesis, anamnesisDraft),
        operationalStatus("ANAMNESIS"),
      ),

      ANTHROPOMETRY: mergeAttendanceStepStatus(
        collection.records.anthropometry.status,
        operationalStatus("ANTHROPOMETRY"),
      ),

      PERIMETRY: mergeAttendanceStepStatus(
        collection.records.perimetry.status,
        operationalStatus("PERIMETRY"),
      ),

      BIOIMPEDANCE: mergeAttendanceStepStatus(
        collection.records.bioimpedance.status,
        operationalStatus("BIOIMPEDANCE"),
      ),

      POSTURAL_ASSESSMENT: mergeAttendanceStepStatus(
        collection.records.posturalAssessment.status,
        operationalStatus("POSTURAL_ASSESSMENT"),
      ),

      ASSESSMENT_SUMMARY: mergeAttendanceStepStatus(
        collection.completed ? "COMPLETED" : "NOT_STARTED",
        operationalStatus("ASSESSMENT_SUMMARY"),
      ),

      PERFORMANCE: performanceStatus,

      NUTRITION_STRATEGY: mergeAttendanceStepStatus(
        persistedStrategy?.status === "APPROVED"
          ? "COMPLETED"
          : persistedStrategy?.status === "DRAFT"
            ? "IN_PROGRESS"
            : "NOT_STARTED",
        operationalStatus("NUTRITION_STRATEGY"),
      ),

      MEAL_PLAN: mergeAttendanceStepStatus(
        mealPlanContentStatus,
        operationalStatus("MEAL_PLAN"),
      ),

      DELIVERABLES: deliverablesStatus,

      FINALIZE_ATTENDANCE:
        attendance.status === "COMPLETED"
          ? "COMPLETED"
          : mergeAttendanceStepStatus(
              "NOT_STARTED",
              operationalStatus("FINALIZE_ATTENDANCE"),
              true,
            ),
    };

    const completeFlow = buildNutritionClinicalFlow(context, statuses);
    const decisionSteps = completeFlow.flatMap((step) => {
      const decision = toDecisionStep(step, operationalSteps.get(step.id));
      return decision ? [decision] : [];
    });
    const closureEligibility = evaluateNutritionClinicalFlowClosureEligibility(
      decisionSteps,
      NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
    );
    const flow = flowForAttendanceAnamnesis(completeFlow, attendance);

    return {
      collection,
      flow,
      resumeStep: findNutritionClinicalFlowResumeStep(flow),
      requiredStepIds: NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
      closureEligibility,
    };
  },

  async markStepSkipped(
    attendanceId: string,
    stepId: NutritionClinicalFlowStepId,
    professionalUserId: string,
    reason: string,
  ) {
    if (stepId === "DELIVERABLES") {
      throw new Error("ATTENDANCE_DOCUMENT_CENTER_CANNOT_BE_SKIPPED");
    }

    if (stepId === "PATIENT_REGISTRATION" || stepId === "ANAMNESIS") {
      throw new Error("ATTENDANCE_REQUIRED_STEP_CANNOT_BE_SKIPPED");
    }

    const normalizedReason = reason.trim().replace(/\s+/g, " ");

    if (!normalizedReason) {
      throw new Error("SKIP_REASON_REQUIRED");
    }

    const attendanceContext = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        deletedAt: null,
      },
      select: {
        masterRecord: {
          select: {
            patientId: true,
          },
        },
      },
    });

    if (!attendanceContext) {
      throw new Error("ATTENDANCE_NOT_FOUND");
    }

    const flowSnapshot = await nutritionClinicalFlowRepository.getFlow({
      patientId: attendanceContext.masterRecord.patientId,
      attendanceId,
    });

    if (!flowSnapshot) {
      throw new Error("ATTENDANCE_PENDING_CHECK_NOT_FOUND");
    }

    const currentFlowStep = flowSnapshot.flow.find(
      (step) => step.id === stepId,
    );

    if (!currentFlowStep) {
      throw new Error("ATTENDANCE_STEP_NOT_FOUND");
    }

    if (currentFlowStep.status === "COMPLETED") {
      throw new Error("ATTENDANCE_STEP_ALREADY_COMPLETED");
    }

    const completedStepIds = completedClinicalStepIds(flowSnapshot.flow);

    return prisma.$transaction(async (transaction) => {
      const pendingCheck = await ensureAttendancePendingCheck(
        transaction,
        attendanceId,
        completedStepIds,
      );

      const step = await transaction.attendancePendingCheckItem.findFirst({
        where: {
          pendingCheckId: pendingCheck.id,
          continuityStep: {
            key: continuityStepKey(stepId),
          },
        },
        select: {
          id: true,
          pendingCheckId: true,
          continuityStepId: true,
          status: true,
          skippedByUserId: true,
          skippedAt: true,
          skipReason: true,
        },
      });

      if (!step) {
        throw new Error("ATTENDANCE_STEP_NOT_FOUND");
      }

      if (step.status === "COMPLETED") {
        throw new Error("ATTENDANCE_STEP_ALREADY_COMPLETED");
      }

      if (step.status === "SKIPPED") {
        return step;
      }

      const skippedAt = new Date();
      const update = await transaction.attendancePendingCheckItem.updateMany({
        where: {
          id: step.id,
          status: {
            notIn: ["COMPLETED", "SKIPPED"],
          },
        },
        data: {
          status: "SKIPPED",
          skippedByUserId: professionalUserId,
          skippedAt,
          skipReason: normalizedReason,
        },
      });

      if (update.count === 0) {
        const currentStep =
          await transaction.attendancePendingCheckItem.findUnique({
            where: {
              id: step.id,
            },
            select: {
              id: true,
              pendingCheckId: true,
              continuityStepId: true,
              status: true,
              skippedByUserId: true,
              skippedAt: true,
              skipReason: true,
            },
          });

        if (currentStep?.status === "SKIPPED") {
          return currentStep;
        }

        if (currentStep?.status === "COMPLETED") {
          throw new Error("ATTENDANCE_STEP_ALREADY_COMPLETED");
        }

        throw new Error("ATTENDANCE_STEP_NOT_FOUND");
      }

      const skippedStep =
        await transaction.attendancePendingCheckItem.findUnique({
          where: {
            id: step.id,
          },
          select: {
            id: true,
            pendingCheckId: true,
            continuityStepId: true,
            status: true,
            skippedByUserId: true,
            skippedAt: true,
            skipReason: true,
          },
        });

      if (!skippedStep) {
        throw new Error("ATTENDANCE_STEP_NOT_FOUND");
      }

      return skippedStep;
    });
  },

  async finalizeAttendance(
    patientId: string,
    attendanceId: string,
    professionalUserId: string,
    returnPlan?: ClinicalReturnInput,
    closureObservation?: string,
  ) {
    const attendanceOwnership = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        deletedAt: null,
      },
      select: {
        status: true,
        masterRecord: {
          select: {
            patientId: true,
            status: true,
          },
        },
      },
    });

    if (!attendanceOwnership) {
      throw new Error("ATTENDANCE_NOT_FOUND");
    }

    if (
      attendanceOwnership.masterRecord.patientId !== patientId ||
      attendanceOwnership.masterRecord.status !== "ACTIVE"
    ) {
      throw new Error("ATTENDANCE_PATIENT_MISMATCH");
    }

    if (attendanceOwnership.status !== "IN_PROGRESS") {
      throw new Error("ATTENDANCE_NOT_FINALIZABLE");
    }

    const fallbackFlowSnapshot = await nutritionClinicalFlowRepository.getFlow({
      patientId,
      attendanceId,
    });

    if (!fallbackFlowSnapshot) {
      throw new Error("ATTENDANCE_PENDING_CHECK_NOT_FOUND");
    }

    validateAttendanceCompletion(
      "IN_PROGRESS",
      fallbackFlowSnapshot.closureEligibility.completedClinicalStepIds.length > 0,
      closureObservation,
    );

    await prisma.$transaction(async (transaction) => {
      await ensureAttendancePendingCheck(
        transaction,
        attendanceId,
        completedClinicalStepIds(fallbackFlowSnapshot.flow),
      );
    });

    const flowSnapshot = await nutritionClinicalFlowRepository.getFlow({
      patientId,
      attendanceId,
    });

    if (!flowSnapshot) {
      throw new Error("ATTENDANCE_PENDING_CHECK_NOT_FOUND");
    }

    const hasClinicalRecords =
      flowSnapshot.closureEligibility.completedClinicalStepIds.length > 0;

    return prisma.$transaction(async (transaction) => {
      const attendance = await transaction.attendance.findFirst({
        where: {
          id: attendanceId,
          status: "IN_PROGRESS",
          deletedAt: null,
          masterRecord: {
            patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
        },
        select: {
          id: true,
          masterRecordId: true,
          moduleId: true,
          context: true,
        },
      });

      if (!attendance) {
        throw new Error("ATTENDANCE_NOT_FOUND");
      }

      const pendingCheck =
        await transaction.attendancePendingCheck.findUnique({
          where: {
            attendanceId: attendance.id,
          },
          select: {
            continuityId: true,
          },
        });

      if (!pendingCheck) {
        throw new Error("ATTENDANCE_PENDING_CHECK_NOT_FOUND");
      }

      const now = new Date();
      const completedState = completedAttendanceState(
        "IN_PROGRESS",
        now,
        hasClinicalRecords,
        closureObservation,
      );

      const lastEvent =
        await transaction.attendanceTimelineEvent.aggregate({
          where: {
            attendanceId,
          },
          _max: {
            sequence: true,
          },
        });

      await Promise.all([
        transaction.attendance.update({
          where: {
            id: attendanceId,
          },
          data: {
            ...completedState,
            ...(closureObservation?.trim()
              ? {
                  context: {
                    ...(attendance.context &&
                    typeof attendance.context === "object" &&
                    !Array.isArray(attendance.context)
                      ? attendance.context
                      : {}),
                    closureObservation: closureObservation.trim(),
                  },
                }
              : {}),
            updatedByUserId: professionalUserId,
            version: {
              increment: 1,
            },
          },
        }),

        transaction.attendanceTimelineEvent.create({
          data: {
            attendanceId,
            moduleId: attendance.moduleId,
            actorUserId: professionalUserId,
            type: "ATTENDANCE_COMPLETED",
            sequence: (lastEvent._max.sequence ?? 0) + 1,
            occurredAt: now,
          },
        }),

        transaction.continuityStep.upsert({
          where: {
            continuityId_key: {
              continuityId: pendingCheck.continuityId,
              key: "FINALIZATION",
            },
          },
          update: {
            status: "COMPLETED",
            responsibleUserId: professionalUserId,
            completedByUserId: professionalUserId,
            completedAt: now,
            updatedByUserId: professionalUserId,
            version: {
              increment: 1,
            },
          },
          create: {
            continuityId: pendingCheck.continuityId,
            moduleId: attendance.moduleId,
            key: "FINALIZATION",
            title: "Finalização",
            status: "COMPLETED",
            sortOrder: 6,
            responsibleUserId: professionalUserId,
            completedByUserId: professionalUserId,
            completedAt: now,
            createdByUserId: professionalUserId,
            updatedByUserId: professionalUserId,
          },
        }),

        transaction.masterRecordContinuity.update({
          where: {
            id: pendingCheck.continuityId,
          },
          data: {
            lastCompletedStepKey: "FINALIZATION",
            lastActivityAt: now,
            nextSuggestedStepKey: null,
            suggestionSource: "WORKFLOW",
            responsibleUserId: professionalUserId,
            updatedByUserId: professionalUserId,
            version: {
              increment: 1,
            },
          },
        }),
      ]);

      if (returnPlan) {
        await upsertClinicalReturn(transaction, {
          attendanceId,
          actorUserId: professionalUserId,
          returnPlan,
        });
      }

      return {
        finalizedAt: now.toISOString(),
      } as const;
    }, { isolationLevel: "Serializable" });
  },
};
