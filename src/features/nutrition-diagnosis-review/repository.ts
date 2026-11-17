import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { z } from "zod";

export const NUTRITION_DIAGNOSIS_REVIEW_ENTRY_TYPE =
  "NUTRITION_DIAGNOSIS_REVIEW";

const diagnosisSchema = z
  .string()
  .trim()
  .min(1)
  .max(500);

export type NutritionDiagnosisReviewOutcome =
  | "NO_DIAGNOSIS_ESTABLISHED"
  | "DIAGNOSES_CONFIRMED";

const payloadSchema = z
  .union([
    z.object({
      schemaVersion: z.literal(1),
      outcome: z.literal("NO_DIAGNOSIS_ESTABLISHED"),
      diagnoses: z.array(diagnosisSchema).length(0),
      reviewedAt: z.string().datetime(),
    }),
    z.object({
      schemaVersion: z.literal(1),
      outcome: z.literal("DIAGNOSES_CONFIRMED"),
      diagnoses: z.array(diagnosisSchema).min(1).max(50),
      reviewedAt: z.string().datetime(),
    }),
    z.object({
      schemaVersion: z.literal(1),
      diagnoses: z.array(diagnosisSchema).min(1).max(50),
      reviewedAt: z.string().datetime(),
    }),
  ])
  .transform((payload) => ({
    ...payload,
    outcome:
      "outcome" in payload
        ? payload.outcome
        : ("DIAGNOSES_CONFIRMED" as const),
  }));

export interface NutritionDiagnosisReview {
  readonly id: string;
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly outcome: NutritionDiagnosisReviewOutcome;
  readonly diagnoses: readonly string[];
  readonly reviewedAt: string;
  readonly responsibleUserId: string;
  readonly responsibleName: string;
  readonly revision: number;
}

