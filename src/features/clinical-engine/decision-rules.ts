import {
  compareMealPlanTarget,
  MEAL_PLAN_TARGET_TOLERANCES,
} from "@/features/meal-plan/config";

import type {
  NutritionCompatibilityStatus,
  NutritionDecisionAlert,
  NutritionDecisionComparison,
  NutritionDecisionPriority,
  NutritionDecisionPriorityItem,
  NutritionDecisionSuggestion,
} from "./contracts";

export const NUTRITION_DECISION_ENGINE_VERSION = "1.0.0";

export const NUTRITION_DECISION_RULES = {
  divergentDifference: 0.15,
  weightSourceDifference: 0.05,
  recentAssessmentDays: 180,
  maxMealIntervalHours: 6,
} as const;

export interface NutritionDecisionRuleInput {
  readonly objective?: string;
  readonly strategy?: {
    readonly status: "DRAFT" | "ACTIVE";
    readonly objective?: string;
    readonly calories?: number;
    readonly proteinGrams?: number;
    readonly carbohydratesGrams?: number;
    readonly fatsGrams?: number;
    readonly fiberGrams?: number;
    readonly hydrationMl?: number;
  };
  readonly mealPlan?: {
    readonly status:
      | "DRAFT"
      | "PENDING_REVIEW"
      | "APPROVED"
      | "REJECTED"
      | "NEEDS_UPDATE";
    readonly objective?: string;
    readonly calories?: number;
    readonly proteinGrams?: number;
    readonly carbohydratesGrams?: number;
    readonly fatsGrams?: number;
    readonly fiberGrams?: number;
    readonly hydrationMl?: number;
    readonly meals: readonly {
      readonly id: string;
      readonly name: string;
      readonly time?: string;
      readonly foodCount: number;
    }[];
  };
  readonly anthropometry: {
    readonly weightKg?: number;
    readonly bioimpedanceWeightKg?: number;
    readonly heightCm?: number;
    readonly assessedAt?: string;
  };
  readonly supplementCount: number;
  readonly analyzedAt: string;
}

