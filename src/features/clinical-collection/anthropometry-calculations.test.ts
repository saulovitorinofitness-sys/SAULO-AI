import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBmi,
  formatHeightFromCentimeters,
  heightMetersToCentimeters,
  normalizeHeightMeters,
  parseLocalizedDecimal,
  validateAnthropometryMeasurements,
} from "./anthropometry-calculations";

test("interpreta peso e altura com vírgula ou ponto sem usar zero", () => {
  assert.equal(parseLocalizedDecimal("65,5"), 65.5);
  assert.equal(parseLocalizedDecimal("65.5"), 65.5);
  assert.equal(normalizeHeightMeters("1,565"), 1.565);
  assert.equal(normalizeHeightMeters("156.5"), 1.565);
  assert.equal(parseLocalizedDecimal(""), undefined);
  assert.equal(parseLocalizedDecimal("0"), undefined);
  assert.equal(parseLocalizedDecimal("-65"), undefined);
});

test("preserva frações de centímetro ao persistir e reabrir", () => {
  assert.equal(heightMetersToCentimeters(1.565), 156.5);
  assert.equal(formatHeightFromCentimeters(156.5), "1,565");
  assert.equal(heightMetersToCentimeters(1.56555), 156.555);
  assert.equal(formatHeightFromCentimeters(156.555), "1,56555");
});

test("valida peso e altura obrigatórios, finitos e positivos", () => {
  assert.deepEqual(validateAnthropometryMeasurements({}), {
    weightKg: "Informe o peso.",
    heightCm: "Informe a altura.",
  });
  assert.deepEqual(
    validateAnthropometryMeasurements({ weightKg: -1, heightCm: 0 }),
    {
      weightKg: "O peso deve ser um número maior que zero.",
      heightCm: "A altura deve ser um número maior que zero.",
    },
  );
  assert.deepEqual(
    validateAnthropometryMeasurements({ weightKg: 65.5, heightCm: 156.5 }),
    {},
  );
});

test("calcula IMC somente quando peso e altura válidos estão presentes", () => {
  assert.equal(calculateBmi(65.5, 1.565), 26.74);
  assert.equal(calculateBmi(undefined, 1.565), undefined);
  assert.equal(calculateBmi(65.5, undefined), undefined);
  assert.equal(calculateBmi(0, 1.565), undefined);
});
