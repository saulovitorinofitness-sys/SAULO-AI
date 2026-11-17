import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import type { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { objectiveOptions } from "@/features/clinical-anamnesis";
import { persistedProfessionalReference } from "@/features/professional-responsibility/persisted-responsibility";

import type {
  InheritedTrainingFact,
  PerformanceWorkoutView,
  StoredWorkoutPlanPayload,
  WorkoutPlanDraft,
  WorkoutPlanStatus,
  WorkoutProfessionalContext,
} from "./workout-contracts";
import {
  buildWorkoutMethodGlossary,
  emptyWorkoutPlanDraft,
  parseStoredWorkoutPlanPayload,
} from "./workout-record";

const WORKOUT_PLAN_ENTRY_TYPE = "WORKOUT_PLAN";
const NOT_INFORMED = "Não informado";
const objectiveLabels = new Map(objectiveOptions);

async function workoutRepositoryDependencies() {
  const [database, clinicalCollection, exerciseCatalog] = await Promise.all([
    import("@/lib/database/prisma"),
    import("@/features/clinical-collection/repository"),
    import("./exercise-catalog-repository"),
  ]);
  return {
    prisma: database.prisma,
    clinicalCollectionRepository:
      clinicalCollection.clinicalCollectionRepository,
    exerciseCatalogRepository: exerciseCatalog.exerciseCatalogRepository,
  };
}

function cleanParts(parts: readonly (string | undefined)[]) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

function joinItems(items: readonly string[]) {
  return items.length ? items.join(" | ") : NOT_INFORMED;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueItems(items: readonly (string | undefined)[]) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function objectArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(objectValue).filter((item) => Object.keys(item).length > 0)
    : [];
}

function describedItems(
  value: unknown,
  primaryKey: string,
  secondaryKeys: readonly string[] = [],
) {
  return objectArray(value).flatMap((item) => {
    const primary = stringValue(item[primaryKey]);
    if (!primary) return [];
    const details = secondaryKeys
      .map((key) => stringValue(item[key]))
      .filter((detail): detail is string => Boolean(detail));
    return [details.length ? `${primary} — ${details.join(" · ")}` : primary];
  });
}

function measurementSummary(
  data: Record<string, unknown>,
  definitions: readonly (readonly [string, string, string])[],
) {
  return definitions.flatMap(([key, label, unit]) => {
    const measurement = data[key];
    return typeof measurement === "number" && Number.isFinite(measurement)
      ? [`${label}: ${measurement}${unit}`]
      : [];
  });
}

const bioimpedanceMeasurements = [
  ["weightKg", "Peso", " kg"],
  ["bodyFatPercent", "Gordura corporal", "%"],
  ["fatMassKg", "Massa de gordura", " kg"],
  ["fatFreeMassKg", "Massa livre de gordura", " kg"],
  ["skeletalMuscleMassKg", "Massa muscular esquelética", " kg"],
  ["totalBodyWaterL", "Água corporal total", " L"],
  ["intracellularWaterL", "Água intracelular", " L"],
  ["extracellularWaterL", "Água extracelular", " L"],
  ["bmi", "IMC", " kg/m²"],
  ["visceralFatLevel", "Gordura visceral", ""],
  ["basalMetabolicRateKcal", "Taxa metabólica basal", " kcal"],
  ["appendicularIndex", "Índice apendicular", " kg/m²"],
  ["metabolicAgeYears", "Idade metabólica", " anos"],
  ["proteinKg", "Proteína", " kg"],
  ["mineralsKg", "Minerais", " kg"],
  ["leanRightArmKg", "Massa magra — braço direito", " kg"],
  ["leanLeftArmKg", "Massa magra — braço esquerdo", " kg"],
  ["leanTrunkKg", "Massa magra — tronco", " kg"],
  ["leanRightLegKg", "Massa magra — perna direita", " kg"],
  ["leanLeftLegKg", "Massa magra — perna esquerda", " kg"],
  ["fatRightArmKg", "Gordura — braço direito", " kg"],
  ["fatLeftArmKg", "Gordura — braço esquerdo", " kg"],
  ["fatTrunkKg", "Gordura — tronco", " kg"],
  ["fatRightLegKg", "Gordura — perna direita", " kg"],
  ["fatLeftLegKg", "Gordura — perna esquerda", " kg"],
] as const;

const perimetryMeasurements = [
  ["neckCm", "Pescoço", " cm"],
  ["shouldersCm", "Ombros", " cm"],
  ["chestCm", "Tórax", " cm"],
  ["waistCm", "Cintura", " cm"],
  ["abdomenCm", "Abdômen", " cm"],
  ["hipCm", "Quadril", " cm"],
  ["rightArmCm", "Braço direito", " cm"],
  ["leftArmCm", "Braço esquerdo", " cm"],
  ["rightForearmCm", "Antebraço direito", " cm"],
  ["leftForearmCm", "Antebraço esquerdo", " cm"],
  ["rightThighCm", "Coxa direita", " cm"],
  ["leftThighCm", "Coxa esquerda", " cm"],
  ["rightCalfCm", "Panturrilha direita", " cm"],
  ["leftCalfCm", "Panturrilha esquerda", " cm"],
] as const;

interface PersistedAssessmentData {
  readonly data: Record<string, unknown>;
  readonly entryId: string;
}

function toJson(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalizedJson(item)]),
  );
}

