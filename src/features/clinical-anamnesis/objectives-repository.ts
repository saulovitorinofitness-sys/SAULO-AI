import { prisma } from "@/lib/database/prisma";

import type {
  AnamnesisObjective,
  ClinicalAnamnesisData,
  ClinicalAnamnesisView,
} from "./contracts";
import { emptyAnamnesisData, objectiveOptions } from "./mock-data";

const objectiveByTitle = new Map<string, AnamnesisObjective>(
  objectiveOptions.flatMap(([value, title]) => [
    [title, value] as const,
    [value, value] as const,
  ]),
);
const titleByObjective = new Map(objectiveOptions);

function objectiveValue(title: string): AnamnesisObjective | undefined {
  return objectiveByTitle.get(title) as AnamnesisObjective | undefined;
}

function blankData(): ClinicalAnamnesisData {
  return {
    ...structuredClone(emptyAnamnesisData),
    chiefComplaint: "",
    primaryObjective: "",
    secondaryObjectives: [],
  };
}

export const clinicalAnamnesisObjectivesRepository = {
  async getView(
    patientId: string,
    scenario: ClinicalAnamnesisView["scenario"],
  ): Promise<ClinicalAnamnesisView | null> {
    const masterRecord = await prisma.masterRecord.findFirst({
      where: {
        patientId,
        status: "ACTIVE",
        patient: { deletedAt: null },
      },
      select: {
        id: true,
        patient: {
          select: {
            fullName: true,
            clinicalCode: true,
          },
        },
        attendances: {
          where: { status: { in: ["DRAFT", "IN_PROGRESS"] }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            professional: { select: { id: true, fullName: true } },
            startedAt: true,
            updatedAt: true,
            clinicalReasoningSession: {
              select: {
                version: true,
                objectives: {
                  where: { status: { not: "CANCELLED" } },
                  orderBy: [{ type: "asc" }, { sequence: "asc" }],
                  select: {
                    type: true,
                    title: true,
                    updatedAt: true,
                    updatedBy: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const attendance = masterRecord?.attendances[0];
    if (!masterRecord || !attendance) return null;

    const objectives =
      attendance.clinicalReasoningSession?.objectives ?? [];
    const primary = objectives.find((item) => item.type === "PRIMARY");
    const primaryValue = primary
      ? objectiveValue(primary.title)
      : undefined;
    const secondaryValues = objectives
      .filter((item) => item.type === "SECONDARY")
      .map((item) => objectiveValue(item.title))
      .filter((item): item is AnamnesisObjective => item !== undefined);
    const latest = [...objectives].sort(
      (left, right) =>
        right.updatedAt.getTime() - left.updatedAt.getTime(),
    )[0];
    const auditUser = latest?.updatedBy ?? attendance.professional;
    const updatedAt =
      latest?.updatedAt ?? attendance.updatedAt ?? attendance.startedAt;
    const data = blankData();

    return {
      patientId,
      masterRecordId: masterRecord.id,
      patientName: masterRecord.patient.fullName,
      patientCode: masterRecord.patient.clinicalCode,
      scenario,
      status: primaryValue ? "COMPLETED" : "DRAFT",
      version: attendance.clinicalReasoningSession?.version ?? 1,
      data: {
        ...data,
        primaryObjective: primaryValue ?? "",
        secondaryObjectives: secondaryValues,
      },
      audit: {
        professionalUserId: auditUser.id,
        professionalName: auditUser.fullName,
        updatedAt: updatedAt.toISOString(),
        version: attendance.clinicalReasoningSession?.version ?? 1,
      },
      history: [],
      timeline: [],
      canRead: true,
      canEdit: true,
      canViewNutrition: true,
    };
  },

  async save(input: {
    patientId: string;
    primaryObjective: AnamnesisObjective;
    secondaryObjectives: readonly AnamnesisObjective[];
    professionalUserId: string;
  }) {
    await prisma.$transaction(async (transaction) => {
      const [masterRecord, module, professional] = await Promise.all([
        transaction.masterRecord.findFirst({
          where: {
            patientId: input.patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
          select: {
            id: true,
            attendances: {
              where: {
                status: { in: ["DRAFT", "IN_PROGRESS"] },
                deletedAt: null,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true },
            },
          },
        }),
        transaction.systemModule.findUnique({
          where: { key: "MASTER_RECORD" },
          select: { id: true },
        }),
        transaction.user.findUnique({
          where: { id: input.professionalUserId },
          select: { id: true },
        }),
      ]);
      const attendance = masterRecord?.attendances[0];
      if (!masterRecord || !attendance || !module || !professional) {
        throw new Error("OBJECTIVE_CONTEXT_NOT_FOUND");
      }

      const session = await transaction.clinicalReasoningSession.upsert({
        where: { attendanceId: attendance.id },
        update: {
          status: "ACTIVE",
          responsibleProfessionalUserId: professional.id,
          updatedByUserId: professional.id,
          version: { increment: 1 },
        },
        create: {
          attendanceId: attendance.id,
          moduleId: module.id,
          responsibleProfessionalUserId: professional.id,
          updatedByUserId: professional.id,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      const uniqueSecondary = [
        ...new Set(
          input.secondaryObjectives.filter(
            (objective) => objective !== input.primaryObjective,
          ),
        ),
      ];
      const desired = [
        {
          type: "PRIMARY" as const,
          sequence: 0,
          value: input.primaryObjective,
          deduplicationKey: "anamnesis:objective:primary",
        },
        ...uniqueSecondary.map((value, index) => ({
          type: "SECONDARY" as const,
          sequence: index + 1,
          value,
          deduplicationKey: `anamnesis:objective:secondary:${index + 1}`,
        })),
      ];

      await transaction.clinicalObjective.updateMany({
        where: { sessionId: session.id, status: { not: "CANCELLED" } },
        data: {
          status: "CANCELLED",
          updatedByUserId: professional.id,
          version: { increment: 1 },
        },
      });
      for (const objective of desired) {
        await transaction.clinicalObjective.upsert({
          where: {
            sessionId_type_sequence: {
              sessionId: session.id,
              type: objective.type,
              sequence: objective.sequence,
            },
          },
          update: {
            title: titleByObjective.get(objective.value)!,
            status: "ACTIVE",
            professionalUserId: professional.id,
            updatedByUserId: professional.id,
            deduplicationKey: objective.deduplicationKey,
            version: { increment: 1 },
          },
          create: {
            sessionId: session.id,
            moduleId: module.id,
            professionalUserId: professional.id,
            updatedByUserId: professional.id,
            type: objective.type,
            title: titleByObjective.get(objective.value)!,
            sequence: objective.sequence,
            status: "ACTIVE",
            deduplicationKey: objective.deduplicationKey,
          },
        });
      }
    });
  },
};
