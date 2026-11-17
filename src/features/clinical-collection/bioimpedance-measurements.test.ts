import assert from "node:assert/strict";
import test from "node:test";

import { calculateBmi } from "./anthropometry-calculations";
import {
  bioimpedanceEditableFields,
  bioimpedanceMeasurementFields,
  parseBioimpedanceInputs,
  validateBioimpedanceMeasurements,
} from "./bioimpedance-measurements";

test("preserva os 25 campos existentes e os 23 editáveis", () => {
  const keys = bioimpedanceMeasurementFields.map((field) => field.key);

  assert.equal(keys.length, 25);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(bioimpedanceEditableFields.length, 23);
  assert.equal(bioimpedanceEditableFields.some((field) => field.key === "weightKg"), false);
  assert.equal(bioimpedanceEditableFields.some((field) => field.key === "bmi"), false);
});

test("interpreta vírgula e ponto, preserva precisão e não troca campos", () => {
  const result = parseBioimpedanceInputs({
    bodyFatPercent: "24,55",
    fatMassKg: "18.125",
    totalBodyWaterL: "40,75",
  });

  assert.deepEqual(result.errors, {});
  assert.equal(result.data.bodyFatPercent, 24.55);
  assert.equal(result.data.fatMassKg, 18.125);
  assert.equal(result.data.totalBodyWaterL, 40.75);
});

test("mantém vazio ausente e rejeita zero, negativo e texto", () => {
  const result = parseBioimpedanceInputs({
    fatMassKg: "",
    fatFreeMassKg: "0",
    skeletalMuscleMassKg: "-1",
    mineralsKg: "valor",
  });

  assert.equal(result.data.fatMassKg, undefined);
  assert.match(result.errors.fatFreeMassKg ?? "", /maior que zero/);
  assert.match(result.errors.skeletalMuscleMassKg ?? "", /maior que zero/);
  assert.match(result.errors.mineralsKg ?? "", /maior que zero/);
});

test("valida percentual de gordura e idade metabólica", () => {
  assert.deepEqual(parseBioimpedanceInputs({ bodyFatPercent: "100" }).errors, {});
  assert.match(
    parseBioimpedanceInputs({ bodyFatPercent: "100,1" }).errors.bodyFatPercent ?? "",
    /menor ou igual a 100/,
  );
  assert.match(
    parseBioimpedanceInputs({ metabolicAgeYears: "42,5" }).errors.metabolicAgeYears ?? "",
    /anos inteiros/,
  );
  assert.deepEqual(
    validateBioimpedanceMeasurements({ metabolicAgeYears: 42 }),
    {},
  );
});

test("IMC existente exige peso e altura positivos", () => {
  assert.equal(calculateBmi(67, 1.85), 19.58);
  assert.equal(calculateBmi(undefined, 1.85), undefined);
  assert.equal(calculateBmi(67, undefined), undefined);
  assert.equal(calculateBmi(0, 1.85), undefined);
});
