import assert from "node:assert/strict";
import test from "node:test";

import { canAccess } from "@/features/mvp";
import {
  BUILT_IN_ACCESS_POLICIES,
  BUILT_IN_IDS,
} from "@/modules/permissions";
import {
  canOperatePerformance,
  canOperatePosturalAssessment,
} from "./permissions";

test("Saulo possui acesso total, inclusive à Avaliação Postural", () => {
  const snapshot = {
    user: {
      id: BUILT_IN_IDS.users.sauloXavierVitorino,
      fullName: "Saulo Xavier Vitorino",
      status: "ACTIVE" as const,
      roleName: "Acesso total",
    },
    grantsAllModules: true,
    allowsNutritionModules: true,
    overrides:
      BUILT_IN_ACCESS_POLICIES.sauloXavierVitorino.overrides,
  };

  assert.equal(
    canAccess(snapshot, "POSTURAL_ASSESSMENT", "UPDATE"),
    true,
  );
  assert.equal(
    canAccess(snapshot, "POSTURAL_ASSESSMENT", "READ"),
    true,
  );
  assert.equal(canAccess(snapshot, "MEAL_PLAN", "UPDATE"), true);
  assert.equal(
    canOperatePosturalAssessment(snapshot.user.id),
    true,
  );
  assert.equal(canOperatePerformance(snapshot.user.id), true);
});

test("Maria executa avaliação postural sem acessar Nutrição", () => {
  const snapshot = {
    user: {
      id: BUILT_IN_IDS.users.mariaDeLourdesGomes,
      fullName: "Maria de Lourdes Gomes",
      status: "ACTIVE" as const,
      roleName: "Profissional",
    },
    grantsAllModules: true,
    allowsNutritionModules: false,
    overrides:
      BUILT_IN_ACCESS_POLICIES.mariaDeLourdesGomes.overrides,
  };

  assert.equal(
    canAccess(snapshot, "POSTURAL_ASSESSMENT", "UPDATE"),
    true,
  );
  assert.equal(canAccess(snapshot, "MEAL_PLAN", "READ"), false);
  assert.equal(
    canAccess(snapshot, "NUTRITION_STRATEGY", "UPDATE"),
    false,
  );
  assert.equal(
    canOperatePosturalAssessment(snapshot.user.id),
    true,
  );
  assert.equal(canOperatePerformance(snapshot.user.id), true);
});

test("usuário sem vínculo aprovado não opera a Avaliação Postural", () => {
  assert.equal(
    canOperatePosturalAssessment("00000000-0000-4000-8000-999999999999"),
    false,
  );
  assert.equal(
    canOperatePerformance("00000000-0000-4000-8000-999999999999"),
    false,
  );
});
