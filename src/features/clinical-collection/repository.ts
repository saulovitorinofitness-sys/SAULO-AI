import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@/generated/prisma/client";

import {
  bioimpedanceGroups,
  perimetryGroups,
} from "./field-definitions";
import { calculateBmi } from "./anthropometry-calculations";
import { buildPosturalEvolutionTimeline } from "./postural-history";
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
  EditableClinicalData,
  EditableClinicalStepKey,
  PerimetryData,
  PosturalAssessmentData,
  ProfessionalAudit,
  SaveClinicalStepInput,
} from "./contracts";

const ASSESSMENT_ENTRY_TYPE = "ASSESSMENT";
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
  attendanceId: string,
): Promise<ClinicalCollectionView | null> {
  const attendance = await prisma.attendance.findFirst({
    where: {
      id: attendanceId,
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
  });

  if (!attendance) return null;

  const entry = await prisma.masterRecordEntry.findFirst({
    where: {
      attendanceId,
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
  const recentPhysicalAssessments =
    await prisma.physicalAssessmentRecord.findMany({
      where: {
        entry: {
          masterRecordId: attendance.masterRecordId,
          deletedAt: null,
        },
      },
      orderBy: { assessedAt: "desc" },
      select: { observations: true },
      take: 50,
    });
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
    notes: entry?.physicalAssessment?.notes ?? undefined,
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
    notes: entry?.perimetry?.notes ?? undefined,
  };
  const postural = {
    ...emptyPosturalAssessment,
    ...jsonObject<PosturalAssessmentData>(
      entry?.posturalAssessment?.observations,
      emptyPosturalAssessment,
    ),
    notes: entry?.posturalAssessment?.notes ?? undefined,
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
    patientPhone: phoneLabel(patient.phones[0]),
    attendanceId: attendance.id,
    masterRecordId: attendance.masterRecordId,
    consultationType: attendance.consultationType,
    connectedProfessional: {
      professionalUserId: attendance.professional.id,
      professionalName: attendance.professional.fullName,
      updatedAt: attendance.updatedAt.toISOString(),
      version: attendance.version,
    },
    records,
    progressPercent: completedCount * 25,
    nutritionFlowReady,
    firstIncompleteStep,
    lastSavedStep: undefined,
    canRead: true,
    canEdit: attendance.status === "IN_PROGRESS",
    completed: entry?.status === "FINALIZED",
    nextAttendanceStep:
      entry?.status === "FINALIZED" ? "Painel Clínico Integrado" : undefined,
    scenario: "complete",
  };
}

export const clinicalCollectionRepository = {
  getCollection: loadCollection,

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

    return buildPosturalEvolutionTimeline(
      records.map((record) => ({
        assessmentId: record.entry.id,
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
        audit: {
          professionalUserId: record.entry.updatedBy.id,
          professionalName: record.entry.updatedBy.fullName,
          updatedAt: record.entry.updatedAt.toISOString(),
          version: record.entry.revision,
        },
      })),
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

  async saveStep(
    input: SaveClinicalStepInput,
    professionalUserId: string,
  ) {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.attendanceId}))
      `;

      const attendance = await transaction.attendance.findFirst({
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
      });

      if (!attendance) throw new Error("ASSESSMENT_NOT_FOUND");

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
            notes,
          },
          create: {
            entryId: entry.id,
            assessedAt: now,
            observations: toJson({ ...measurements, bmi }),
            notes,
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
                entry: {
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
          update: { measuredAt: now, measurements },
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
        const measurements = perimetryJson(data);
        await transaction.perimetryRecord.upsert({
          where: { entryId: entry.id },
          update: { measuredAt: now, measurements, notes },
          create: {
            entryId: entry.id,
            measuredAt: now,
            measurements,
            notes,
          },
        });
      }

      if (input.step === "POSTURAL_ASSESSMENT") {
        const data = input.data as PosturalAssessmentData;
        const { notes, ...observations } = data;
        await transaction.posturalAssessmentRecord.upsert({
          where: { entryId: entry.id },
          update: { assessedAt: now, observations: toJson(observations), notes },
          create: {
            entryId: entry.id,
            assessedAt: now,
            observations: toJson(observations),
            notes,
          },
        });
      }

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
          status: "IN_PROGRESS",
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
      nextAttendanceStep: "Painel Clínico Integrado",
    } as const;
  },
};
