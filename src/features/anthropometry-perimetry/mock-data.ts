import type { ClinicalCollectionView, PerimetryData } from "@/features/clinical-collection";
import type { AnthropometryAssessment, AnthropometryScenarioKey, PerimetryMeasurement } from "./contracts";
import { perimetryMeasurementDefinitions } from "./definitions";

const extraCurrent: Partial<Record<string, number>> = { rightArmContracted: 35.1, leftArmContracted: 34.7, rightWrist: 17.2, leftWrist: 17.0, rightProximalThigh: 59.4, leftProximalThigh: 58.9 };
const previousValues: Partial<Record<string, number>> = { neck: 38.4, shoulders: 116.8, chest: 102.1, waist: 88.2, abdomen: 91.6, hipGlutes: 101.0, rightArmRelaxed: 33.1, leftArmRelaxed: 32.8, rightArmContracted: 34.6, leftArmContracted: 34.2, rightForearm: 28.0, leftForearm: 27.7, rightWrist: 17.1, leftWrist: 16.9, rightProximalThigh: 58.8, leftProximalThigh: 58.5, rightMedialThigh: 55.1, leftMedialThigh: 54.8, rightCalf: 38.0, leftCalf: 37.7 };

function sourceValue(data: PerimetryData, sourceField?: string) { return sourceField ? data[sourceField as keyof PerimetryData] as number | undefined : undefined; }

function currentMeasurements(collection: ClinicalCollectionView, scenario: AnthropometryScenarioKey): PerimetryMeasurement[] {
  const source = collection.records.perimetry;
  return perimetryMeasurementDefinitions.map((definition, index) => {
    const partialNotPerformed = scenario === "PARTIAL" && ["leftWrist", "leftProximalThigh"].includes(definition.key);
    const partialMissing = scenario === "PARTIAL" && index > 10 && !partialNotPerformed;
    const valueCm = partialMissing || partialNotPerformed ? undefined : sourceValue(source.data, definition.sourceField) ?? extraCurrent[definition.key];
    return {
      id: `measurement-current-${definition.key}`, key: definition.key, label: definition.label, region: definition.region, side: definition.side,
      valueCm, notPerformed: partialNotPerformed, reason: partialNotPerformed ? "Medida não realizada no cenário parcial demonstrativo." : undefined,
      notes: definition.key === "waist" ? "Ponto anatômico conferido no registro mockado." : undefined,
      origin: definition.sourceField && source.origin ? { masterRecordId: collection.masterRecordId, sourceRecordId: source.origin.entryId, sourceField: definition.sourceField, sourceLabel: source.origin.label } : undefined,
    };
  });
}

function previousMeasurements(): PerimetryMeasurement[] {
  return perimetryMeasurementDefinitions.map((definition) => ({ id: `measurement-previous-${definition.key}`, key: definition.key, label: definition.label, region: definition.region, side: definition.side, valueCm: previousValues[definition.key], notPerformed: false }));
}

export function buildAnthropometryMockAssessments(collection: ClinicalCollectionView, scenario: AnthropometryScenarioKey): readonly AnthropometryAssessment[] {
  const basic = collection.records.anthropometry;
  const origin = basic.origin ? { masterRecordId: collection.masterRecordId, sourceRecordId: basic.origin.entryId, sourceField: "anthropometry", sourceLabel: basic.origin.label } : undefined;
  const current: AnthropometryAssessment = {
    id: "anthropometry-assessment-current", patientId: collection.patientId, masterRecordId: collection.masterRecordId,
    type: scenario === "REASSESSMENT" ? "REASSESSMENT" : "INITIAL", status: scenario === "PARTIAL" ? "IN_PROGRESS" : scenario === "REASSESSMENT" ? "REVIEWED" : "COMPLETED",
    assessmentDate: "2026-07-16", professionalId: collection.connectedProfessional.professionalUserId, professionalName: collection.connectedProfessional.professionalName,
    basicMeasurementsOrigin: origin, weightKg: basic.data.weightKg, heightCm: basic.data.heightCm, bmi: basic.data.bmi,
    measurements: currentMeasurements(collection, scenario), professionalNotes: scenario === "PARTIAL" ? "Coleta parcial; medidas não realizadas possuem justificativa." : "Condições, roupa e pontos anatômicos registrados no cenário demonstrativo.",
    createdAt: "2026-07-16T09:30:00-03:00", updatedAt: "2026-07-16T10:18:00-03:00", version: scenario === "REASSESSMENT" ? 3 : 2,
  };
  const previous: AnthropometryAssessment = {
    ...current, id: "anthropometry-assessment-previous", type: "INITIAL", status: "REVIEWED", assessmentDate: "2026-03-12",
    professionalId: "00000000-0000-4000-8000-000000000001", professionalName: "Saulo Xavier Vitorino", weightKg: 84.1, heightCm: basic.data.heightCm, bmi: 26.5,
    measurements: previousMeasurements(), professionalNotes: "Avaliação anterior preservada para comparação numérica.", createdAt: "2026-03-12T08:30:00-03:00", updatedAt: "2026-03-12T09:10:00-03:00", version: 1,
  };
  return [current, previous];
}
