import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { prisma } from "@/lib/database/prisma";

import type {
  ExerciseLibraryItemView,
  InheritedTrainingFact,
  PerformanceWorkoutView,
  WorkoutPlanDraft,
  WorkoutPlanStatus,
} from "./workout-contracts";
import {
  buildWorkoutMethodGlossary,
  emptyWorkoutPlanDraft,
  parseStoredWorkoutPlanPayload,
} from "./workout-record";

const WORKOUT_PLAN_ENTRY_TYPE = "WORKOUT_PLAN";
const NOT_INFORMED = "Não informado";

function toJson(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function value(value: string | number | undefined, unit = "") {
  if (value === undefined || value === "") return NOT_INFORMED;
  return `${value}${unit}`;
}

function inheritedFacts(input: {
  objective?: string;
  collection: NonNullable<
    Awaited<ReturnType<typeof clinicalCollectionRepository.getCollection>>
  >;
}): readonly InheritedTrainingFact[] {
  const { collection } = input;
  const anthropometry = collection.records.anthropometry;
  const bioimpedance = collection.records.bioimpedance;
  const perimetry = collection.records.perimetry;
  const postural = collection.records.posturalAssessment;
  const posturalData = postural.data;
  const posturalSummary =
    posturalData.technicalSummary?.editedSummary?.trim() ||
    posturalData.evaluatorConclusion?.trim() ||
    posturalData.identifiedChangesNotes?.trim();

  return [
    {
      key: "primary-objective",
      label: "Objetivo principal",
      value: input.objective || NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "strength-experience",
      label: "Experiência com musculação",
      value: NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "weekly-availability",
      label: "Rotina e disponibilidade semanal",
      value: NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "possible-weekly-frequency",
      label: "Frequência semanal possível",
      value: NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "session-duration",
      label: "Duração disponível por sessão",
      value: NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "pain",
      label: "Dores",
      value: NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "injuries-surgeries",
      label: "Lesões e cirurgias relevantes",
      value: NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "contraindications",
      label: "Contraindicações e restrições de movimento",
      value: NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "sport-modality",
      label: "Modalidade esportiva praticada",
      value: NOT_INFORMED,
      source: "Anamnese",
    },
    {
      key: "weight-height",
      label: "Peso e altura",
      value:
        anthropometry.data.weightKg || anthropometry.data.heightCm
          ? [
              value(anthropometry.data.weightKg, " kg"),
              value(anthropometry.data.heightCm, " cm"),
            ].join(" · ")
          : NOT_INFORMED,
      source: "Antropometria",
      sourceEntryId: anthropometry.origin?.entryId,
    },
    {
      key: "body-composition",
      label: "Composição corporal",
      value:
        bioimpedance.data.bodyFatPercent !== undefined
          ? `${value(bioimpedance.data.bodyFatPercent, "% de gordura")}${
              bioimpedance.data.skeletalMuscleMassKg !== undefined
                ? ` · ${value(
                    bioimpedance.data.skeletalMuscleMassKg,
                    " kg de massa muscular",
                  )}`
                : ""
            }`
          : NOT_INFORMED,
      source: "Bioimpedância",
      sourceEntryId: bioimpedance.origin?.entryId,
    },
    {
      key: "perimetry",
      label: "Perimetria para evolução e assimetrias",
      value:
        Object.values(perimetry.data).some(
          (measurement) => typeof measurement === "number",
        )
          ? "Medidas registradas na avaliação atual"
          : NOT_INFORMED,
      source: "Perimetria",
      sourceEntryId: perimetry.origin?.entryId,
    },
    {
      key: "postural-changes",
      label: "Alterações posturais relevantes",
      value: posturalSummary || NOT_INFORMED,
      source: "Avaliação Postural",
      sourceEntryId: postural.origin?.entryId,
    },
    {
      key: "functional-limitations",
      label: "Limitações funcionais",
      value: posturalData.functionalLimitationsNotes?.trim() || NOT_INFORMED,
      source: "Avaliação Postural",
      sourceEntryId: postural.origin?.entryId,
    },
    {
      key: "mobility-stability",
      label: "Déficits de mobilidade e estabilidade",
      value: NOT_INFORMED,
      source: "Avaliação Postural",
      sourceEntryId: postural.origin?.entryId,
    },
    {
      key: "strengthening-stretching",
      label: "Necessidades de fortalecimento e alongamento",
      value:
        posturalData.futureCorrectiveExercisesNote?.trim() || NOT_INFORMED,
      source: "Avaliação Postural",
      sourceEntryId: postural.origin?.entryId,
    },
  ];
}

function normalizeExerciseName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

async function exerciseLibrary(): Promise<
  readonly ExerciseLibraryItemView[]
> {
  return prisma.exerciseLibraryItem.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      muscleGroup: true,
      equipment: true,
      description: true,
    },
  }).then((items) =>
    items.map((item) => ({
      id: item.id,
      name: item.name,
      muscleGroup: item.muscleGroup ?? undefined,
      equipment: item.equipment ?? undefined,
      description: item.description ?? undefined,
    })),
  );
}