function semanticallyEqualJson(left: unknown, right: unknown) {
  return JSON.stringify(normalizedJson(left)) === JSON.stringify(normalizedJson(right));
}

function contentWithDraftStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return toJson({
    ...(value as Record<string, unknown>),
    status: "DRAFT",
  });
}

function workoutPlanPayload(
  draft: WorkoutPlanDraft,
  status: WorkoutPlanStatus,
): StoredWorkoutPlanPayload {
  const baseProtocol = draft.strategy.baseProtocol;
  const weeklyDivision = draft.strategy.weeklyDivision;

  return {
    ...draft,
    strategy: {
      ...draft.strategy,
      baseProtocol: baseProtocol
        ? {
            protocolId: baseProtocol.protocolId,
            protocolName: baseProtocol.protocolName,
            source: baseProtocol.source,
            version: baseProtocol.version,
            area: baseProtocol.area,
            professionalNotes: baseProtocol.professionalNotes,
          }
        : undefined,
      weeklyDivision: weeklyDivision?.map((entry) => ({
        weekday: entry.weekday,
        weeklyOrder: entry.weeklyOrder,
        sessionName: entry.sessionName,
        primaryFocus: entry.primaryFocus,
        prioritizedGroupsOrCapacities: [
          ...entry.prioritizedGroupsOrCapacities,
        ],
        sessionId: entry.sessionId,
        kind: entry.kind,
        observations: entry.observations,
      })),
    },
    schemaVersion: 1,
    status,
    methodGlossary: buildWorkoutMethodGlossary(draft),
  };
}

function value(value: string | number | undefined, unit = "") {
  if (value === undefined || value === "") return NOT_INFORMED;
  return `${value}${unit}`;
}

