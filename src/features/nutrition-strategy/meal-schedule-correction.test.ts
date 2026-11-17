import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  mealScheduleCorrectionHref,
  presentMealSchedules,
} from "./meal-schedule";

const emptySixMealSchedule = Array.from({ length: 6 }, (_, index) => ({
  mealNumber: index + 1,
  name: index % 2 === 0 ? "" : `Refeição ${index + 1}`,
  time: "",
  vetPercentage: index === 5 ? 16.65 : 16.67,
}));

test("apresenta os seis nomes clínicos reais sem inventar horários", () => {
  const presented = presentMealSchedules(emptySixMealSchedule);

  assert.deepEqual(
    presented.map((meal) => meal.name),
    [
      "Desjejum",
      "Lanche da manhã",
      "Almoço",
      "Lanche da tarde",
      "Jantar",
      "Ceia",
    ],
  );
  assert.ok(presented.every((meal) => meal.time === ""));
});

test("ida para a Estratégia preserva patientId e attendanceId e isola atendimentos", () => {
  const first = mealScheduleCorrectionHref("patient-1", "attendance-1");
  const second = mealScheduleCorrectionHref("patient-1", "attendance-2");

  assert.match(first, /patient-1\/estrategia-nutricional/);
  assert.match(first, /attendanceId=attendance-1/);
  assert.match(first, /section=daily-distribution/);
  assert.match(first, /returnTo=meal-plan/);
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /attendance-2/);
});

test("correção auditável mantém a Estratégia finalizada e retorna ao mesmo Plano", async () => {
  const [repository, route, page, strategyWorkspace, mealPlanWorkspace] =
    await Promise.all([
      readFile(new URL("./strategy-repository.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../../app/api/patients/[patientId]/attendances/[attendanceId]/nutrition-strategy/route.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../app/(authenticated)/pacientes/[patientId]/estrategia-nutricional/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/nutrition-strategy/nutrition-strategy-decision-engine.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/meal-plan/meal-plan-foundation-workspace.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  const update = repository.slice(
    repository.indexOf("async updateApprovedMealSchedules("),
    repository.indexOf("async reopen("),
  );
  assert.match(update, /attendanceId,/);
  assert.match(update, /status: "FINALIZED"/);
  assert.doesNotMatch(update, /status: "DRAFT"/);
  assert.match(update, /recordVersion\.create/);
  assert.match(update, /auditEvent\.create/);
  assert.match(route, /action === "UPDATE_MEAL_SCHEDULES"/);
  assert.match(page, /query\.section === "daily-distribution"/);
  assert.match(strategyWorkspace, /attendanceId: view\.attendanceId/);
  assert.match(strategyWorkspace, /nutritionClinicalFlowHref\("MEAL_PLAN"/);
  assert.match(mealPlanWorkspace, /Corrigir horários na Estratégia/);
  assert.match(mealPlanWorkspace, /Prévia anterior inativa enquanto os horários estão pendentes/);
});
