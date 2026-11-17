import type { FolateForm, FoodNutrientForms, VitaminAForm } from "./contracts";

interface NutrientFormObservation {
  readonly nutrientKey: string;
  readonly sourceNutrientName?: string | null;
}

function vitaminAFormFromName(value: string | null | undefined): VitaminAForm | null {
  const name = value?.trim().toLocaleUpperCase("pt-BR") ?? "";
  if (/\bRAE\b/u.test(name)) return "RAE";
  if (/\bRETINOL\b/u.test(name)) return "RETINOL";
  if (/\(RE\)|\bRE\b/u.test(name)) return "RE";
  return null;
}

function folateFormFromName(value: string | null | undefined): FolateForm | null {
  const name = value?.trim().toLocaleUpperCase("pt-BR") ?? "";
  if (/\bDFE\b/u.test(name)) return "DFE";
  if (/ÁCIDO FÓLICO|ACIDO FOLICO/u.test(name)) return "FOLIC_ACID";
  if (/FOLATO ALIMENTAR|FOOD FOLATE/u.test(name)) return "FOOD_FOLATE";
  return null;
}

/** Usa somente proveniência explícita ou importadores cuja unidade é documentada. */
export function resolveFoodNutrientForms(input: {
  readonly sourceKind: string;
  readonly importedFrom?: string | null;
  readonly observations?: readonly NutrientFormObservation[];
}): FoodNutrientForms {
  const vitaminAObservation = input.observations?.find((item) =>
    item.nutrientKey === "vitaminAMcg" || /vitamin.*a|retinol/i.test(item.sourceNutrientName ?? ""),
  );
  const folateObservation = input.observations?.find((item) =>
    item.nutrientKey === "folateMcg" || /folat|fólic|folic/i.test(item.sourceNutrientName ?? ""),
  );
  const importedByEvonut = input.sourceKind === "EVONUT" || input.importedFrom === "EVONUT";
  return {
    vitaminAMcg: vitaminAFormFromName(vitaminAObservation?.sourceNutrientName) ??
      (importedByEvonut ? "RE" : input.sourceKind === "TACO" ? "RAE" : "UNSPECIFIED"),
    folateMcg: folateFormFromName(folateObservation?.sourceNutrientName) ?? "UNSPECIFIED",
  };
}