function normalizeDiagnoses(values: readonly string[]) {
  const unique = new Map<string, string>();
  for (const value of values) {
    const diagnosis = diagnosisSchema.parse(value);
    const key = diagnosis.toLocaleLowerCase("pt-BR");
    if (!unique.has(key)) unique.set(key, diagnosis);
  }
  return [...unique.values()];
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const select = {
  id: true,
  masterRecordId: true,
  attendanceId: true,
  revision: true,
  payload: true,
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.MasterRecordEntrySelect;

function toView(
  patientId: string,
  entry: {
    id: string;
    masterRecordId: string;
    attendanceId: string | null;
    revision: number;
    payload: Prisma.JsonValue | null;
    updatedBy: { id: string; fullName: string };
  },
): NutritionDiagnosisReview | null {
  const payload = payloadSchema.safeParse(entry.payload);
  if (!payload.success || !entry.attendanceId) return null;
  return {
    id: entry.id,
    patientId,
    masterRecordId: entry.masterRecordId,
    attendanceId: entry.attendanceId,
    outcome: payload.data.outcome,
    diagnoses: payload.data.diagnoses,
    reviewedAt: payload.data.reviewedAt,
    responsibleUserId: entry.updatedBy.id,
    responsibleName: entry.updatedBy.fullName,
    revision: entry.revision,
  };
}

export const nutritionDiagnosisReviewRepository = {
  async get(patientId: string, attendanceId: string) {
    const entry = await prisma.masterRecordEntry.findFirst({
      where: {
        type: NUTRITION_DIAGNOSIS_REVIEW_ENTRY_TYPE,
        attendanceId,
        status: "FINALIZED",
        deletedAt: null,
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      orderBy: [{ revision: "desc" }, { updatedAt: "desc" }],
      select,
    });
    return entry ? toView(patientId, entry) : null;
  },

  async save(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly professionalUserId: string;
    readonly outcome: NutritionDiagnosisReviewOutcome;
    readonly diagnoses: readonly string[];
  }) {
    const diagnoses =
      input.outcome === "DIAGNOSES_CONFIRMED"
        ? normalizeDiagnoses(input.diagnoses)
        : [];
    if (input.outcome === "DIAGNOSES_CONFIRMED" && !diagnoses.length) {
      throw new Error("NUTRITION_DIAGNOSIS_REVIEW_EMPTY");
    }
    if (
      input.outcome === "NO_DIAGNOSIS_ESTABLISHED" &&
      input.diagnoses.some((diagnosis) => diagnosis.trim())
    ) {
      throw new Error("NUTRITION_DIAGNOSIS_REVIEW_CONFLICT");
    }

    const existingView = await this.get(input.patientId, input.attendanceId);
    if (
      existingView &&
      existingView.outcome === input.outcome &&
      JSON.stringify(existingView.diagnoses) === JSON.stringify(diagnoses)
    ) {
      return existingView;
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))
      `;

      const [attendance, professional, module] = await Promise.all([
        transaction.attendance.findFirst({
          where: {
            id: input.attendanceId,
            status: "IN_PROGRESS",
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
        transaction.systemModule.findUnique({
          where: { key: "MASTER_RECORD" },
          select: { id: true },
        }),
      ]);
      if (!attendance || !professional || !module) {
        throw new Error("NUTRITION_DIAGNOSIS_REVIEW_CONTEXT_NOT_FOUND");
      }

      const existing = await transaction.masterRecordEntry.findFirst({
        where: {
          type: NUTRITION_DIAGNOSIS_REVIEW_ENTRY_TYPE,
          attendanceId: attendance.id,
          masterRecordId: attendance.masterRecordId,
          deletedAt: null,
        },
        orderBy: [{ revision: "desc" }, { updatedAt: "desc" }],
        select: { id: true, revision: true, payload: true },
      });
      const existingPayload = payloadSchema.safeParse(existing?.payload);
      if (
        existingPayload.success &&
        existingPayload.data.outcome === input.outcome &&
        JSON.stringify(existingPayload.data.diagnoses) ===
          JSON.stringify(diagnoses)
      ) {
        return;
      }
      const now = new Date();
      const revision = (existing?.revision ?? 0) + 1;
      const nextPayload = {
        schemaVersion: 1 as const,
        outcome: input.outcome,
        diagnoses,
        reviewedAt: now.toISOString(),
      };
      const entry = existing
        ? await transaction.masterRecordEntry.update({
            where: { id: existing.id },
            data: {
              revision,
              payload: json(nextPayload),
              occurredAt: now,
              updatedByUserId: professional.id,
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
              type: NUTRITION_DIAGNOSIS_REVIEW_ENTRY_TYPE,
              status: "FINALIZED",
              occurredAt: now,
              revision,
              payload: json(nextPayload),
            },
            select: { id: true },
          });

      await transaction.recordVersion.create({
        data: {
          entityType: NUTRITION_DIAGNOSIS_REVIEW_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: module.id,
          responsibleUserId: professional.id,
          version: revision,
          status: "FINALIZED",
          snapshot: json(nextPayload),
          reason: "Revisão profissional do diagnóstico nutricional do atendimento.",
        },
      });
      await transaction.auditEvent.create({
        data: {
          entityType: NUTRITION_DIAGNOSIS_REVIEW_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: module.id,
          action: existing ? "UPDATE" : "CREATE",
          createdByUserId: professional.id,
          changedByUserId: professional.id,
          occurredAt: now,
          reason: "Revisão explícita do diagnóstico usado no relatório nutricional.",
          changes: {
            create: {
              fieldPath: "diagnosisReview",
              previousValue: existing?.payload ?? Prisma.JsonNull,
              newValue: json(nextPayload),
            },
          },
        },
      });
    });

    const saved = await this.get(input.patientId, input.attendanceId);
    if (!saved) throw new Error("NUTRITION_DIAGNOSIS_REVIEW_NOT_SAVED");
    return saved;
  },
};
