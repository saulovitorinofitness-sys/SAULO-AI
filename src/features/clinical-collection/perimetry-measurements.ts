import { parseLocalizedDecimal } from "./anthropometry-calculations";
import type { PerimetryData } from "./contracts";
import { perimetryGroups } from "./field-definitions";

export type PerimetryMeasurementKey = Exclude<keyof PerimetryData, "notes">;
export type PerimetryMeasurementErrors = Partial<
  Record<PerimetryMeasurementKey, string>
>;

export const perimetryMeasurementFields = perimetryGroups.flatMap(
  (group) => group.fields,
);

function invalidMeasurementMessage(label: string) {
  return `${label} deve ser uma medida maior que zero.`;
}

export function parsePerimetryInputs(
  inputs: Partial<Record<PerimetryMeasurementKey, string>>,
) {
  const data: Partial<Record<PerimetryMeasurementKey, number>> = {};
  const errors: PerimetryMeasurementErrors = {};

  for (const field of perimetryMeasurementFields) {
    const key = field.key as PerimetryMeasurementKey;
    const rawValue = inputs[key]?.trim() ?? "";
    if (!rawValue) continue;

    const parsed = parseLocalizedDecimal(rawValue);
    if (parsed === undefined) {
      errors[key] = invalidMeasurementMessage(field.label);
    } else {
      data[key] = parsed;
    }
  }

  return { data: data as PerimetryData, errors };
}

export function validatePerimetryMeasurements(
  data: PerimetryData,
): PerimetryMeasurementErrors {
  const errors: PerimetryMeasurementErrors = {};

  for (const field of perimetryMeasurementFields) {
    const key = field.key as PerimetryMeasurementKey;
    const value = data[key];
    if (value === undefined) continue;

    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      errors[key] = invalidMeasurementMessage(field.label);
    }
  }

  return errors;
}
