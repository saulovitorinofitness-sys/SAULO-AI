import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import * as XLSX from "@e965/xlsx";

import type {
  FoodNutrientIdentifier,
  FoodNutrientObservationDraft,
} from "./contracts";
import { parseTacoWorkbook, readTacoWorkbook } from "./taco-xlsx";

const tacoFile = resolve("data/imports/food/raw/Taco-4a-Edicao.xlsx");

function scientificMarkerFixture() {
  const nutrientRow = Array<unknown>(29).fill(null);
  nutrientRow[0] = 1;
  nutrientRow[1] = "Alimento científico de teste";
  nutrientRow[3] = 123.4;
  nutrientRow[5] = "Tr";
  nutrientRow[6] = "NA";
  nutrientRow[8] = "*";
  nutrientRow[9] = ";0,02";

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Grupo de teste"], nutrientRow]),
    "CMVCol taco3",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([[]]),
    "AGtaco3",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([[]]),
    "Aminoácidos TACO3",
  );

  return parseTacoWorkbook(
    XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
    "fixture-taco.xlsx",
  );
}

const fixture = scientificMarkerFixture();
const fixtureFood = fixture.package.foods[0];

function observation(
  nutrientKey: FoodNutrientIdentifier,
): FoodNutrientObservationDraft {
  const result = fixtureFood?.nutrientObservations.find(
    (candidate) => candidate.nutrientKey === nutrientKey,
  );
  assert.ok(result, `Observação ausente para ${nutrientKey}.`);
  return result;
}

test("preserva valor numérico, valor bruto e unidade", () => {
  const energy = observation("energyKcal");

  assert.equal(energy.qualifier, "VALUE");
  assert.equal(energy.rawValue, "123.4");
  assert.equal(energy.numericValue, 123.4);
  assert.equal(energy.unit, "kcal");
});

test("preserva Tr como TRACE sem converter em zero ou ausência comum", () => {
  const protein = observation("proteinGrams");

  assert.equal(protein.qualifier, "TRACE");
  assert.equal(protein.rawValue, "Tr");
  assert.equal(protein.numericValue, null);
  assert.notEqual(protein.qualifier, "MISSING");
  assert.notEqual(protein.numericValue, 0);
});

test("preserva NA como NOT_APPLICABLE", () => {
  const fats = observation("fatsGrams");

  assert.equal(fats.qualifier, "NOT_APPLICABLE");
  assert.equal(fats.rawValue, "NA");
  assert.equal(fats.numericValue, null);
});

test("classifica célula vazia como NOT_ANALYZED sem inventar valor", () => {
  const cholesterol = observation("cholesterolMg");

  assert.equal(cholesterol.qualifier, "NOT_ANALYZED");
  assert.equal(cholesterol.rawValue, "");
  assert.equal(cholesterol.numericValue, null);
  assert.notEqual(cholesterol.numericValue, 0);
});

test("preserva análise em reavaliação como MISSING conservador", () => {
  const carbohydrates = observation("carbohydratesGrams");

  assert.equal(carbohydrates.rawValue, "*");
  assert.equal(carbohydrates.qualifier, "MISSING");
  assert.equal(carbohydrates.numericValue, null);
  assert.equal(carbohydrates.dataOrigin, "TACO, 4ª edição");
  assert.notEqual(carbohydrates.numericValue, 0);
});

test("preserva ;0,02 como irregular e inclui aviso sem normalização silenciosa", () => {
  const fiber = observation("fiberGrams");

  assert.equal(fiber.rawValue, ";0,02");
  assert.equal(fiber.qualifier, "MISSING");
  assert.equal(fiber.numericValue, null);
  assert.notEqual(fiber.numericValue, 0.02);
  assert.ok(
    fixture.warnings.some(
      (warning) =>
        warning.code === "1" &&
        warning.reason.includes(";0,02") &&
        warning.reason.includes("não reconhecido"),
    ),
  );
});

test("mantém números legados e não converte qualificadores não numéricos em zero", () => {
  assert.equal(fixtureFood?.nutrients.energyKcal, 123.4);
  assert.equal(fixtureFood?.nutrients.proteinGrams, null);
  assert.equal(fixtureFood?.nutrients.fatsGrams, null);
  assert.equal(fixtureFood?.nutrients.cholesterolMg, null);
  assert.equal(fixtureFood?.nutrients.carbohydratesGrams, null);
  assert.equal(fixtureFood?.nutrients.fiberGrams, null);

  for (const value of [
    fixtureFood?.nutrients.proteinGrams,
    fixtureFood?.nutrients.fatsGrams,
    fixtureFood?.nutrients.cholesterolMg,
    fixtureFood?.nutrients.carbohydratesGrams,
    fixtureFood?.nutrients.fiberGrams,
  ]) {
    assert.notEqual(value, 0);
  }
});

test("processa localmente os 597 alimentos oficiais sem rejeições", async () => {
  const parsed = await readTacoWorkbook(tacoFile);
  const codes = parsed.package.foods.map((food) => food.sourceCode);

  assert.equal(parsed.package.source.kind, "TACO");
  assert.equal(parsed.package.source.version, "4ª edição");
  assert.equal(parsed.package.foods.length, 597);
  assert.equal(new Set(codes).size, 597);
  assert.equal(parsed.rejected.length, 0);
  assert.equal(parsed.package.foods[0]?.referenceServingGrams, 100);
  assert.equal(parsed.package.foods[0]?.referenceServingUnit, "g");
});
