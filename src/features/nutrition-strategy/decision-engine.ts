import {
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

export type CalorieAdjustmentPercentage = number;

export interface NutritionDecisionEnergyContext extends EnergyProtocolInput {
  readonly sex: EnergyCalculationSex;
  readonly activityFactor?: number;
  readonly recordedBasalMetabolicRateKcal?: number;
  readonly recordedTotalEnergyExpenditureKcal?: number;
}

export interface NutritionDecisionInput {
  readonly energy: NutritionDecisionEnergyContext;
  readonly objective?: NutritionDecisionObjective;
  readonly protocol?: EnergyProtocol;
  readonly calorieAdjustmentPercentage?: CalorieAdjustmentPercentage;
  readonly manualFinalCaloriesKcal?: number;
}

export interface NutritionEnergyCalculationDetails {
  readonly basalFormula: string;
  readonly basalSubstitution: string;
  readonly basalResultKcal?: number;
  readonly getFormula?: string;
  readonly getSubstitution?: string;
  readonly getResultKcal?: number;
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
  readonly calorieAdjustmentPercentage?: CalorieAdjustmentPercentage;
  readonly calculationDetails: NutritionEnergyCalculationDetails;
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

export function resolveInitialNutritionObjective(
  strategyObjective: NutritionDecisionObjective | undefined,
  clinicalObjective: string | undefined,
) {
  return strategyObjective ?? resolveNutritionObjective(clinicalObjective);
}

function positiveNumber(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export function nutritionEnergyMissingData(
  energy: NutritionDecisionEnergyContext | undefined,
  protocol: EnergyProtocol | undefined,
  activityFactor: number | undefined,
) {
  const missing: string[] = [];
  if (!protocol) missing.push("Protocolo energético");
  if (!energy) {
    missing.push("Sexo cadastrado para cálculo energético");
    return missing;
  }

  if (protocol === "CUNNINGHAM") {
    if (!positiveNumber(energy.leanMassKg)) {
      missing.push("Massa livre de gordura");
    }
  } else if (protocol === "FAO_WHO") {
    if (energy.ageYears === undefined) missing.push("Idade");
    if (!positiveNumber(energy.weightKg)) missing.push("Peso");
  } else if (protocol) {
    if (energy.ageYears === undefined) missing.push("Idade");
    if (!positiveNumber(energy.weightKg)) missing.push("Peso");
    if (!positiveNumber(energy.heightCm)) missing.push("Altura");
  }

  if (
    !positiveNumber(energy.recordedTotalEnergyExpenditureKcal) &&
    !positiveNumber(activityFactor)
  ) {
    missing.push("Fator de atividade");
  }
  return missing;
}

function basalFormulaDetails(
  protocol: EnergyProtocol,
  energy: NutritionDecisionEnergyContext,
  result: number | undefined,
): Pick<NutritionEnergyCalculationDetails, "basalFormula" | "basalSubstitution" | "basalResultKcal"> {
  if (positiveNumber(energy.recordedBasalMetabolicRateKcal)) {
    return {
      basalFormula: "TMB registrada no atendimento",
      basalSubstitution: `Valor registrado = ${energy.recordedBasalMetabolicRateKcal} kcal`,
      basalResultKcal: result,
    };
  }

  const sexConstant = energy.sex === "MALE" ? 5 : -161;
  const formulaByProtocol: Partial<Record<EnergyProtocol, string>> = {
    HARRIS_BENEDICT:
      energy.sex === "MALE"
        ? "66,473 + (13,7516 × peso) + (5,0033 × altura) − (6,755 × idade)"
        : "655,0955 + (9,5634 × peso) + (1,8496 × altura) − (4,6756 × idade)",
    MIFFLIN_ST_JEOR: "(10 × peso) + (6,25 × altura) − (5 × idade) + constante sexual",
    FAO_WHO: "Equação FAO/OMS correspondente ao sexo e à faixa etária",
    CUNNINGHAM: "500 + (22 × massa livre de gordura)",
  };
  const substitutionByProtocol: Partial<Record<EnergyProtocol, string>> = {
    HARRIS_BENEDICT:
      energy.sex === "MALE"
        ? `66,473 + (13,7516 × ${energy.weightKg}) + (5,0033 × ${energy.heightCm}) − (6,755 × ${energy.ageYears})`
        : `655,0955 + (9,5634 × ${energy.weightKg}) + (1,8496 × ${energy.heightCm}) − (4,6756 × ${energy.ageYears})`,
    MIFFLIN_ST_JEOR: `(10 × ${energy.weightKg}) + (6,25 × ${energy.heightCm}) − (5 × ${energy.ageYears}) + (${sexConstant})`,
    FAO_WHO: `Sexo: ${energy.sex === "FEMALE" ? "feminino" : "masculino"}; idade: ${energy.ageYears} anos; peso: ${energy.weightKg} kg`,
    CUNNINGHAM: `500 + (22 × ${energy.leanMassKg})`,
  };

  return {
    basalFormula: formulaByProtocol[protocol] ?? ENERGY_PROTOCOLS[protocol],
    basalSubstitution: substitutionByProtocol[protocol] ?? "Dados insuficientes para demonstrar a substituição.",
    basalResultKcal: result,
  };
}

export const nutritionStrategyDecisionService = {
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
    if (!input.protocol) {
      throw new Error("Selecione o protocolo de TMB antes de calcular.");
    }
    const protocol = input.protocol;
    const recordedBasalMetabolicRateKcal = positiveNumber(
      input.energy.recordedBasalMetabolicRateKcal,
    );
    const calculatedBasalMetabolicRateKcal = recordedBasalMetabolicRateKcal
      ? undefined
      : nutritionEnergyService.calculateBasalMetabolicRate({
          ...input.energy,
          protocol,
        })?.value;
    const basalMetabolicRateKcal =
      recordedBasalMetabolicRateKcal ?? calculatedBasalMetabolicRateKcal;
    const recordedTotalEnergyExpenditureKcal =
      positiveNumber(input.energy.recordedTotalEnergyExpenditureKcal);
    const totalEnergyExpenditureKcal =
      recordedTotalEnergyExpenditureKcal ??
      (basalMetabolicRateKcal && positiveNumber(input.energy.activityFactor)
        ? nutritionEnergyService.calculateTotalEnergyExpenditure(
            basalMetabolicRateKcal,
            input.energy.activityFactor!,
          )
        : undefined);
    const basalDetails = basalFormulaDetails(
      protocol,
      input.energy,
      basalMetabolicRateKcal,
    );
    const calculationDetails: NutritionEnergyCalculationDetails = {
      ...basalDetails,
      ...(recordedTotalEnergyExpenditureKcal
        ? {
            getFormula: "GET registrado no atendimento",
            getSubstitution: `Valor registrado = ${recordedTotalEnergyExpenditureKcal} kcal`,
            getResultKcal: recordedTotalEnergyExpenditureKcal,
          }
        : basalMetabolicRateKcal && positiveNumber(input.energy.activityFactor)
          ? {
              getFormula: "GET = TMB × fator de atividade",
              getSubstitution: `${basalMetabolicRateKcal} × ${input.energy.activityFactor}`,
              getResultKcal: totalEnergyExpenditureKcal,
            }
          : {}),
    };
    const suggestedCaloriesKcal =
      input.objective && totalEnergyExpenditureKcal
        ? totalEnergyExpenditureKcal
        : undefined;
    const automaticFinalCaloriesKcal =
      suggestedCaloriesKcal && input.calorieAdjustmentPercentage !== undefined
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
      calculationDetails,
    };
  },
} as const;
