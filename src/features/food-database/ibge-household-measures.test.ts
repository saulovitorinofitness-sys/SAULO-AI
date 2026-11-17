import "dotenv/config";

import assert from "node:assert/strict";
import { resolve } from "node:path";
import test, { after } from "node:test";

import { prisma } from "../../lib/database/prisma";
import { householdMeasureRepository } from "./household-measure-repository";
import {
  importIbgeHouseholdMeasures,
  matchIbgeFoodToTaco,
} from "./ibge-household-measure-import";
import { readIbgeHouseholdMeasures } from "./ibge-household-measures";

const pdfPath = resolve("data/imports/food/raw/liv50000.pdf");

const reviewedTacoFoods = [
  { id: "rice-cooked", sourceCode: "1", officialName: "Arroz, integral, cozido", normalizedName: "arroz, integral, cozido", foodGroup: "Cereais", preparationState: null },
  { id: "rice-raw", sourceCode: "2", officialName: "Arroz, integral, cru", normalizedName: "arroz, integral, cru", foodGroup: "Cereais", preparationState: null },
  { id: "bread", sourceCode: "53", officialName: "Pão, trigo, francês", normalizedName: "pao, trigo, frances", foodGroup: "Cereais", preparationState: null },
  { id: "coffee-drink", sourceCode: "471", officialName: "Café, infusão 10%", normalizedName: "cafe, infusao 10%", foodGroup: "Bebidas", preparationState: null },
  { id: "coffee-powder", sourceCode: "511", officialName: "Café, pó, torrado", normalizedName: "cafe, po, torrado", foodGroup: "Miscelâneas", preparationState: null },
] as const;

after(async () => {
  await prisma.$disconnect();
});

test("crosswalk revisado usa código e preparação sem vincular por semelhança genérica", () => {
  const rice = matchIbgeFoodToTaco(
    { sourceFoodCode: "6300201", foodName: "Arroz integral", normalizedFoodName: "arroz integral", preparationCode: "99" },
    reviewedTacoFoods,
  );
  const bread = matchIbgeFoodToTaco(
    { sourceFoodCode: "8000105", foodName: "Pão de sal", normalizedFoodName: "pao de sal", preparationCode: "99" },
    reviewedTacoFoods,
  );
  const coffee = matchIbgeFoodToTaco(
    { sourceFoodCode: "8501302", foodName: "Café", normalizedFoodName: "cafe", preparationCode: "99" },
    reviewedTacoFoods,
  );

  assert.equal(rice.foodId, "rice-cooked");
  assert.equal(bread.foodId, "bread");
  assert.equal(coffee.foodId, "coffee-drink");
  assert.notEqual(coffee.foodId, "coffee-powder");
  assert.ok([rice, bread, coffee].every((match) =>
    match.status === "CONFIRMED" &&
    match.reason.startsWith("CROSSWALK_CODIGO_OFICIAL_REVISADO:"),
  ));
});

test("extrai linhas estruturadas reais de arroz sem OCR", async () => {
  const extraction = await readIbgeHouseholdMeasures(pdfPath, {
    firstPage: 35,
    lastPage: 36,
  });
  assert.equal(extraction.rejected.length, 0);
  const rice = extraction.rows.filter((row) => row.sourceFoodCode === "6300101");
  assert.ok(rice.length > 5);
  const spoon = rice.find((row) => row.measureCode === "16");
  assert.ok(spoon);
  assert.equal(spoon.foodName, "Arroz (polido, parboilizado)");
  assert.equal(spoon.preparationCode, "99");
  assert.equal(spoon.preparationName, "Não se aplica");
  assert.equal(spoon.measureName, "Colher de sopa");
  assert.equal(spoon.quantityValue, 25);
  assert.equal(spoon.quantityUnit, "g");
});

test("consultas obrigatórias retornam múltiplas medidas reais", async () => {
  const queries = [
    "arroz",
    "arroz integral",
    "feijão",
    "banana",
    "café",
    "leite",
    "ovo",
    "frango",
    "batata-doce",
  ];
  for (const query of queries) {
    const rows = await householdMeasureRepository.findByFood({ query, limit: 500 });
    assert.ok(rows.length > 1, `${query} deveria retornar múltiplas medidas`);
    assert.ok(rows.every((row) => row.quantity !== null && row.quantity > 0));
    assert.ok(rows.every((row) => row.quantityUnit === "g" || row.quantityUnit === "ml"));
    assert.ok(rows.every((row) => row.preparation.code && row.preparation.name));
  }

  const cassava = [
    ...await householdMeasureRepository.findByFood({ query: "mandioca", limit: 500 }),
    ...await householdMeasureRepository.findByFood({ query: "macaxeira", limit: 500 }),
  ];
  assert.ok(cassava.length > 1, "mandioca/macaxeira deveria retornar múltiplas medidas");
});

test("preparações, volumes explícitos e registros sem vínculo permanecem preservados", async () => {
  const chicken = await householdMeasureRepository.findByFood({ query: "frango", limit: 500 });
  assert.ok(new Set(chicken.map((row) => row.preparation.code)).size > 1);

  const volume = await prisma.foodHouseholdMeasureReference.findFirst({
    where: { quantityUnit: "ml" },
  });
  assert.ok(volume);
  assert.ok(Number(volume.quantityValue) > 0);

  const unmatched = await prisma.foodHouseholdMeasureReference.count({
    where: { matchStatus: "UNMATCHED", foodId: null },
  });
  assert.ok(unmatched > 0);

  const zeroQuantities = await prisma.foodHouseholdMeasureReference.count({
    where: { quantityValue: 0 },
  });
  assert.equal(zeroQuantities, 0);
});

test("segunda execução é idempotente", async () => {
  const before = await prisma.foodHouseholdMeasureReference.count({
    where: { source: { kind: "IBGE" } },
  });
  const result = await importIbgeHouseholdMeasures(pdfPath);
  const afterImport = await prisma.foodHouseholdMeasureReference.count({
    where: { source: { kind: "IBGE" } },
  });
  assert.equal(result.createdMeasures, 0);
  assert.equal(afterImport, before);
  assert.equal(result.totalMeasures, 11_168);
});
