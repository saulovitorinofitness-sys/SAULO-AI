import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { householdMeasureRepository } from "@/features/food-database/household-measure-repository";
import { nutritionStrategyInheritanceService } from "@/features/nutrition-strategy/inheritance-service";

import { assembleMealPlanView } from "./foundation-view";
import { attachConfirmedIbgeMeasures } from "./food-snapshot";
import { mealPlanRepository } from "./repository";

export const mealPlanFoundationService = {
  async getOrCreate(input: {
    readonly patientId: string;
    readonly attendanceId: string;
    readonly scenario: ClinicalCollectionScenarioKey;
    readonly professionalUserId: string;
    readonly strategySkipped?: boolean;
  }) {
    const current = await mealPlanRepository.get(
      input.patientId,
      input.attendanceId,
    );
    const latestDelivered = current
      ? null
      : await mealPlanRepository.getLatestDeliveredForAttendanceMasterRecord(
          input.patientId,
          input.attendanceId,
        );
    const currentStrategy =
      await nutritionStrategyInheritanceService.getForMealPlan(
        input.patientId,
        input.attendanceId,
      );
    const strategy = currentStrategy;

    if (!strategy && !input.strategySkipped) return null;

    const record =
      current ??
      (strategy
        ? await mealPlanRepository.getOrCreateDraft({
            patientId: input.patientId,
            attendanceId: input.attendanceId,
            strategy,
            professionalUserId: input.professionalUserId,
            sourcePlan: latestDelivered ?? undefined,
          })
        : await mealPlanRepository.getOrCreateManualDraft({
            patientId: input.patientId,
            attendanceId: input.attendanceId,
            professionalUserId: input.professionalUserId,
            sourcePlan: latestDelivered ?? undefined,
          }));

    const measureOptions = await householdMeasureRepository.findConfirmedOptionsByFoodIds(
      record.meals.flatMap((meal) => meal.items.map((item) => item.catalogFoodId)),
    );
    const hydratedRecord = attachConfirmedIbgeMeasures(record, measureOptions);

    return {
      plan: assembleMealPlanView({
        record: hydratedRecord,
        strategy: strategy ?? undefined,
        scenario: input.scenario,
      }),
      record: hydratedRecord,
      strategy,
    };
  },
};
