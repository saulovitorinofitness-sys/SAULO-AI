import type {
  CalorieAdjustmentPercentage,
  NutritionDecisionObjective,
} from "./decision-engine";
import type {
  MacroAdequacyStatus,
  MacronutrientCalculation,
  MacronutrientInputMode,
  EnergyProtocol,
} from "@/lib/nutrition";
import type { NutritionMethod } from "./contracts";
import {
  specificConfigurationIssues,
  type ClinicalNutritionProtocol,
  type NutritionEnergyGoal,
  type NutritionModification,
  type NutritionSpecificConfigurations,
} from "./prescription";
import type {
  HabitualIntakeEstimate,
  NutritionEvolutionGoal,
  PatternEnergySuggestion,
  QuantifiedRecallItem,
  VetDecisionState,
} from "./habitual-intake-engine";

export type NutritionStrategyRecordStatus = "DRAFT" | "APPROVED";

export interface MacronutrientDraftInput {
  readonly mode: MacronutrientInputMode;
  readonly value?: number;
}

export interface NutritionStrategyMealAllocation {
  readonly mealNumber: number;
  readonly name: string;
  readonly time: string;
  readonly vetPercentage: number;
  readonly plannedCaloriesKcal?: number;
}

export interface NutritionStrategySupplement {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly schedule: string;
  readonly observations: string;
}

export interface NutritionStrategyDraft {
  readonly objective?: NutritionDecisionObjective;
  readonly secondaryObjectives?: readonly string[];
  readonly method?: NutritionMethod;
  readonly modifications?: readonly NutritionModification[];
  readonly clinicalProtocols?: readonly ClinicalNutritionProtocol[];
  /** @deprecated Compatibilidade de leitura com estratégias anteriores. */
  readonly clinicalProtocol?: ClinicalNutritionProtocol;
  readonly specificConfigurations?: NutritionSpecificConfigurations;
  readonly energyGoal?: NutritionEnergyGoal;
  readonly protocol?: EnergyProtocol;
  readonly calorieAdjustmentPercentage?: CalorieAdjustmentPercentage;
  readonly activityFactor?: number;
  readonly manualFinalCaloriesKcal?: number;
  readonly finalCaloriesKcal?: number;
  readonly basalMetabolicRateKcal?: number;
  readonly totalEnergyExpenditureKcal?: number;
  readonly habitualIntake?: {
    readonly items: readonly QuantifiedRecallItem[];
    readonly estimate?: HabitualIntakeEstimate;
  };
  readonly evolutionGoal?: NutritionEvolutionGoal;
  readonly patternEnergySuggestion?: PatternEnergySuggestion;
  readonly vetDecisionState?: VetDecisionState;
  readonly protein: MacronutrientDraftInput;
  readonly carbohydrates: MacronutrientDraftInput;
  readonly fats: MacronutrientDraftInput;
  readonly calculatedMacros: {
    readonly protein?: MacronutrientCalculation;
    readonly carbohydrates?: MacronutrientCalculation;
    readonly fats?: MacronutrientCalculation;
  };
  readonly macroValidation?: {
    readonly plannedCalories: number;
    readonly calculatedCalories: number;
    readonly differenceKcal: number;
    readonly differencePercent: number;
    readonly percentageTotal: number;
    readonly status: MacroAdequacyStatus;
  };
  readonly fiberGrams?: number;
  readonly waterMl?: number;
  readonly mealCount?: number;
  readonly mealDistribution: readonly NutritionStrategyMealAllocation[];
  readonly supplementation: readonly NutritionStrategySupplement[];
  readonly clinicalObservations: string;
  readonly evaluationEntryId?: string;
}

export interface NutritionStrategyRecordView extends NutritionStrategyDraft {
  readonly id: string;
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly status: NutritionStrategyRecordStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly responsibleUserId: string;
  readonly responsibleName: string;
  readonly approvedAt?: string;
  readonly approvedByUserId?: string;
  readonly approvedByName?: string;
  readonly version: number;
}

export function shouldCreateNutritionStrategyVersion(finalizing: boolean) {
  return finalizing;
}

