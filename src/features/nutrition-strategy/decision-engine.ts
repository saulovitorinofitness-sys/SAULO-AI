import {
  DEFAULT_ENERGY_PROTOCOL,
  ENERGY_PROTOCOLS,
  nutritionEnergyService,
  type EnergyCalculationSex,
  type EnergyProtocol,
  type EnergyProtocolInput,
} from "@/lib/nutrition";

export const NUTRITION_OBJECTIVES = {
  HEALTH: "Saúde",
  WEIGHT_LOSS: "Emagrecimento",
  HYPERTROPHY: "Hipertrofia",
  FOOD_REEDUCATION: "Reeducação Alimentar",
  MAINTENANCE: "Manutenção",
  PERFORMANCE: "Performance",
  WEIGHT_GAIN: "Ganho de Peso",
} as const;

export type NutritionDecisionObjective = keyof typeof NUTRITION_OBJECTIVES;

export const CALORIE_ADJUSTMENT_PERCENTAGES = [
  -30,
  -25,
  -20,
  -15,
  -10,
  0,
  5,
  10,
  15,
  20,
] as const;

export type CalorieAdjustmentPercentage =
  (typeof CALORIE_ADJUSTMENT_PERCENTAGES)[number];

export interface NutritionDecisionEnergyContext extends EnergyProtocolInput {
  readonly sex: EnergyCalculationSex;
  readonly activityFactor?: number;
  readonly recordedTotalEnergyExpenditureKcal?: number;
}

export interface NutritionDecisionInput {
  readonly energy: NutritionDecisionEnergyContext;
  readonly objective?: NutritionDecisionObjective;
  readonly protocol?: EnergyProtocol;
  readonly calorieAdjustmentPercentage: CalorieAdjustmentPercentage;
  readonly manualFinalCaloriesKcal?: number;
}

export interface NutritionDecisionResult {
  readonly objective?: NutritionDecisionObjective;
  readonly objectiveLabel?: string;
  readonly protocol: EnergyProtocol;
  readonly protocolLabel: string;
  readonly basalMetabolicRateKcal?: number;
  readonly totalEnergyExpenditureKcal?: number;
  readonly suggestedCaloriesKcal?: number;
  readonly finalCaloriesKcal?: number;
  readonly calorieSource?: "AUTOMATIC" | "MANUAL";
  readonly calorieAdjustmentPercentage: CalorieAdjustmentPercentage;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

const objectiveByLabel = Object.fromEntries(
  Object.entries(NUTRITION_OBJECTIVES).map(([key, label]) => [
    normalize(label),
    key as NutritionDecisionObjective,
  ]),
) as Readonly<Record<string, NutritionDecisionObjective>>;

export function resolveNutritionObjective(
  value: string | undefined,
): NutritionDecisionObjective | undefined {
  if (!value?.trim()) return undefined;
  if (value in NUTRITION_OBJECTIVES) {
    return value as NutritionDecisionObjective;
  }
  return objectiveByLabel[normalize(value)];
}

function positiveNumber(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export const nutritionStrategyDecisionService = {
  defaultProtocol: DEFAULT_ENERGY_PROTOCOL,

  availableProtocols(
    input: NutritionDecisionEnergyContext,
  ): readonly EnergyProtocol[] {
    return (Object.keys(ENERGY_PROTOCOLS) as EnergyProtocol[]).filter(
      (protocol) =>
        nutritionEnergyService.calculateBasalMetabolicRate({
          ...input,
          protocol,
        }) !== undefined,
    );
  },

  calculate(input: NutritionDecisionInput): NutritionDecisionResult {
    const protocol = input.protocol ?? DEFAULT_ENERGY_PROTOCOL;
    const energy = nutritionEnergyService.calculateEnergyStrategy({
      ...input.energy,
      protocol,
    });
    const basalMetabolicRateKcal = energy.basalMetabolicRate?.value;
    const recordedTotalEnergyExpenditureKcal =
      positiveNumber(input.energy.recordedTotalEnergyExpenditureKcal);
    const totalEnergyExpenditureKcal =
      recordedTotalEnergyExpenditureKcal ?? energy.totalEnergyExpenditure;
    const suggestedCaloriesKcal =
      input.objective && totalEnergyExpenditureKcal
        ? totalEnergyExpenditureKcal
        : undefined;
    const automaticFinalCaloriesKcal = suggestedCaloriesKcal
      ? suggestedCaloriesKcal *
        (1 + input.calorieAdjustmentPercentage / 100)
      : undefined;
    const manualFinalCaloriesKcal = positiveNumber(
      input.manualFinalCaloriesKcal,
    );
    const finalCaloriesKcal =
      manualFinalCaloriesKcal ?? automaticFinalCaloriesKcal;

    return {
      objective: input.objective,
      objectiveLabel: input.objective
        ? NUTRITION_OBJECTIVES[input.objective]
        : undefined,
      protocol,
      protocolLabel: ENERGY_PROTOCOLS[protocol],
      basalMetabolicRateKcal,
      totalEnergyExpenditureKcal,
      suggestedCaloriesKcal,
      finalCaloriesKcal,
      calorieSource: manualFinalCaloriesKcal
        ? "MANUAL"
        : automaticFinalCaloriesKcal
          ? "AUTOMATIC"
          : undefined,
      calorieAdjustmentPercentage: input.calorieAdjustmentPercentage,
    };
  },
} as const;
