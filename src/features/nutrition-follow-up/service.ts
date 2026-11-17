import { prisma } from "@/lib/database/prisma";
import {
  perimetryGroups,
  type PerimetryData,
} from "@/features/clinical-collection";

type JsonObject = Record<string, unknown>;

export type FollowUpRecordStatus = "DRAFT" | "FINALIZED";
export type FollowUpMetricKey =
  | "weightKg"
  | "waistCm"
  | "abdomenCm"
  | "hipCm";
export type PerimetryMetricKey = Exclude<keyof PerimetryData, "notes">;

export interface NutritionFollowUpEvaluation {
  readonly id: string;
  readonly date: string;
  readonly occurredAt: string;
  readonly status: FollowUpRecordStatus;
  readonly dataLabel?: string;
  readonly attendanceId?: string;
  readonly entryIds: readonly string[];
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly bmi?: number;
  readonly waistCm?: number;
  readonly abdomenCm?: number;
  readonly hipCm?: number;
  readonly perimetryMeasurements: Readonly<
    Partial<Record<PerimetryMetricKey, number>>
  >;
  readonly perimetryStatus?: FollowUpRecordStatus;
  readonly measurementMethods: Readonly<
    Partial<Record<FollowUpMetricKey, string>>
  >;
  readonly bodyComposition?: {
    readonly method: "Bioimpedância";
    readonly equipment: string;
    readonly bodyFatPercent?: number;
    readonly fatMassKg?: number;
    readonly fatFreeMassKg?: number;
    readonly skeletalMuscleMassKg?: number;
    readonly totalBodyWaterL?: number;
    readonly visceralFatLevel?: number;
  };
  readonly sources: readonly {
    readonly modality: "Antropometria" | "Perimetria" | "Bioimpedância";
    readonly entryId: string;
    readonly href?: string;
    readonly notes?: string;
  }[];
}

