import { prisma } from "@/lib/database/prisma";
import {
  calculateRatio,
  classifyAdultBmi,
} from "@/features/clinical-collection/assessment-summary";
import {
  nutritionEnergyService,
  resolveActivityFactor,
  type EnergyCalculationSex,
} from "@/lib/nutrition";

import type { NutritionClinicalPanelView } from "./clinical-panel-contracts";
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

function ageAt(date: Date) {
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const month = today.getUTCMonth() - date.getUTCMonth();
  if (
    month < 0 ||
    (month === 0 && today.getUTCDate() < date.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

const sexLabels = {
  FEMALE: "Feminino",
  MALE: "Masculino",
  INTERSEX: "Intersexo",
  NOT_INFORMED: "Não informado",
} as const;

export const nutritionClinicalPanelRepository = {
  async get(patientId: string): Promise<NutritionClinicalPanelView | null> {
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
            id: true,
            fullName: true,
            clinicalCode: true,
            birthDate: true,
            sex: true,
            profession: true,
          },
        },
        attendances: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
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
          },
        },
        entries: {
          where: {
            type: { in: ["ASSESSMENT", "NUTRITION_STRATEGY"] },
            deletedAt: null,
          },
          orderBy: { occurredAt: "asc" },
          select: {
            id: true,
            type: true,
            payload: true,
            occurredAt: true,
            physicalAssessment: {
              select: { observations: true, assessedAt: true },
            },
            perimetry: { select: { measurements: true } },
            bioimpedance: { select: { measurements: true } },
          },
        },
      },
    });

    const attendance = masterRecord?.attendances[0];
    if (!masterRecord || !attendance) return null;

    const assessmentEntries = masterRecord.entries.filter(
      (entry) => entry.type === "ASSESSMENT",
    );
    const assessment = assessmentEntries.at(-1);
    const anthropometry = objectValue(
      assessment?.physicalAssessment?.observations,
    );
    const perimetry = objectValue(assessment?.perimetry?.measurements);
    const bioimpedance = objectValue(
      assessment?.bioimpedance?.measurements,
    );
    const age = ageAt(masterRecord.patient.birthDate);
    const weightKg = positiveNumber(anthropometry.weightKg);
    const heightCm = positiveNumber(anthropometry.heightCm);
    const heightM = heightCm ? heightCm / 100 : undefined;
    const calculationSex: EnergyCalculationSex | undefined =
      masterRecord.patient.sex === "FEMALE" ||
      masterRecord.patient.sex === "MALE"
        ? masterRecord.patient.sex
        : undefined;
    const activityFactor = resolveActivityFactor(
      anthropometry.activityFactor ?? bioimpedance.activityFactor,
    );
    const energy = calculationSex
      ? nutritionEnergyService.calculateEnergyStrategy({
          sex: calculationSex,
          ageYears: age,
          weightKg,
          heightCm,
          leanMassKg: positiveNumber(bioimpedance.fatFreeMassKg),
          activityFactor,
        })
      : {};
    const basalMetabolicRateKcal =
      energy.basalMetabolicRate?.value ??
      positiveNumber(bioimpedance.basalMetabolicRateKcal);
    const totalEnergyExpenditureKcal =
      energy.totalEnergyExpenditure ??
      (basalMetabolicRateKcal && activityFactor
        ? nutritionEnergyService.calculateTotalEnergyExpenditure(
            basalMetabolicRateKcal,
            activityFactor,
          )
        : undefined) ??
      positiveNumber(bioimpedance.totalEnergyExpenditureKcal);
    const bmi =
      positiveNumber(anthropometry.bmi) ??
      positiveNumber(bioimpedance.bmi);
    const waistCm = positiveNumber(perimetry.waistCm);
    const hipCm = positiveNumber(perimetry.hipCm);
    const objectives = resolvePatientObjectives({
      clinicalObjectives:
        attendance.clinicalReasoningSession?.objectives ?? [],
      strategyEntries: masterRecord.entries.filter(
        (entry) => entry.type === "NUTRITION_STRATEGY",
      ),
    });
    const { primaryObjective, secondaryObjectives } = objectives;
    const positivePoints = [
      weightKg && heightM
        ? "Avaliação antropométrica disponível no Prontuário Mestre."
        : undefined,
      assessment?.bioimpedance
        ? "Registro de bioimpedância vinculado a esta avaliação."
        : undefined,
    ].filter((value): value is string => Boolean(value));
    const attentionPoints =
      attendance.clinicalReasoningSession?.alerts.map(
        (alert) => alert.message,
      ) ?? [];
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
    ].filter((value): value is string => Boolean(value));

    return {
      patientId: masterRecord.patient.id,
      masterRecordId: masterRecord.id,
      attendanceId: attendance.id,
      evaluationEntryId: assessment?.id,
      patient: {
        name: masterRecord.patient.fullName,
        code: masterRecord.patient.clinicalCode,
        age,
        sex: sexLabels[masterRecord.patient.sex],
        profession: masterRecord.patient.profession ?? undefined,
        primaryObjective,
        secondaryObjectives,
        evaluationDate:
          assessment?.physicalAssessment?.assessedAt.toISOString() ??
          assessment?.occurredAt.toISOString(),
        evaluationNumber: assessment
          ? assessmentEntries.indexOf(assessment) + 1
          : undefined,
      },
      nutritionalStatus: {
        weightKg,
        heightM,
        bmi,
        bmiClassification: classifyAdultBmi(bmi, age),
        waistHipRatio: calculateRatio(waistCm, hipCm),
        abdomenCm: positiveNumber(perimetry.abdomenCm),
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
            recordedTotalEnergyExpenditureKcal: positiveNumber(
              bioimpedance.totalEnergyExpenditureKcal,
            ),
          }
        : undefined,
      decisionSupport: {
        positivePoints,
        attentionPoints,
        pendingData,
      },
    };
  },
};
