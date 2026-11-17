import type { StudentPortalContentType as PrismaStudentPortalContentType } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import {
  isMealPlanRecipeItem,
  parseStoredMealPlanPayload,
} from "@/features/meal-plan/record";
import { getLatestOfficialWorkoutPlan } from "@/features/performance-endurance/workout-repository";
import { mvpService } from "@/features/mvp";

import type {
  StudentAssessmentsView,
  StudentDietView,
  StudentPaymentView,
  StudentPortalContext,
  StudentPortalDashboard,
  StudentPortalContentType,
  StudentWorkoutView,
} from "./contracts";
import {
  createStudentCredentialHash,
  createStudentInvitationToken,
  normalizeStudentLogin,
  studentInvitationTokenHash,
} from "./credentials";
import { StudentPortalAccessError } from "./security";

export { StudentPortalAccessError } from "./security";

const INVITATION_DURATION_MS = 72 * 60 * 60 * 1_000;
const RELEASE_TYPES: readonly StudentPortalContentType[] = [
  "DIET",
  "WORKOUT",
  "ASSESSMENTS",
  "POSTURAL_MEDIA",
  "PAYMENTS",
];

export async function requireStudentPortalContext(): Promise<StudentPortalContext> {
  let access: Awaited<ReturnType<typeof mvpService.getSession>>;
  try {
    access = await mvpService.getSession();
  } catch {
    throw new StudentPortalAccessError("UNAUTHENTICATED");
  }

  const link = await prisma.studentPortalLink.findFirst({
    where: {
      userId: access.user.id,
      status: "ACTIVE",
      user: {
        status: "ACTIVE",
        deletedAt: null,
        profile: { is: { type: "STUDENT" } },
      },
      patient: { status: "ACTIVE", deletedAt: null },
      masterRecord: { status: "ACTIVE", archivedAt: null },
    },
    select: {
      userId: true,
      patientId: true,
      masterRecordId: true,
      patient: { select: { fullName: true, clinicalCode: true } },
    },
  });

  if (!link) throw new StudentPortalAccessError("FORBIDDEN");

  return {
    userId: link.userId,
    patientId: link.patientId,
    masterRecordId: link.masterRecordId,
    patientName: link.patient.fullName,
    patientCode: link.patient.clinicalCode,
  };
}

function blankReleaseMap(): Record<StudentPortalContentType, boolean> {
  return {
    DIET: false,
    WORKOUT: false,
    ASSESSMENTS: false,
    POSTURAL_MEDIA: false,
    PAYMENTS: false,
  };
}

async function releaseMap(masterRecordId: string) {
  const releases = await prisma.studentPortalRelease.findMany({
    where: { masterRecordId, revokedAt: null },
    select: { contentType: true },
  });
  const result = blankReleaseMap();
  for (const release of releases) result[release.contentType] = true;
  return result;
}

function portionLabel(item: {
  prescribedAmount?: number;
  prescribedUnit?: string;
  quantity?: number;
  householdMeasure?: string;
}) {
  if (item.prescribedAmount && item.prescribedUnit) {
    return `${item.prescribedAmount} ${item.prescribedUnit}`;
  }
  return [item.quantity, item.householdMeasure].filter(Boolean).join(" ");
}

