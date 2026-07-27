import { toMealPlanStrategyInheritance } from "./inheritance";
import { nutritionStrategyRepository } from "./strategy-repository";
import type { MealPlanStrategyInheritance } from "./inheritance";

export const nutritionStrategyInheritanceService = {
  async getForMealPlan(
    patientId: string,
    attendanceId: string,
  ): Promise<MealPlanStrategyInheritance | null> {
    const approved = await nutritionStrategyRepository.get(
      patientId,
      attendanceId,
    );
    return approved ? toMealPlanStrategyInheritance(approved) : null;
  },
};

export type { MealPlanStrategyInheritance } from "./inheritance";
