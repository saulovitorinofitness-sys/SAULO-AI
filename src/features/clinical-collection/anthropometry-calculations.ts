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
  return Math.round(heightMeters * 10_000) / 100;
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

export function formatLocalizedNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "";

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

export function formatHeightFromCentimeters(
  heightCm: number | undefined,
) {
  if (heightCm === undefined || !Number.isFinite(heightCm) || heightCm <= 0) {
    return "";
  }

  return (heightCm / 100).toFixed(2).replace(".", ",");
}

export function formatBmi(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "";
  return value.toFixed(2).replace(".", ",");
}
