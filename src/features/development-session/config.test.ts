import assert from "node:assert/strict";
import test from "node:test";

import {
  DEVELOPMENT_PROFESSIONALS,
  canDevelopmentUserAccess,
  canDevelopmentUserOpenPath,
  canDevelopmentUserOperatePostural,
} from "./config";

test("Saulo acessa módulos gerais e nutricionais, mas não opera avaliação postural", () => {
  const saulo = DEVELOPMENT_PROFESSIONALS.saulo;

  assert.equal(
    canDevelopmentUserAccess(
      saulo,
      "PHYSICAL_ASSESSMENT",
      "UPDATE",
    ),
    true,
  );
  assert.equal(
    canDevelopmentUserAccess(saulo, "BIOIMPEDANCE", "UPDATE"),
    true,
  );
  assert.equal(
    canDevelopmentUserAccess(saulo, "PERIMETRY", "UPDATE"),
    true,
  );
  assert.equal(
    canDevelopmentUserAccess(saulo, "MEAL_PLAN", "READ"),
    true,
  );
  assert.equal(canDevelopmentUserOperatePostural(saulo), false);
});

test("Maria opera avaliação postural e acessa avaliações físicas compartilhadas", () => {
  const maria = DEVELOPMENT_PROFESSIONALS.maria;

  assert.equal(
    canDevelopmentUserAccess(
      maria,
      "POSTURAL_ASSESSMENT",
      "UPDATE",
    ),
    true,
  );
  assert.equal(canDevelopmentUserOperatePostural(maria), true);
  assert.equal(
    canDevelopmentUserAccess(
      maria,
      "PHYSICAL_ASSESSMENT",
      "UPDATE",
    ),
    true,
  );
  assert.equal(
    canDevelopmentUserAccess(maria, "BIOIMPEDANCE", "UPDATE"),
    true,
  );
  assert.equal(
    canDevelopmentUserAccess(maria, "PERIMETRY", "UPDATE"),
    true,
  );
});

test("Maria não acessa módulos e rotas exclusivos de Nutrição", () => {
  const maria = DEVELOPMENT_PROFESSIONALS.maria;

  assert.equal(
    canDevelopmentUserAccess(
      maria,
      "NUTRITION_STRATEGY",
      "READ",
    ),
    false,
  );
  assert.equal(
    canDevelopmentUserAccess(maria, "MEAL_PLAN", "UPDATE"),
    false,
  );
  assert.equal(
    canDevelopmentUserOpenPath(
      maria,
      "/pacientes/demo/estrategia-nutricional",
    ),
    false,
  );
  assert.equal(
    canDevelopmentUserOpenPath(
      maria,
      "/pacientes/demo/plano-alimentar",
    ),
    false,
  );
  assert.equal(
    canDevelopmentUserOpenPath(maria, "/pacientes/demo"),
    true,
  );
});