export interface NutritionFollowUpView {
  readonly patient: {
    readonly id: string;
    readonly name: string;
    readonly clinicalCode: string;
    readonly masterRecordId: string;
    readonly sex: "FEMALE" | "MALE" | "INTERSEX" | "NOT_INFORMED";
    readonly birthDate: string;
  };
  readonly evaluations: readonly NutritionFollowUpEvaluation[];
  readonly performance: {
    readonly prescriptions: readonly {
      readonly id: string;
      readonly title: string;
      readonly status: FollowUpRecordStatus;
      readonly occurredAt: string;
      readonly validFrom?: string;
      readonly validUntil?: string;
    }[];
    readonly scheduledSessions: readonly {
      readonly id: string;
      readonly workoutPlanEntryId: string;
      readonly workoutPlanVersionId: string;
      readonly sessionId?: string;
      readonly title: string;
      readonly modality: string;
      readonly scheduledStartAt: string;
      readonly plannedDurationSeconds?: number;
      readonly status: string;
    }[];
    readonly executions: readonly {
      readonly id: string;
      readonly scheduledSessionId?: string;
      readonly workoutPlanEntryId?: string;
      readonly workoutPlanVersionId?: string;
      readonly sessionId?: string;
      readonly modality: string;
      readonly source: string;
      readonly actualStartAt: string;
      readonly actualEndAt?: string;
      readonly executedDurationSeconds?: number;
      readonly executedRpe?: number;
      readonly status: string;
    }[];
  };
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function positiveNumberValue(value: unknown) {
  const parsed = numberValue(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function sourceHref(
  patientId: string,
  attendanceId: string | null,
  step: "ANTHROPOMETRY" | "PERIMETRY" | "BIOIMPEDANCE",
) {
  return attendanceId
    ? `/pacientes/${patientId}/atendimentos/${attendanceId}/coleta?step=${step}`
    : undefined;
}

export const nutritionFollowUpService = {
  async get(patientId: string): Promise<NutritionFollowUpView | null> {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        clinicalCode: true,
        sex: true,
        birthDate: true,
        masterRecord: {
          select: {
            id: true,
            entries: {
              where: {
                deletedAt: null,
                status: { not: "VOIDED" },
                OR: [
                  { physicalAssessment: { isNot: null } },
                  { perimetry: { isNot: null } },
                  { bioimpedance: { isNot: null } },
                ],
              },
              orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                status: true,
                attendanceId: true,
                occurredAt: true,
                payload: true,
                physicalAssessment: {
                  select: {
                    assessedAt: true,
                    observations: true,
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
                bioimpedance: {
                  select: {
                    measuredAt: true,
                    measurements: true,
                    notes: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!patient?.masterRecord) return null;

    type MutableEvaluation = {
      id: string;
      date: string;
      occurredAt: string;
      status: FollowUpRecordStatus;
      dataLabel?: string;
      attendanceId?: string;
      entryIds: Set<string>;
      weightKg?: number;
      heightCm?: number;
      bmi?: number;
      waistCm?: number;
      abdomenCm?: number;
      hipCm?: number;
      perimetryMeasurements: Partial<Record<PerimetryMetricKey, number>>;
      perimetryStatus?: FollowUpRecordStatus;
      measurementMethods: Partial<Record<FollowUpMetricKey, string>>;
      bodyComposition?: NutritionFollowUpEvaluation["bodyComposition"];
      sources: NutritionFollowUpEvaluation["sources"][number][];
    };

    const byEntry = new Map<string, MutableEvaluation>();
    const evaluationFor = (
      date: Date,
      entry: (typeof patient.masterRecord.entries)[number],
    ) => {
      const current = byEntry.get(entry.id);
      if (current) {
        if (entry.status !== "FINALIZED") current.status = "DRAFT";
        return current;
      }
      const created: MutableEvaluation = {
        id: entry.id,
        date: dateKey(date),
        occurredAt: entry.occurredAt.toISOString(),
        status: entry.status === "FINALIZED" ? "FINALIZED" : "DRAFT",
        dataLabel:
          typeof objectValue(entry.payload).testDataLabel === "string"
            ? (objectValue(entry.payload).testDataLabel as string)
            : undefined,
        attendanceId: entry.attendanceId ?? undefined,
        entryIds: new Set([entry.id]),
        measurementMethods: {},
        perimetryMeasurements: {},
        sources: [],
      };
      byEntry.set(entry.id, created);
      return created;
    };

    for (const entry of patient.masterRecord.entries) {
      if (entry.physicalAssessment) {
        const target = evaluationFor(entry.physicalAssessment.assessedAt, entry);
        const values = objectValue(entry.physicalAssessment.observations);
        target.weightKg = numberValue(values.weightKg);
        if (target.weightKg !== undefined) {
          target.measurementMethods.weightKg =
            "Antropometria · método e equipamento não informados";
        }
        target.heightCm = numberValue(values.heightCm);
        target.bmi = numberValue(values.bmi);
        target.sources.push({
          modality: "Antropometria",
          entryId: entry.id,
          href: sourceHref(patient.id, entry.attendanceId, "ANTHROPOMETRY"),
          notes: entry.physicalAssessment.notes ?? undefined,
        });
      }

      if (entry.perimetry) {
        const target = evaluationFor(entry.perimetry.measuredAt, entry);
        const values = objectValue(entry.perimetry.measurements);
        target.perimetryStatus =
          target.perimetryStatus === "DRAFT" || entry.status !== "FINALIZED"
            ? "DRAFT"
            : "FINALIZED";
        for (const field of perimetryGroups.flatMap((group) => group.fields)) {
          const key = field.key as PerimetryMetricKey;
          const value = positiveNumberValue(values[key]);
          if (value !== undefined) target.perimetryMeasurements[key] = value;
        }
        target.waistCm = target.perimetryMeasurements.waistCm;
        target.abdomenCm = target.perimetryMeasurements.abdomenCm;
        target.hipCm = target.perimetryMeasurements.hipCm;
        if (target.waistCm !== undefined) target.measurementMethods.waistCm = "Perimetria";
        if (target.abdomenCm !== undefined) target.measurementMethods.abdomenCm = "Perimetria";
        if (target.hipCm !== undefined) target.measurementMethods.hipCm = "Perimetria";
        target.sources.push({
          modality: "Perimetria",
          entryId: entry.id,
          href: sourceHref(patient.id, entry.attendanceId, "PERIMETRY"),
          notes: entry.perimetry.notes ?? undefined,
        });
      }

      if (entry.bioimpedance) {
        const target = evaluationFor(entry.bioimpedance.measuredAt, entry);
        const values = objectValue(entry.bioimpedance.measurements);
        if (target.weightKg === undefined) {
          target.weightKg = numberValue(values.weightKg);
          if (target.weightKg !== undefined) {
            target.measurementMethods.weightKg = "Bioimpedância";
          }
        }
        target.bmi ??= numberValue(values.bmi);
        const bodyComposition = {
          method: "Bioimpedância",
          equipment: "Equipamento e protocolo não informados no registro",
          bodyFatPercent: numberValue(values.bodyFatPercent),
          fatMassKg: numberValue(values.fatMassKg),
          fatFreeMassKg: numberValue(values.fatFreeMassKg),
          skeletalMuscleMassKg: numberValue(values.skeletalMuscleMassKg),
          totalBodyWaterL: numberValue(values.totalBodyWaterL),
          visceralFatLevel: numberValue(values.visceralFatLevel),
        } as const;
        if (
          Object.entries(bodyComposition).some(
            ([key, value]) =>
              key !== "method" && key !== "equipment" && value !== undefined,
          )
        ) {
          target.bodyComposition = bodyComposition;
        }
        target.sources.push({
          modality: "Bioimpedância",
          entryId: entry.id,
          href: sourceHref(patient.id, entry.attendanceId, "BIOIMPEDANCE"),
          notes: entry.bioimpedance.notes ?? undefined,
        });
      }
    }

    const evaluations = [...byEntry.values()]
      .sort((left, right) =>
        left.date.localeCompare(right.date) ||
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.id.localeCompare(right.id),
      )
      .map((evaluation): NutritionFollowUpEvaluation => ({
        ...evaluation,
        entryIds: [...evaluation.entryIds],
      }));

    const [prescriptions, scheduledSessions, executions] = await Promise.all([
      prisma.masterRecordEntry.findMany({
        where: {
          masterRecordId: patient.masterRecord.id,
          deletedAt: null,
          status: { not: "VOIDED" },
          workoutPlan: { isNot: null },
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          occurredAt: true,
          status: true,
          workoutPlan: {
            select: {
              title: true,
              validFrom: true,
              validUntil: true,
            },
          },
        },
      }),
      prisma.workoutScheduledSession.findMany({
        where: { masterRecordId: patient.masterRecord.id },
        orderBy: [{ scheduledStartAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          workoutPlanEntryId: true,
          workoutPlanVersionId: true,
          sessionId: true,
          title: true,
          modality: true,
          scheduledStartAt: true,
          plannedDurationSeconds: true,
          status: true,
        },
      }),
      prisma.workoutExecution.findMany({
        where: { masterRecordId: patient.masterRecord.id },
        orderBy: [{ actualStartAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          scheduledSessionId: true,
          workoutPlanEntryId: true,
          workoutPlanVersionId: true,
          sessionId: true,
          modality: true,
          source: true,
          actualStartAt: true,
          actualEndAt: true,
          executedDurationSeconds: true,
          executedRpe: true,
          status: true,
        },
      }),
    ]);

    return {
      patient: {
        id: patient.id,
        name: patient.fullName,
        clinicalCode: patient.clinicalCode,
        masterRecordId: patient.masterRecord.id,
        sex: patient.sex,
        birthDate: dateKey(patient.birthDate),
      },
      evaluations,
      performance: {
        prescriptions: prescriptions.flatMap((entry) =>
          entry.workoutPlan
            ? [{
                id: entry.id,
                title: entry.workoutPlan.title,
                status: entry.status === "FINALIZED" ? "FINALIZED" as const : "DRAFT" as const,
                occurredAt: entry.occurredAt.toISOString(),
                validFrom: entry.workoutPlan.validFrom?.toISOString().slice(0, 10),
                validUntil: entry.workoutPlan.validUntil?.toISOString().slice(0, 10),
              }]
            : [],
        ),
        scheduledSessions: scheduledSessions.map((session) => ({
          ...session,
          sessionId: session.sessionId ?? undefined,
          plannedDurationSeconds: session.plannedDurationSeconds ?? undefined,
          scheduledStartAt: session.scheduledStartAt.toISOString(),
        })),
        executions: executions.map((execution) => ({
          ...execution,
          scheduledSessionId: execution.scheduledSessionId ?? undefined,
          workoutPlanEntryId: execution.workoutPlanEntryId ?? undefined,
          workoutPlanVersionId: execution.workoutPlanVersionId ?? undefined,
          sessionId: execution.sessionId ?? undefined,
          actualStartAt: execution.actualStartAt.toISOString(),
          actualEndAt: execution.actualEndAt?.toISOString(),
          executedDurationSeconds: execution.executedDurationSeconds ?? undefined,
          executedRpe: execution.executedRpe === null
            ? undefined
            : Number(execution.executedRpe),
        })),
      },
    };
  },
};
