import { prisma } from "@/lib/database/prisma";
import {
  assessmentConditionLabels,
  assessmentObjectiveLabel,
  assessmentSummaryIntegrityIssues,
  calculateRatio,
  classifyAdultBmi,
} from "@/features/clinical-collection/assessment-summary";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { safeClinicalTexts } from "@/features/clinical-collection/clinical-text-safety";
import {
  resolveEffectiveFoodAllergyState,
  returnFoodSafetyRepository,
} from "@/features/nutrition-return-anamnesis/food-safety-update";
import { nutritionDiagnosisReviewRepository } from "@/features/nutrition-diagnosis-review/repository";
import {
  nutritionEnergyService,
  resolveActivityFactor,
  type EnergyCalculationSex,
} from "@/lib/nutrition";

import type {
  NutritionClinicalPanelPerimetryMeasurement,
  NutritionClinicalPanelView,
} from "./clinical-panel-contracts";
import { resolvePatientObjectives } from "./patient-objectives";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function compactText(values: readonly (string | undefined)[]) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}


function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function perimetryMeasurement(
  source: Record<string, unknown>,
  input: {
    key: string;
    label: string;
    region: "TRUNK" | "UPPER_LIMBS" | "LOWER_LIMBS";
    side?: "RIGHT" | "LEFT";
    valueFields: readonly string[];
    notPerformedFields?: readonly string[];
    reasonFields?: readonly string[];
    notesFields?: readonly string[];
  },
): NutritionClinicalPanelPerimetryMeasurement | undefined {
  const valueCm = input.valueFields
    .map((field) => positiveNumber(source[field]))
    .find((value) => value != null);

  const notPerformed = (input.notPerformedFields ?? [])
    .map((field) => booleanValue(source[field]))
    .find((value) => value != null);

  const reason = (input.reasonFields ?? [])
    .map((field) => textValue(source[field]))
    .find(Boolean);

  const notes = (input.notesFields ?? [])
    .map((field) => textValue(source[field]))
    .find(Boolean);

  if (valueCm == null && !notPerformed && !reason && !notes) return undefined;

  return {
    key: input.key,
    label: input.label,
    region: input.region,
    side: input.side,
    valueCm,
    notPerformed: notPerformed ?? false,
    reason,
    notes,
  };
}