export const performanceWorkoutRepository = {
  async get(
    patientId: string,
    attendanceId: string,
  ): Promise<PerformanceWorkoutView | null> {
    const [collection, context, library] = await Promise.all([
      clinicalCollectionRepository.getCollection(patientId, attendanceId),
      prisma.attendance.findFirst({
        where: {
          id: attendanceId,
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
          professional: { select: { fullName: true } },
          clinicalReasoningSession: {
            select: {
              objectives: {
                where: { type: "PRIMARY", status: { not: "CANCELLED" } },
                orderBy: { sequence: "asc" },
                take: 1,
                select: { title: true },
              },
            },
          },
          masterRecord: {
            select: {
              patient: {
                select: { id: true, fullName: true, clinicalCode: true },
              },
              entries: {
                where: {
                  type: WORKOUT_PLAN_ENTRY_TYPE,
                  attendanceId,
                  deletedAt: null,
                },
                orderBy: { createdAt: "asc" },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  revision: true,
                  updatedAt: true,
                  updatedBy: { select: { fullName: true } },
                  workoutPlan: { select: { content: true } },
                },
              },
            },
          },
        },
      }),
      exerciseLibrary(),
    ]);
    if (!collection || !context) return null;
    const entry = context.masterRecord.entries[0];
    const stored = entry?.workoutPlan
      ? parseStoredWorkoutPlanPayload(entry.workoutPlan.content)
      : null;
    const objective =
      context.clinicalReasoningSession?.objectives[0]?.title;
    return {
      patient: {
        id: context.masterRecord.patient.id,
        name: context.masterRecord.patient.fullName,
        code: context.masterRecord.patient.clinicalCode,
      },
      masterRecordId: context.masterRecordId,
      attendanceId: context.id,
      entryId: entry?.id,
      status: stored?.status ?? "DRAFT",
      draft: stored ?? emptyWorkoutPlanDraft(),
      inheritedFacts: inheritedFacts({ objective, collection }),
      exerciseLibrary: library,
      responsibleProfessional:
        entry?.updatedBy.fullName ?? context.professional.fullName,
      updatedAt: entry?.updatedAt.toISOString(),
      version: entry?.revision ?? 0,
    };
  },

  async save(input: {
    patientId: string;
    attendanceId: string;
    professionalUserId: string;
    draft: WorkoutPlanDraft;
    status: WorkoutPlanStatus;
  }) {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))
      `;
      const [attendance, module, professional] = await Promise.all([
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
        transaction.systemModule.findUnique({
          where: { key: "WORKOUT_PLAN" },
          select: { id: true },
        }),
        transaction.user.findUnique({
          where: { id: input.professionalUserId },
          select: { id: true },
        }),
      ]);
      if (!attendance || !module || !professional) {
        throw new Error("WORKOUT_PLAN_CONTEXT_NOT_FOUND");
      }
      const existing = await transaction.masterRecordEntry.findFirst({
        where: {
          type: WORKOUT_PLAN_ENTRY_TYPE,
          attendanceId: attendance.id,
          masterRecordId: attendance.masterRecordId,
          deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true, revision: true },
      });
      if (existing?.status === "FINALIZED") {
        throw new Error("WORKOUT_PLAN_FINALIZED");
      }
      const now = new Date();
      const revision = existing ? existing.revision + 1 : 1;
      const payload = {
        ...input.draft,
        schemaVersion: 1 as const,
        status: input.status,
        methodGlossary: buildWorkoutMethodGlossary(input.draft),
      };
      const entryStatus =
        input.status === "FINALIZED" ? "FINALIZED" : "DRAFT";
      const entry = existing
        ? await transaction.masterRecordEntry.update({
            where: { id: existing.id },
            data: {
              status: entryStatus,
              revision,
              occurredAt: now,
              updatedByUserId: professional.id,
              payload: toJson({
                schemaVersion: 1,
                status: input.status,
              }),
              workoutPlan: {
                update: {
                  title:
                    input.draft.strategy.programName || "Plano de Treino",
                  validFrom: input.draft.strategy.startDate
                    ? new Date(`${input.draft.strategy.startDate}T00:00:00.000Z`)
                    : null,
                  content: toJson(payload),
                  notes: input.draft.strategy.observations || null,
                },
              },
            },
            select: { id: true },
          })
        : await transaction.masterRecordEntry.create({
            data: {
              masterRecordId: attendance.masterRecordId,
              moduleId: module.id,
              authorUserId: professional.id,
              updatedByUserId: professional.id,
              attendanceId: attendance.id,
              aggregateId: randomUUID(),
              type: WORKOUT_PLAN_ENTRY_TYPE,
              status: entryStatus,
              occurredAt: now,
              revision,
              payload: toJson({
                schemaVersion: 1,
                status: input.status,
              }),
              workoutPlan: {
                create: {
                  title:
                    input.draft.strategy.programName || "Plano de Treino",
                  validFrom: input.draft.strategy.startDate
                    ? new Date(`${input.draft.strategy.startDate}T00:00:00.000Z`)
                    : undefined,
                  content: toJson(payload),
                  notes: input.draft.strategy.observations || undefined,
                },
              },
            },
            select: { id: true },
          });
      await transaction.recordVersion.create({
        data: {
          entityType: WORKOUT_PLAN_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: module.id,
          responsibleUserId: professional.id,
          version: revision,
          status: entryStatus,
          snapshot: toJson(payload),
          reason:
            input.status === "FINALIZED"
              ? "Plano de Treino finalizado pelo profissional."
              : "Rascunho do Plano de Treino salvo.",
        },
      });
      await transaction.auditEvent.create({
        data: {
          entityType: WORKOUT_PLAN_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: module.id,
          action: existing
            ? input.status === "FINALIZED"
              ? "STATUS_CHANGE"
              : "UPDATE"
            : "CREATE",
          createdByUserId: professional.id,
          changedByUserId: professional.id,
          occurredAt: now,
          reason:
            input.status === "FINALIZED"
              ? "Finalização explícita do Plano de Treino."
              : "Salvamento profissional do Plano de Treino.",
          changes: {
            create: {
              fieldPath: "status",
              previousValue: existing?.status ?? "NONE",
              newValue: input.status,
            },
          },
        },
      });
    });
    return this.get(input.patientId, input.attendanceId);
  },

  async createExercise(input: {
    name: string;
    professionalUserId: string;
  }): Promise<ExerciseLibraryItemView> {
    const name = input.name.trim();
    if (!name) throw new Error("EXERCISE_NAME_REQUIRED");
    const normalizedName = normalizeExerciseName(name);
    const [module, professional] = await Promise.all([
      prisma.systemModule.findUnique({
        where: { key: "WORKOUT_PLAN" },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: input.professionalUserId },
        select: { id: true },
      }),
    ]);
    if (!module || !professional) {
      throw new Error("EXERCISE_LIBRARY_CONTEXT_NOT_FOUND");
    }
    const item = await prisma.exerciseLibraryItem.upsert({
      where: { normalizedName },
      update: { active: true, updatedByUserId: professional.id },
      create: {
        moduleId: module.id,
        createdByUserId: professional.id,
        updatedByUserId: professional.id,
        name,
        normalizedName,
      },
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        description: true,
      },
    });
    return {
      id: item.id,
      name: item.name,
      muscleGroup: item.muscleGroup ?? undefined,
      equipment: item.equipment ?? undefined,
      description: item.description ?? undefined,
    };
  },
};
