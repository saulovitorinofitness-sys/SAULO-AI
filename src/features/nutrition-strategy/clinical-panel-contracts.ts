export interface NutritionClinicalPanelMetric {
  readonly label: string;
  readonly value?: number;
  readonly unit?: string;
}

export interface NutritionClinicalPanelView {
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly evaluationEntryId?: string;
  readonly patient: {
    readonly photoUrl?: string;
    readonly name: string;
    readonly code: string;
    readonly age: number;
    readonly sex: string;
    readonly profession?: string;
    readonly primaryObjective?: string;
    readonly secondaryObjectives: readonly string[];
    readonly evaluationDate?: string;
    readonly evaluationNumber?: number;
  };
  readonly nutritionalStatus: {
    readonly weightKg?: number;
    readonly heightM?: number;
    readonly bmi?: number;
    readonly bmiClassification?: string;
    readonly waistHipRatio?: number;
    readonly abdomenCm?: number;
  };
  readonly bodyComposition: {
    readonly muscleMassKg?: number;
    readonly fatMassKg?: number;
    readonly bodyFatPercent?: number;
    readonly bodyWaterL?: number;
    readonly basalMetabolicRateKcal?: number;
    readonly totalEnergyExpenditureKcal?: number;
  };
  readonly energyDecision?: EnergyProtocolInput & {
    readonly sex: EnergyCalculationSex;
    readonly activityFactor?: number;
    readonly recordedTotalEnergyExpenditureKcal?: number;
  };
  readonly decisionSupport: {
    readonly positivePoints: readonly string[];
    readonly attentionPoints: readonly string[];
    readonly pendingData: readonly string[];
  };
}
import type {
  EnergyCalculationSex,
  EnergyProtocolInput,
} from "@/lib/nutrition";