function perimetryMeasurements(
  source: Record<string, unknown>,
): readonly NutritionClinicalPanelPerimetryMeasurement[] {
  const storedMeasurements = Array.isArray(source.measurements)
    ? source.measurements
        .map((item) => objectValue(item))
        .map((item) => ({
          key: textValue(item.key),
          label: textValue(item.label),
          region: textValue(item.region),
          side: textValue(item.side),
          valueCm: positiveNumber(item.valueCm),
          notPerformed: booleanValue(item.notPerformed) ?? false,
          reason: textValue(item.reason),
          notes: textValue(item.notes),
        }))
        .filter(
          (item) =>
            item.key &&
            item.label &&
            (item.region === "TRUNK" ||
              item.region === "UPPER_LIMBS" ||
              item.region === "LOWER_LIMBS"),
        )
        .map((item): NutritionClinicalPanelPerimetryMeasurement => ({
          key: item.key!,
          label: item.label!,
          region: item.region as "TRUNK" | "UPPER_LIMBS" | "LOWER_LIMBS",
          side:
            item.side === "RIGHT" || item.side === "LEFT"
              ? item.side
              : undefined,
          valueCm: item.valueCm,
          notPerformed: item.notPerformed,
          reason: item.reason,
          notes: item.notes,
        }))
    : [];

  if (storedMeasurements.length) return storedMeasurements;

  return [
    perimetryMeasurement(source, {
      key: "neck",
      label: "Pescoço",
      region: "TRUNK",
      valueFields: ["neckCm", "neck"],
    }),
    perimetryMeasurement(source, {
      key: "shoulders",
      label: "Ombros",
      region: "TRUNK",
      valueFields: ["shouldersCm", "shoulders"],
    }),
    perimetryMeasurement(source, {
      key: "chest",
      label: "Tórax",
      region: "TRUNK",
      valueFields: ["chestCm", "chest"],
    }),
    perimetryMeasurement(source, {
      key: "waist",
      label: "Cintura",
      region: "TRUNK",
      valueFields: ["waistCm", "waist"],
    }),
    perimetryMeasurement(source, {
      key: "abdomen",
      label: "Abdômen",
      region: "TRUNK",
      valueFields: ["abdomenCm", "abdomen"],
    }),
    perimetryMeasurement(source, {
      key: "hipGlutes",
      label: "Quadril / Glúteos",
      region: "TRUNK",
      valueFields: ["hipCm", "hipGlutesCm", "hipGlutes", "hip"],
    }),
    perimetryMeasurement(source, {
      key: "rightArmRelaxed",
      label: "Braço direito relaxado",
      region: "UPPER_LIMBS",
      side: "RIGHT",
      valueFields: ["rightArmRelaxedCm", "rightArmRelaxed"],
    }),
    perimetryMeasurement(source, {
      key: "leftArmRelaxed",
      label: "Braço esquerdo relaxado",
      region: "UPPER_LIMBS",
      side: "LEFT",
      valueFields: ["leftArmRelaxedCm", "leftArmRelaxed"],
    }),
    perimetryMeasurement(source, {
      key: "rightArmContracted",
      label: "Braço direito contraído",
      region: "UPPER_LIMBS",
      side: "RIGHT",
      valueFields: ["rightArmContractedCm", "rightArmContracted"],
    }),
    perimetryMeasurement(source, {
      key: "leftArmContracted",
      label: "Braço esquerdo contraído",
      region: "UPPER_LIMBS",
      side: "LEFT",
      valueFields: ["leftArmContractedCm", "leftArmContracted"],
    }),
    perimetryMeasurement(source, {
      key: "rightForearm",
      label: "Antebraço direito",
      region: "UPPER_LIMBS",
      side: "RIGHT",
      valueFields: ["rightForearmCm", "rightForearm"],
    }),
    perimetryMeasurement(source, {
      key: "leftForearm",
      label: "Antebraço esquerdo",
      region: "UPPER_LIMBS",
      side: "LEFT",
      valueFields: ["leftForearmCm", "leftForearm"],
    }),
    perimetryMeasurement(source, {
      key: "rightWrist",
      label: "Punho direito",
      region: "UPPER_LIMBS",
      side: "RIGHT",
      valueFields: ["rightWristCm", "rightWrist"],
    }),
    perimetryMeasurement(source, {
      key: "leftWrist",
      label: "Punho esquerdo",
      region: "UPPER_LIMBS",
      side: "LEFT",
      valueFields: ["leftWristCm", "leftWrist"],
    }),
    perimetryMeasurement(source, {
      key: "rightProximalThigh",
      label: "Coxa proximal direita",
      region: "LOWER_LIMBS",
      side: "RIGHT",
      valueFields: ["rightProximalThighCm", "rightProximalThigh"],
    }),
    perimetryMeasurement(source, {
      key: "leftProximalThigh",
      label: "Coxa proximal esquerda",
      region: "LOWER_LIMBS",
      side: "LEFT",
      valueFields: ["leftProximalThighCm", "leftProximalThigh"],
    }),
    perimetryMeasurement(source, {
      key: "rightMedialThigh",
      label: "Coxa medial direita",
      region: "LOWER_LIMBS",
      side: "RIGHT",
      valueFields: ["rightMedialThighCm", "rightMedialThigh"],
    }),
    perimetryMeasurement(source, {
      key: "leftMedialThigh",
      label: "Coxa medial esquerda",
      region: "LOWER_LIMBS",
      side: "LEFT",
      valueFields: ["leftMedialThighCm", "leftMedialThigh"],
    }),
    perimetryMeasurement(source, {
      key: "rightCalf",
      label: "Panturrilha direita",
      region: "LOWER_LIMBS",
      side: "RIGHT",
      valueFields: ["rightCalfCm", "rightCalf"],
    }),
    perimetryMeasurement(source, {
      key: "leftCalf",
      label: "Panturrilha esquerda",
      region: "LOWER_LIMBS",
      side: "LEFT",
      valueFields: ["leftCalfCm", "leftCalf"],
    }),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
}

const sexLabels = {
  FEMALE: "Feminino",
  MALE: "Masculino",
  INTERSEX: "Intersexo",
  NOT_INFORMED: "Não informado",
} as const;

export const nutritionClinicalPanelRepository = {
  async get(
    patientId: string,
    attendanceId?: string,
  ): Promise<NutritionClinicalPanelView | null> {
    const collection = attendanceId
      ? await clinicalCollectionRepository.getCollection(patientId, attendanceId)
      : await clinicalCollectionRepository.getLatestCollection(patientId);
    if (!collection) return null;

    const [attendance, foodSafetyUpdate, diagnosisReview] = await Promise.all([
      prisma.attendance.findFirst({
        where: {
          id: collection.attendanceId,
          deletedAt: null,
          masterRecord: {
            id: collection.masterRecordId,
            patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
        },
        select: {
          id: true,
          clinicalReasoningSession: {
            select: {
              objectives: {
                where: { status: { not: "CANCELLED" } },
                orderBy: [{ type: "asc" }, { sequence: "asc" }],
                select: { type: true, title: true },
              },
              alerts: {
                where: { status: "ACTIVE" },
                orderBy: { raisedAt: "desc" },
                select: { message: true },
              },
            },
          },
          masterRecord: {
            select: {
              entries: {
                where: {
                  type: { in: ["ASSESSMENT", "NUTRITION_STRATEGY"] },
                  attendanceId: collection.attendanceId,
                  deletedAt: null,
                },
                orderBy: { occurredAt: "asc" },
                select: {
                  id: true,
                  type: true,
                  payload: true,
                  occurredAt: true,
                  physicalAssessment: {
                    select: { assessedAt: true },
                  },
                },
              },
            },
          },
        },
      }),
      returnFoodSafetyRepository.get(patientId, collection.attendanceId),
      nutritionDiagnosisReviewRepository.get(
        patientId,
        collection.attendanceId,
      ),
    ]);

    if (!attendance) return null;

    const assessmentEntries = attendance.masterRecord.entries.filter(
      (entry) => entry.type === "ASSESSMENT",
    );
    const evaluationEntryId =
      collection.records.anthropometry.origin?.entryId ??
      collection.records.perimetry.origin?.entryId ??
      collection.records.bioimpedance.origin?.entryId;
    const assessment = assessmentEntries.find(
      (entry) => entry.id === evaluationEntryId,
    );
    const anthropometry = objectValue(
      collection.records.anthropometry.data,
    );
    const perimetry = objectValue(collection.records.perimetry.data);
    const bioimpedance = objectValue(
      collection.records.bioimpedance.data,
    );
    const age = collection.patientAge;
    const weightKg = positiveNumber(anthropometry.weightKg);
    const heightCm = positiveNumber(anthropometry.heightCm);
    const heightM = heightCm ? heightCm / 100 : undefined;
    const calculationSex: EnergyCalculationSex | undefined =
      collection.patientSex === "FEMALE" ||
      collection.patientSex === "MALE"
        ? collection.patientSex
        : undefined;
    const activityFactor = resolveActivityFactor(
      anthropometry.activityFactor ?? bioimpedance.activityFactor,
    );
    const recordedBasalMetabolicRateKcal = positiveNumber(
      bioimpedance.basalMetabolicRateKcal,
    );
    const recordedTotalEnergyExpenditureKcal = positiveNumber(
      bioimpedance.totalEnergyExpenditureKcal,
    );
    const basalMetabolicRateKcal = recordedBasalMetabolicRateKcal;
    const totalEnergyExpenditureKcal =
      recordedTotalEnergyExpenditureKcal ??
      (basalMetabolicRateKcal && activityFactor
        ? nutritionEnergyService.calculateTotalEnergyExpenditure(
            basalMetabolicRateKcal,
            activityFactor,
          )
        : undefined);
    const bmi =
      positiveNumber(anthropometry.bmi) ??
      positiveNumber(bioimpedance.bmi);
    const measurements = perimetryMeasurements(perimetry);
    const waistCm =
      positiveNumber(perimetry.waistCm) ??
      measurements.find((item) => item.key === "waist")?.valueCm;
    const hipCm =
      positiveNumber(perimetry.hipCm) ??
      positiveNumber(perimetry.hipGlutesCm) ??
      measurements.find((item) => item.key === "hipGlutes")?.valueCm;
    const anamnesis = collection.anamnesis?.data;
    const anamnesisPrimaryObjective = anamnesis
      ? assessmentObjectiveLabel(anamnesis.primaryObjective)
      : undefined;
    const objectives = resolvePatientObjectives({
      clinicalObjectives: [
        ...(attendance.clinicalReasoningSession?.objectives ?? []),
        ...(anamnesisPrimaryObjective &&
        anamnesisPrimaryObjective !== "Não informado"
          ? [{ type: "PRIMARY" as const, title: anamnesisPrimaryObjective }]
          : []),
        ...(anamnesis?.secondaryObjectives.map((objective) => ({
          type: "SECONDARY" as const,
          title: assessmentObjectiveLabel(objective),
        })) ?? []),
      ],
      strategyEntries: attendance.masterRecord.entries.filter(
        (entry) => entry.type === "NUTRITION_STRATEGY",
      ),
    });
    const primaryObjective = objectives.primaryObjective;
    const secondaryObjectives = [...new Set(objectives.secondaryObjectives)];
    const currentAttendanceDiagnoses =
      collection.anamnesis?.attendanceId === collection.attendanceId
        ? assessmentConditionLabels(collection)
        : [];
    const diagnoses = safeClinicalTexts(
      diagnosisReview?.diagnoses ?? currentAttendanceDiagnoses,
    );
    const baselineAllergies = safeClinicalTexts(anamnesis?.allergies ?? []);
    const effectiveAllergyState = resolveEffectiveFoodAllergyState({
      attendanceId: collection.attendanceId,
      baselineStatus:
        anamnesis?.allergyStatus ??
        (baselineAllergies.length ? "CONFIRMED" : "NOT_INFORMED"),
      baselineAllergies,
      update: foodSafetyUpdate,
    });
    const allergies = safeClinicalTexts(effectiveAllergyState.allergies);
    const allergyStatus = effectiveAllergyState.status;
    const restrictions = safeClinicalTexts([anamnesis?.nutrition.restrictions]);
    const foodPreferences = safeClinicalTexts([anamnesis?.nutrition.preferences]);
    const medications = safeClinicalTexts(
      anamnesis?.medications
        .map((item) =>
          compactText([
            item.name,
            item.dose,
            item.frequency,
            item.reason,
          ]).join(" · "),
        )
        .filter(Boolean) ?? [],
    );
    const supplements = safeClinicalTexts(
      anamnesis?.supplements
        .map((item) =>
          compactText([item.name, item.dose, item.frequency]).join(" · "),
        )
        .filter(Boolean) ?? [],
    );
    const injuriesAndLimitations = safeClinicalTexts([
      ...(anamnesis?.injuries
        .map((item) =>
          compactText([item.region, item.situation, item.notes]).join(" · "),
        )
        .filter(Boolean) ?? []),
      ...compactText([
        collection.records.posturalAssessment.data.functionalLimitationsNotes,
        collection.records.posturalAssessment.data.identifiedChangesNotes,
      ]),
    ]);
    const positivePoints = [
      weightKg && heightM
        ? "Avaliação antropométrica disponível no Prontuário Mestre."
        : undefined,
      collection.records.bioimpedance.origin
        ? "Registro de bioimpedância vinculado a esta avaliação."
        : undefined,
    ].filter((value): value is string => Boolean(value));
    const attentionPoints = safeClinicalTexts([
      ...(attendance.clinicalReasoningSession?.alerts.map(
        (alert) => alert.message,
      ) ?? []),
      ...assessmentSummaryIntegrityIssues(collection),
    ]);
    const pendingData = [
      primaryObjective ? undefined : "Objetivo principal",
      weightKg ? undefined : "Peso",
      heightM ? undefined : "Altura",
      bmi ? undefined : "IMC",
      waistCm && hipCm ? undefined : "Relação cintura/quadril",
      positiveNumber(perimetry.abdomenCm)
        ? undefined
        : "Circunferência abdominal",
      positiveNumber(bioimpedance.skeletalMuscleMassKg)
        ? undefined
        : "Massa muscular",
      positiveNumber(bioimpedance.fatMassKg)
        ? undefined
        : "Massa gorda",
      positiveNumber(bioimpedance.bodyFatPercent)
        ? undefined
        : "Percentual de gordura",
      positiveNumber(bioimpedance.totalBodyWaterL)
        ? undefined
        : "Água corporal",
      basalMetabolicRateKcal
        ? undefined
        : "Taxa metabólica basal",
      totalEnergyExpenditureKcal ? undefined : "Gasto energético total",
      "Exames laboratoriais reais não registrados neste atendimento",
    ].filter((value): value is string => Boolean(value));

    return {
      patientId: collection.patientId,
      masterRecordId: collection.masterRecordId,
      attendanceId: attendance.id,
      attendanceStartedAt: collection.attendanceStartedAt,
      evaluationEntryId: assessment?.id,
      responsibleProfessional:
        collection.connectedProfessional.professionalName,
      patient: {
        name: collection.patientName,
        code: collection.patientCode,
        age,
        sex: collection.patientSex
          ? sexLabels[collection.patientSex]
          : "Não informado",
        profession: collection.patientProfession,
        primaryObjective,
        secondaryObjectives,
        evaluationDate:
          assessment?.physicalAssessment?.assessedAt.toISOString() ??
          assessment?.occurredAt.toISOString(),
        evaluationNumber: assessment
          ? assessmentEntries.indexOf(assessment) + 1
          : undefined,
      },
      anthropometry: {
        weightKg,
        heightCm,
        bmi,
        bmiClassification: classifyAdultBmi(bmi, age),
        assessmentDate:
          assessment?.physicalAssessment?.assessedAt.toISOString() ??
          assessment?.occurredAt.toISOString(),
      },
      perimetry: {
        measurements,
        waistCm,
        abdomenCm:
          positiveNumber(perimetry.abdomenCm) ??
          measurements.find((item) => item.key === "abdomen")?.valueCm,
        hipCm,
        waistHipRatio: calculateRatio(waistCm, hipCm),
      },
      bioimpedance: {
        skeletalMuscleMassKg: positiveNumber(
          bioimpedance.skeletalMuscleMassKg,
        ),
        fatMassKg: positiveNumber(bioimpedance.fatMassKg),
        fatFreeMassKg: positiveNumber(bioimpedance.fatFreeMassKg),
        bodyFatPercent: positiveNumber(bioimpedance.bodyFatPercent),
        totalBodyWaterL: positiveNumber(bioimpedance.totalBodyWaterL),
        visceralFatLevel: positiveNumber(
          bioimpedance.visceralFatLevel ??
            bioimpedance.visceralFatRating ??
            bioimpedance.visceralFat,
        ),
        basalMetabolicRateKcal,
        totalEnergyExpenditureKcal,
        metabolicAgeYears: positiveNumber(
          bioimpedance.metabolicAgeYears ?? bioimpedance.metabolicAge,
        ),
        phaseAngleDegrees: positiveNumber(
          bioimpedance.phaseAngleDegrees ?? bioimpedance.phaseAngle,
        ),
      },
      nutritionalStatus: {
        weightKg,
        heightM,
        bmi,
        bmiClassification: classifyAdultBmi(bmi, age),
        waistHipRatio: calculateRatio(waistCm, hipCm),
        abdomenCm:
          positiveNumber(perimetry.abdomenCm) ??
          measurements.find((item) => item.key === "abdomen")?.valueCm,
      },
      bodyComposition: {
        muscleMassKg: positiveNumber(
          bioimpedance.skeletalMuscleMassKg,
        ),
        fatMassKg: positiveNumber(bioimpedance.fatMassKg),
        bodyFatPercent: positiveNumber(bioimpedance.bodyFatPercent),
        bodyWaterL: positiveNumber(bioimpedance.totalBodyWaterL),
        basalMetabolicRateKcal,
        totalEnergyExpenditureKcal,
      },
      energyDecision: calculationSex
        ? {
            sex: calculationSex,
            ageYears: age,
            weightKg,
            heightCm,
            leanMassKg: positiveNumber(bioimpedance.fatFreeMassKg),
            activityFactor,
            recordedBasalMetabolicRateKcal,
            recordedTotalEnergyExpenditureKcal: positiveNumber(
              bioimpedance.totalEnergyExpenditureKcal,
            ),
          }
        : undefined,
      inheritedClinicalContext: {
        diagnoses,
        diagnosisReview: diagnosisReview
          ? {
              outcome: diagnosisReview.outcome,
              reviewedAt: diagnosisReview.reviewedAt,
              responsibleName: diagnosisReview.responsibleName,
              revision: diagnosisReview.revision,
            }
          : undefined,
        allergyStatus,
        allergies,
        restrictions,
        foodPreferences,
        medications,
        supplements,
        injuriesAndLimitations,
        laboratoryExams: [],
      },
      decisionSupport: {
        positivePoints,
        attentionPoints,
        pendingData,
      },
    };
  },
};