function inheritedFacts(input: {
  objective?: string;
  latestAnthropometry?: {
    weightKg?: number;
    heightCm?: number;
    entryId?: string;
  };
  latestBioimpedance?: PersistedAssessmentData;
  latestPerimetry?: PersistedAssessmentData;
  latestPosturalAssessment?: PersistedAssessmentData;
  collection: NonNullable<
    Awaited<ReturnType<typeof clinicalCollectionRepository.getCollection>>
  >;
}): readonly InheritedTrainingFact[] {
  const { collection } = input;
  const anamnesis = collection.anamnesis?.data;
  const anthropometry = collection.records.anthropometry;
  const bioimpedance = collection.records.bioimpedance;
  const perimetry = collection.records.perimetry;
  const postural = collection.records.posturalAssessment;
  const bioimpedanceData = bioimpedance.origin
    ? objectValue(bioimpedance.data)
    : input.latestBioimpedance?.data ?? objectValue(bioimpedance.data);
  const bioimpedanceEntryId =
    bioimpedance.origin?.entryId ?? input.latestBioimpedance?.entryId;
  const perimetryData = perimetry.origin
    ? objectValue(perimetry.data)
    : input.latestPerimetry?.data ?? objectValue(perimetry.data);
  const perimetryEntryId =
    perimetry.origin?.entryId ?? input.latestPerimetry?.entryId;
  const posturalData = postural.origin
    ? objectValue(postural.data)
    : input.latestPosturalAssessment?.data ?? objectValue(postural.data);
  const posturalEntryId =
    postural.origin?.entryId ?? input.latestPosturalAssessment?.entryId;
  const weightKg =
    anthropometry.data.weightKg ?? input.latestAnthropometry?.weightKg;
  const heightCm =
    anthropometry.data.heightCm ?? input.latestAnthropometry?.heightCm;
  const anthropometryEntryId =
    anthropometry.origin?.entryId ?? input.latestAnthropometry?.entryId;

  const anamnesisObjective = anamnesis?.primaryObjective
    ? objectiveLabels.get(anamnesis.primaryObjective) ?? anamnesis.primaryObjective
    : undefined;

  const activityRoutine = anamnesis
    ? cleanParts([
        anamnesis.physicalActivity.modality
          ? `Modalidade: ${anamnesis.physicalActivity.modality}`
          : undefined,
        anamnesis.physicalActivity.frequency
          ? `Frequência: ${anamnesis.physicalActivity.frequency}`
          : undefined,
        anamnesis.physicalActivity.duration
          ? `Duração: ${anamnesis.physicalActivity.duration}`
          : undefined,
      ]).join(" · ")
    : "";

  const surgeries = anamnesis
    ? anamnesis.surgeries
        .map((item) =>
          cleanParts([
            item.procedure,
            item.date,
            item.notes,
          ]).join(" · "),
        )
        .filter(Boolean)
    : [];

  const injuries = anamnesis
    ? anamnesis.injuries
        .map((item) =>
          cleanParts([
            item.region,
            item.situation,
            item.notes,
          ]).join(" · "),
        )
        .filter(Boolean)
    : [];

  const injuriesAndSurgeries = [
    ...injuries.map((item) => `Lesão: ${item}`),
    ...surgeries.map((item) => `Cirurgia: ${item}`),
  ];

  const posturalSummary =
    stringValue(objectValue(posturalData.technicalSummary).editedSummary) ||
    stringValue(posturalData.evaluatorConclusion) ||
    stringValue(posturalData.identifiedChangesNotes);
  const correctivePlan = objectValue(posturalData.correctivePlan);
  const posturalPrecautions = describedItems(
    correctivePlan.precautions,
    "description",
    ["observation"],
  );
  const mobilityAndStability = [
    ...describedItems(correctivePlan.mobility, "exerciseName", [
      "objective",
      "observation",
    ]),
    ...describedItems(correctivePlan.stability, "exerciseName", [
      "objective",
      "observation",
    ]),
  ];
  const strengtheningAndStretching = [
    ...describedItems(correctivePlan.objectives, "title", ["description"]),
    ...describedItems(correctivePlan.stretching, "exerciseName", [
      "region",
      "observation",
    ]),
    ...describedItems(correctivePlan.activation, "exerciseName", [
      "muscleOrRegion",
      "observation",
    ]),
    ...describedItems(correctivePlan.correctiveExercises, "exerciseName", [
      "objective",
      "observation",
    ]),
  ];
  const bodyComposition = measurementSummary(
    bioimpedanceData,
    bioimpedanceMeasurements,
  );
  const perimetryValues = measurementSummary(
    perimetryData,
    perimetryMeasurements,
  );

  return [
    {
      key: "primary-objective",
      label: "Objetivo principal",
      value: anamnesisObjective || input.objective || NOT_INFORMED,
      source: "Anamnese",
      sourceEntryId: collection.anamnesis?.entryId,
    },
    {
      key: "strength-experience",
      label: "Experiência com musculação",
      value: NOT_INFORMED,
      source: "Anamnese",
      sourceEntryId: collection.anamnesis?.entryId,
    },
    {
      key: "weekly-availability",
      label: "Rotina e disponibilidade semanal",
      value: activityRoutine || NOT_INFORMED,
      source: "Anamnese",
      sourceEntryId: collection.anamnesis?.entryId,
    },
    {
      key: "possible-weekly-frequency",
      label: "Frequência semanal possível",
      value: anamnesis?.physicalActivity.frequency?.trim() || NOT_INFORMED,
      source: "Anamnese",
      sourceEntryId: collection.anamnesis?.entryId,
    },
    {
      key: "session-duration",
      label: "Duração disponível por sessão",
      value: anamnesis?.physicalActivity.duration?.trim() || NOT_INFORMED,
      source: "Anamnese",
      sourceEntryId: collection.anamnesis?.entryId,
    },
    {
      key: "pain",
      label: "Dores",
      value: NOT_INFORMED,
      source: "Anamnese",
      sourceEntryId: collection.anamnesis?.entryId,
    },
    {
      key: "injuries-surgeries",
      label: "Lesões e cirurgias relevantes",
      value: joinItems(injuriesAndSurgeries),
      source: "Anamnese",
      sourceEntryId: collection.anamnesis?.entryId,
    },
    {
      key: "contraindications",
      label: "Contraindicações e restrições de movimento",
      value: joinItems(posturalPrecautions),
      source: "Avaliação Postural",
      sourceEntryId: posturalEntryId,
    },
    {
      key: "sport-modality",
      label: "Modalidade esportiva praticada",
      value: anamnesis?.physicalActivity.modality?.trim() || NOT_INFORMED,
      source: "Anamnese",
      sourceEntryId: collection.anamnesis?.entryId,
    },
    {
      key: "weight-height",
      label: "Peso e altura",
      value:
        weightKg || heightCm
          ? [
              value(weightKg, " kg"),
              value(heightCm, " cm"),
            ].join(" · ")
          : NOT_INFORMED,
      source: "Antropometria",
      sourceEntryId: anthropometryEntryId,
    },
    {
      key: "body-composition",
      label: "Composição corporal",
      value: joinItems(bodyComposition),
      source: "Bioimpedância",
      sourceEntryId: bioimpedanceEntryId,
    },
    {
      key: "perimetry",
      label: "Perimetria para evolução e assimetrias",
      value: joinItems(perimetryValues),
      source: "Perimetria",
      sourceEntryId: perimetryEntryId,
    },
    {
      key: "postural-changes",
      label: "Alterações posturais relevantes",
      value: posturalSummary || NOT_INFORMED,
      source: "Avaliação Postural",
      sourceEntryId: posturalEntryId,
    },
    {
      key: "functional-limitations",
      label: "Limitações funcionais",
      value: stringValue(posturalData.functionalLimitationsNotes) || NOT_INFORMED,
      source: "Avaliação Postural",
      sourceEntryId: posturalEntryId,
    },
    {
      key: "mobility-stability",
      label: "Déficits de mobilidade e estabilidade",
      value: joinItems(mobilityAndStability),
      source: "Avaliação Postural",
      sourceEntryId: posturalEntryId,
    },
    {
      key: "strengthening-stretching",
      label: "Necessidades de fortalecimento e alongamento",
      value:
        stringValue(posturalData.futureCorrectiveExercisesNote) ||
        joinItems(strengtheningAndStretching),
      source: "Avaliação Postural",
      sourceEntryId: posturalEntryId,
    },
  ];
}

