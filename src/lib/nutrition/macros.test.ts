import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCarbohydratesByDifference,
  calculateMacronutrient,
  validateMacroDistribution,
} from "./index";

const finalCalories = 2000;
const weightKg = 68;

test("recalcula proteína informada por g/kg", () => {
  const protein = calculateMacronutrient(
    "protein",
    "GRAMS_PER_KG",
    1.6,
    finalCalories,
    weightKg,
  );

  assert.ok(protein);
  assert.ok(Math.abs(protein.grams - 108.8) < 0.00001);
  assert.ok(Math.abs(protein.kcal - 435.2) < 0.00001);
  assert.ok(Math.abs(protein.percentage - 21.76) < 0.00001);
});

test("recalcula lipídios informados por percentual", () => {
  const fats = calculateMacronutrient(
    "fats",
    "PERCENTAGE",
    30,
    finalCalories,
    weightKg,
  );

  assert.ok(fats);
  assert.ok(Math.abs(fats.grams - 66.6666666667) < 0.00001);
  assert.equal(fats.kcal, 600);
  assert.equal(fats.percentage, 30);
});

test("calcula carboidratos por diferença e fecha 100%", () => {
  const protein = calculateMacronutrient(
    "protein",
    "GRAMS_PER_KG",
    1.6,
    finalCalories,
    weightKg,
  );
  const fats = calculateMacronutrient(
    "fats",
    "PERCENTAGE",
    30,
    finalCalories,
    weightKg,
  );
  assert.ok(protein);
  assert.ok(fats);

  const carbohydrates = calculateCarbohydratesByDifference(
    finalCalories,
    protein.kcal,
    fats.kcal,
    weightKg,
  );
  const validation = validateMacroDistribution(finalCalories, [
    protein,
    carbohydrates,
    fats,
  ]);

  assert.ok(carbohydrates);
  assert.ok(Math.abs(carbohydrates.grams - 241.2) < 0.00001);
  assert.ok(validation);
  assert.ok(Math.abs(validation.percentageTotal - 100) < 0.00001);
  assert.ok(Math.abs(validation.differenceKcal) < 0.00001);
  assert.equal(validation.status, "ADEQUATE");
});

test("edição manual de carboidratos atualiza distribuição sem alterar outros macros", () => {
  const protein = calculateMacronutrient(
    "protein",
    "GRAMS_PER_KG",
    1.6,
    finalCalories,
    weightKg,
  );
  const fats = calculateMacronutrient(
    "fats",
    "PERCENTAGE",
    30,
    finalCalories,
    weightKg,
  );
  const carbohydrates = calculateMacronutrient(
    "carbohydrates",
    "GRAMS_PER_KG",
    4,
    finalCalories,
    weightKg,
  );
  const validation = validateMacroDistribution(finalCalories, [
    protein,
    carbohydrates,
    fats,
  ]);

  assert.ok(protein);
  assert.ok(Math.abs(protein.grams - 108.8) < 0.00001);
  assert.equal(fats?.kcal, 600);
  assert.equal(carbohydrates?.grams, 272);
  assert.ok(validation);
  assert.ok(Math.abs(validation.differenceKcal - 123.2) < 0.00001);
  assert.equal(validation.status, "OUTSIDE_TARGET");
});

test("rejeita zero, negativos e entradas não finitas", () => {
  assert.equal(
    calculateMacronutrient("protein", "GRAMS", 0, finalCalories, weightKg),
    undefined,
  );
  assert.equal(
    calculateMacronutrient("fats", "GRAMS", -10, finalCalories, weightKg),
    undefined,
  );
  assert.equal(
    calculateMacronutrient(
      "carbohydrates",
      "GRAMS",
      Number.NaN,
      finalCalories,
      weightKg,
    ),
    undefined,
  );
});
