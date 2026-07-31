import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/database/prisma";

import type {
  AnamnesisObjective,
  ClinicalAnamnesisData,
  ClinicalAnamnesisView,
} from "./contracts";
import { emptyAnamnesisData, objectiveOptions } from "./mock-data";

const ENTRY_TYPE = "CLINICAL_ANAMNESIS";

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

function isStoredData(value: unknown): value is ClinicalAnamnesisData {
  return Boolean(value && typeof value === "object" && "chiefComplaint" in value);
}

function jsonPayload(data: ClinicalAnamnesisData) {
  return JSON.parse(JSON.stringify(data));
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
        entries: {
          where: {
            type: ENTRY_TYPE,
            deletedAt: null,
            status: { in: ["DRAFT", "FINALIZED"] },
          },
          orderBy: [{ revision: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            revision: true,
            payload: true,
            occurredAt: true,
            updatedAt: true,
            author: { select: { id: true, fullName: true } },
          },
        },
        attendances: {
          where: { status: { in: ["DRAFT", "IN_PROGRESS"] }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
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

    const latestEntry = masterRecord.entries[0];
    const previousEntries = masterRecord.entries.slice(1);
    const storedData = isStoredData(latestEntry?.payload)
      ? latestEntry.payload
      : null;
    const objectives = attendance.clinicalReasoningSession?.objectives ?? [];
    const primary = objectives.find((item) => item.type === "PRIMARY");
    const primaryValue = primary ? objectiveValue(primary.title) : undefined;
    const secondaryValues = objectives
      .filter((item) => item.type === "SECONDARY")
      .map((item) => objectiveValue(item.title))
      .filter((item): item is AnamnesisObjective => item !== undefined);

    const data: ClinicalAnamnesisData = storedData ?? {
      ...blankData(),
      primaryObjective: primaryValue ?? "",
      secondaryObjectives: secondaryValues,
    };
    const auditUser = latestEntry?.author ?? attendance.professional;
    const updatedAt = latestEntry?.updatedAt ?? attendance.updatedAt ?? attendance.startedAt;
    const version = latestEntry?.revision ?? attendance.clinicalReasoningSession?.version ?? 1;

    return {
      patientId,
      masterRecordId: masterRecord.id,
      attendanceId: attendance.id,
      patientName: masterRecord.patient.fullName,
      patientCode: masterRecord.patient.clinicalCode,
      scenario,
      status: latestEntry ? "COMPLETED" : data.primaryObjective ? "COMPLETED" : "DRAFT",
      version,
      data,
      audit: {
        professionalUserId: auditUser.id,
        professionalName: auditUser.fullName,
        updatedAt: updatedAt.toISOString(),
        version,
      },
      history: previousEntries
        .filter((entry) => isStoredData(entry.payload))
        .map((entry) => ({
          id: entry.id,
          version: entry.revision,
          changedAt: entry.updatedAt.toISOString(),
          changedBy: entry.author.fullName,
          summary: `Versão ${entry.revision} da anamnese clínica.`,
          data: entry.payload as unknown as ClinicalAnamnesisData,
        })),
      timeline: masterRecord.entries.map((entry) => ({
        id: `timeline-${entry.id}`,
        occurredAt: entry.occurredAt.toISOString(),
        actorName: entry.author.fullName,
        title: entry.revision === 1 ? "Anamnese criada" : "Anamnese atualizada",
        detail: `Versão ${entry.revision} registrada no Prontuário Mestre.`,
      })),
      canRead: true,
      canEdit: true,
      canViewNutrition: true,
    };
  },

  async save(input: {
    patientId: string;
    data: ClinicalAnamnesisData;
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
            entries: {
              where: { type: ENTRY_TYPE, deletedAt: null },
              orderBy: [{ revision: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: { id: true, aggregateId: true, revision: true },
            },
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

      const previousEntry = masterRecord.entries[0];
      if (previousEntry) {
        await transaction.masterRecordEntry.update({
          where: { id: previousEntry.id },
          data: {
            status: "SUPERSEDED",
            updatedByUserId: professional.id,
          },
        });
      }

      await transaction.masterRecordEntry.create({
        data: {
          masterRecordId: masterRecord.id,
          moduleId: module.id,
          authorUserId: professional.id,
          updatedByUserId: professional.id,
          attendanceId: attendance.id,
          aggregateId: previousEntry?.aggregateId ?? randomUUID(),
          previousEntryId: previousEntry?.id,
          type: ENTRY_TYPE,
          status: "FINALIZED",
          occurredAt: new Date(),
          revision: (previousEntry?.revision ?? 0) + 1,
          payload: jsonPayload(input.data),
        },
      });

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
          input.data.secondaryObjectives.filter(
            (objective) => objective !== input.data.primaryObjective,
          ),
        ),
      ];
      const desired = input.data.primaryObjective
        ? [
            {
              type: "PRIMARY" as const,
              sequence: 0,
              value: input.data.primaryObjective,
              deduplicationKey: "anamnesis:objective:primary",
            },
            ...uniqueSecondary.map((value, index) => ({
              type: "SECONDARY" as const,
              sequence: index + 1,
              value,
              deduplicationKey: `anamnesis:objective:secondary:${index + 1}`,
            })),
          ]
        : [];

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

      await transaction.masterRecordContinuity.update({
        where: { masterRecordId: masterRecord.id },
        data: {
          lastActivityAt: new Date(),
          nextSuggestedStepKey: "ANTHROPOMETRY",
          suggestionSource: "WORKFLOW",
          responsibleUserId: professional.id,
          updatedByUserId: professional.id,
        },
      });
    });
  },
};
