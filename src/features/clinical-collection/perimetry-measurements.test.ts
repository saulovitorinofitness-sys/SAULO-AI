import assert from "node:assert/strict";
import test from "node:test";

import { calculateBilateralDifferences, calculateRatio } from "./assessment-summary";
import {
  parsePerimetryInputs,
  perimetryMeasurementFields,
  validatePerimetryMeasurements,
} from "./perimetry-measurements";

test("mantém somente os 14 campos existentes com chaves únicas", () => {
  const keys = perimetryMeasurementFields.map((field) => field.key);

  assert.equal(keys.length, 14);
  assert.equal(new Set(keys).size, keys.length);
});

test("interpreta vírgula e ponto, preserva decimais e não troca campos", () => {
  const result = parsePerimetryInputs({
    waistCm: "82,55",
    hipCm: "101.125",
    rightArmCm: "34,5",
  });

  assert.deepEqual(result.errors, {});
  assert.equal(result.data.waistCm, 82.55);
  assert.equal(result.data.hipCm, 101.125);
  assert.equal(result.data.rightArmCm, 34.5);
});

test("mantém vazio ausente e rejeita zero, negativo e texto inválido", () => {
  const result = parsePerimetryInputs({
    waistCm: "",
    hipCm: "0",
    rightArmCm: "-1",
    leftArmCm: "valor",
  });

  assert.equal(result.data.waistCm, undefined);
  assert.equal(result.data.hipCm, undefined);
  assert.match(result.errors.hipCm ?? "", /maior que zero/);
  assert.match(result.errors.rightArmCm ?? "", /maior que zero/);
  assert.match(result.errors.leftArmCm ?? "", /maior que zero/);
});

test("validação central rejeita requisições numéricas incompatíveis", () => {
  assert.deepEqual(validatePerimetryMeasurements({ waistCm: 82.5 }), {});
  assert.deepEqual(validatePerimetryMeasurements({ waistCm: 0 }), {
    waistCm: "Cintura deve ser uma medida maior que zero.",
  });
  assert.deepEqual(validatePerimetryMeasurements({ hipCm: -10 }), {
    hipCm: "Quadril deve ser uma medida maior que zero.",
  });
});

test("cálculos existentes exigem todos os dados válidos", () => {
  assert.equal(calculateRatio(82.5, 101), 0.82);
  assert.equal(calculateRatio(82.5, undefined), undefined);
  assert.equal(calculateRatio(0, 101), undefined);
  assert.deepEqual(calculateBilateralDifferences({ rightArmCm: 34.5 }), []);
  assert.equal(
    calculateBilateralDifferences({ rightArmCm: 34.5, leftArmCm: 34 })[0]
      ?.differenceCm,
    0.5,
  );
});