async function loadWorkoutProfessionalContext(input: {
  masterRecordId: string;
  patientId: string;
  attendanceId: string;
  currentEntryId?: string;
  objective?: string;
  currentPlan?: StoredWorkoutPlanPayload;
  collection: NonNullable<
    Awaited<ReturnType<typeof clinicalCollectionRepository.getCollection>>
  >;
}): Promise<WorkoutProfessionalContext> {
  const { prisma } = await workoutRepositoryDependencies();
  const [
    previousEntries,
    latestPosturalAssessment,
    physicalAssessmentRecords,
  ] = await Promise.all([
    prisma.masterRecordEntry.findMany({
      where: {
        masterRecordId: input.masterRecordId,
        type: WORKOUT_PLAN_ENTRY_TYPE,
        status: "FINALIZED",
        deletedAt: null,
        id: input.currentEntryId ? { not: input.currentEntryId } : undefined,
        OR: [
          { attendanceId: null },
          { attendanceId: { not: input.attendanceId } },
        ],
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 25,
      select: {
        id: true,
        revision: true,
        status: true,
        createdAt: true,
        workoutPlan: {
          select: {
            content: true,
            notes: true,
          },
        },
      },
    }),
    prisma.posturalAssessmentRecord.findFirst({
      where: {
        entry: {
          masterRecordId: input.masterRecordId,
          status: { not: "VOIDED" },
          deletedAt: null,
        },
      },
      orderBy: { assessedAt: "desc" },
      select: { observations: true },
    }),
    prisma.physicalAssessmentRecord.findMany({
      where: {
        entry: {
          masterRecordId: input.masterRecordId,
          status: { not: "VOIDED" },
          deletedAt: null,
        },
      },
      orderBy: { assessedAt: "desc" },
      take: 25,
      select: {
        assessedAt: true,
        observations: true,
        notes: true,
        entry: { select: { id: true } },
      },
    }),
  ]);

  const anamnesis = input.collection.anamnesis?.data;
  const anamnesisObjective = anamnesis?.primaryObjective
    ? objectiveLabels.get(anamnesis.primaryObjective) ?? anamnesis.primaryObjective
    : undefined;
  const activity = anamnesis?.physicalActivity;
  const trainingRoutine = activity
    ? cleanParts([
        activity.frequency
          ? `Frequência registrada: ${activity.frequency}`
          : undefined,
        activity.duration
          ? `Duração registrada: ${activity.duration}`
          : undefined,
      ]).join(" · ") || undefined
    : undefined;
  const practicedModalities = activity?.modality?.trim()
    ? [activity.modality.trim()]
    : [];
  const relevantInjuries = anamnesis
    ? anamnesis.injuries
        .map((injury) =>
          cleanParts([
            injury.region,
            injury.date,
            injury.situation,
            injury.notes,
          ]).join(" · "),
        )
        .filter(Boolean)
    : [];

  const postural = objectValue(latestPosturalAssessment?.observations);
  const technicalSummary = objectValue(postural.technicalSummary);
  const followUp = objectValue(postural.followUp);
  const hasTrainingRelevantPosturalFinding =
    followUp.conduct === "CONSIDER_IN_TRAINING" ||
    postural.overallRelevance === "MODERATE" ||
    postural.overallRelevance === "HIGH";
  const painAndLimitations =
    postural.functionalLimitations === "FINDING_RECORDED"
      ? uniqueItems([stringValue(postural.functionalLimitationsNotes)])
      : [];
  const relevantPosturalFindings = hasTrainingRelevantPosturalFinding
    ? uniqueItems([
        stringValue(technicalSummary.editedSummary),
        stringValue(postural.evaluatorConclusion),
        postural.identifiedChanges === "FINDING_RECORDED"
          ? stringValue(postural.identifiedChangesNotes)
          : undefined,
        stringValue(followUp.observation),
      ])
    : [];
  const correctivePlan = objectValue(postural.correctivePlan);
  const relevantContraindications = describedItems(
    correctivePlan.precautions,
    "description",
    ["observation"],
  );
  const physicalAssessments = physicalAssessmentRecords.flatMap((record) => {
    const observations = objectValue(record.observations);
    const assessmentName = stringValue(observations.assessmentName);
    const evaluatedCapacity = stringValue(observations.evaluatedCapacity);
    const resultSummary = stringValue(observations.resultSummary);
    if (!assessmentName || !evaluatedCapacity || !resultSummary) return [];

    return [{
      assessmentId: record.entry.id,
      assessmentName,
      performedAt: record.assessedAt.toISOString(),
      evaluatedCapacity,
      resultSummary,
      professionalInterpretation:
        stringValue(observations.professionalInterpretation) ||
        record.notes?.trim() ||
        undefined,
      sourceRecordId: record.entry.id,
    }];
  });

  const previousWorkoutPlan = previousEntries
    .map((entry) => {
      const plan = entry.workoutPlan
        ? parseStoredWorkoutPlanPayload(entry.workoutPlan.content)
        : null;
      if (!plan) return undefined;

      return {
        recordId: entry.id,
        version: entry.revision,
        status: "FINALIZED" as const,
        createdAt: entry.createdAt.toISOString(),
        objective: plan.service.trainingObjective.trim() || undefined,
        weeklyDivision: plan.strategy.weeklyDivision,
        sessions: plan.sessions.map((session) => ({
          id: session.id,
          name: session.name,
          objective: session.objective,
          estimatedDuration: session.estimatedDuration,
          observations: session.observations,
        })),
        professionalSummary:
          entry.workoutPlan?.notes?.trim() ||
          plan.strategy.observations.trim() ||
          undefined,
      };
    })
    .find((plan) => plan !== undefined);

  return {
    masterRecordId: input.masterRecordId,
    patientId: input.patientId,
    objective: anamnesisObjective || input.objective?.trim() || undefined,
    trainingRoutine,
    practicedModalities,
    painAndLimitations,
    relevantInjuries,
    relevantContraindications,
    relevantPosturalFindings,
    physicalAssessments,
    activeProtocol: input.currentPlan?.strategy.baseProtocol,
    previousWorkoutPlan,
  };
}

export async function reopenWorkoutPlanForAdjustment(input: {
  patientId: string;
  attendanceId: string;
  professionalUserId: string;
  reason: string;
  expectedRevision: number;
}): Promise<PerformanceWorkoutView | null> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("WORKOUT_PLAN_ADJUST_REASON_REQUIRED");
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new Error("WORKOUT_PLAN_REVISION_CONFLICT");
  }
  const { prisma } = await workoutRepositoryDependencies();

  const reopened = await prisma.$transaction(async (transaction) => {
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
    if (!attendance) return null;
    if (!module || !professional) {
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
      select: {
        id: true,
        status: true,
        revision: true,
        payload: true,
        workoutPlan: { select: { content: true } },
      },
    });
    if (!existing?.workoutPlan) return null;
    if (existing.status === "DRAFT") {
      throw new Error("WORKOUT_PLAN_ALREADY_DRAFT");
    }
    if (existing.status !== "FINALIZED") {
      throw new Error("WORKOUT_PLAN_NOT_FINALIZED");
    }
    if (existing.revision !== input.expectedRevision) {
      throw new Error("WORKOUT_PLAN_REVISION_CONFLICT");
    }

    const content = contentWithDraftStatus(existing.workoutPlan.content);
    if (!content) throw new Error("WORKOUT_PLAN_CONTENT_INVALID");
    const payload = contentWithDraftStatus(existing.payload) ??
      toJson({ schemaVersion: 1, status: "DRAFT" });
    const now = new Date();

    await transaction.masterRecordEntry.update({
      where: { id: existing.id },
      data: {
        status: "DRAFT",
        revision: { increment: 1 },
        occurredAt: now,
        updatedByUserId: professional.id,
        payload,
        workoutPlan: {
          update: { content },
        },
      },
    });
    await transaction.auditEvent.create({
      data: {
        entityType: WORKOUT_PLAN_ENTRY_TYPE,
        entityId: existing.id,
        moduleId: module.id,
        action: "STATUS_CHANGE",
        createdByUserId: professional.id,
        changedByUserId: professional.id,
        occurredAt: now,
        reason,
        changes: {
          create: {
            fieldPath: "status",
            previousValue: "FINALIZED",
            newValue: "DRAFT",
          },
        },
      },
    });

    return true;
  });

  return reopened
    ? performanceWorkoutRepository.get(
        input.patientId,
        input.attendanceId,
        input.professionalUserId,
      )
    : null;
}