async function studentDiet(
  context: StudentPortalContext,
): Promise<StudentDietView | undefined> {
  const deliverables = await prisma.deliverable.findMany({
    where: {
      masterRecordId: context.masterRecordId,
      kind: "NUTRITION_REPORT",
      status: "PUBLISHED",
      deletedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    select: { createdAt: true, metadata: true },
  });
  const releasedSources = deliverables.flatMap((deliverable) => {
    if (
      !deliverable.metadata ||
      typeof deliverable.metadata !== "object" ||
      Array.isArray(deliverable.metadata)
    ) {
      return [];
    }
    const metadata = deliverable.metadata as Record<string, unknown>;
    return typeof metadata.sourceEntryId === "string" &&
      typeof metadata.sourceVersionId === "string"
      ? [{
          deliveredAt: deliverable.createdAt,
          entryId: metadata.sourceEntryId,
          versionId: metadata.sourceVersionId,
        }]
      : [];
  });
  if (!releasedSources.length) return undefined;

  const [entries, versions] = await Promise.all([
    prisma.masterRecordEntry.findMany({
      where: {
        id: { in: releasedSources.map((source) => source.entryId) },
        masterRecordId: context.masterRecordId,
        type: "MEAL_PLAN",
        status: "FINALIZED",
        deletedAt: null,
      },
      select: { id: true, occurredAt: true },
    }),
    prisma.recordVersion.findMany({
      where: {
        id: { in: releasedSources.map((source) => source.versionId) },
        entityType: "MEAL_PLAN",
        status: "FINALIZED",
      },
      select: { id: true, entityId: true, snapshot: true, createdAt: true },
    }),
  ]);
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const releasedPlans = releasedSources.flatMap((source) => {
    const entry = entryById.get(source.entryId);
    const version = versionById.get(source.versionId);
    if (!entry || !version || version.entityId !== entry.id) return [];
    const plan = parseStoredMealPlanPayload(version.snapshot);
    return plan?.status === "APPROVED"
      ? [{ deliveredAt: source.deliveredAt, entry, plan, version }]
      : [];
  });
  const selected = releasedPlans.sort((left, right) =>
    right.entry.occurredAt.getTime() - left.entry.occurredAt.getTime() ||
    right.deliveredAt.getTime() - left.deliveredAt.getTime() ||
    right.version.createdAt.getTime() - left.version.createdAt.getTime()
  )[0];
  if (!selected) return undefined;

  const { plan } = selected;

  return {
    updatedAt: selected.version.createdAt.toISOString(),
    meals: plan.meals.map((meal) => ({
      id: meal.id,
      name: meal.name,
      time: meal.time,
      orientation: meal.observations?.trim() || undefined,
      items: meal.items.map((item) =>
        isMealPlanRecipeItem(item)
          ? {
              id: item.id,
              name: item.recipeTitle,
              portion: item.portion.description,
              substitutions: [],
            }
          : {
              id: item.id,
              name: item.description,
              portion: portionLabel(item),
              substitutions: item.substitutions.map((substitution) =>
                [
                  substitution.replacementDescription,
                  substitution.replacementQuantity,
                  substitution.replacementHouseholdMeasure,
                ]
                  .filter(Boolean)
                  .join(" · "),
              ),
            },
      ),
    })),
    orientations: plan.supplements.map((item) => item.description),
  };
}

async function studentWorkout(
  context: StudentPortalContext,
): Promise<StudentWorkoutView | undefined> {
  const entry = await prisma.masterRecordEntry.findFirst({
    where: {
      masterRecordId: context.masterRecordId,
      type: "WORKOUT_PLAN",
      status: "FINALIZED",
      deletedAt: null,
      attendanceId: { not: null },
    },
    orderBy: [{ occurredAt: "desc" }, { revision: "desc" }],
    select: { attendanceId: true },
  });
  if (!entry?.attendanceId) return undefined;

  const plan = await getLatestOfficialWorkoutPlan({
    patientId: context.patientId,
    masterRecordId: context.masterRecordId,
    attendanceId: entry.attendanceId,
  });
  if (!plan || plan.status !== "FINALIZED") return undefined;

  return {
    updatedAt: plan.updatedAt ?? new Date(0).toISOString(),
    currentPhase: plan.draft.strategy.currentPhase || undefined,
    currentFocus: plan.draft.strategy.currentFocus || undefined,
    nextPhase: plan.draft.strategy.nextPhase || undefined,
    nextFocus: plan.draft.strategy.nextFocus || undefined,
    journey: (plan.draft.strategy.transitions ?? []).map((transition) => ({
      effectiveDate: transition.effectiveDate,
      phaseBefore: transition.phaseBefore,
      phaseAfter: transition.phaseAfter,
      focusBefore: transition.focusBefore,
      focusAfter: transition.focusAfter,
    })),
    sessions: plan.draft.sessions.map((session) => ({
      id: session.id,
      name: session.name,
      objective: session.objective || undefined,
      estimatedDuration: session.estimatedDuration || undefined,
      exercises: session.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        sets: exercise.sets || undefined,
        repetitions: exercise.repetitions || undefined,
        load: [exercise.load, exercise.loadUnit].filter(Boolean).join(" ") || undefined,
        restInterval: exercise.restInterval || undefined,
        instruction: exercise.patientInstructions || undefined,
      })),
    })),
  };
}

