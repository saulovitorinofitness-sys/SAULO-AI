import { validateAnthropometryMeasurements } from "./anthropometry-calculations";
import { validateBioimpedanceMeasurements } from "./bioimpedance-measurements";
import {
  bioimpedanceGroups,
  perimetryGroups,
} from "./field-definitions";
import { validatePerimetryMeasurements } from "./perimetry-measurements";
import { validatePosturalAssessmentData } from "./postural-validation";
import type {
  AnthropometryData,
  BioimpedanceAvanutriData,
  EditableClinicalData,
  EditableClinicalStepKey,
  PerimetryData,
  PosturalAssessmentData,
} from "./contracts";

export interface StoredClinicalStepDraft {
  readonly schemaVersion: 1;
  readonly step: EditableClinicalStepKey;
  readonly savedAt: string;
  readonly data: EditableClinicalData;
}

const numericFieldsByStep = {
  ANTHROPOMETRY: ["weightKg", "heightCm", "bmi"],
  BIOIMPEDANCE: bioimpedanceGroups.flatMap((group) =>
    group.fields.map((field) => String(field.key)),
  ),
  PERIMETRY: perimetryGroups.flatMap((group) =>
    group.fields.map((field) => String(field.key)),
  ),
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validNumericDraft(
  value: Record<string, unknown>,
  fields: readonly string[],
  allowNotes: boolean,
) {
  const allowed = new Set([...fields, ...(allowNotes ? ["notes"] : [])]);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    fields.every((key) =>
      value[key] === undefined ||
      (typeof value[key] === "number" &&
        Number.isFinite(value[key]) &&
        value[key] >= 0),
    ) &&
    (!allowNotes ||
      value.notes === undefined ||
      (typeof value.notes === "string" && value.notes.length <= 4_000))
  );
}

function validStepData(
  step: EditableClinicalStepKey,
  data: Record<string, unknown>,
) {
  if (step === "ANTHROPOMETRY") {
    return (
      validNumericDraft(data, numericFieldsByStep.ANTHROPOMETRY, true) &&
      Object.keys(
        validateAnthropometryMeasurements(data as AnthropometryData),
      ).length === 0
    );
  }
  if (step === "PERIMETRY") {
    return (
      validNumericDraft(data, numericFieldsByStep.PERIMETRY, true) &&
      Object.keys(validatePerimetryMeasurements(data as PerimetryData)).length ===
        0
    );
  }
  if (step === "BIOIMPEDANCE") {
    return (
      validNumericDraft(data, numericFieldsByStep.BIOIMPEDANCE, false) &&
      Object.keys(
        validateBioimpedanceMeasurements(data as BioimpedanceAvanutriData),
      ).length === 0
    );
  }
  return validatePosturalAssessmentData(
    data as unknown as PosturalAssessmentData,
  ).valid;
}

export function clinicalStepDraftStorageKey(
  patientId: string,
  attendanceId: string,
  step: EditableClinicalStepKey,
) {
  return `saulo-ai:clinical-collection-draft:v1:${encodeURIComponent(patientId)}:${encodeURIComponent(attendanceId)}:${step}`;
}

export function serializeClinicalStepDraft(
  step: EditableClinicalStepKey,
  data: EditableClinicalData,
) {
  return JSON.stringify({
    schemaVersion: 1,
    step,
    savedAt: new Date().toISOString(),
    data,
  } satisfies StoredClinicalStepDraft);
}

export function parseClinicalStepDraft(
  raw: string,
  expectedStep: EditableClinicalStepKey,
): StoredClinicalStepDraft | null {
  if (!raw || raw.length > 4_000_000) return null;
  try {
    const candidate: unknown = JSON.parse(raw);
    if (!isObject(candidate) || !isObject(candidate.data)) return null;
    if (
      candidate.schemaVersion !== 1 ||
      candidate.step !== expectedStep ||
      typeof candidate.savedAt !== "string" ||
      Number.isNaN(Date.parse(candidate.savedAt)) ||
      !validStepData(expectedStep, candidate.data)
    ) {
      return null;
    }
    return candidate as unknown as StoredClinicalStepDraft;
  } catch {
    return null;
  }
}