function positive(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

export function resolveMacronutrientDraftInput(
  input: MacronutrientDraftInput,
  calculated: MacronutrientCalculation | undefined,
  fallbackMode: "GRAMS_PER_KG" | "PERCENTAGE",
): MacronutrientDraftInput {
  const mode =
    input.mode === "GRAMS_PER_KG" ||
    input.mode === "PERCENTAGE" ||
    input.mode === "GRAMS"
      ? input.mode
      : fallbackMode;
  if (positive(input.value)) return { mode, value: input.value };

  const calculatedValue =
    mode === "GRAMS_PER_KG"
      ? calculated?.gramsPerKg
      : mode === "GRAMS"
        ? calculated?.grams
        : calculated?.percentage;
  return {
    mode,
    value: positive(calculatedValue) ? calculatedValue : undefined,
  };
}

function macronutrientApprovalIssue(
  label: string,
  input: MacronutrientDraftInput,
  calculated: MacronutrientCalculation | undefined,
  finalCaloriesKcal: number | undefined,
) {
  if (positive(calculated?.grams)) return undefined;
  if (!positive(finalCaloriesKcal)) {
    return `${label}: VET não informado para o cálculo`;
  }
  if (!positive(input.value)) {
    const target =
      input.mode === "GRAMS_PER_KG"
        ? "meta em g/kg"
        : input.mode === "GRAMS"
          ? "gramagem"
          : "percentual";
    return `${label}: ${target} não informado`;
  }
  if (input.mode === "GRAMS_PER_KG") {
    return `${label}: peso não informado para o cálculo em g/kg`;
  }
  return `${label}: não foi possível calcular com os dados informados`;
}

export function canApproveNutritionStrategy(
  strategy: NutritionStrategyDraft,
) {
  return nutritionStrategyApprovalIssues(strategy).length === 0;
}

export function nutritionStrategyApprovalIssues(
  strategy: NutritionStrategyDraft,
): readonly string[] {
  const issues: string[] = [];
  if (!strategy.objective) issues.push("Objetivo nutricional");
  if (!strategy.protocol) issues.push("Protocolo utilizado");
  if (!strategy.method) {
    issues.push("Padrão/método alimentar principal");
  }
  issues.push(
    ...specificConfigurationIssues({
      method: strategy.method,
      modifications: strategy.modifications ?? [],
      clinicalProtocols:
        strategy.clinicalProtocols ??
        (strategy.clinicalProtocol ? [strategy.clinicalProtocol] : []),
      clinicalProtocol: strategy.clinicalProtocol,
      configurations: strategy.specificConfigurations ?? {},
    }),
  );
  if (
    strategy.energyGoal === "MANUAL_VET"
      ? !positive(strategy.manualFinalCaloriesKcal)
      : strategy.calorieAdjustmentPercentage === undefined
  ) {
    issues.push("Objetivo energético");
  }
  if (!positive(strategy.totalEnergyExpenditureKcal)) {
    issues.push("GET calculado");
  }
  if (!positive(strategy.finalCaloriesKcal)) {
    issues.push("VET (Valor Energético Total)");
  }
  const macronutrientIssues = [
    macronutrientApprovalIssue(
      "Proteínas",
      strategy.protein,
      strategy.calculatedMacros.protein,
      strategy.finalCaloriesKcal,
    ),
    macronutrientApprovalIssue(
      "Carboidratos",
      strategy.carbohydrates,
      strategy.calculatedMacros.carbohydrates,
      strategy.finalCaloriesKcal,
    ),
    macronutrientApprovalIssue(
      "Lipídios",
      strategy.fats,
      strategy.calculatedMacros.fats,
      strategy.finalCaloriesKcal,
    ),
  ].filter((issue): issue is string => Boolean(issue));
  issues.push(...macronutrientIssues);
  if (strategy.macroValidation?.status !== "ADEQUATE") {
    issues.push("Distribuição energética dos macronutrientes dentro da tolerância de 2%");
  }
  if (!positive(strategy.fiberGrams)) issues.push("Meta diária de fibras");
  if (
    !(strategy.modifications ?? []).includes("FLUID_RESTRICTION") &&
    !positive(strategy.waterMl)
  ) {
    issues.push("Meta diária de água");
  }

  const validMealCount =
    strategy.mealCount !== undefined &&
    Number.isInteger(strategy.mealCount) &&
    strategy.mealCount > 0;
  if (!validMealCount) {
    issues.push("Número de refeições");
  }

  return issues;
}
