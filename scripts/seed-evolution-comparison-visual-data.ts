import "dotenv/config";

import type {
  AnthropometryData,
  BioimpedanceAvanutriData,
  PerimetryData,
} from "../src/features/clinical-collection/contracts";
import { clinicalCollectionRepository } from "../src/features/clinical-collection/repository";
import { nutritionFollowUpService } from "../src/features/nutrition-follow-up/service";
import { prisma } from "../src/lib/database/prisma";
import type { Prisma } from "../src/generated/prisma/client";
import { BUILT_IN_IDS } from "../src/modules/permissions";

const dataLabel = "TESTE — dados simulados";
const dataKeyPrefix = "EVOLUTION_VISUAL_V1";
const targetClinicalCode =
  process.env.EVOLUTION_TEST_PATIENT_CODE?.trim() || "SV000006";

type Simulation = {
  date: string;
  weightKg: number;
  perimetry: Omit<PerimetryData, "notes">;
  bioimpedance: BioimpedanceAvanutriData;
};

const simulations: readonly Simulation[] = [
  {
    date: "2026-06-06",
    weightKg: 73.8,
    perimetry: {
      neckCm: 34.8, shouldersCm: 101.2, chestCm: 92.4,
      waistCm: 78.6, abdomenCm: 84.2, hipCm: 101.8,
      rightArmCm: 30.4, leftArmCm: 29.9,
      rightForearmCm: 25.1, leftForearmCm: 24.7,
      rightThighCm: 57.2, leftThighCm: 56.6,
      rightCalfCm: 36.8, leftCalfCm: 36.3,
    },
    bioimpedance: {
      weightKg: 73.8, bodyFatPercent: 28.4, fatMassKg: 21,
      fatFreeMassKg: 52.8, skeletalMuscleMassKg: 28.6,
      totalBodyWaterL: 38.2, intracellularWaterL: 23.5,
      extracellularWaterL: 14.7, visceralFatLevel: 8,
      basalMetabolicRateKcal: 1498, appendicularIndex: 7.2,
      metabolicAgeYears: 38, proteinKg: 10.4, mineralsKg: 3.2,
      leanRightArmKg: 2.75, leanLeftArmKg: 2.68, leanTrunkKg: 24.1,
      leanRightLegKg: 8.4, leanLeftLegKg: 8.25,
      fatRightArmKg: 1.65, fatLeftArmKg: 1.72, fatTrunkKg: 10.8,
      fatRightLegKg: 3.35, fatLeftLegKg: 3.48,
    },
  },
  {
    date: "2026-07-18",
    weightKg: 72.9,
    perimetry: {
      neckCm: 34.6, shouldersCm: 100.8, chestCm: 92,
      waistCm: 77.9, abdomenCm: 83.4, hipCm: 101.1,
      rightArmCm: 30.6, leftArmCm: 30.1,
      rightForearmCm: 25.2, leftForearmCm: 24.8,
      rightThighCm: 57, leftThighCm: 56.5,
      rightCalfCm: 36.9, leftCalfCm: 36.4,
    },
    bioimpedance: {
      weightKg: 72.9, bodyFatPercent: 27.8, fatMassKg: 20.3,
      fatFreeMassKg: 52.6, skeletalMuscleMassKg: 28.8,
      totalBodyWaterL: 38.4, intracellularWaterL: 23.7,
      extracellularWaterL: 14.7, visceralFatLevel: 8,
      basalMetabolicRateKcal: 1502, appendicularIndex: 7.25,
      metabolicAgeYears: 37, proteinKg: 10.5, mineralsKg: 3.2,
      leanRightArmKg: 2.78, leanLeftArmKg: 2.7, leanTrunkKg: 24.15,
      leanRightLegKg: 8.42, leanLeftLegKg: 8.28,
      fatRightArmKg: 1.58, fatLeftArmKg: 1.66, fatTrunkKg: 10.4,
      fatRightLegKg: 3.22, fatLeftLegKg: 3.36,
    },
  },
  {
    date: "2026-08-08",
    weightKg: 73.3,
    perimetry: {
      neckCm: 34.7, shouldersCm: 101, chestCm: 92.3,
      waistCm: 78.2, abdomenCm: 83.7, hipCm: 101.4,
      rightArmCm: 30.7, leftArmCm: 30.2,
      rightForearmCm: 25.3,
      rightThighCm: 57.3, leftThighCm: 56.7,
      rightCalfCm: 37, leftCalfCm: 36.5,
    },
    bioimpedance: {
      weightKg: 73.3, bodyFatPercent: 27.9, fatMassKg: 20.5,
      fatFreeMassKg: 52.8, skeletalMuscleMassKg: 29,
      totalBodyWaterL: 38.5, intracellularWaterL: 23.8,
      extracellularWaterL: 14.7, visceralFatLevel: 8,
      basalMetabolicRateKcal: 1508, appendicularIndex: 7.3,
      metabolicAgeYears: 37, proteinKg: 10.6, mineralsKg: 3.25,
      leanRightArmKg: 2.81, leanLeftArmKg: 2.73, leanTrunkKg: 24.2,
      leanRightLegKg: 8.46, leanLeftLegKg: 8.31,
      fatRightArmKg: 1.6, fatLeftArmKg: 1.68, fatTrunkKg: 10.5,
      fatRightLegKg: 3.25, fatLeftLegKg: 3.39,
    },
  },
  {
    date: "2026-09-26",
    weightKg: 71.8,
    perimetry: {
      neckCm: 34.4, shouldersCm: 100.5, chestCm: 91.8,
      waistCm: 76.8, abdomenCm: 82.1, hipCm: 100.3,
      rightArmCm: 30.8, leftArmCm: 30.3,
      rightForearmCm: 25.4, leftForearmCm: 24.9,
      rightThighCm: 56.8, leftThighCm: 56.2,
      rightCalfCm: 36.8, leftCalfCm: 36.3,
    },
    bioimpedance: {
      weightKg: 71.8, bodyFatPercent: 26.9, fatMassKg: 19.3,
      fatFreeMassKg: 52.5, skeletalMuscleMassKg: 29.1,
      totalBodyWaterL: 38.6, intracellularWaterL: 23.9,
      extracellularWaterL: 14.7, visceralFatLevel: 7,
      basalMetabolicRateKcal: 1510, appendicularIndex: 7.35,
      metabolicAgeYears: 36, proteinKg: 10.7, mineralsKg: 3.25,
      leanRightArmKg: 2.84, leanLeftArmKg: 2.76, leanTrunkKg: 24.18,
      leanRightLegKg: 8.48, leanLeftLegKg: 8.33,
      fatRightArmKg: 1.49, fatLeftArmKg: 1.57, fatTrunkKg: 9.9,
      fatRightLegKg: 3.05, fatLeftLegKg: 3.17,
    },
  },
];

