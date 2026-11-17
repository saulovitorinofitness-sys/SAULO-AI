import { randomUUID } from "node:crypto";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

export const RETURN_FOOD_SAFETY_ENTRY_TYPE =
  "NUTRITION_RETURN_FOOD_SAFETY" as const;

export interface ReturnFoodSafetyAllergen {
  readonly id: string;
  readonly name: string;
  readonly reaction: string;
}

export interface ReturnFoodSafetyUpdate {
  readonly id: string;
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly status: "DENIED" | "CONFIRMED";
  readonly allergens: readonly ReturnFoodSafetyAllergen[];
  readonly confirmedAt: string;
  readonly responsibleUserId: string;
  readonly responsibleName: string;
  readonly revision: number;
}

export interface EffectiveFoodAllergyState {
  readonly status: "NOT_INFORMED" | "DENIED" | "CONFIRMED";
  readonly allergies: readonly string[];
}

export function resolveEffectiveFoodAllergyState(input: {
  readonly attendanceId: string;
  readonly baselineStatus: EffectiveFoodAllergyState["status"];
  readonly baselineAllergies: readonly string[];
  readonly update: ReturnFoodSafetyUpdate | null;
}): EffectiveFoodAllergyState {
  if (!input.update || input.update.attendanceId !== input.attendanceId) {
    return {
      status: input.baselineStatus,
      allergies: input.baselineAllergies,
    };
  }

  return {
    status: input.update.status,
    allergies:
      input.update.status === "CONFIRMED"
        ? input.update.allergens.map((allergen) => allergen.name)
        : [],
  };
}

const allergenSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(180),
    reaction: z.string().trim().max(1_000),
  })
  .strict();

const allergensSchema = z.array(allergenSchema).max(50);

const inputSchema = z
  .object({
    status: z.enum(["DENIED", "CONFIRMED"]),
    allergens: allergensSchema,
    professionalConfirmation: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "DENIED" && value.allergens.length) {
      context.addIssue({
        code: "custom",
        path: ["allergens"],
        message: "A ausência confirmada não pode conter alérgenos.",
      });
    }
    if (value.status === "CONFIRMED" && !value.allergens.length) {
      context.addIssue({
        code: "custom",
        path: ["allergens"],
        message: "Informe ao menos um alérgeno.",
      });
    }
  });

export type ReturnFoodSafetyInput = z.infer<typeof inputSchema>;

export function parseReturnFoodSafetyInput(value: unknown) {
  const parsed = inputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function json(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function payload(value: unknown) {
  const result = z
    .object({
      schemaVersion: z.literal(1),
      status: z.enum(["DENIED", "CONFIRMED"]),
      allergens: allergensSchema,
      confirmedAt: z.string().datetime(),
    })
    .safeParse(value);
  return result.success ? result.data : null;
}

const select = {
  id: true,
  masterRecordId: true,
  attendanceId: true,
  revision: true,
  payload: true,
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.MasterRecordEntrySelect;

function view(
  patientId: string,
  entry: {
    id: string;
    masterRecordId: string;
    attendanceId: string | null;
    revision: number;
    payload: Prisma.JsonValue | null;
    updatedBy: { id: string; fullName: string };
  },
): ReturnFoodSafetyUpdate | null {
  const data = payload(entry.payload);
  if (!data || !entry.attendanceId) return null;
  return {
    id: entry.id,
    patientId,
    masterRecordId: entry.masterRecordId,
    attendanceId: entry.attendanceId,
    status: data.status,
    allergens: data.allergens,
    confirmedAt: data.confirmedAt,
    responsibleUserId: entry.updatedBy.id,
    responsibleName: entry.updatedBy.fullName,
    revision: entry.revision,
  };
}

export const returnFoodSafetyRepository = {
  async get(patientId: string, attendanceId: string) {
    const entry = await prisma.masterRecordEntry.findFirst({
      where: {
        type: RETURN_FOOD_SAFETY_ENTRY_TYPE,
        attendanceId,
        deletedAt: null,
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      select,
      orderBy: { updatedAt: "desc" },
    });
    return entry ? view(patientId, entry) : null;
  },

  async save(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly professionalUserId: string;
    readonly data: ReturnFoodSafetyInput;
  }) {
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
            OR: [
              { clinicalType: "RETURN" },
              { clinicalType: null, consultationType: "FOLLOW_UP" },
            ],
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
          select: { id: true, fullName: true },
        }),
        transaction.systemModule.findUnique({
          where: { key: "MASTER_RECORD" },
          select: { id: true },
        }),
      ]);
      if (!attendance || !professional || !module) {
        throw new Error("RETURN_FOOD_SAFETY_CONTEXT_NOT_FOUND");
      }

      const existing = await transaction.masterRecordEntry.findFirst({
        where: {
          type: RETURN_FOOD_SAFETY_ENTRY_TYPE,
          attendanceId: attendance.id,
          masterRecordId: attendance.masterRecordId,
          deletedAt: null,
        },
        select: { id: true, revision: true, payload: true },
      });
      const now = new Date();
      const nextPayload = {
        schemaVersion: 1 as const,
        status: input.data.status,
        allergens: input.data.allergens,
        confirmedAt: now.toISOString(),
      };
      const revision = (existing?.revision ?? 0) + 1;
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
              type: RETURN_FOOD_SAFETY_ENTRY_TYPE,
              status: "FINALIZED",
              occurredAt: now,
              revision,
              payload: json(nextPayload),
            },
            select: { id: true },
          });

      await transaction.recordVersion.create({
        data: {
          entityType: RETURN_FOOD_SAFETY_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: module.id,
          responsibleUserId: professional.id,
          version: revision,
          status: "FINALIZED",
          snapshot: json(nextPayload),
          reason: "Atualização consciente de segurança alimentar no retorno.",
        },
      });
      await transaction.auditEvent.create({
        data: {
          entityType: RETURN_FOOD_SAFETY_ENTRY_TYPE,
          entityId: entry.id,
          moduleId: module.id,
          action: existing ? "UPDATE" : "CREATE",
          createdByUserId: professional.id,
          changedByUserId: professional.id,
          occurredAt: now,
          reason: "Confirmação profissional de alergias alimentares no atendimento de retorno.",
          changes: {
            create: {
              fieldPath: "foodSafety",
              previousValue: existing?.payload ?? Prisma.JsonNull,
              newValue: json(nextPayload),
            },
          },
        },
      });
    });

    const saved = await this.get(input.patientId, input.attendanceId);
    if (!saved) throw new Error("RETURN_FOOD_SAFETY_NOT_SAVED");
    return saved;
  },
};
