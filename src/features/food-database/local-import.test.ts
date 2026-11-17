import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";

import { parseLocalFoodPackages } from "./local-import";
import { normalizeFoodSearchText } from "./normalization";

function validPackage() {
  return {
    source: {
      kind: "TACO",
      name: "Fonte oficial de teste",
      version: "teste",
      origin: "OFFICIAL",
    },
    foods: [
      {
        sourceCode: "COD-001",
        officialName: "Alimento com Acento",
        category: "Categoria de teste",
        foodGroup: "Grupo de teste",
        nutrients: {
          energyKcal: 100,
          proteinGrams: 10,
          carbohydratesGrams: 15,
          fatsGrams: 2,
          fiberGrams: 3,
        },
        householdMeasures: [
          {
            name: "medida cadastrada",
            quantity: 1,
            grams: 50,
            isDefault: true,
          },
        ],
        synonyms: ["Alimento sem acento"],
      },
    ],
  };
}

test("normaliza busca com acento e sem acento para a mesma chave local", () => {
  assert.equal(normalizeFoodSearchText("Açaí"), "acai");
  assert.equal(
    normalizeFoodSearchText("Alimento com Acento"),
    normalizeFoodSearchText("alimento com acento"),
  );
});

test("preserva fonte, nutrientes e medida caseira do arquivo local", () => {
  const [item] = parseLocalFoodPackages(validPackage());
  const [food] = item.foods;

  assert.equal(item.source.kind, "TACO");
  assert.equal(item.source.origin, "OFFICIAL");
  assert.equal(food.nutrients.energyKcal, 100);
  assert.equal(food.nutrients.proteinGrams, 10);
  assert.deepEqual(food.householdMeasures[0], {
    name: "medida cadastrada",
    quantity: 1,
    grams: 50,
    isDefault: true,
  });
});

test("rejeita código repetido dentro da mesma fonte", () => {
  const input = validPackage();
  assert.throws(
    () =>
      parseLocalFoodPackages({
        ...input,
        foods: [input.foods[0], { ...input.foods[0] }],
      }),
    /Alimento duplicado no arquivo/,
  );
});

test("rejeita fonte demonstrativa no importador oficial", () => {
  const input = validPackage();
  assert.throws(
    () =>
      parseLocalFoodPackages({
        ...input,
        source: { ...input.source, origin: "DEMONSTRATIVE" },
      }),
    /Arquivo alimentar inválido/,
  );
});
