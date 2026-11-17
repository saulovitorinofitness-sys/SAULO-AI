import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { validateClinicalAnamnesisData } from "@/features/clinical-anamnesis/validation";

import {
  bioimpedanceGroups,
  perimetryGroups,
} from "./field-definitions";
import {
  calculateBmi,
  validateAnthropometryMeasurements,
} from "./anthropometry-calculations";
import { validateBioimpedanceMeasurements } from "./bioimpedance-measurements";
import { validatePerimetryMeasurements } from "./perimetry-measurements";
import { buildPosturalEvolutionTimeline, type PosturalHistorySource } from "./postural-history";
import { assertValidPosturalAssessmentData, validatePosturalAssessmentData } from "./postural-validation";
import { safeClinicalText } from "./clinical-text-safety";
import { shouldCreateClinicalStepVersion } from "./contracts";
import { persistedProfessionalReference } from "@/features/professional-responsibility/persisted-responsibility";
import type {
  PosturalEvolutionClassification,
  SavePosturalEvolutionComparisonInput,
} from "./postural-evolution";
import type {
  AnthropometryData,
  BioimpedanceAvanutriData,
  ClinicalCollectionRecords,
  ClinicalCollectionView,
  ClinicalStepRecord,
  CreateHistoricalClinicalAssessmentInput,
  CreateHistoricalClinicalAssessmentResult,
  EditableClinicalData,
  EditableClinicalStepKey,
  PerimetryData,
  PosturalAssessmentData,
  ProfessionalAudit,
  SaveClinicalStepInput,
} from "./contracts";

const ASSESSMENT_ENTRY_TYPE = "ASSESSMENT";
export class ClinicalCollectionWriteError extends Error {
  readonly code = "ATTENDANCE_NOT_WRITABLE" as const;

  constructor() {
    super("Atendimento não está ativo para edição.");
    this.name = "ClinicalCollectionWriteError";
  }
}

const assessmentModuleByStep = {
  ANTHROPOMETRY: "PHYSICAL_ASSESSMENT",
  BIOIMPEDANCE: "BIOIMPEDANCE",
  PERIMETRY: "PERIMETRY",
  POSTURAL_ASSESSMENT: "POSTURAL_ASSESSMENT",
} as const;
const bioimpedanceFieldKeys = bioimpedanceGroups.flatMap((group) =>
  group.fields.map((field) => field.key),
);
const perimetryFieldKeys = perimetryGroups.flatMap((group) =>
  group.fields.map((field) => field.key),
);

const emptyPosturalAssessment: PosturalAssessmentData = {
  views: {
    ANTERIOR: { state: "NOT_ASSESSED" },
    POSTERIOR: { state: "NOT_ASSESSED" },
    RIGHT_LATERAL: { state: "NOT_ASSESSED" },
    LEFT_LATERAL: { state: "NOT_ASSESSED" },
  },
  identifiedChanges: "NOT_ASSESSED",
  functionalLimitations: "NOT_ASSESSED",
};

function jsonObject<T extends object>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  return value as T;
}

function toJson(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function historicalAssessmentDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("INVALID_HISTORICAL_ASSESSMENT_DATE");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("INVALID_HISTORICAL_ASSESSMENT_DATE");
  }

  return date;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function readBioimpedanceData(value: unknown): BioimpedanceAvanutriData {
  const source = jsonObject<Record<string, unknown>>(value, {});
  const data: Partial<Record<keyof BioimpedanceAvanutriData, number>> = {};

  for (const key of bioimpedanceFieldKeys) {
    const number = finiteNumber(source[key]);
    if (number !== undefined) data[key] = number;
  }

  return data;
}