export async function getLatestOfficialWorkoutPlan(input: {
  patientId: string;
  attendanceId: string;
  professionalUserId?: string;
  masterRecordId?: string;
  entryId?: string;
  versionId?: string;
}): Promise<PerformanceWorkoutView | null> {
  const specific = input.entryId !== undefined || input.versionId !== undefined;
  if (specific && (!input.entryId || !input.versionId || !input.masterRecordId)) {
    return null;
  }
  const currentView = await performanceWorkoutRepository.get(
    input.patientId,
    input.attendanceId,
    input.professionalUserId,
    input.entryId,
  );
  if (!currentView?.entryId) return null;
  if (specific && (
    currentView.entryId !== input.entryId ||
    currentView.masterRecordId !== input.masterRecordId
  )) return null;
  const { prisma } = await workoutRepositoryDependencies();

  const [currentEntry, latestOfficialVersion] = await Promise.all([
    prisma.masterRecordEntry.findFirst({
      where: {
        id: currentView.entryId,
        attendanceId: input.attendanceId,
        masterRecordId: input.masterRecordId,
        type: WORKOUT_PLAN_ENTRY_TYPE,
        deletedAt: null,
        status: { not: "VOIDED" },
        masterRecord: {
          patientId: input.patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
        attendance: {
          is: {
            id: input.attendanceId,
            masterRecordId: input.masterRecordId,
            deletedAt: null,
          },
        },
      },
      select: {
        status: true,
        revision: true,
        updatedAt: true,
        workoutPlan: { select: { content: true } },
      },
    }),
    prisma.recordVersion.findFirst({
      where: {
        id: input.versionId,
        entityType: WORKOUT_PLAN_ENTRY_TYPE,
        entityId: currentView.entryId,
        status: "FINALIZED",
      },
      orderBy: input.versionId ? undefined : [{ version: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        version: true,
        snapshot: true,
        createdAt: true,
        responsible: { select: { id: true, fullName: true } },
      },
    }),
  ]);
  if (!currentEntry?.workoutPlan) return null;
  if (specific && !latestOfficialVersion) return null;

  if (latestOfficialVersion) {
    const official = parseStoredWorkoutPlanPayload(
      latestOfficialVersion.snapshot,
    );
    if (!official || official.status !== "FINALIZED") return null;

    return {
      ...currentView,
      workoutPlanVersionId: latestOfficialVersion.id,
      status: "FINALIZED",
      draft: official,
      professionalContext: currentView.professionalContext
        ? {
            ...currentView.professionalContext,
            activeProtocol: official.strategy.baseProtocol,
          }
        : undefined,
      responsibleProfessionalId: latestOfficialVersion.responsible.id,
      responsibleProfessional: latestOfficialVersion.responsible.fullName,
      updatedAt: latestOfficialVersion.createdAt.toISOString(),
      version: latestOfficialVersion.version,
    };
  }

  const legacyOfficial = parseStoredWorkoutPlanPayload(
    currentEntry.workoutPlan.content,
  );
  if (
    currentEntry.status !== "FINALIZED" ||
    !legacyOfficial ||
    legacyOfficial.status !== "FINALIZED"
  ) {
    return null;
  }

  return {
    ...currentView,
    status: "FINALIZED",
    draft: legacyOfficial,
    professionalContext: currentView.professionalContext
      ? {
          ...currentView.professionalContext,
          activeProtocol: legacyOfficial.strategy.baseProtocol,
        }
      : undefined,
    updatedAt: currentEntry.updatedAt.toISOString(),
    version: currentEntry.revision,
  };
}

export const performanceWorkoutRepository = {
  getLatestOfficial: getLatestOfficialWorkoutPlan,
  reopenForAdjustment: reopenWorkoutPlanForAdjustment,
  async get(
    patientId: string,
    attendanceId: string,
    professionalUserId?: string,
    entryId?: string,
  ): Promise<PerformanceWorkoutView | null> {
    const {
      prisma,
      clinicalCollectionRepository,
      exerciseCatalogRepository,
    } = await workoutRepositoryDependencies();
    const [collection, context] = await Promise.all([
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
          professional: { select: { id: true, fullName: true } },
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
                  id: entryId,
                  type: WORKOUT_PLAN_ENTRY_TYPE,
                  attendanceId,
                  deletedAt: null,
                  status: { not: "VOIDED" },
                },
                orderBy: { createdAt: "asc" },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  revision: true,
                  updatedAt: true,
                  updatedBy: { select: { id: true, fullName: true } },
                  workoutPlan: { select: { content: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    if (!collection || !context) return null;
    const library = await exerciseCatalogRepository.search({
      professionalUserId: professionalUserId ?? context.professional.id,
      active: true,
    });

    const [
      latestPhysicalAssessment,
      latestBioimpedanceRecord,
      latestPerimetryRecord,
      latestPosturalAssessmentRecord,
    ] = await Promise.all([
      prisma.physicalAssessmentRecord.findFirst({
        where: {
          entry: {
            masterRecordId: context.masterRecordId,
            status: { not: "VOIDED" },
            deletedAt: null,
          },
        },
        orderBy: { assessedAt: "desc" },
        select: {
          observations: true,
          entry: { select: { id: true } },
        },
      }),
      prisma.bioimpedanceRecord.findFirst({
        where: {
          entry: {
            masterRecordId: context.masterRecordId,
            status: { not: "VOIDED" },
            deletedAt: null,
          },
        },
        orderBy: { measuredAt: "desc" },
        select: {
          measurements: true,
          entry: { select: { id: true } },
        },
      }),
      prisma.perimetryRecord.findFirst({
        where: {
          entry: {
            masterRecordId: context.masterRecordId,
            status: { not: "VOIDED" },
            deletedAt: null,
          },
        },
        orderBy: { measuredAt: "desc" },
        select: {
          measurements: true,
          entry: { select: { id: true } },
        },
      }),
      prisma.posturalAssessmentRecord.findFirst({
        where: {
          entry: {
            masterRecordId: context.masterRecordId,
            status: { not: "VOIDED" },
            deletedAt: null,
          },
        },
        orderBy: { assessedAt: "desc" },
        select: {
          observations: true,
          entry: { select: { id: true } },
        },
      }),
    ]);

    const latestAnthropometrySource = objectValue(
      latestPhysicalAssessment?.observations,
    );
    const latestAnthropometry = latestPhysicalAssessment
      ? {
          weightKg: positiveNumber(latestAnthropometrySource.weightKg),
          heightCm: positiveNumber(latestAnthropometrySource.heightCm),
          entryId: latestPhysicalAssessment.entry.id,
        }
      : undefined;
    const latestBioimpedance = latestBioimpedanceRecord
      ? {
          data: objectValue(latestBioimpedanceRecord.measurements),
          entryId: latestBioimpedanceRecord.entry.id,
        }
      : undefined;
    const latestPerimetry = latestPerimetryRecord
      ? {
          data: objectValue(latestPerimetryRecord.measurements),
          entryId: latestPerimetryRecord.entry.id,
        }
      : undefined;
    const latestPosturalAssessment = latestPosturalAssessmentRecord
      ? {
          data: objectValue(latestPosturalAssessmentRecord.observations),
          entryId: latestPosturalAssessmentRecord.entry.id,
        }
      : undefined;

    const entry = context.masterRecord.entries[0];
    const responsibleVersion = entry
      ? await prisma.recordVersion.findFirst({
          where: {
            entityType: WORKOUT_PLAN_ENTRY_TYPE,
            entityId: entry.id,
          },
          orderBy: { version: "desc" },
          select: {
            id: true,
            responsible: {
              select: { id: true, fullName: true },
            },
          },
        })
      : null;
    const stored = entry?.workoutPlan
      ? parseStoredWorkoutPlanPayload(entry.workoutPlan.content)
      : null;
    const objective =
      context.clinicalReasoningSession?.objectives[0]?.title;
    const professionalContext = await loadWorkoutProfessionalContext({
      masterRecordId: context.masterRecordId,
      patientId: context.masterRecord.patient.id,
      attendanceId: context.id,
      currentEntryId: entry?.id,
      objective,
      currentPlan: stored ?? undefined,
      collection,
    });
    const responsible = entry
      ? persistedProfessionalReference(
          responsibleVersion?.responsible,
          entry.updatedBy,
        )
      : {
          id: collection.connectedProfessional.professionalUserId,
          fullName: context.professional.fullName,
        };
    return {
      patient: {
        id: context.masterRecord.patient.id,
        name: context.masterRecord.patient.fullName,
        code: context.masterRecord.patient.clinicalCode,
      },
      masterRecordId: context.masterRecordId,
      attendanceId: context.id,
      entryId: entry?.id,
      workoutPlanVersionId:
        entry?.status === "FINALIZED" ? responsibleVersion?.id : undefined,
      status:
        entry?.status === "FINALIZED"
          ? "FINALIZED"
          : stored?.status ?? "DRAFT",
      draft: stored ?? emptyWorkoutPlanDraft(),
      professionalContext,
      inheritedFacts: inheritedFacts({
        objective,
        collection,
        latestAnthropometry,
        latestBioimpedance,
        latestPerimetry,
        latestPosturalAssessment,
      }),
      exerciseLibrary: library.items,
      responsibleProfessionalId: responsible.id,
      responsibleProfessional: responsible.fullName,
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
    expectedRevision?: number;
  }) {
    const { prisma } = await workoutRepositoryDependencies();
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
        select: {
          id: true,
          status: true,
          revision: true,
          workoutPlan: { select: { content: true } },
        },
      });
      if (
        input.expectedRevision !== undefined &&
        (!Number.isInteger(input.expectedRevision) ||
          input.expectedRevision < 0 ||
          input.expectedRevision !== (existing?.revision ?? 0))
      ) {
        throw new Error("WORKOUT_PLAN_REVISION_CONFLICT");
      }
      const payload = workoutPlanPayload(input.draft, input.status);
      if (existing?.status === "FINALIZED") {
        const stored = existing.workoutPlan
          ? parseStoredWorkoutPlanPayload(existing.workoutPlan.content)
          : null;
        if (
          input.status === "FINALIZED" &&
          stored &&
          semanticallyEqualJson(stored, payload)
        ) {
          return;
        }
        throw new Error("WORKOUT_PLAN_FINALIZED");
      }
      const now = new Date();
      const revision = existing ? existing.revision + 1 : 1;
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
      if (input.status === "FINALIZED") {
        const [latestOfficialVersion, latestVersion] = await Promise.all([
          transaction.recordVersion.findFirst({
            where: {
              entityType: WORKOUT_PLAN_ENTRY_TYPE,
              entityId: entry.id,
              status: "FINALIZED",
            },
            orderBy: { version: "desc" },
            select: { snapshot: true },
          }),
          transaction.recordVersion.findFirst({
            where: {
              entityType: WORKOUT_PLAN_ENTRY_TYPE,
              entityId: entry.id,
            },
            orderBy: { version: "desc" },
            select: { version: true },
          }),
        ]);
        const previousOfficial = latestOfficialVersion
          ? parseStoredWorkoutPlanPayload(latestOfficialVersion.snapshot)
          : null;

        if (
          !previousOfficial ||
          !semanticallyEqualJson(previousOfficial, payload)
        ) {
          await transaction.recordVersion.create({
            data: {
              entityType: WORKOUT_PLAN_ENTRY_TYPE,
              entityId: entry.id,
              moduleId: module.id,
              responsibleUserId: professional.id,
              version: Math.max(revision, (latestVersion?.version ?? 0) + 1),
              status: "FINALIZED",
              snapshot: toJson(payload),
              reason: "Plano de Treino finalizado pelo profissional.",
            },
          });
        }
      }
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
          changes:
            !existing || existing.status !== entryStatus
              ? {
                  create: {
                    fieldPath: "status",
                    previousValue: existing?.status ?? "NONE",
                    newValue: input.status,
                  },
                }
              : undefined,
        },
      });

      const continuity =
        await transaction.masterRecordContinuity.findUnique({
          where: {
            masterRecordId: attendance.masterRecordId,
          },
          select: {
            id: true,
          },
        });

      if (continuity) {
        const performanceCompleted = input.status === "FINALIZED";

        await Promise.all([
          transaction.continuityStep.upsert({
            where: {
              continuityId_key: {
                continuityId: continuity.id,
                key: "PERFORMANCE",
              },
            },
            update: {
              status: performanceCompleted ? "COMPLETED" : "IN_PROGRESS",
              responsibleUserId: professional.id,
              completedByUserId: performanceCompleted
                ? professional.id
                : null,
              completedAt: performanceCompleted ? now : null,
              updatedByUserId: professional.id,
              version: {
                increment: 1,
              },
            },
            create: {
              continuityId: continuity.id,
              moduleId: module.id,
              key: "PERFORMANCE",
              title: "Performance",
              status: performanceCompleted ? "COMPLETED" : "IN_PROGRESS",
              sortOrder: 9,
              responsibleUserId: professional.id,
              completedByUserId: performanceCompleted
                ? professional.id
                : undefined,
              completedAt: performanceCompleted ? now : undefined,
              createdByUserId: professional.id,
              updatedByUserId: professional.id,
            },
          }),

          transaction.masterRecordContinuity.update({
            where: {
              id: continuity.id,
            },
            data: {
              ...(performanceCompleted
                ? { lastCompletedStepKey: "PERFORMANCE" }
                : {}),
              lastActivityAt: now,
              nextSuggestedStepKey: performanceCompleted
                ? "DELIVERABLES"
                : "PERFORMANCE",
              suggestionSource: "WORKFLOW",
              responsibleUserId: professional.id,
              updatedByUserId: professional.id,
              version: {
                increment: 1,
              },
            },
          }),
        ]);
      }
    });
    return this.get(
      input.patientId,
      input.attendanceId,
      input.professionalUserId,
    );
  },
};
