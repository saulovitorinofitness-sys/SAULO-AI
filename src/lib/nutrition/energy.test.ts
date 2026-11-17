import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBasalMetabolicRate,
  calculateEnergyStrategy,
  calculateTotalEnergyExpenditure,
  resolveActivityFactor,
} from "./index";

const adultMale = {
  sex: "MALE",
  ageYears: 34,
  weightKg: 82.4,
  heightCm: 178,
  leanMassKg: 67,
} as const;

test("calcula Harris-Benedict com a equação oficial", () => {
  const result = calculateBasalMetabolicRate({
    ...adultMale,
    protocol: "HARRIS_BENEDICT",
  });

  assert.equal(result?.protocol, "Harris-Benedict");
  assert.ok(result);
  assert.ok(Math.abs(result.value - 1860.52224) < 0.00001);
});

test("calcula Mifflin-St Jeor", () => {
  const result = calculateBasalMetabolicRate({
    ...adultMale,
    protocol: "MIFFLIN_ST_JEOR",
  });

  assert.equal(result?.protocol, "Mifflin-St Jeor");
  assert.equal(result?.value, 1771.5);
});

test("calcula Cunningham a partir da massa magra", () => {
  const result = calculateBasalMetabolicRate({
    ...adultMale,
    protocol: "CUNNINGHAM",
  });

  assert.equal(result?.protocol, "Cunningham");
  assert.equal(result?.value, 1974);
});

test("calcula FAO/OMS na faixa etária correspondente", () => {
  const result = calculateBasalMetabolicRate({
    ...adultMale,
    protocol: "FAO_WHO",
  });

  assert.equal(result?.protocol, "FAO/OMS");
  assert.ok(result);
  assert.ok(Math.abs(result.value - 1834.84) < 0.00001);
});

test("calcula GET a partir da TMB e do fator de atividade", () => {
  const result = calculateTotalEnergyExpenditure(1771.5, 1.55);
  assert.ok(result);
  assert.ok(Math.abs(result - 2745.825) < 0.00001);
});

test("converte apenas níveis de atividade explicitamente registrados", () => {
  assert.equal(resolveActivityFactor("Sedentário"), 1.2);
  assert.equal(resolveActivityFactor("Levemente ativo"), 1.375);
  assert.equal(resolveActivityFactor("Moderadamente ativo"), 1.55);
  assert.equal(resolveActivityFactor("Muito ativo"), 1.725);
  assert.equal(resolveActivityFactor("Extremamente ativo"), 1.9);
  assert.equal(resolveActivityFactor("1,55"), 1.55);
  assert.equal(resolveActivityFactor("3 vezes por semana"), undefined);
  assert.equal(resolveActivityFactor("Personalizado"), undefined);
});

test("não retorna valores inválidos quando faltam dados", () => {
  const result = calculateEnergyStrategy({
    sex: "FEMALE",
    ageYears: 40,
    weightKg: 65,
    protocol: "MIFFLIN_ST_JEOR",
  });

  assert.equal(result.basalMetabolicRate, undefined);
  assert.equal(result.totalEnergyExpenditure, undefined);
  assert.equal(calculateTotalEnergyExpenditure(Number.NaN, 1.2), undefined);
  assert.equal(calculateTotalEnergyExpenditure(1500, 0), undefined);
});