function findRecentAnthropometryValue(
  records: readonly { observations: unknown }[],
  key: keyof AnthropometryData,
) {
  for (const record of records) {
    const observations = jsonObject<Record<string, unknown>>(
      record.observations,
      {},
    );
    const value = positiveNumber(observations[key]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function bioimpedanceJson(
  data: BioimpedanceAvanutriData,
  bmi: number | undefined,
): Prisma.InputJsonValue {
  return Object.fromEntries(
    bioimpedanceFieldKeys
      .filter((key) => key !== "weightKg")
      .map((key) => {
        const value = key === "bmi" ? bmi : finiteNumber(data[key]);
        return [key, value ?? null];
      }),
  ) as Prisma.InputJsonValue;
}

function readPerimetryData(value: unknown): PerimetryData {
  const source = jsonObject<Record<string, unknown>>(value, {});
  const data: Record<string, number> = {};

  for (const key of perimetryFieldKeys) {
    const number = positiveNumber(source[key]);
    if (number !== undefined) data[key] = number;
  }

  return data as PerimetryData;
}

function perimetryJson(data: PerimetryData): Prisma.InputJsonValue {
  return Object.fromEntries(
    perimetryFieldKeys.map((key) => [
      key,
      positiveNumber(data[key]) ?? null,
    ]),
  ) as Prisma.InputJsonValue;
}

function calculateAge(birthDate: Date) {
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - birthDate.getUTCMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}

function phoneLabel(phone?: {
  countryCode: string;
  areaCode: string;
  number: string;
}) {
  if (!phone) return "";

  const prefix = phone.countryCode === "55" ? "" : `+${phone.countryCode} `;
  const localNumber =
    phone.number.length === 9
      ? `${phone.number.slice(0, 5)}-${phone.number.slice(5)}`
      : phone.number.length === 8
        ? `${phone.number.slice(0, 4)}-${phone.number.slice(4)}`
        : phone.number;

  return `${prefix}(${phone.areaCode}) ${localNumber}`;
}

function isMissing(value: unknown) {
  return value === undefined || value === null || value === "";
}

function missingFields(
  step: EditableClinicalStepKey,
  data: EditableClinicalData,
): readonly string[] {
  if (step === "ANTHROPOMETRY") {
    const values = data as AnthropometryData;
    return [
      values.weightKg === undefined ? "Peso" : null,
      values.heightCm === undefined ? "Estatura" : null,
    ].filter((item): item is string => Boolean(item));
  }

  if (step === "BIOIMPEDANCE") {
    return bioimpedanceGroups.flatMap((group) =>
      group.fields
        .filter(
          (field) =>
            field.required &&
            isMissing(data[field.key as keyof typeof data]),
        )
        .map((field) => field.label),
    );
  }

  if (step === "PERIMETRY") {
    return perimetryGroups.flatMap((group) =>
      group.fields
        .filter(
          (field) =>
            field.required &&
            isMissing(data[field.key as keyof typeof data]),
        )
        .map((field) => field.label),
    );
  }

  // A documentação postural é integralmente opcional. A existência do
  // registro salvo, e não campos específicos, conclui esta etapa.
  return [];
}

function record<T extends EditableClinicalData>(
  step: EditableClinicalStepKey,
  data: T,
  audit?: ProfessionalAudit,
  entryId?: string,
  masterRecordId?: string,
): ClinicalStepRecord<T> {
  const missingRequiredFields = missingFields(step, data);
  const posturalStatus =
    step === "POSTURAL_ASSESSMENT"
      ? (data as PosturalAssessmentData).completionStatus
      : undefined;

  return {
    data,
    missingRequiredFields,
    status:
      !entryId
        ? "NOT_STARTED"
        : step === "POSTURAL_ASSESSMENT"
          ? (posturalStatus ?? "COMPLETED")
        : missingRequiredFields.length === 0
          ? "COMPLETED"
          : "IN_PROGRESS",
    audit,
    origin: entryId
      ? {
          masterRecordId: masterRecordId!,
          entryId,
          moduleKey:
            step === "ANTHROPOMETRY"
              ? "PHYSICAL_ASSESSMENT"
              : step,
          label: "Prontuário Mestre",
        }
      : undefined,
  };
}

async function loadCollection(
  patientId: string,
  attendanceId?: string,
): Promise<ClinicalCollectionView | null> {
  const attendance = await prisma.attendance.findFirst({
    where: {
      ...(attendanceId ? { id: attendanceId } : {}),
      deletedAt: null,
      masterRecord: {
        patientId,
        status: "ACTIVE",
        patient: { deletedAt: null },
      },
    },
    include: {
      professional: { select: { id: true, fullName: true } },
      masterRecord: {
        include: {
          patient: {
            include: {
              phones: {
                where: { status: "ACTIVE" },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!attendance) return null;

  const entry = await prisma.masterRecordEntry.findFirst({
    where: {
      attendanceId: attendance.id,
      masterRecordId: attendance.masterRecordId,
      type: ASSESSMENT_ENTRY_TYPE,
      deletedAt: null,
    },
    include: {
      updatedBy: { select: { id: true, fullName: true } },
      bioimpedance: true,
      perimetry: true,
      physicalAssessment: true,
      posturalAssessment: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const [anamnesisEntry, recentPhysicalAssessments, previousPerimetryRecord] =
    await Promise.all([
      prisma.masterRecordEntry.findFirst({
        where: {
          masterRecordId: attendance.masterRecordId,
          type: "CLINICAL_ANAMNESIS",
          status: { in: ["DRAFT", "FINALIZED"] },
          deletedAt: null,
        },
        orderBy: [{ revision: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          masterRecordId: true,
          attendanceId: true,
          occurredAt: true,
          payload: true,
          revision: true,
          updatedAt: true,
          updatedBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.physicalAssessmentRecord.findMany({
      where: {
        assessedAt: { lt: attendance.createdAt },
        entry: {
          attendanceId: { not: attendance.id },
          masterRecordId: attendance.masterRecordId,
          deletedAt: null,
        },
      },
      orderBy: { assessedAt: "desc" },
      select: { observations: true },
      take: 50,
      }),
      prisma.perimetryRecord.findFirst({
        where: {
          measuredAt: {
            lt: entry?.perimetry?.measuredAt ?? attendance.createdAt,
          },
          entry: {
            attendanceId: { not: attendance.id },
            masterRecordId: attendance.masterRecordId,
            deletedAt: null,
          },
        },
        orderBy: { measuredAt: "desc" },
        include: {
          entry: {
            select: {
              id: true,
              revision: true,
              updatedAt: true,
              updatedBy: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
    ]);
  const anamnesisValidation = anamnesisEntry
    ? validateClinicalAnamnesisData(anamnesisEntry.payload)
    : undefined;
  const previousPerimetryVersion = previousPerimetryRecord
    ? await prisma.recordVersion.findFirst({
        where: {
          entityId: previousPerimetryRecord.entryId,
          entityType: `${ASSESSMENT_ENTRY_TYPE}_PERIMETRY`,
        },
        orderBy: { version: "desc" },
        include: {
          responsible: { select: { id: true, fullName: true } },
        },
      })
    : null;
  const stepVersions = entry
    ? await prisma.recordVersion.findMany({
        where: {
          entityId: entry.id,
          entityType: {
            in: (
              Object.keys(
                assessmentModuleByStep,
              ) as EditableClinicalStepKey[]
            ).map((step) => `${ASSESSMENT_ENTRY_TYPE}_${step}`),
          },
        },
        orderBy: { createdAt: "desc" },
        include: {
          responsible: { select: { id: true, fullName: true } },
        },
      })
    : [];

  const audit = entry
    ? {
        professionalUserId: entry.updatedBy.id,
        professionalName: entry.updatedBy.fullName,
        updatedAt: entry.updatedAt.toISOString(),
        version: entry.revision,
      }
    : undefined;
  const auditByStep = Object.fromEntries(
    (Object.keys(assessmentModuleByStep) as EditableClinicalStepKey[]).map(
      (step) => {
        const version = stepVersions.find(
          (candidate) =>
            candidate.entityType ===
            `${ASSESSMENT_ENTRY_TYPE}_${step}`,
        );
        return [
          step,
          version
            ? {
                professionalUserId: version.responsible.id,
                professionalName: version.responsible.fullName,
                updatedAt: version.createdAt.toISOString(),
                version: version.version,
              }
            : audit,
        ];
      },
    ),
  ) as Readonly<
    Record<EditableClinicalStepKey, ProfessionalAudit | undefined>
  >;

  const anthropometry = {
    ...jsonObject<AnthropometryData>(
      entry?.physicalAssessment?.observations,
      {},
    ),
    notes: safeClinicalText(entry?.physicalAssessment?.notes),
  };
  const inheritedWeightKg =
    positiveNumber(anthropometry.weightKg) ??
    findRecentAnthropometryValue(recentPhysicalAssessments, "weightKg");
  const inheritedHeightCm =
    positiveNumber(anthropometry.heightCm) ??
    findRecentAnthropometryValue(recentPhysicalAssessments, "heightCm");
  const bioimpedance = {
    ...readBioimpedanceData(entry?.bioimpedance?.measurements),
    weightKg: inheritedWeightKg,
    bmi: calculateBmi(
      inheritedWeightKg,
      inheritedHeightCm ? inheritedHeightCm / 100 : undefined,
    ),
  };
  const perimetry = {
    ...readPerimetryData(entry?.perimetry?.measurements),
    notes: safeClinicalText(entry?.perimetry?.notes),
  };
  const postural = {
    ...emptyPosturalAssessment,
    ...jsonObject<PosturalAssessmentData>(
      entry?.posturalAssessment?.observations,
      emptyPosturalAssessment,
    ),
    notes: safeClinicalText(entry?.posturalAssessment?.notes),
  };

  const records: ClinicalCollectionRecords = {
    anthropometry: record(
      "ANTHROPOMETRY",
      anthropometry,
      entry?.physicalAssessment ? auditByStep.ANTHROPOMETRY : undefined,
      entry?.physicalAssessment ? entry.id : undefined,
      attendance.masterRecordId,
    ),
    bioimpedance: record(
      "BIOIMPEDANCE",
      bioimpedance,
      entry?.bioimpedance ? auditByStep.BIOIMPEDANCE : undefined,
      entry?.bioimpedance ? entry.id : undefined,
      attendance.masterRecordId,
    ),
    perimetry: record(
      "PERIMETRY",
      perimetry,
      entry?.perimetry ? auditByStep.PERIMETRY : undefined,
      entry?.perimetry ? entry.id : undefined,
      attendance.masterRecordId,
    ),
    posturalAssessment: record(
      "POSTURAL_ASSESSMENT",
      postural,
      entry?.posturalAssessment
        ? auditByStep.POSTURAL_ASSESSMENT
        : undefined,
      entry?.posturalAssessment ? entry.id : undefined,
      attendance.masterRecordId,
    ),
  };

  const recordPairs = [
    ["ANTHROPOMETRY", records.anthropometry],
    ["PERIMETRY", records.perimetry],
    ["BIOIMPEDANCE", records.bioimpedance],
    ["POSTURAL_ASSESSMENT", records.posturalAssessment],
  ] as const;
  const completedCount = recordPairs.filter(
    ([, current]) => current.status === "COMPLETED",
  ).length;
  const nutritionFlowReady =
    records.anthropometry.status === "COMPLETED";
  const firstIncompleteStep =
    entry?.status === "FINALIZED"
      ? "SUMMARY"
      : recordPairs.find(([, current]) => current.status !== "COMPLETED")?.[0] ??
        "SUMMARY";
  const patient = attendance.masterRecord.patient;

  return {
    patientId: patient.id,
    patientName: patient.fullName,
    patientCode: patient.clinicalCode,
    patientAge: calculateAge(patient.birthDate),
    patientSex: patient.sex,
    patientProfession: patient.profession ?? undefined,
    patientPhone: phoneLabel(patient.phones[0]),
    attendanceId: attendance.id,
    attendanceStartedAt: attendance.startedAt?.toISOString(),
    masterRecordId: attendance.masterRecordId,
    consultationType: attendance.consultationType,
    connectedProfessional: {
      professionalUserId: attendance.professional.id,
      professionalName: attendance.professional.fullName,
      updatedAt: attendance.updatedAt.toISOString(),
      version: attendance.version,
    },
    records,
    anamnesis:
      anamnesisEntry?.attendanceId && anamnesisValidation?.success
        ? {
            entryId: anamnesisEntry.id,
            masterRecordId: anamnesisEntry.masterRecordId,
            attendanceId: anamnesisEntry.attendanceId,
            occurredAt: anamnesisEntry.occurredAt.toISOString(),
            data: anamnesisValidation.data,
            audit: {
              professionalUserId: anamnesisEntry.updatedBy.id,
              professionalName: anamnesisEntry.updatedBy.fullName,
              updatedAt: anamnesisEntry.updatedAt.toISOString(),
              version: anamnesisEntry.revision,
            },
          }
        : undefined,
    summaryLoadIssue:
      anamnesisEntry && anamnesisValidation && !anamnesisValidation.success
        ? "A Anamnese deste atendimento não pôde ser consolidada. Revise o registro antes de continuar."
        : undefined,
    anthropometryMeasuredAt:
      entry?.physicalAssessment?.assessedAt.toISOString(),
    bioimpedanceHeightCm: inheritedHeightCm,
    bioimpedanceMeasuredAt: entry?.bioimpedance?.measuredAt.toISOString(),
    perimetryMeasuredAt: entry?.perimetry?.measuredAt.toISOString(),
    posturalAssessedAt:
      entry?.posturalAssessment?.assessedAt.toISOString(),
    previousPerimetry: previousPerimetryRecord
      ? {
          measuredAt: previousPerimetryRecord.measuredAt.toISOString(),
          values: {
            ...readPerimetryData(previousPerimetryRecord.measurements),
            notes: previousPerimetryRecord.notes ?? undefined,
          },
          audit: previousPerimetryVersion
            ? {
                professionalUserId:
                  previousPerimetryVersion.responsible.id,
                professionalName:
                  previousPerimetryVersion.responsible.fullName,
                updatedAt: previousPerimetryVersion.createdAt.toISOString(),
                version: previousPerimetryVersion.version,
              }
            : {
                professionalUserId:
                  previousPerimetryRecord.entry.updatedBy.id,
                professionalName:
                  previousPerimetryRecord.entry.updatedBy.fullName,
                updatedAt:
                  previousPerimetryRecord.entry.updatedAt.toISOString(),
                version: previousPerimetryRecord.entry.revision,
              },
        }
      : undefined,
    progressPercent: completedCount * 25,
    nutritionFlowReady,
    firstIncompleteStep,
    lastSavedStep: undefined,
    canRead: true,
    canEdit: attendance.status === "IN_PROGRESS",
    completed: entry?.status === "FINALIZED",
    nextAttendanceStep:
      entry?.status === "FINALIZED" ? "Estratégia Nutricional" : undefined,
    scenario: "complete",
  };
}

export const clinicalCollectionRepository = {
  getCollection(patientId: string, attendanceId: string) {
    return loadCollection(patientId, attendanceId);
  },

  getLatestCollection(patientId: string) {
    return loadCollection(patientId);
  },

  async findOpenAttendanceId(patientId: string) {
    const attendance = await prisma.attendance.findFirst({
      where: {
        status: { in: ["DRAFT", "IN_PROGRESS"] },
        deletedAt: null,
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    return attendance?.id ?? null;
  },

  async findOpenAttendance(patientId: string) {
    return prisma.attendance.findFirst({
      where: {
        status: { in: ["DRAFT", "IN_PROGRESS"] },
        deletedAt: null,
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });
  },

  async findAttendanceIds(patientId: string) {
    const attendances = await prisma.attendance.findMany({
      where: {
        deletedAt: null,
        masterRecord: {
          patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    return attendances.map((attendance) => attendance.id);
  },

  async getOfficialPosturalAssessment(input: {
    patientId: string;
    masterRecordId: string;
    attendanceId: string;
    entryId: string;
    versionId?: string;
  }): Promise<PosturalHistorySource | null> {
    const entry = await prisma.masterRecordEntry.findFirst({
      where: {
        id: input.entryId,
        type: ASSESSMENT_ENTRY_TYPE,
        masterRecordId: input.masterRecordId,
        attendanceId: input.attendanceId,
        deletedAt: null,
        status: { not: "VOIDED" },
        masterRecord: {
          patientId: input.patientId,
          status: "ACTIVE",
          patient: { deletedAt: null, status: "ACTIVE" },
        },
        attendance: {
          is: {
            id: input.attendanceId,
            masterRecordId: input.masterRecordId,
            deletedAt: null,
          },
        },
        posturalAssessment: { isNot: null },
      },
      select: {
        id: true,
        masterRecordId: true,
        attendanceId: true,
        status: true,
        revision: true,
        updatedAt: true,
        updatedBy: { select: { id: true, fullName: true } },
        posturalAssessment: {
          select: { assessedAt: true, observations: true, notes: true, updatedAt: true },
        },
      },
    });
    if (!entry?.posturalAssessment || !entry.attendanceId) return null;

    const version = await prisma.recordVersion.findFirst({
      where: {
        id: input.versionId,
        entityType: `${ASSESSMENT_ENTRY_TYPE}_POSTURAL_ASSESSMENT`,
        entityId: entry.id,
        status: "COMPLETED",
      },
      orderBy: input.versionId ? undefined : { version: "desc" },
      select: {
        id: true,
        version: true,
        snapshot: true,
        createdAt: true,
        responsible: { select: { id: true, fullName: true } },
      },
    });
    if (input.versionId ? !version : Boolean(version)) return null;

    const source = version
      ? version.snapshot
      : {
          ...emptyPosturalAssessment,
          ...jsonObject<PosturalAssessmentData>(
            entry.posturalAssessment.observations,
            emptyPosturalAssessment,
          ),
          notes: entry.posturalAssessment.notes ?? undefined,
        };
    const validated = validatePosturalAssessmentData(source);
    if (!validated.valid || validated.data.completionStatus !== "COMPLETED") {
      return null;
    }
    return {
      assessmentId: entry.id,
      patientId: input.patientId,
      masterRecordId: entry.masterRecordId,
      attendanceId: entry.attendanceId,
      assessedAt: entry.posturalAssessment.assessedAt.toISOString(),
      status: "FINALIZED",
      data: validated.data,
      audit: version
        ? {
            professionalUserId: version.responsible.id,
            professionalName: version.responsible.fullName,
            updatedAt: version.createdAt.toISOString(),
            version: version.version,
          }
        : {
            professionalUserId: entry.updatedBy.id,
            professionalName: entry.updatedBy.fullName,
            updatedAt: entry.posturalAssessment.updatedAt.toISOString(),
            version: entry.revision,
          },
    };
  },

  async getPosturalHistory(patientId: string) {
    const records = await prisma.posturalAssessmentRecord.findMany({
      where: {
        entry: {
          deletedAt: null,
          masterRecord: {
            patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
        },
      },
      orderBy: { assessedAt: "asc" },
      select: {
        assessedAt: true,
        observations: true,
        notes: true,
        entry: {
          select: {
            id: true,
            masterRecordId: true,
            attendanceId: true,
            status: true,
            revision: true,
            updatedAt: true,
            updatedBy: {
              select: { id: true, fullName: true },
            },
            masterRecord: {
              select: { patientId: true },
            },
          },
        },
      },
    });
    const versions = records.length
      ? await prisma.recordVersion.findMany({
          where: {
            entityType: `${ASSESSMENT_ENTRY_TYPE}_POSTURAL_ASSESSMENT`,
            status: "COMPLETED",
            entityId: {
              in: records.map((record) => record.entry.id),
            },
          },
          orderBy: [{ entityId: "asc" }, { version: "desc" }],
          select: {
            id: true,
            entityId: true,
            version: true,
            createdAt: true,
            responsible: {
              select: { id: true, fullName: true },
            },
          },
        })
      : [];
    const latestVersionByEntry = new Map<
      string,
      (typeof versions)[number]
    >();
    for (const version of versions) {
      if (!latestVersionByEntry.has(version.entityId)) {
        latestVersionByEntry.set(version.entityId, version);
      }
    }

    return buildPosturalEvolutionTimeline(
      records.map((record) => {
        const version = latestVersionByEntry.get(record.entry.id);
        const responsible = persistedProfessionalReference(
          version?.responsible,
          record.entry.updatedBy,
        );
        return {
          assessmentId: record.entry.id,
          versionId: version?.id,
          masterRecordId: record.entry.masterRecordId,
          patientId: record.entry.masterRecord.patientId,
          attendanceId: record.entry.attendanceId ?? undefined,
          assessedAt: record.assessedAt.toISOString(),
          status: record.entry.status,
          data: {
            ...emptyPosturalAssessment,
            ...jsonObject<PosturalAssessmentData>(
              record.observations,
              emptyPosturalAssessment,
            ),
            notes: record.notes ?? undefined,
          },
          audit: version
            ? {
                professionalUserId: responsible.id,
                professionalName: responsible.fullName,
                updatedAt: version.createdAt.toISOString(),
                version: version.version,
              }
            : {
                // Compatibilidade com registros anteriores à auditoria por etapa.
                professionalUserId: responsible.id,
                professionalName: responsible.fullName,
                updatedAt: record.entry.updatedAt.toISOString(),
                version: record.entry.revision,
              },
        };
      }),
    );
  },

  async getPosturalEvolution(patientId: string) {
    const [history, comparisons] = await Promise.all([
      this.getPosturalHistory(patientId),
      prisma.posturalEvolutionComparison.findMany({
        where: {
          previousEntry: {
            masterRecord: { patientId, status: "ACTIVE" },
            deletedAt: null,
          },
          currentEntry: {
            masterRecord: { patientId, status: "ACTIVE" },
            deletedAt: null,
          },
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          previousEntryId: true,
          currentEntryId: true,
          classifications: true,
          visualSettings: true,
          generatedSummary: true,
          editedSummary: true,
          evaluatorConclusion: true,
          generatedAt: true,
          comparedAt: true,
          updatedAt: true,
          version: true,
          updatedBy: {
            select: {
              fullName: true,
              profile: {
                select: {
                  professionalTitle: true,
                  professionalRegistration: true,
                  professionalPhone: true,
                  professionalInstagram: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      history,
      comparisons: comparisons.map((comparison) => ({
        id: comparison.id,
        previousAssessmentId: comparison.previousEntryId,
        currentAssessmentId: comparison.currentEntryId,
        classifications: jsonObject<
          Record<string, PosturalEvolutionClassification>
        >(comparison.classifications, {}),
        visualSettings: jsonObject<{
          synchronized: boolean;
        }>(comparison.visualSettings, {
          synchronized: false,
        }),
        generatedSummary: comparison.generatedSummary ?? undefined,
        editedSummary: comparison.editedSummary ?? undefined,
        evaluatorConclusion:
          comparison.evaluatorConclusion ?? undefined,
        generatedAt: comparison.generatedAt?.toISOString(),
        comparedAt: comparison.comparedAt.toISOString(),
        updatedAt: comparison.updatedAt.toISOString(),
        professionalName: comparison.updatedBy.fullName,
        professionalTitle:
          comparison.updatedBy.profile?.professionalTitle ?? undefined,
        professionalRegistration:
          comparison.updatedBy.profile?.professionalRegistration ??
          undefined,
        professionalPhone:
          comparison.updatedBy.profile?.professionalPhone ?? undefined,
        professionalInstagram:
          comparison.updatedBy.profile?.professionalInstagram ??
          undefined,
        version: comparison.version,
      })),
    };
  },

  async savePosturalEvolutionComparison(
    patientId: string,
    input: SavePosturalEvolutionComparisonInput,
    professionalUserId: string,
  ) {
    if (
      input.previousAssessmentId === input.currentAssessmentId
    ) {
      throw new Error("POSTURAL_COMPARISON_REQUIRES_TWO_ASSESSMENTS");
    }

    return prisma.$transaction(async (transaction) => {
      const entries = await transaction.masterRecordEntry.findMany({
        where: {
          id: {
            in: [
              input.previousAssessmentId,
              input.currentAssessmentId,
            ],
          },
          deletedAt: null,
          posturalAssessment: { isNot: null },
          masterRecord: {
            patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
        },
        select: { id: true },
      });
      if (entries.length !== 2) {
        throw new Error("POSTURAL_COMPARISON_ASSESSMENT_NOT_FOUND");
      }

      const comparison =
        await transaction.posturalEvolutionComparison.upsert({
          where: {
            previousEntryId_currentEntryId: {
              previousEntryId: input.previousAssessmentId,
              currentEntryId: input.currentAssessmentId,
            },
          },
          create: {
            previousEntryId: input.previousAssessmentId,
            currentEntryId: input.currentAssessmentId,
            professionalUserId,
            updatedByUserId: professionalUserId,
            classifications: toJson(input.classifications),
            visualSettings: input.visualSettings
              ? toJson(input.visualSettings)
              : undefined,
            generatedSummary: input.generatedSummary,
            editedSummary: input.editedSummary,
            evaluatorConclusion: input.evaluatorConclusion,
            generatedAt: input.generatedAt
              ? new Date(input.generatedAt)
              : undefined,
          },
          update: {
            updatedByUserId: professionalUserId,
            classifications: toJson(input.classifications),
            visualSettings: input.visualSettings
              ? toJson(input.visualSettings)
              : undefined,
            generatedSummary: input.generatedSummary,
            editedSummary: input.editedSummary,
            evaluatorConclusion: input.evaluatorConclusion,
            generatedAt: input.generatedAt
              ? new Date(input.generatedAt)
              : null,
            version: { increment: 1 },
          },
          select: {
            id: true,
            previousEntryId: true,
            currentEntryId: true,
            classifications: true,
            visualSettings: true,
            generatedSummary: true,
            editedSummary: true,
            evaluatorConclusion: true,
            generatedAt: true,
            comparedAt: true,
            updatedAt: true,
            version: true,
            updatedBy: {
              select: {
                fullName: true,
                profile: {
                  select: {
                    professionalTitle: true,
                    professionalRegistration: true,
                    professionalPhone: true,
                    professionalInstagram: true,
                  },
                },
              },
            },
          },
        });

      const comparisonVersion =
        await transaction.recordVersion.aggregate({
          where: {
            entityType: "POSTURAL_EVOLUTION_COMPARISON",
            entityId: comparison.id,
          },
          _max: { version: true },
        });
      const posturalModule =
        await transaction.systemModule.findUniqueOrThrow({
          where: { key: "POSTURAL_ASSESSMENT" },
          select: { id: true },
        });
      await transaction.recordVersion.create({
        data: {
          entityType: "POSTURAL_EVOLUTION_COMPARISON",
          entityId: comparison.id,
          moduleId: posturalModule.id,
          responsibleUserId: professionalUserId,
          version: (comparisonVersion._max.version ?? 0) + 1,
          status: "ACTIVE",
          snapshot: toJson({
            previousAssessmentId: comparison.previousEntryId,
            currentAssessmentId: comparison.currentEntryId,
            classifications: input.classifications,
            visualSettings: input.visualSettings,
            generatedSummary: input.generatedSummary,
            editedSummary: input.editedSummary,
            evaluatorConclusion: input.evaluatorConclusion,
            generatedAt: input.generatedAt,
          }),
          reason:
            "Comparação evolutiva postural revisada pela profissional responsável.",
        },
      });

      return {
        id: comparison.id,
        previousAssessmentId: comparison.previousEntryId,
        currentAssessmentId: comparison.currentEntryId,
        classifications: jsonObject<
          Record<string, PosturalEvolutionClassification>
        >(comparison.classifications, {}),
        visualSettings: jsonObject<{
          synchronized: boolean;
        }>(comparison.visualSettings, {
          synchronized: false,
        }),
        generatedSummary: comparison.generatedSummary ?? undefined,
        editedSummary: comparison.editedSummary ?? undefined,
        evaluatorConclusion:
          comparison.evaluatorConclusion ?? undefined,
        generatedAt: comparison.generatedAt?.toISOString(),
        comparedAt: comparison.comparedAt.toISOString(),
        updatedAt: comparison.updatedAt.toISOString(),
        professionalName: comparison.updatedBy.fullName,
        professionalTitle:
          comparison.updatedBy.profile?.professionalTitle ?? undefined,
        professionalRegistration:
          comparison.updatedBy.profile?.professionalRegistration ??
          undefined,
        professionalPhone:
          comparison.updatedBy.profile?.professionalPhone ?? undefined,
        professionalInstagram:
          comparison.updatedBy.profile?.professionalInstagram ??
          undefined,
        version: comparison.version,
      };
    });
  },

  async createHistoricalClinicalAssessment(
    input: CreateHistoricalClinicalAssessmentInput,
    professionalUserId: string,
  ): Promise<CreateHistoricalClinicalAssessmentResult> {
    const assessmentDate = historicalAssessmentDate(input.assessmentDate);
    const historicalSteps = [
      input.records.anthropometry ? "ANTHROPOMETRY" : undefined,
      input.records.perimetry ? "PERIMETRY" : undefined,
      input.records.bioimpedance ? "BIOIMPEDANCE" : undefined,
    ].filter(
      (step): step is "ANTHROPOMETRY" | "PERIMETRY" | "BIOIMPEDANCE" =>
        step !== undefined,
    );

    if (historicalSteps.length === 0) {
      throw new Error("HISTORICAL_ASSESSMENT_REQUIRES_RECORD");
    }

    if (input.records.anthropometry) {
      const errors = validateAnthropometryMeasurements(
        input.records.anthropometry,
      );
      const firstError = Object.values(errors)[0];
      if (firstError) {
        throw new Error(`INVALID_ANTHROPOMETRY:${firstError}`);
      }
    }

    if (input.records.perimetry) {
      const errors = validatePerimetryMeasurements(input.records.perimetry);
      const firstError = Object.values(errors)[0];
      if (firstError) {
        throw new Error(`INVALID_PERIMETRY:${firstError}`);
      }
    }

    if (input.records.bioimpedance) {
      const errors = validateBioimpedanceMeasurements(
        input.records.bioimpedance,
      );
      const firstError = Object.values(errors)[0];
      if (firstError) {
        throw new Error(`INVALID_BIOIMPEDANCE:${firstError}`);
      }
    }

    const assessment = await prisma.$transaction(async (transaction) => {
      const masterRecord = await transaction.masterRecord.findFirst({
        where: {
          patientId: input.patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
        select: { id: true },
      });

      if (!masterRecord) throw new Error("MASTER_RECORD_NOT_FOUND");

      const moduleKeys = [
        "MASTER_RECORD",
        ...historicalSteps.map((step) => assessmentModuleByStep[step]),
      ] as const;
      const modules = await transaction.systemModule.findMany({
        where: { key: { in: [...moduleKeys] } },
        select: { id: true, key: true },
      });
      const moduleIdByKey = new Map(
        modules.map((module) => [module.key, module.id]),
      );
      const masterRecordModuleId = moduleIdByKey.get("MASTER_RECORD");

      if (!masterRecordModuleId) throw new Error("MODULE_NOT_FOUND");

      const entry = await transaction.masterRecordEntry.create({
        data: {
          masterRecordId: masterRecord.id,
          moduleId: masterRecordModuleId,
          authorUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          aggregateId: randomUUID(),
          type: ASSESSMENT_ENTRY_TYPE,
          status: "FINALIZED",
          occurredAt: assessmentDate,
          payload: toJson({
            stage: "ASSESSMENT",
            historical: true,
            assessmentDate: input.assessmentDate,
            modalities: historicalSteps,
          }),
        },
        select: {
          id: true,
          masterRecordId: true,
          revision: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (input.records.anthropometry) {
        const { notes, ...measurements } = input.records.anthropometry;
        const bmi = calculateBmi(
          measurements.weightKg,
          measurements.heightCm
            ? measurements.heightCm / 100
            : undefined,
        );
        await transaction.physicalAssessmentRecord.create({
          data: {
            entryId: entry.id,
            assessedAt: assessmentDate,
            observations: toJson({ ...measurements, bmi }),
            notes: safeClinicalText(notes),
          },
        });
      }

      if (input.records.perimetry) {
        const { notes } = input.records.perimetry;
        await transaction.perimetryRecord.create({
          data: {
            entryId: entry.id,
            measuredAt: assessmentDate,
            measurements: perimetryJson(input.records.perimetry),
            notes: safeClinicalText(notes),
          },
        });
      }

      if (input.records.bioimpedance) {
        const measurements = Object.fromEntries(
          bioimpedanceFieldKeys.map((key) => [
            key,
            finiteNumber(input.records.bioimpedance?.[key]) ?? null,
          ]),
        ) as Prisma.InputJsonValue;
        await transaction.bioimpedanceRecord.create({
          data: {
            entryId: entry.id,
            measuredAt: assessmentDate,
            measurements,
          },
        });
      }

      for (const step of historicalSteps) {
        const moduleId = moduleIdByKey.get(assessmentModuleByStep[step]);
        if (!moduleId) throw new Error("MODULE_NOT_FOUND");

        const data =
          step === "ANTHROPOMETRY"
            ? input.records.anthropometry!
            : step === "PERIMETRY"
              ? input.records.perimetry!
              : input.records.bioimpedance!;
        await transaction.recordVersion.create({
          data: {
            entityType: `${ASSESSMENT_ENTRY_TYPE}_${step}`,
            entityId: entry.id,
            moduleId,
            responsibleUserId: professionalUserId,
            version: 1,
            status: "COMPLETED",
            snapshot: toJson({
              ...data,
              assessmentDate: input.assessmentDate,
            }),
            reason: `${step} histórica registrada pelo usuário autenticado.`,
          },
        });
      }

      return {
        id: entry.id,
        patientId: input.patientId,
        masterRecordId: entry.masterRecordId,
        assessmentDate: input.assessmentDate,
        records: input.records,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        version: entry.revision,
      };
    });

    return { assessment, persisted: true };
  },

  async saveStep(
    input: SaveClinicalStepInput,
    professionalUserId: string,
  ) {
    if (input.step === "ANTHROPOMETRY") {
      const errors = validateAnthropometryMeasurements(
        input.data as AnthropometryData,
      );
      const firstError = Object.values(errors)[0];

      if (firstError) {
        throw new Error(`INVALID_ANTHROPOMETRY:${firstError}`);
      }
    }

    if (input.step === "PERIMETRY") {
      const errors = validatePerimetryMeasurements(
        input.data as PerimetryData,
      );
      const firstError = Object.values(errors)[0];

      if (firstError) {
        throw new Error(`INVALID_PERIMETRY:${firstError}`);
      }
    }

    if (input.step === "BIOIMPEDANCE") {
      const errors = validateBioimpedanceMeasurements(
        input.data as BioimpedanceAvanutriData,
      );
      const firstError = Object.values(errors)[0];

      if (firstError) {
        throw new Error(`INVALID_BIOIMPEDANCE:${firstError}`);
      }
    }

    if (input.step === "POSTURAL_ASSESSMENT") {
      assertValidPosturalAssessmentData(input.data);
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))
      `;

      const attendance = await transaction.attendance.findFirst({
        where: {
          id: input.attendanceId,
          ...(input.step === "POSTURAL_ASSESSMENT"
            ? {}
            : { status: { in: ["DRAFT", "IN_PROGRESS"] } }),
          deletedAt: null,
          masterRecord: {
            patientId: input.patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
        },
        select: { id: true, masterRecordId: true, createdAt: true, status: true },
      });

      if (!attendance) throw new Error("ASSESSMENT_NOT_FOUND");
      if (
        input.step === "POSTURAL_ASSESSMENT" &&
        attendance.status !== "IN_PROGRESS"
      ) {
        throw new ClinicalCollectionWriteError();
      }

      const [masterRecordModule, executedModule] = await Promise.all([
        transaction.systemModule.findUniqueOrThrow({
          where: { key: "MASTER_RECORD" },
          select: { id: true },
        }),
        transaction.systemModule.findUniqueOrThrow({
          where: { key: assessmentModuleByStep[input.step] },
          select: { id: true },
        }),
      ]);
      const now = new Date();
      let entry = await transaction.masterRecordEntry.findFirst({
        where: {
          attendanceId: attendance.id,
          masterRecordId: attendance.masterRecordId,
          type: ASSESSMENT_ENTRY_TYPE,
          deletedAt: null,
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      if (!entry) {
        entry = await transaction.masterRecordEntry.create({
          data: {
            masterRecordId: attendance.masterRecordId,
            moduleId: masterRecordModule.id,
            authorUserId: professionalUserId,
            updatedByUserId: professionalUserId,
            attendanceId: attendance.id,
            aggregateId: randomUUID(),
            type: ASSESSMENT_ENTRY_TYPE,
            status: "DRAFT",
            occurredAt: now,
            payload: { stage: "ASSESSMENT" },
          },
          select: { id: true },
        });
      } else {
        await transaction.masterRecordEntry.update({
          where: { id: entry.id },
          data: {
            updatedByUserId: professionalUserId,
            occurredAt: now,
          },
        });
      }

      if (input.step === "ANTHROPOMETRY") {
        const data = input.data as AnthropometryData;
        const { notes, ...measurements } = data;
        const safeNotes = safeClinicalText(notes);
        const bmi = calculateBmi(
          measurements.weightKg,
          measurements.heightCm
            ? measurements.heightCm / 100
            : undefined,
        );

        await transaction.physicalAssessmentRecord.upsert({
          where: { entryId: entry.id },
          update: {
            assessedAt: now,
            observations: toJson({ ...measurements, bmi }),
            notes: safeNotes,
          },
          create: {
            entryId: entry.id,
            assessedAt: now,
            observations: toJson({ ...measurements, bmi }),
            notes: safeNotes,
          },
        });
      }

      if (input.step === "BIOIMPEDANCE") {
        const data = input.data as BioimpedanceAvanutriData;
        const [currentPhysicalAssessment, recentPhysicalAssessments] =
          await Promise.all([
            transaction.physicalAssessmentRecord.findUnique({
              where: { entryId: entry.id },
              select: { observations: true },
            }),
            transaction.physicalAssessmentRecord.findMany({
              where: {
                assessedAt: { lt: attendance.createdAt },
                entry: {
                  attendanceId: { not: attendance.id },
                  masterRecordId: attendance.masterRecordId,
                  deletedAt: null,
                },
              },
              orderBy: { assessedAt: "desc" },
              select: { observations: true },
              take: 50,
            }),
          ]);
        const currentAnthropometry = jsonObject<Record<string, unknown>>(
          currentPhysicalAssessment?.observations,
          {},
        );
        const inheritedWeightKg =
          positiveNumber(currentAnthropometry.weightKg) ??
          findRecentAnthropometryValue(
            recentPhysicalAssessments,
            "weightKg",
          );
        const inheritedHeightCm =
          positiveNumber(currentAnthropometry.heightCm) ??
          findRecentAnthropometryValue(
            recentPhysicalAssessments,
            "heightCm",
          );
        const bmi = calculateBmi(
          inheritedWeightKg,
          inheritedHeightCm ? inheritedHeightCm / 100 : undefined,
        );
        const measurements = bioimpedanceJson(data, bmi);

        await transaction.bioimpedanceRecord.upsert({
          where: { entryId: entry.id },
          update: { measurements },
          create: {
            entryId: entry.id,
            measuredAt: now,
            measurements,
          },
        });
      }

      if (input.step === "PERIMETRY") {
        const data = input.data as PerimetryData;
        const { notes } = data;
        const safeNotes = safeClinicalText(notes);
        const measurements = perimetryJson(data);
        await transaction.perimetryRecord.upsert({
          where: { entryId: entry.id },
          update: { measurements, notes: safeNotes },
          create: {
            entryId: entry.id,
            measuredAt: now,
            measurements,
            notes: safeNotes,
          },
        });
      }

      if (input.step === "POSTURAL_ASSESSMENT") {
        const data = input.data as PosturalAssessmentData;
        const { notes, ...observations } = data;
        const safeNotes = safeClinicalText(notes);
        await transaction.posturalAssessmentRecord.upsert({
          where: { entryId: entry.id },
          update: { observations: toJson(observations), notes: safeNotes },
          create: {
            entryId: entry.id,
            assessedAt: now,
            observations: toJson(observations),
            notes: safeNotes,
          },
        });
      }

      if (shouldCreateClinicalStepVersion(input.saveMode)) {
        const entityType = `${ASSESSMENT_ENTRY_TYPE}_${input.step}`;
        const previousVersion = await transaction.recordVersion.aggregate({
          where: { entityType, entityId: entry.id },
          _max: { version: true },
        });
        await transaction.recordVersion.create({
          data: {
            entityType,
            entityId: entry.id,
            moduleId: executedModule.id,
            responsibleUserId: professionalUserId,
            version: (previousVersion._max.version ?? 0) + 1,
            status:
              input.step === "POSTURAL_ASSESSMENT" &&
              (input.data as PosturalAssessmentData).completionStatus !==
                "COMPLETED"
                ? "DRAFT"
                : "COMPLETED",
            snapshot: toJson(input.data),
            reason: `${input.step} registrada pelo usuário autenticado.`,
          },
        });
      }

      await transaction.masterRecordContinuity.update({
        where: { masterRecordId: attendance.masterRecordId },
        data: {
          lastActivityAt: now,
          nextSuggestedStepKey: {
            ANTHROPOMETRY: "PERIMETRY",
            PERIMETRY: "BIOIMPEDANCE",
            BIOIMPEDANCE: "POSTURAL_ASSESSMENT",
            POSTURAL_ASSESSMENT: "ASSESSMENT_SUMMARY",
          }[input.step],
          suggestionSource: "WORKFLOW",
          updatedByUserId: professionalUserId,
          steps: {
            update: {
              where: {
                continuityId_key: {
                  continuityId: (
                    await transaction.masterRecordContinuity.findUniqueOrThrow({
                      where: { masterRecordId: attendance.masterRecordId },
                      select: { id: true },
                    })
                  ).id,
                  key: "ASSESSMENT",
                },
              },
              data: {
                status: "IN_PROGRESS",
                responsibleUserId: professionalUserId,
                updatedByUserId: professionalUserId,
              },
            },
          },
        },
      });
    });

    const collection = await loadCollection(input.patientId, input.attendanceId);
    if (!collection) throw new Error("ASSESSMENT_NOT_FOUND");

    return {
      collection: { ...collection, lastSavedStep: input.step },
      savedAt: new Date().toISOString(),
      persisted: true,
    } as const;
  },

  async completeCollection(
    patientId: string,
    attendanceId: string,
    professionalUserId: string,
  ) {
    const current = await loadCollection(patientId, attendanceId);

    if (!current) throw new Error("ASSESSMENT_NOT_FOUND");
    if (current.summaryLoadIssue) {
      throw new Error("SUMMARY_DATA_UNAVAILABLE");
    }
    if (current.completed) {
      return {
        collection: current,
        persisted: true,
        nextAttendanceStep: "Estratégia Nutricional",
      } as const;
    }
    if (!current.nutritionFlowReady) {
      throw new Error("MANDATORY_STEPS_PENDING");
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${attendanceId}))
      `;

      const attendance = await transaction.attendance.findFirst({
        where: {
          id: attendanceId,
          status: { in: ["DRAFT", "IN_PROGRESS"] },
          deletedAt: null,
          masterRecord: {
            patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
        },
        select: { masterRecordId: true },
      });

      if (!attendance) throw new Error("ASSESSMENT_NOT_FOUND");

      const entry = await transaction.masterRecordEntry.findFirst({
        where: {
          attendanceId,
          masterRecordId: attendance.masterRecordId,
          type: ASSESSMENT_ENTRY_TYPE,
          deletedAt: null,
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      if (!entry) throw new Error("ASSESSMENT_NOT_FOUND");

      const now = new Date();
      const continuity =
        await transaction.masterRecordContinuity.findUniqueOrThrow({
          where: { masterRecordId: attendance.masterRecordId },
          select: { id: true },
        });

      await Promise.all([
        transaction.masterRecordEntry.update({
          where: { id: entry.id },
          data: {
            status: "FINALIZED",
            updatedByUserId: professionalUserId,
            occurredAt: now,
          },
        }),
        transaction.continuityStep.update({
          where: {
            continuityId_key: {
              continuityId: continuity.id,
              key: "ASSESSMENT",
            },
          },
          data: {
            status: "COMPLETED",
            responsibleUserId: professionalUserId,
            completedByUserId: professionalUserId,
            completedAt: now,
            updatedByUserId: professionalUserId,
          },
        }),
        transaction.masterRecordContinuity.update({
          where: { id: continuity.id },
          data: {
            lastCompletedStepKey: "ASSESSMENT",
            lastActivityAt: now,
            nextSuggestedStepKey: "NUTRITION_STRATEGY",
            suggestionSource: "WORKFLOW",
            responsibleUserId: professionalUserId,
            updatedByUserId: professionalUserId,
          },
        }),
      ]);
    });

    const collection = await loadCollection(patientId, attendanceId);
    if (!collection) throw new Error("ASSESSMENT_NOT_FOUND");

    return {
      collection,
      persisted: true,
      nextAttendanceStep: "Estratégia Nutricional",
    } as const;
  },
};