async function studentAssessments(
  context: StudentPortalContext,
  includePostural: boolean,
): Promise<StudentAssessmentsView> {
  const types = [
    "BIOIMPEDANCE",
    "PERIMETRY",
    "PHYSICAL_ASSESSMENT",
    ...(includePostural ? ["POSTURAL_ASSESSMENT"] : []),
  ];
  const entries = await prisma.masterRecordEntry.findMany({
    where: {
      masterRecordId: context.masterRecordId,
      type: { in: types },
      status: "FINALIZED",
      deletedAt: null,
    },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      type: true,
      occurredAt: true,
      bioimpedance: { select: { measuredAt: true, measurements: true } },
      perimetry: { select: { measuredAt: true, measurements: true } },
      physicalAssessment: { select: { assessedAt: true, observations: true } },
      posturalAssessment: { select: { assessedAt: true, observations: true } },
    },
  });
  const comparisons = includePostural
    ? await prisma.posturalEvolutionComparison.findMany({
        where: {
          currentEntry: { masterRecordId: context.masterRecordId },
          previousEntry: { masterRecordId: context.masterRecordId },
        },
        orderBy: { comparedAt: "desc" },
        select: {
          editedSummary: true,
          generatedSummary: true,
          previousEntry: { select: { occurredAt: true } },
          currentEntry: { select: { occurredAt: true } },
        },
      })
    : [];

  return {
    items: entries.flatMap((entry) => {
      const record =
        entry.bioimpedance ??
        entry.perimetry ??
        entry.physicalAssessment ??
        entry.posturalAssessment;
      if (!record) return [];
      const performedAt =
        "measuredAt" in record ? record.measuredAt : record.assessedAt;
      const results =
        "measurements" in record ? record.measurements : record.observations;
      return [{
        id: entry.id,
        kind: entry.type as StudentAssessmentsView["items"][number]["kind"],
        performedAt: performedAt.toISOString(),
        results,
      }];
    }),
    posturalEvolution: comparisons.map((comparison) => ({
      previousDate: comparison.previousEntry.occurredAt.toISOString(),
      currentDate: comparison.currentEntry.occurredAt.toISOString(),
      summary:
        comparison.editedSummary?.trim() ||
        comparison.generatedSummary?.trim() ||
        undefined,
    })),
  };
}

