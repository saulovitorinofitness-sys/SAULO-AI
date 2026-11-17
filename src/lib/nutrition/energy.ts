import {
  ENERGY_PROTOCOLS,
  energyProtocolFormulas,
  type EnergyProtocol,
  type EnergyProtocolInput,
  type EnergyProtocolName,
} from "./protocols";

export interface BasalMetabolicRateInput extends EnergyProtocolInput {
  readonly protocol: EnergyProtocol;
}

export interface BasalMetabolicRateResult {
  readonly value: number;
  readonly protocol: EnergyProtocolName;
}

export interface EnergyStrategyInput extends EnergyProtocolInput {
  readonly protocol: EnergyProtocol;
  readonly activityFactor?: number;
}

export interface EnergyStrategyResult {
  readonly basalMetabolicRate?: BasalMetabolicRateResult;
  readonly totalEnergyExpenditure?: number;
}

function validEnergy(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

export function calculateBasalMetabolicRate(
  input: BasalMetabolicRateInput,
): BasalMetabolicRateResult | undefined {
  const value = energyProtocolFormulas[input.protocol](input);
  if (!validEnergy(value)) return undefined;

  return {
    value,
    protocol: ENERGY_PROTOCOLS[input.protocol],
  };
}

export function calculateTotalEnergyExpenditure(
  basalMetabolicRate: number,
  activityFactor: number,
): number | undefined {
  if (
    !validEnergy(basalMetabolicRate) ||
    !Number.isFinite(activityFactor) ||
    activityFactor <= 0
  ) {
    return undefined;
  }

  const value = basalMetabolicRate * activityFactor;
  return validEnergy(value) ? value : undefined;
}

export function calculateEnergyStrategy(
  input: EnergyStrategyInput,
): EnergyStrategyResult {
  const basalMetabolicRate = calculateBasalMetabolicRate({
    ...input,
    protocol: input.protocol,
  });
  const totalEnergyExpenditure =
    basalMetabolicRate && input.activityFactor !== undefined
      ? calculateTotalEnergyExpenditure(
          basalMetabolicRate.value,
          input.activityFactor,
        )
      : undefined;

  return {
    basalMetabolicRate,
    totalEnergyExpenditure,
  };
}

export const nutritionEnergyService = {
  calculateBasalMetabolicRate,
  calculateTotalEnergyExpenditure,
  calculateEnergyStrategy,
} as const;
