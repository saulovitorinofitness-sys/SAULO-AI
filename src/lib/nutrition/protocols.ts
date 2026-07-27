export const ENERGY_PROTOCOLS = {
  HARRIS_BENEDICT: "Harris-Benedict",
  MIFFLIN_ST_JEOR: "Mifflin-St Jeor",
  FAO_WHO: "FAO/OMS",
  IOM: "IOM",
  OWEN: "Owen",
  KATCH_MCARDLE: "Katch-McArdle",
  CUNNINGHAM: "Cunningham",
  CUSTOM: "Equação personalizada",
} as const;

export type EnergyProtocol = keyof typeof ENERGY_PROTOCOLS;
export type EnergyProtocolName = (typeof ENERGY_PROTOCOLS)[EnergyProtocol];
export type EnergyCalculationSex = "FEMALE" | "MALE";

/**
 * Escala discreta adotada para as descrições já catalogadas no projeto.
 * A conversão só ocorre quando o nível ou o fator foi explicitamente
 * registrado; frequência, duração e modalidade não são usadas para inferi-lo.
 */
export const ACTIVITY_LEVEL_FACTORS = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  EXTREMELY_ACTIVE: 1.9,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_LEVEL_FACTORS;

const activityLevelByDescription: Readonly<Record<string, ActivityLevel>> = {
  SEDENTARIO: "SEDENTARY",
  LEVEMENTE_ATIVO: "LIGHTLY_ACTIVE",
  MODERADAMENTE_ATIVO: "MODERATELY_ACTIVE",
  MUITO_ATIVO: "VERY_ACTIVE",
  EXTREMAMENTE_ATIVO: "EXTREMELY_ACTIVE",
};

function normalizedDescription(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function resolveActivityFactor(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  if (typeof value !== "string" || !value.trim()) return undefined;

  const numericText = value.trim().replace(",", ".");
  if (/^\d+(?:\.\d+)?$/.test(numericText)) {
    const numericFactor = Number(numericText);
    return Number.isFinite(numericFactor) && numericFactor > 0
      ? numericFactor
      : undefined;
  }

  const level = activityLevelByDescription[normalizedDescription(value)];
  return level ? ACTIVITY_LEVEL_FACTORS[level] : undefined;
}

export interface EnergyProtocolInput {
  readonly sex: EnergyCalculationSex;
  readonly ageYears?: number;
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly leanMassKg?: number;
}

type ProtocolFormula = (input: EnergyProtocolInput) => number | undefined;

function isPositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function isValidAge(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function harrisBenedict(input: EnergyProtocolInput) {
  if (
    !isValidAge(input.ageYears) ||
    !isPositive(input.weightKg) ||
    !isPositive(input.heightCm)
  ) {
    return undefined;
  }

  return input.sex === "MALE"
    ? 66.473 + 13.7516 * input.weightKg + 5.0033 * input.heightCm - 6.755 * input.ageYears
    : 655.0955 + 9.5634 * input.weightKg + 1.8496 * input.heightCm - 4.6756 * input.ageYears;
}

function mifflinStJeor(input: EnergyProtocolInput) {
  if (
    !isValidAge(input.ageYears) ||
    !isPositive(input.weightKg) ||
    !isPositive(input.heightCm)
  ) {
    return undefined;
  }

  const sexConstant = input.sex === "MALE" ? 5 : -161;
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + sexConstant;
}

function cunningham(input: EnergyProtocolInput) {
  if (!isPositive(input.leanMassKg)) return undefined;
  return 500 + 22 * input.leanMassKg;
}

function faoWho(input: EnergyProtocolInput) {
  if (!isValidAge(input.ageYears) || !isPositive(input.weightKg)) {
    return undefined;
  }

  const { ageYears, weightKg } = input;

  if (input.sex === "MALE") {
    if (ageYears < 3) return 60.9 * weightKg - 54;
    if (ageYears < 10) return 22.7 * weightKg + 495;
    if (ageYears < 18) return 17.5 * weightKg + 651;
    if (ageYears < 30) return 15.3 * weightKg + 679;
    if (ageYears < 60) return 11.6 * weightKg + 879;
    return 13.5 * weightKg + 487;
  }

  if (ageYears < 3) return 61 * weightKg - 51;
  if (ageYears < 10) return 22.5 * weightKg + 499;
  if (ageYears < 18) return 12.2 * weightKg + 746;
  if (ageYears < 30) return 14.7 * weightKg + 496;
  if (ageYears < 60) return 8.7 * weightKg + 829;
  return 10.5 * weightKg + 596;
}

export const energyProtocolFormulas: Readonly<Record<EnergyProtocol, ProtocolFormula>> = {
  HARRIS_BENEDICT: harrisBenedict,
  MIFFLIN_ST_JEOR: mifflinStJeor,
  FAO_WHO: faoWho,
  IOM: () => undefined,
  OWEN: () => undefined,
  KATCH_MCARDLE: () => undefined,
  CUNNINGHAM: cunningham,
  CUSTOM: () => undefined,
};
