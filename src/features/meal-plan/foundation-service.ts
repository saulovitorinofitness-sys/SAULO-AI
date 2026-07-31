import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import {
  toMealPlanStrategyInheritance,
  type MealPlanStrategyInheritance,
} from "@/features/nutrition-strategy/inheritance";
import { nutritionStrategyInheritanceService } from "@/features/nutrition-strategy/inheritance-service";
import { nutritionStrategyRepository } from "@/features/nutrition-strategy/strategy-repository";

import { assembleMealPlanView } from "./foundation-view";
import { mealPlanRepository } from "./repository";

async function getDevelopmentStrategy(input: {
  readonly patientId: string;
  readonly attendanceId: string;
  readonly professionalUserId: string;
}): Promise<MealPlanStrategyInheritance | null> {
  if (process.env.NODE_ENV !== "development") return null;

  const draft = await nutritionStrategyRepository.get(
    input.patientId,
    input.attendanceId,
  );
  if (!draft) return null;

  const approvedAt = new Date().toISOString();

  return toMealPlanStrategyInheritance({
    ...draft,
    status: "APPROVED",
    approvedAt,
    approvedByUserId: input.professionalUserId,
    approvedByName: draft.responsibleName,
  });
}

export const mealPlanFoundationService = {
  async getOrCreate(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly scenario: ClinicalCollectionScenarioKey;
    readonly professionalUserId: string;
  }) {
    const approvedStrategy =
      await nutritionStrategyInheritanceService.getForMealPlan(
        input.patientId,
        input.attendanceId,
      );
    const strategy =
      approvedStrategy ?? (await getDevelopmentStrategy(input));

    if (!strategy) return null;

    const record = await mealPlanRepository.getOrCreateDraft({
      patientId: input.patientId,
      attendanceId: input.attendanceId,
      strategy,
      professionalUserId: input.professionalUserId,
    });

    return {
      plan: assembleMealPlanView({
        record,
        strategy,
        scenario: input.scenario,
      }),
      record,
      strategy,
    };
  },
};
