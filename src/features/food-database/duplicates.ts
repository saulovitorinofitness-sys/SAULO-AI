import type {
  ClinicFoodDraft,
  FoodDuplicateCandidate,
  ProfessionalFood,
} from "./contracts";
import { normalizeFoodSearchText } from "./normalization";

export function findPossibleFoodDuplicates(
  draft: ClinicFoodDraft,
  foods: readonly ProfessionalFood[],
): readonly FoodDuplicateCandidate[] {
  const normalizedName = normalizeFoodSearchText(draft.officialName);
  const normalizedState = normalizeFoodSearchText(
    draft.preparationState ?? "",
  );

  return foods
    .filter(
      (food) =>
        food.normalizedName === normalizedName &&
        normalizeFoodSearchText(food.preparationState ?? "") ===
          normalizedState &&
        (!draft.sourceCode || food.sourceCode === draft.sourceCode),
    )
    .map((food) => ({
      id: food.id,
      officialName: food.officialName,
      source: food.source,
      sourceCode: food.sourceCode,
      preparationState: food.preparationState,
      reason:
        food.source.kind === "CLINIC_SV"
          ? "Mesmo nome, estado e código na fonte Clínica SV."
          : "Registro semelhante em outra fonte; requer revisão profissional.",
    }));
}
