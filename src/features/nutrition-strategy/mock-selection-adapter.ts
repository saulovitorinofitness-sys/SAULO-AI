import type {
  NutritionStrategyDraftSnapshot,
  NutritionStrategySelection,
  NutritionStrategyView,
} from "./contracts";

function storageKey(patientId: string, scenario: string) {
  return `saulo-ai:nutrition-strategy-selection:${patientId}:${scenario}`;
}

function draftStorageKey(patientId: string, scenario: string) {
  return `saulo-ai:nutrition-strategy-draft:v1:${patientId}:${scenario}`;
}

export function nutritionStrategySelectionFromView(view: NutritionStrategyView): NutritionStrategySelection {
  return {
    patientId: view.patientId,
    masterRecordId: view.masterRecordId,
    scenario: view.scenario,
    objectiveMain: view.objectiveMain,
    method: view.nutritionGoals.method,
    energyMode: view.nutritionGoals.energyMode,
    targetCalories: view.nutritionGoals.targetCalories,
    carbohydrates: view.nutritionGoals.carbohydrates,
    protein: view.nutritionGoals.protein,
    fats: view.nutritionGoals.fats,
    mealCount: view.mealDistribution.mealCount,
    mealTimes: view.mealDistribution.mealTimes,
    complementaryStrategies: view.complementaryStrategies,
    updatedAt: view.updatedAt,
    demonstrative: true,
  };
}

export function nutritionStrategySelectionFingerprint(selection: NutritionStrategySelection) {
  return JSON.stringify({
    objectiveMain: selection.objectiveMain,
    method: selection.method,
    energyMode: selection.energyMode,
    targetCalories: selection.targetCalories,
    carbohydrates: selection.carbohydrates,
    protein: selection.protein,
    fats: selection.fats,
    mealCount: selection.mealCount,
    mealTimes: selection.mealTimes,
    complementaryStrategies: selection.complementaryStrategies,
  });
}

// Adaptador temporário e demonstrativo. Não persiste decisão clínica nem envia dados externos.
export const mockNutritionStrategySelectionAdapter = {
  read(patientId: string, scenario: string): NutritionStrategySelection | null {
    if (typeof window === "undefined") return null;
    const raw =
      window.localStorage.getItem(storageKey(patientId, scenario)) ??
      window.sessionStorage.getItem(storageKey(patientId, scenario));
    if (!raw) return null;
    try {
      const selection = JSON.parse(raw) as NutritionStrategySelection;
      return selection.patientId === patientId &&
        selection.scenario === scenario
        ? selection
        : null;
    } catch {
      return null;
    }
  },

  store(selection: NutritionStrategySelection) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey(selection.patientId, selection.scenario),
      JSON.stringify(selection),
    );
  },

  readDraft(
    patientId: string,
    scenario: string,
  ): NutritionStrategyDraftSnapshot | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(
      draftStorageKey(patientId, scenario),
    );
    if (!raw) return null;
    try {
      const draft = JSON.parse(raw) as NutritionStrategyDraftSnapshot;
      return draft.selection.patientId === patientId &&
        draft.selection.scenario === scenario
        ? draft
        : null;
    } catch {
      return null;
    }
  },

  storeDraft(draft: NutritionStrategyDraftSnapshot) {
    if (typeof window === "undefined") return;
    this.store(draft.selection);
    window.localStorage.setItem(
      draftStorageKey(
        draft.selection.patientId,
        draft.selection.scenario,
      ),
      JSON.stringify(draft),
    );
  },
};
