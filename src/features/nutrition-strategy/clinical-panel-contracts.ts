export interface NutritionClinicalPanelMetric {
  readonly label: string;
  readonly value?: number;
  readonly unit?: string;
}


export interface NutritionClinicalPanelAnthropometry {
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly bmi?: number;
  readonly bmiClassification?: string;
  readonly assessmentDate?: string;
  readonly assessmentType?: "INITIAL" | "REASSESSMENT";
  readonly assessmentStatus?:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "REVIEWED";
}

export interface NutritionClinicalPanelPerimetryMeasurement {
  readonly key: string;
  readonly label: string;
  readonly valueCm?: number;
  readonly region?: "TRUNK" | "UPPER_LIMBS" | "LOWER_LIMBS";
  readonly side?: "RIGHT" | "LEFT";
  readonly notPerformed?: boolean;
  readonly reason?: string;
  readonly notes?: string;
}

export interface NutritionClinicalPanelPerimetry {
  readonly measurements: readonly NutritionClinicalPanelPerimetryMeasurement[];
  readonly waistCm?: number;
  readonly abdomenCm?: number;
  readonly hipCm?: number;
  readonly waistHipRatio?: number;
}

export interface NutritionClinicalPanelBioimpedance {
  readonly skeletalMuscleMassKg?: number;
  readonly fatMassKg?: number;
  readonly fatFreeMassKg?: number;
  readonly bodyFatPercent?: number;
  readonly totalBodyWaterL?: number;
  readonly visceralFatLevel?: number;
  readonly basalMetabolicRateKcal?: number;
  readonly totalEnergyExpenditureKcal?: number;
  readonly metabolicAgeYears?: number;
  readonly phaseAngleDegrees?: number;
}

export interface NutritionClinicalPanelView {
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly attendanceStartedAt?: string;
  readonly evaluationEntryId?: string;
  readonly responsibleProfessional: string;
  readonly patient: {
    readonly photoUrl?: string;
    readonly name: string;
    readonly code: string;
    readonly age?: number;
    readonly sex: string;
    readonly profession?: string;
    readonly primaryObjective?: string;
    readonly secondaryObjectives: readonly string[];
    readonly evaluationDate?: string;
    readonly evaluationNumber?: number;
  };
  readonly anthropometry: NutritionClinicalPanelAnthropometry;
  readonly perimetry: NutritionClinicalPanelPerimetry;
  readonly bioimpedance: NutritionClinicalPanelBioimpedance;
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
    readonly recordedBasalMetabolicRateKcal?: number;
    readonly recordedTotalEnergyExpenditureKcal?: number;
  };
  readonly inheritedClinicalContext: {
    readonly diagnoses: readonly string[];
    readonly diagnosisReview?: {
      readonly outcome:
        | "NO_DIAGNOSIS_ESTABLISHED"
        | "DIAGNOSES_CONFIRMED";
      readonly reviewedAt: string;
      readonly responsibleName: string;
      readonly revision: number;
    };
    readonly allergyStatus: import("@/features/clinical-anamnesis").FoodAllergyStatus;
    readonly allergies: readonly string[];
    readonly restrictions: readonly string[];
    readonly foodPreferences: readonly string[];
    readonly medications: readonly string[];
    readonly supplements: readonly string[];
    readonly injuriesAndLimitations: readonly string[];
    readonly laboratoryExams: readonly string[];
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
