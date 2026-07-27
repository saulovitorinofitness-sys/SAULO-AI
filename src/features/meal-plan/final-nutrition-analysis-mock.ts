import type { AssistedMicronutrientKey } from "./contracts";

export type NutritionAnalysisState = "ADEQUATE" | "ATTENTION" | "OUT_OF_RANGE";

export interface DemonstrativeMicronutrientReference {
  readonly key: AssistedMicronutrientKey;
  readonly label: string;
  readonly target: number;
  readonly unit: "mg" | "µg";
}

export const demonstrativeFiberTargetGrams = 30;

// Referências demonstrativas para validar a análise visual da Sprint 011.
export const demonstrativeMicronutrientReferences: readonly DemonstrativeMicronutrientReference[] = [
  { key: "calciumMg", label: "Cálcio", target: 1000, unit: "mg" },
  { key: "ironMg", label: "Ferro", target: 8, unit: "mg" },
  { key: "magnesiumMg", label: "Magnésio", target: 400, unit: "mg" },
  { key: "zincMg", label: "Zinco", target: 11, unit: "mg" },
  { key: "sodiumMg", label: "Sódio", target: 2300, unit: "mg" },
  { key: "potassiumMg", label: "Potássio", target: 3500, unit: "mg" },
  { key: "vitaminAMcg", label: "Vitamina A", target: 900, unit: "µg" },
  { key: "vitaminCMg", label: "Vitamina C", target: 90, unit: "mg" },
  { key: "vitaminDMcg", label: "Vitamina D", target: 15, unit: "µg" },
  { key: "vitaminEMg", label: "Vitamina E", target: 15, unit: "mg" },
  { key: "vitaminB1Mg", label: "Vitamina B1", target: 1.2, unit: "mg" },
  { key: "vitaminB2Mg", label: "Vitamina B2", target: 1.3, unit: "mg" },
  { key: "vitaminB6Mg", label: "Vitamina B6", target: 1.3, unit: "mg" },
  { key: "vitaminB12Mcg", label: "Vitamina B12", target: 2.4, unit: "µg" },
  { key: "folateMcg", label: "Folato", target: 400, unit: "µg" },
] as const;

export function achievedPercentage(total: number, target: number) {
  return target > 0 ? Math.round((total / target) * 1000) / 10 : 0;
}

export function classifyNutritionPercentage(percentage: number): { readonly state: NutritionAnalysisState; readonly label: string } {
  if (percentage >= 90 && percentage <= 110) return { state: "ADEQUATE", label: "Adequado" };
  if (percentage >= 75 && percentage <= 125) return { state: "ATTENTION", label: "Atenção" };
  return percentage < 75 ? { state: "OUT_OF_RANGE", label: "Abaixo da referência" } : { state: "OUT_OF_RANGE", label: "Acima da referência" };
}