export interface NutritionDecisionRuleResult {
  readonly comparisons: readonly NutritionDecisionComparison[];
  readonly alerts: readonly NutritionDecisionAlert[];
  readonly priorities: readonly NutritionDecisionPriorityItem[];
  readonly suggestions: readonly NutritionDecisionSuggestion[];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function numericComparison(
  id: string,
  label: string,
  target: number | undefined,
  current: number | undefined,
  unit: string,
  tolerance: number,
): NutritionDecisionComparison {
  if (target === undefined || current === undefined) {
    return {
      id,
      label,
      target,
      current,
      unit,
      status: "UNAVAILABLE",
      explanation: "Comparação indisponível porque um dos valores não foi registrado.",
    };
  }

  const result = compareMealPlanTarget(target, current, tolerance);
  const absoluteRatio =
    target > 0 ? Math.abs(result.difference) / target : result.difference === 0 ? 0 : 1;
  const status: NutritionCompatibilityStatus =
    result.status === "WITHIN_TARGET"
      ? "COMPATIBLE"
      : absoluteRatio > NUTRITION_DECISION_RULES.divergentDifference
        ? "DIVERGENT"
        : "REVIEW";

  return {
    id,
    label,
    target,
    current,
    unit,
    difference: result.difference,
    adequacyPercentage: result.adequacyPercentage,
    status,
    explanation:
      status === "COMPATIBLE"
        ? `Valor dentro da tolerância de ${tolerance * 100}% da meta registrada.`
        : `${label} ${result.difference < 0 ? "abaixo" : "acima"} da meta registrada.`,
  };
}

function objectiveComparison(
  strategyObjective: string | undefined,
  planObjective: string | undefined,
): NutritionDecisionComparison {
  if (!strategyObjective || !planObjective) {
    return {
      id: "objective",
      label: "Objetivo",
      target: strategyObjective,
      current: planObjective,
      status: "UNAVAILABLE",
      explanation: "Objetivo ausente na estratégia ou no plano.",
    };
  }

  const compatible = normalize(strategyObjective) === normalize(planObjective);
  return {
    id: "objective",
    label: "Objetivo",
    target: strategyObjective,
    current: planObjective,
    status: compatible ? "COMPATIBLE" : "DIVERGENT",
    explanation: compatible
      ? "O objetivo do plano corresponde ao objetivo da estratégia."
      : "O objetivo registrado no plano difere do objetivo da estratégia.",
  };
}

function alert(
  id: string,
  title: string,
  description: string,
  priority: NutritionDecisionPriority,
  source: string,
): NutritionDecisionAlert {
  return { id, title, description, priority, source };
}

function parseTime(value: string | undefined) {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
    ? hours * 60 + minutes
    : undefined;
}

function maximumMealInterval(
  meals: NutritionDecisionRuleInput["mealPlan"] extends infer T
    ? T extends { meals: infer M }
      ? M
      : never
    : never,
) {
  const times = meals
    .map((meal) => parseTime(meal.time))
    .filter((time): time is number => time !== undefined)
    .sort((left, right) => left - right);
  if (times.length < 2) return undefined;
  return Math.max(
    ...times.slice(1).map((time, index) => (time - times[index]) / 60),
  );
}

function ageInDays(value: string, now: string) {
  const difference = new Date(now).getTime() - new Date(value).getTime();
  return Math.floor(difference / 86_400_000);
}

function suggestionForAlert(
  item: NutritionDecisionAlert,
  comparisons: readonly NutritionDecisionComparison[],
): NutritionDecisionSuggestion | null {
  const comparison = comparisons.find((entry) => entry.id === item.id);
  const supported = new Set([
    "protein",
    "carbohydrates",
    "fiber",
    "hydration",
    "meal-interval",
    "supplementation-review",
  ]);
  if (!supported.has(item.id)) return null;

  return {
    id: `suggestion-${item.id}`,
    title: `Sugestão do SAULO AI: ${item.title.toLocaleLowerCase("pt-BR")}`,
    priority: item.priority,
    reason: item.description,
    dataUsed: comparison
      ? [
          `Meta registrada: ${String(comparison.target)}${comparison.unit ? ` ${comparison.unit}` : ""}`,
          `Plano atual: ${String(comparison.current)}${comparison.unit ? ` ${comparison.unit}` : ""}`,
        ]
      : [item.source],
    trigger: comparison?.explanation ?? item.description,
  };
}

export function analyzeNutritionDecision(
  input: NutritionDecisionRuleInput,
): NutritionDecisionRuleResult {
  const comparisons: NutritionDecisionComparison[] = [];
  const alerts: NutritionDecisionAlert[] = [];
  const strategy = input.strategy;
  const plan = input.mealPlan;

  if (!strategy) {
    if (plan) {
      alerts.push(
        alert(
          "strategy-missing",
          "Plano sem estratégia",
          "Não existe Estratégia Nutricional disponível para orientar a comparação.",
          "HIGH",
          "Estratégia Nutricional",
        ),
      );
    }
  } else if (strategy.status !== "ACTIVE") {
    alerts.push(
      alert(
        "strategy-incomplete",
        "Estratégia incompleta",
        "A Estratégia Nutricional está em rascunho e requer revisão profissional.",
        "HIGH",
        "Estratégia Nutricional",
      ),
    );
  }

  if (!plan && strategy) {
    alerts.push(
      alert(
        "plan-missing",
        "Estratégia sem plano",
        "Existe contexto nutricional, mas nenhum Plano Alimentar foi localizado.",
        "HIGH",
        "Plano Alimentar",
      ),
    );
  }

  if (!strategy && !plan) {
    alerts.push(
      alert(
        "nutrition-data-missing",
        "Estratégia e plano não encontrados",
        "Não existem Estratégia Nutricional nem Plano Alimentar disponíveis para análise.",
        "HIGH",
        "Estratégia Nutricional e Plano Alimentar",
      ),
    );
  }

  if (plan && plan.status !== "APPROVED") {
    alerts.push(
      alert(
        "plan-review-status",
        "Plano requer revisão profissional",
        `O Plano Alimentar está no estado ${plan.status} e ainda não representa uma prescrição definitiva aprovada.`,
        plan.status === "REJECTED" ? "HIGH" : "MEDIUM",
        "Plano Alimentar",
      ),
    );
  }

  if (strategy && plan) {
    comparisons.push(
      objectiveComparison(strategy.objective ?? input.objective, plan.objective),
      numericComparison(
        "calories",
        "Energia",
        strategy.calories,
        plan.calories,
        "kcal",
        MEAL_PLAN_TARGET_TOLERANCES.calories,
      ),
      numericComparison(
        "protein",
        "Proteína",
        strategy.proteinGrams,
        plan.proteinGrams,
        "g",
        MEAL_PLAN_TARGET_TOLERANCES.proteinGrams,
      ),
      numericComparison(
        "carbohydrates",
        "Carboidratos",
        strategy.carbohydratesGrams,
        plan.carbohydratesGrams,
        "g",
        MEAL_PLAN_TARGET_TOLERANCES.carbohydratesGrams,
      ),
      numericComparison(
        "fats",
        "Lipídios",
        strategy.fatsGrams,
        plan.fatsGrams,
        "g",
        MEAL_PLAN_TARGET_TOLERANCES.fatsGrams,
      ),
      numericComparison(
        "fiber",
        "Fibras",
        strategy.fiberGrams,
        plan.fiberGrams,
        "g",
        MEAL_PLAN_TARGET_TOLERANCES.carbohydratesGrams,
      ),
      numericComparison(
        "hydration",
        "Hidratação",
        strategy.hydrationMl,
        plan.hydrationMl,
        "ml",
        MEAL_PLAN_TARGET_TOLERANCES.calories,
      ),
    );

    for (const comparison of comparisons) {
      if (
        comparison.status !== "REVIEW" &&
        comparison.status !== "DIVERGENT"
      ) {
        continue;
      }
      const below =
        typeof comparison.difference === "number" && comparison.difference < 0;
      alerts.push(
        alert(
          comparison.id,
          `${comparison.label} ${below ? "abaixo" : "acima"} da meta`,
          comparison.explanation,
          comparison.status === "DIVERGENT" ? "HIGH" : "MEDIUM",
          "Comparação Estratégia × Plano",
        ),
      );
    }

    if (!plan.meals.length) {
      alerts.push(
        alert(
          "plan-empty",
          "Plano sem refeições",
          "O Plano Alimentar não possui refeições registradas.",
          "HIGH",
          "Plano Alimentar",
        ),
      );
    }

    const emptyMeals = plan.meals.filter((meal) => meal.foodCount === 0);
    if (emptyMeals.length) {
      alerts.push(
        alert(
          "empty-meals",
          "Refeições vazias",
          `${emptyMeals.length} refeição(ões) não possui(em) alimentos registrados.`,
          "HIGH",
          "Plano Alimentar",
        ),
      );
    }

    const interval = maximumMealInterval(plan.meals);
    if (
      interval !== undefined &&
      interval > NUTRITION_DECISION_RULES.maxMealIntervalHours
    ) {
      alerts.push(
        alert(
          "meal-interval",
          "Revisar horários",
          `Foi identificado intervalo de ${interval.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} horas entre refeições.`,
          "LOW",
          "Horários do Plano Alimentar",
        ),
      );
    }
  }

  const { anthropometry } = input;
  if (anthropometry.weightKg === undefined) {
    alerts.push(
      alert(
        "weight-missing",
        "Peso ausente",
        "Não existe peso registrado na avaliação atual.",
        "MEDIUM",
        "Antropometria",
      ),
    );
  }
  if (anthropometry.heightCm === undefined) {
    alerts.push(
      alert(
        "height-missing",
        "Altura ausente",
        "Não existe altura registrada na avaliação atual.",
        "MEDIUM",
        "Antropometria",
      ),
    );
  }
  if (
    anthropometry.weightKg !== undefined &&
    anthropometry.bioimpedanceWeightKg !== undefined
  ) {
    const baseline = Math.max(
      anthropometry.weightKg,
      anthropometry.bioimpedanceWeightKg,
    );
    const difference =
      Math.abs(
        anthropometry.weightKg - anthropometry.bioimpedanceWeightKg,
      ) / baseline;
    if (difference > NUTRITION_DECISION_RULES.weightSourceDifference) {
      alerts.push(
        alert(
          "weight-incompatible",
          "Peso incompatível entre fontes",
          "O peso da antropometria difere mais de 5% do peso da bioimpedância.",
          "HIGH",
          "Antropometria e Bioimpedância",
        ),
      );
    }
  }

  if (
    !anthropometry.assessedAt ||
    ageInDays(anthropometry.assessedAt, input.analyzedAt) >
      NUTRITION_DECISION_RULES.recentAssessmentDays
  ) {
    alerts.push(
      alert(
        "assessment-recency",
        "Paciente sem avaliação recente",
        "Não há avaliação antropométrica registrada nos últimos 180 dias.",
        "MEDIUM",
        "Antropometria",
      ),
    );
  }

  const unavailableComparisons = comparisons.filter(
    (comparison) => comparison.status === "UNAVAILABLE",
  );
  if (unavailableComparisons.length) {
    alerts.push(
      alert(
        "incomplete-data",
        "Dados incompletos",
        `${unavailableComparisons.map((item) => item.label).join(", ")} sem dados suficientes para comparação.`,
        "LOW",
        "Estratégia Nutricional e Plano Alimentar",
      ),
    );
  }

  if (input.supplementCount > 0) {
    alerts.push(
      alert(
        "supplementation-review",
        "Revisar suplementação cadastrada",
        `${input.supplementCount} suplemento(s) está(ão) registrado(s) e permanece(m) sujeito(s) à revisão profissional.`,
        "LOW",
        "Anamnese e Estratégia Nutricional",
      ),
    );
  }

  const priorityRank: Readonly<Record<NutritionDecisionPriority, number>> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
  };
  const sortedAlerts = [...alerts].sort(
    (left, right) =>
      priorityRank[left.priority] - priorityRank[right.priority],
  );
  const priorities = sortedAlerts.map(
    (item): NutritionDecisionPriorityItem => ({
      id: `priority-${item.id}`,
      title: item.title,
      priority: item.priority,
      source: item.source,
    }),
  );
  const suggestions = sortedAlerts
    .map((item) => suggestionForAlert(item, comparisons))
    .filter((item): item is NutritionDecisionSuggestion => item !== null);

  return {
    comparisons,
    alerts: sortedAlerts,
    priorities,
    suggestions,
  };
}
