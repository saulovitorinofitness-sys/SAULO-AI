import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { nutritionStrategyInheritanceService } from "@/features/nutrition-strategy/inheritance-service";

import { assembleMealPlanView } from "./foundation-view";
import { mealPlanRepository } from "./repository";

export const mealPlanFoundationService = {
  async getOrCreate(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly scenario: ClinicalCollectionScenarioKey;
    readonly professionalUserId: string;
  }) {
    const strategy = await nutritionStrategyInheritanceService.getForMealPlan(
      input.patientId,
      input.attendanceId,
    );
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
