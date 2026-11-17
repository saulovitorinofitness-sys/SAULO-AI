import { parseLocalizedDecimal } from "./anthropometry-calculations";
import type { BioimpedanceAvanutriData } from "./contracts";
import { bioimpedanceGroups } from "./field-definitions";

export type BioimpedanceMeasurementKey = keyof BioimpedanceAvanutriData;
export type BioimpedanceEditableKey = Exclude<
  BioimpedanceMeasurementKey,
  "weightKg" | "bmi"
>;
export type BioimpedanceMeasurementErrors = Partial<
  Record<BioimpedanceMeasurementKey, string>
>;

export const bioimpedanceMeasurementFields = bioimpedanceGroups.flatMap(
  (group) => group.fields,
);
export const bioimpedanceEditableFields = bioimpedanceMeasurementFields.filter(
  (field) => field.key !== "weightKg" && field.key !== "bmi",
);

function positiveMeasurementMessage(label: string) {
  return `${label} deve ser um número maior que zero.`;
}

export function parseBioimpedanceInputs(
  inputs: Partial<Record<BioimpedanceEditableKey, string>>,
) {
  const data: Partial<Record<BioimpedanceEditableKey, number>> = {};
  const errors: BioimpedanceMeasurementErrors = {};

  for (const field of bioimpedanceEditableFields) {
    const key = field.key as BioimpedanceEditableKey;
    const rawValue = inputs[key]?.trim() ?? "";
    if (!rawValue) continue;

    const parsed = parseLocalizedDecimal(rawValue);
    if (parsed === undefined) {
      errors[key] = positiveMeasurementMessage(field.label);
    } else if (key === "metabolicAgeYears" && !Number.isInteger(parsed)) {
      errors[key] = "Idade metabólica deve ser informada em anos inteiros.";
    } else if (key === "bodyFatPercent" && parsed > 100) {
      errors[key] = "Percentual de gordura deve ser menor ou igual a 100%.";
    } else {
      data[key] = parsed;
    }
  }

  return { data: data as BioimpedanceAvanutriData, errors };
}

export function validateBioimpedanceMeasurements(
  data: BioimpedanceAvanutriData,
): BioimpedanceMeasurementErrors {
  const errors: BioimpedanceMeasurementErrors = {};

  for (const field of bioimpedanceMeasurementFields) {
    const key = field.key as BioimpedanceMeasurementKey;
    const value = data[key];
    if (value === undefined) continue;

    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      errors[key] = positiveMeasurementMessage(field.label);
    } else if (key === "metabolicAgeYears" && !Number.isInteger(value)) {
      errors[key] = "Idade metabólica deve ser informada em anos inteiros.";
    } else if (key === "bodyFatPercent" && value > 100) {
      errors[key] = "Percentual de gordura deve ser menor ou igual a 100%.";
    }
  }

  return errors;
}