async function main() {
  const patient = await prisma.patient.findFirst({
    where: {
      clinicalCode: targetClinicalCode,
      deletedAt: null,
      status: "ACTIVE",
      masterRecord: { isNot: null },
    },
    select: {
      id: true,
      fullName: true,
      clinicalCode: true,
      masterRecord: {
        select: {
          entries: {
            where: { deletedAt: null, type: "ASSESSMENT" },
            select: {
              id: true,
              occurredAt: true,
              payload: true,
              physicalAssessment: { select: { observations: true } },
              perimetry: { select: { measurements: true } },
              bioimpedance: { select: { measurements: true } },
            },
          },
        },
      },
    },
  });
  if (!patient?.masterRecord) {
    throw new Error(`Paciente ativo ${targetClinicalCode} com Prontuário Mestre não encontrado.`);
  }

  const asObject = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  const created: { id: string; date: string }[] = [];
  const preserved: { date: string }[] = [];
  const repairedMetadata: { id: string; date: string }[] = [];

  for (const [index, simulation] of simulations.entries()) {
    const dataKey = `${dataKeyPrefix}:${index + 1}`;
    const stored = patient.masterRecord.entries.find((entry) =>
      asObject(entry.payload).testDataKey === dataKey,
    );
    if (stored) {
      preserved.push({ date: simulation.date });
      continue;
    }
    const exactUnlabelled = patient.masterRecord.entries.find((entry) => {
      const anthropometry = asObject(entry.physicalAssessment?.observations);
      const perimetry = asObject(entry.perimetry?.measurements);
      const bioimpedance = asObject(entry.bioimpedance?.measurements);
      return entry.occurredAt.toISOString().slice(0, 10) === simulation.date
        && anthropometry.weightKg === simulation.weightKg
        && perimetry.waistCm === simulation.perimetry.waistCm
        && bioimpedance.bodyFatPercent === simulation.bioimpedance.bodyFatPercent;
    });
    const metadata = {
      testDataLabel: dataLabel,
      testDataKey: dataKey,
      testDataSet: dataKeyPrefix,
    };
    if (exactUnlabelled) {
      await prisma.masterRecordEntry.update({
        where: { id: exactUnlabelled.id },
        data: {
          payload: {
            ...asObject(exactUnlabelled.payload),
            ...metadata,
          } as Prisma.InputJsonValue,
        },
      });
      repairedMetadata.push({ id: exactUnlabelled.id, date: simulation.date });
      continue;
    }
    const anthropometry: AnthropometryData = {
      weightKg: simulation.weightKg,
      heightCm: 166,
      notes: dataLabel,
    };
    const result = await clinicalCollectionRepository.createHistoricalClinicalAssessment(
      {
        patientId: patient.id,
        assessmentDate: simulation.date,
        records: {
          anthropometry,
          perimetry: { ...simulation.perimetry, notes: dataLabel },
          bioimpedance: simulation.bioimpedance,
        },
      },
      BUILT_IN_IDS.users.sauloXavierVitorino,
    );
    const entry = await prisma.masterRecordEntry.findUniqueOrThrow({
      where: { id: result.assessment.id },
      select: { payload: true },
    });
    await prisma.masterRecordEntry.update({
      where: { id: result.assessment.id },
      data: {
        payload: {
          ...asObject(entry.payload),
          ...metadata,
        } as Prisma.InputJsonValue,
      },
    });
    created.push({ id: result.assessment.id, date: result.assessment.assessmentDate });
  }

  const reopened = await nutritionFollowUpService.get(patient.id);
  if (!reopened) throw new Error("Dashboard não pôde ser reaberto para o paciente selecionado.");
  const simulatedEvaluations = reopened.evaluations.filter(
    (evaluation) => evaluation.dataLabel === dataLabel,
  );
  if (simulatedEvaluations.length !== 4) {
    throw new Error(`Persistência incompleta: esperadas 4 avaliações simuladas, encontradas ${simulatedEvaluations.length}.`);
  }
  for (const simulation of simulations) {
    const evaluation = simulatedEvaluations.find((item) => item.date === simulation.date);
    if (!evaluation || evaluation.weightKg !== simulation.weightKg || !evaluation.bodyComposition) {
      throw new Error(`Reabertura divergente para a avaliação simulada de ${simulation.date}.`);
    }
  }
  const intentionalAbsence = simulatedEvaluations.find((evaluation) => evaluation.date === "2026-08-08");
  if (!intentionalAbsence || intentionalAbsence.perimetryMeasurements.leftForearmCm !== undefined) {
    throw new Error("A ausência simulada do antebraço esquerdo não foi preservada.");
  }
  const reopenedEvaluation = simulatedEvaluations.at(-1)!;
  console.log(JSON.stringify({
    patient: { id: patient.id, name: patient.fullName, clinicalCode: patient.clinicalCode },
    created,
    repairedMetadata,
    preservedWithoutDuplication: preserved,
    reopenedEvaluation: {
      id: reopenedEvaluation.id,
      date: reopenedEvaluation.date,
      status: reopenedEvaluation.status,
      weightKg: reopenedEvaluation.weightKg,
      perimetryFieldCount: Object.keys(reopenedEvaluation.perimetryMeasurements).length,
      hasBodyComposition: reopenedEvaluation.bodyComposition !== undefined,
    },
    dashboardEvaluationCount: reopened.evaluations.length,
    intentionalMissingMeasure: {
      date: "2026-08-08",
      field: "leftForearmCm",
      preservedAsMissing: true,
    },
    directPath: `/pacientes/${patient.id}/evolucao-avaliacoes`,
  }, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
