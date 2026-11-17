"use client";

import type { MealPlanPrescriptionView } from "@/features/meal-plan";

import { MealPlanFoundationWorkspace } from "./meal-plan-foundation-workspace";

interface MealPlanWorkspaceProps {
  initialPlan: MealPlanPrescriptionView;
}

export function MealPlanWorkspace({
  initialPlan,
}: MealPlanWorkspaceProps) {
  return <MealPlanFoundationWorkspace initialPlan={initialPlan} />;
}
