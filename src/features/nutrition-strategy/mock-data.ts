import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { CLINICAL_DEMO_MASTER_RECORD_ID, CLINICAL_DEMO_PATIENT_ID } from "@/features/clinical-collection/mock-data";
import type { EnergyTargetMode, NutritionMethod, NutritionStrategyView } from "./contracts";

export const nutritionMethodOptions: readonly (readonly [NutritionMethod, string])[] = [
  ["STANDARD", "Padrão"],
  ["LOW_CARB", "Low carb"],
  ["CARB_CYCLING", "Ciclo de carboidratos"],
] as const;

export const energyTargetModeOptions: readonly (readonly [EnergyTargetMode, string])[] = [
  ["CALORIES", "Calorias definidas diretamente"],
  ["BMR", "Taxa metabólica basal (TMB)"],
] as const;

export const nutritionGoalsMockSeed = {
  method: "STANDARD" as NutritionMethod,
  energyMode: "CALORIES" as EnergyTargetMode,
  targetCalories: 2150,
  carbohydratesPercentage: 45,
  proteinPercentage: 30,
  fatsPercentage: 25,
};

export const nutritionStrategyMainObjectiveOptions = [
  ["EMAGRECIMENTO", "Emagrecimento"],
  ["HIPERTROFIA", "Hipertrofia"],
  ["RECOMPOSICAO_CORPORAL", "Recomposição Corporal"],
  ["PERFORMANCE", "Performance"],
  ["REEDUCACAO_ALIMENTAR", "Reeducação Alimentar"],
  ["CONTROLE_GLICEMICO", "Controle Glicêmico"],
  ["SAUDE_CARDIOVASCULAR", "Saúde Cardiovascular"],
  ["OUTRO", "Outro"],
] as const;

export const nutritionStrategyTypeOptions = [
  ["HIPOCALORICA", "Hipocalórica"],
  ["NORMOCALORICA", "Normocalórica"],
  ["HIPERCALORICA", "Hipercalórica"],
  ["LOW_CARB", "Low Carb"],
  ["MEDITERRANEA", "Mediterrânea"],
  ["FLEXIVEL", "Flexível"],
  ["VEGETARIANA", "Vegetariana"],
  ["CETOGENICA", "Cetogênica"],
  ["OUTRA", "Outra"],
] as const;

export const nutritionStrategyComplementaryOptions = [
  "Maior ingestão proteica",
  "Maior consumo de fibras",
  "Fracionamento",
  "Jejum",
  "Carboidrato periodizado",
  "Refeed",
  "Diet Break",
  "Recuperação esportiva",
] as const;

export const nutritionStrategySecondaryObjectiveOptions = [
  "Melhorar saciedade",
  "Reduzir compulsão",
  "Aumentar consumo de fibras",
  "Melhorar recuperação",
  "Melhorar performance",
  "Melhorar hidratação",
  "Melhorar composição corporal",
  "Outros",
] as const;

type StrategySeed = Pick<NutritionStrategyView, "status" | "objectiveMain" | "secondaryObjectives" | "strategyType" | "complementaryStrategies" | "clinicalObservations">;

const activeSeed: StrategySeed = {
  status: "ACTIVE",
  objectiveMain: "Recomposição Corporal",
  secondaryObjectives: ["Melhorar saciedade", "Melhorar hidratação", "Melhorar recuperação"],
  strategyType: "Flexível",
  complementaryStrategies: ["Maior ingestão proteica", "Maior consumo de fibras", "Carboidrato periodizado"],
  clinicalObservations: "Estratégia registrada no prontuário. Os ajustes finais permanecem sob decisão profissional.",
};

const draftSeed: StrategySeed = {
  status: "DRAFT",
  objectiveMain: "Reeducação Alimentar",
  secondaryObjectives: ["Melhorar saciedade", "Reduzir compulsão"],
  strategyType: "Normocalórica",
  complementaryStrategies: ["Fracionamento", "Maior consumo de fibras"],
  clinicalObservations: "Rascunho demonstrativo aguardando validação profissional antes da elaboração do plano alimentar.",
};

export const nutritionStrategyScenarioSeeds: Readonly<Record<ClinicalCollectionScenarioKey, StrategySeed>> = {
  "not-started": draftSeed,
  "partial-saulo": draftSeed,
  "maria-continuity": draftSeed,
  complete: activeSeed,
  "mandatory-pending": draftSeed,
  "integrity-missing": activeSeed,
  "previous-comparison": activeSeed,
};

export const nutritionStrategyMockPatient = {
  patientId: CLINICAL_DEMO_PATIENT_ID,
  masterRecordId: CLINICAL_DEMO_MASTER_RECORD_ID,
  patientName: "Paciente de demonstração",
  patientCode: "PAC-001",
  age: 34,
};
