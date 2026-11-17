import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy";
import { resolveMealPlanObjective } from "@/features/nutrition-strategy";

import { assembleMealPlanView } from "./foundation-view";

function approvedStrategy(input: {
  attendanceId: string;
  objective: MealPlanStrategyInheritance["objective"];
  sportsObjective?: string;
  sportsObjectiveOther?: string;
}): MealPlanStrategyInheritance {
  return {
    sourceStrategyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    patientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    masterRecordId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    attendanceId: input.attendanceId,
    objective: input.objective,
    secondaryObjectives: [],
    method: input.sportsObjective ? "SPORTS_PERIODIZATION" : "STANDARD",
    specificConfigurations: input.sportsObjective
      ? {
          sportsPeriodization: {
            phase: "HYPERTROPHY",
            objective: input.sportsObjective,
            objectiveOther: input.sportsObjectiveOther,
            sport: "Corrida",
            startDate: "2026-10-01",
            endDate: "2026-10-31",
            trainingDays: ["MON"],
            restDays: ["TUE"],
            competitionDays: [],
          },
        }
      : {},
    protocol: "MIFFLIN_ST_JEOR",
    totalEnergyExpenditureKcal: 2_295,
    caloriesKcal: 1_836,
    proteinGrams: 114.7,
    proteinPercentage: 25,
    carbohydratesGrams: 206.5,
    carbohydratesPercentage: 45,
    fatsGrams: 61.2,
    fatsPercentage: 30,
    fiberGrams: 30,
    waterMl: 2_500,
    mealCount: 6,
    mealDistribution: Array.from({ length: 6 }, (_, index) => ({
      mealNumber: index + 1,
      name: `Refeição ${index + 1}`,
      time: "",
      vetPercentage: index === 5 ? 16.65 : 16.67,
      plannedCaloriesKcal: index === 5 ? 305.7 : 306.1,
    })),
    supplementation: [],
    clinicalObservations: "",
    calorieAdjustmentPercentage: -20,
    status: "APPROVED",
    approvedAt: "2026-10-12T12:00:00.000Z",
    approvedByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  };
}

function recordFor(strategy: MealPlanStrategyInheritance) {
  return {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    patientId: strategy.patientId,
    patientName: "Paciente",
    masterRecordId: strategy.masterRecordId,
    attendanceId: strategy.attendanceId,
    strategyEntryId: strategy.sourceStrategyId,
    status: "DRAFT" as const,
    responsibleUserId: strategy.approvedByUserId,
    responsibleProfessional: "Saulo Xavier Vitorino",
    createdAt: "2026-10-12T12:01:00.000Z",
    updatedAt: "2026-10-12T12:01:00.000Z",
    revision: 1,
    supplements: [],
    history: [],
    meals: strategy.mealDistribution.map((meal) => ({
      id: `00000000-0000-4000-8000-00000000000${meal.mealNumber}`,
      name: meal.name,
      order: meal.mealNumber,
      items: [],
    })),
  };
}

test("Plano usa Redução de gordura da periodização, sem confundir fase Hipertrofia ou modalidade", () => {
  const strategy = approvedStrategy({
    attendanceId: "11111111-1111-4111-8111-111111111111",
    objective: "HYPERTROPHY",
    sportsObjective: "FAT_LOSS",
  });
  const objective = resolveMealPlanObjective(strategy);
  const plan = assembleMealPlanView({
    scenario: "complete",
    strategy,
    record: recordFor(strategy),
  });

  assert.deepEqual(objective, {
    code: "FAT_LOSS",
    label: "Redução de gordura",
    source: "SPORTS_PERIODIZATION_OBJECTIVE",
  });
  assert.equal(strategy.specificConfigurations?.sportsPeriodization?.phase, "HYPERTROPHY");
  assert.equal(strategy.specificConfigurations?.sportsPeriodization?.sport, "Corrida");
  assert.equal(plan.summary.primaryObjective, "Redução de gordura");
  assert.equal(plan.summary.plannedCalories, "1.836 kcal");
  assert.equal(plan.summary.mealCount, 6);
  assert.equal(plan.summary.protein, "114,7 g · 25%");
  assert.equal(plan.summary.carbohydrates, "206,5 g · 45%");
  assert.equal(plan.summary.fats, "61,2 g · 30%");
});

test("objetivos futuros continuam resolvidos pela Estratégia aprovada", () => {
  const cases = [
    ["WEIGHT_LOSS", "Emagrecimento"],
    ["MAINTENANCE", "Manutenção"],
    ["PERFORMANCE", "Performance"],
  ] as const;

  for (const [objective, label] of cases) {
    assert.equal(
      resolveMealPlanObjective(
        approvedStrategy({
          attendanceId: "11111111-1111-4111-8111-111111111111",
          objective,
        }),
      ).label,
      label,
    );
  }

  assert.equal(
    resolveMealPlanObjective(
      approvedStrategy({
        attendanceId: "11111111-1111-4111-8111-111111111111",
        objective: "HEALTH",
        sportsObjective: "OTHER",
        sportsObjectiveOther: "Recomposição corporal",
      }),
    ).label,
    "Recomposição corporal",
  );
});

test("Plano não herda objetivo de outro atendimento nem snapshot legado", async () => {
  const current = approvedStrategy({
    attendanceId: "11111111-1111-4111-8111-111111111111",
    objective: "WEIGHT_LOSS",
  });
  const otherAttendance = approvedStrategy({
    attendanceId: "22222222-2222-4222-8222-222222222222",
    objective: "HYPERTROPHY",
  });
  const plan = assembleMealPlanView({
    scenario: "complete",
    strategy: current,
    record: {
      ...recordFor(current),
      strategySnapshot: otherAttendance,
    },
  });
  const [service, workspace] = await Promise.all([
    readFile(new URL("./foundation-service.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../components/meal-plan/meal-plan-foundation-workspace.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.equal(plan.attendanceId, current.attendanceId);
  assert.equal(plan.summary.primaryObjective, "Emagrecimento");
  assert.notEqual(plan.summary.primaryObjective, "Hipertrofia");
  assert.match(
    service,
    /getForMealPlan\([\s\S]*input\.patientId,[\s\S]*input\.attendanceId/,
  );
  assert.match(workspace, /planObjective!\.label/);
  assert.doesNotMatch(workspace, /NUTRITION_OBJECTIVES\[strategy\.objective\]/);
});
