import type { NutritionStrategySelection } from "@/features/nutrition-strategy";
import type { AssistedMealPreview, MealPlanView } from "./contracts";

function storageKey(strategy: NutritionStrategySelection) {
  return `saulo-ai:meal-plan-draft:v2:${strategy.patientId}:${strategy.masterRecordId}:${strategy.scenario}`;
}

function legacyStorageKey(strategy: NutritionStrategySelection) {
  return `saulo-ai:assisted-meal-preview:${strategy.patientId}:${strategy.scenario}`;
}

function planStorageKey(plan: MealPlanView) {
  return `saulo-ai:meal-plan-view:v2:${plan.patientId}:${plan.masterRecordId}:${plan.scenario}`;
}

function normalizeStatus(preview: AssistedMealPreview): AssistedMealPreview {
  const legacyStatus = preview.status as string;
  const normalizedNotice =
    "Sugestão assistida por regras locais. Requer revisão e validação do nutricionista." as const;

  if (legacyStatus === "AI_SUGGESTION_PENDING") {
    return {
      ...preview,
      status: "PENDING_REVIEW",
      notice: normalizedNotice,
    };
  }

  if (legacyStatus === "EDITING") {
    return { ...preview, status: "DRAFT", notice: normalizedNotice };
  }

  return { ...preview, notice: normalizedNotice };
}

// Suporte temporário de interface. Não substitui a persistência clínica oficial.
export const mockAssistedPreviewAdapter = {
  read(strategy: NutritionStrategySelection): AssistedMealPreview | null {
    if (typeof window === "undefined") return null;

    const raw =
      window.localStorage.getItem(storageKey(strategy)) ??
      window.sessionStorage.getItem(legacyStorageKey(strategy));

    if (!raw) return null;

    try {
      const preview = normalizeStatus(
        JSON.parse(raw) as AssistedMealPreview,
      );

      return preview.masterRecordId === strategy.masterRecordId &&
        preview.nutritionDataVersion === 1
        ? preview
        : null;
    } catch {
      return null;
    }
  },

  store(
    strategy: NutritionStrategySelection,
    preview: AssistedMealPreview,
  ) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(strategy), JSON.stringify(preview));
  },
};

// Centraliza o rascunho local legado até existir um repositório clínico oficial.
export const temporaryMealPlanDraftAdapter = {
  read(initialPlan: MealPlanView): MealPlanView {
    if (typeof window === "undefined") return initialPlan;

    const raw =
      window.localStorage.getItem(planStorageKey(initialPlan)) ??
      window.localStorage.getItem("saulo-ai-meal-plan");

    if (!raw) return initialPlan;

    try {
      const candidate = JSON.parse(raw) as MealPlanView;
      return candidate.patientId === initialPlan.patientId &&
        candidate.masterRecordId === initialPlan.masterRecordId
        ? candidate
        : initialPlan;
    } catch {
      return initialPlan;
    }
  },

  store(plan: MealPlanView) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(planStorageKey(plan), JSON.stringify(plan));
  },
};