async function studentPayments(
  context: StudentPortalContext,
): Promise<readonly StudentPaymentView[]> {
  const charges = await prisma.professionalServiceCharge.findMany({
    where: { masterRecordId: context.masterRecordId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      amountDue: true,
      financialEntry: { select: { dueDate: true } },
      items: { orderBy: { serviceDate: "asc" }, select: { description: true } },
      payments: {
        orderBy: { recordedAt: "desc" },
        select: {
          receipts: {
            where: { status: "ISSUED" },
            orderBy: { issuedAt: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  return charges.map((charge) => ({
    id: charge.id,
    services: charge.items.map((item) => item.description),
    amount: charge.amountDue.toFixed(2),
    dueDate: charge.financialEntry?.dueDate.toISOString(),
    status: charge.status,
    receiptId: charge.payments.flatMap((payment) => payment.receipts)[0]?.id,
  }));
}

export const studentPortalService = {
  async getPatientAccess(patientId: string) {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        status: "ACTIVE",
        deletedAt: null,
        masterRecord: { is: { status: "ACTIVE", archivedAt: null } },
      },
      select: {
        id: true,
        fullName: true,
        masterRecord: {
          select: {
            id: true,
            studentPortalLink: {
              select: { status: true, createdAt: true, user: { select: { id: true } } },
            },
            studentPortalInvitations: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { expiresAt: true, consumedAt: true, revokedAt: true, createdAt: true },
            },
          },
        },
      },
    });
    if (!patient?.masterRecord) throw new StudentPortalAccessError("NOT_FOUND");
    return {
      patient: { id: patient.id, name: patient.fullName },
      linked: patient.masterRecord.studentPortalLink?.status === "ACTIVE",
      latestInvitation: patient.masterRecord.studentPortalInvitations[0],
      releases: await releaseMap(patient.masterRecord.id),
    };
  },

  async createInvitation(input: {
    readonly patientId: string;
    readonly invitedByUserId: string;
    readonly now?: Date;
  }) {
    const now = input.now ?? new Date();
    const patient = await prisma.patient.findFirst({
      where: {
        id: input.patientId,
        status: "ACTIVE",
        deletedAt: null,
        masterRecord: { is: { status: "ACTIVE", archivedAt: null } },
      },
      select: {
        id: true,
        masterRecord: { select: { id: true, studentPortalLink: { select: { id: true } } } },
      },
    });
    if (!patient?.masterRecord) throw new StudentPortalAccessError("NOT_FOUND");
    if (patient.masterRecord.studentPortalLink) {
      throw new Error("STUDENT_PORTAL_ALREADY_LINKED");
    }

    const token = createStudentInvitationToken();
    const expiresAt = new Date(now.getTime() + INVITATION_DURATION_MS);
    await prisma.$transaction([
      prisma.studentPortalInvitation.updateMany({
        where: {
          patientId: patient.id,
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      }),
      prisma.studentPortalInvitation.create({
        data: {
          patientId: patient.id,
          masterRecordId: patient.masterRecord.id,
          tokenHash: studentInvitationTokenHash(token),
          expiresAt,
          invitedByUserId: input.invitedByUserId,
        },
      }),
    ]);

    return { token, expiresAt };
  },

  async activateInvitation(input: {
    readonly token: string;
    readonly login: string;
    readonly password: string;
    readonly now?: Date;
  }) {
    const now = input.now ?? new Date();
    const login = normalizeStudentLogin(input.login);
    const credentialHash = await createStudentCredentialHash(input.password);
    const tokenHash = studentInvitationTokenHash(input.token);

    return prisma.$transaction(async (transaction) => {
      const invitation = await transaction.studentPortalInvitation.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          patientId: true,
          masterRecordId: true,
          expiresAt: true,
          consumedAt: true,
          revokedAt: true,
          patient: { select: { fullName: true, status: true, deletedAt: true } },
          masterRecord: { select: { status: true, archivedAt: true } },
        },
      });
      if (
        !invitation ||
        invitation.consumedAt ||
        invitation.revokedAt ||
        invitation.expiresAt.getTime() <= now.getTime() ||
        invitation.patient.status !== "ACTIVE" ||
        invitation.patient.deletedAt ||
        invitation.masterRecord.status !== "ACTIVE" ||
        invitation.masterRecord.archivedAt
      ) {
        throw new Error("STUDENT_INVITATION_INVALID");
      }

      const claimed = await transaction.studentPortalInvitation.updateMany({
        where: {
          id: invitation.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) throw new Error("STUDENT_INVITATION_INVALID");

      const user = await transaction.user.create({
        data: {
          fullName: invitation.patient.fullName,
          status: "ACTIVE",
          profile: { create: { type: "STUDENT" } },
          identities: {
            create: {
              provider: "CREDENTIALS",
              providerSubject: login,
              credentialHash,
            },
          },
          studentPortalLink: {
            create: {
              patientId: invitation.patientId,
              masterRecordId: invitation.masterRecordId,
            },
          },
        },
        select: { id: true },
      });
      await transaction.studentPortalInvitation.update({
        where: { id: invitation.id },
        data: { consumedByUserId: user.id },
      });
      return { userId: user.id };
    }, { isolationLevel: "Serializable" });
  },

  async setRelease(input: {
    readonly patientId: string;
    readonly contentType: StudentPortalContentType;
    readonly released: boolean;
    readonly actorUserId: string;
    readonly now?: Date;
  }) {
    if (!RELEASE_TYPES.includes(input.contentType)) {
      throw new Error("STUDENT_PORTAL_RELEASE_INVALID");
    }
    const now = input.now ?? new Date();
    const patient = await prisma.patient.findFirst({
      where: {
        id: input.patientId,
        status: "ACTIVE",
        deletedAt: null,
        masterRecord: { is: { status: "ACTIVE", archivedAt: null } },
      },
      select: { id: true, masterRecord: { select: { id: true } } },
    });
    if (!patient?.masterRecord) throw new StudentPortalAccessError("NOT_FOUND");

    await prisma.studentPortalRelease.upsert({
      where: {
        masterRecordId_contentType: {
          masterRecordId: patient.masterRecord.id,
          contentType: input.contentType as PrismaStudentPortalContentType,
        },
      },
      create: {
        patientId: patient.id,
        masterRecordId: patient.masterRecord.id,
        contentType: input.contentType as PrismaStudentPortalContentType,
        releasedByUserId: input.actorUserId,
        releasedAt: now,
        revokedAt: input.released ? null : now,
        revokedByUserId: input.released ? null : input.actorUserId,
      },
      update: input.released
        ? {
            releasedByUserId: input.actorUserId,
            releasedAt: now,
            revokedAt: null,
            revokedByUserId: null,
          }
        : { revokedAt: now, revokedByUserId: input.actorUserId },
    });
  },

  async getDashboard(): Promise<StudentPortalDashboard> {
    const context = await requireStudentPortalContext();
    const releases = await releaseMap(context.masterRecordId);
    const [diet, workout, assessments, payments] = await Promise.all([
      releases.DIET ? studentDiet(context) : undefined,
      releases.WORKOUT ? studentWorkout(context) : undefined,
      releases.ASSESSMENTS
        ? studentAssessments(context, releases.POSTURAL_MEDIA)
        : undefined,
      releases.PAYMENTS ? studentPayments(context) : undefined,
    ]);
    return {
      student: { name: context.patientName, code: context.patientCode },
      diet,
      workout,
      assessments,
      payments,
      releases,
    };
  },

  async getReceipt(receiptId: string) {
    const context = await requireStudentPortalContext();
    const releases = await releaseMap(context.masterRecordId);
    if (!releases.PAYMENTS) throw new StudentPortalAccessError("NOT_FOUND");

    const receipt = await prisma.professionalServiceReceipt.findFirst({
      where: {
        id: receiptId,
        status: "ISSUED",
        payment: { charge: { masterRecordId: context.masterRecordId } },
      },
      select: {
        id: true,
        sequence: true,
        receivedAmount: true,
        remainingBalance: true,
        partialPayment: true,
        issuedAt: true,
        legalProvider: {
          select: {
            businessUnit: { select: { name: true } },
            user: { select: { fullName: true } },
            employee: { select: { fullName: true } },
          },
        },
        payment: {
          select: {
            recordedAt: true,
            charge: {
              select: {
                items: {
                  orderBy: { serviceDate: "asc" },
                  select: { description: true, serviceDate: true, grossAmount: true },
                },
              },
            },
          },
        },
      },
    });
    if (!receipt) throw new StudentPortalAccessError("NOT_FOUND");
    return {
      id: receipt.id,
      number: receipt.sequence,
      provider:
        receipt.legalProvider.businessUnit?.name ??
        receipt.legalProvider.user?.fullName ??
        receipt.legalProvider.employee?.fullName ??
        "Clínica SV",
      studentName: context.patientName,
      studentCode: context.patientCode,
      receivedAmount: receipt.receivedAmount.toFixed(2),
      remainingBalance: receipt.remainingBalance.toFixed(2),
      partialPayment: receipt.partialPayment,
      issuedAt: receipt.issuedAt?.toISOString(),
      paidAt: receipt.payment.recordedAt.toISOString(),
      services: receipt.payment.charge.items.map((item) => ({
        description: item.description,
        serviceDate: item.serviceDate.toISOString(),
        grossAmount: item.grossAmount.toFixed(2),
      })),
    };
  },
};
