export function parseLocalizedDecimal(value: string): number | undefined {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function normalizeHeightMeters(value: string): number | undefined {
  const parsed = parseLocalizedDecimal(value);
  if (parsed === undefined) return undefined;

  const meters = parsed >= 10 ? parsed / 100 : parsed;
  return Number.isFinite(meters) && meters > 0 ? meters : undefined;
}

export function heightMetersToCentimeters(
  heightMeters: number | undefined,
): number | undefined {
  if (heightMeters === undefined || heightMeters <= 0) return undefined;
  return Number((heightMeters * 100).toFixed(10));
}

export function calculateBmi(
  weightKg: number | undefined,
  heightMeters: number | undefined,
): number | undefined {
  if (
    weightKg === undefined ||
    heightMeters === undefined ||
    weightKg <= 0 ||
    heightMeters <= 0
  ) {
    return undefined;
  }

  const bmi = weightKg / heightMeters ** 2;
  if (!Number.isFinite(bmi)) return undefined;

  return Math.round((bmi + Number.EPSILON) * 100) / 100;
}

export type AnthropometryMeasurementErrors = Partial<
  Record<"weightKg" | "heightCm", string>
>;

export function validateAnthropometryMeasurements(input: {
  weightKg?: number;
  heightCm?: number;
}): AnthropometryMeasurementErrors {
  const errors: AnthropometryMeasurementErrors = {};

  if (input.weightKg === undefined) {
    errors.weightKg = "Informe o peso.";
  } else if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    errors.weightKg = "O peso deve ser um número maior que zero.";
  }

  if (input.heightCm === undefined) {
    errors.heightCm = "Informe a altura.";
  } else if (!Number.isFinite(input.heightCm) || input.heightCm <= 0) {
    errors.heightCm = "A altura deve ser um número maior que zero.";
  }

  return errors;
}

export function formatLocalizedNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "";

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 10,
    useGrouping: false,
  }).format(value);
}

export function formatHeightFromCentimeters(
  heightCm: number | undefined,
) {
  if (heightCm === undefined || !Number.isFinite(heightCm) || heightCm <= 0) {
    return "";
  }

  return formatLocalizedNumber(heightCm / 100);
}

export function formatBmi(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "";
  return value.toFixed(2).replace(".", ",");
}
