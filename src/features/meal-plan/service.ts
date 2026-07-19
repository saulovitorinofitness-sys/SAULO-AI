import { mealPlanMock } from "./mock-data";
import type { GetMealPlanInput, MealPlanView } from "./contracts";

export const mealPlanService = {
  async get(input: GetMealPlanInput): Promise<MealPlanView | null> {
    if (input.patientId !== mealPlanMock.patientId) return null;
    return structuredClone({ ...mealPlanMock, scenario: input.scenario });
  },
};
