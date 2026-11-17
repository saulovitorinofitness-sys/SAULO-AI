import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, describe, it } from "node:test";

import { prisma } from "@/lib/database/prisma";

import { EVONUT_SOURCE_VERSION, parseEvonutWorkbook } from "./evonut-audit";
import {
  EVONUT_EXPECTED_SHA256,
  EVONUT_IMPORTED_FROM,
  evonutFoodKey,
  evonutMeasureCode,
  evonutNutrientData,
  validateEvonutSource,
} from "./evonut-import";
import { normalizeFoodSearchText } from "./normalization";

const workbookPath = resolve("data/imports/food/raw/Evonut.xlsm");
const parsed = parseEvonutWorkbook(await readFile(workbookPath));

after(async () => prisma.$disconnect());

function findFoodWithTokens(tokens: readonly string[]) {
  const normalizedTokens = tokens.map(normalizeFoodSearchText);
  const food = parsed.validFoods.find((candidate) => {
    if (candidate.originalSource === "Receitas") return false;
    return normalizedTokens.every((token) => candidate.normalizedName.includes(token));
  });
  assert.ok(food, `Alimento não encontrado no arquivo: ${tokens.join(" + ")}`);
  return food;
}

describe("importação segura Evonut", () => {
  it("valida o hash conhecido e lê somente as duas abas autorizadas", () => {
    assert.equal(parsed.sourceSha256, EVONUT_EXPECTED_SHA256);
    assert.doesNotThrow(() => validateEvonutSource(parsed));
    assert.equal(parsed.validFoods.length, 7_079);
    assert.equal(parsed.measures.length, 20_732);
  });

  it("preserva null e guarda nutrientes adicionais sem inventar zero", () => {
    const food = parsed.validFoods.find((candidate) => candidate.nutrients.Energia === null);
    assert.ok(food);
    const nutrients = evonutNutrientData(food);
    assert.equal(nutrients.energyKcal, null);
    assert.ok(Object.hasOwn(nutrients.additionalNutrients as object, "Sódio de adição"));
  });

  it("preserva fonte, código, nutrientes e vínculo por código nos alimentos obrigatórios", async () => {
    const scenarios = [
      ["arroz", "integral"],
      ["arroz", "tipo 1", "cozido"],
      ["feijao", "carioca"],
      ["pao", "frances"],
      ["banana", "prata"],
      ["abacaxi", "cru"],
      ["cafe"],
      ["leite", "vaca", "integral"],
      ["ovo", "galinha"],
      ["frango"],
      ["batata-doce"],
      ["mandioca"],
    ] as const;

    for (const tokens of scenarios) {
      const food = findFoodWithTokens(tokens);
      const saved = await prisma.food.findFirst({
        where: {
          importedFrom: EVONUT_IMPORTED_FROM,
          sourceCode: food.sourceCode,
          source: {
            kind: "EVONUT",
            name: food.originalSource,
            version: EVONUT_SOURCE_VERSION,
          },
        },
        include: { source: true, nutrients: true },
      });
      assert.ok(saved, `${food.originalName} não foi persistido.`);
      assert.equal(saved.officialName, food.originalName);
      assert.equal(saved.source.name, food.originalSource);
      assert.equal(saved.sourceCode, food.sourceCode);
      assert.equal(saved.referenceServingUnit, food.referenceUnit);
      assert.equal(Number(saved.referenceServingGrams), food.referenceQuantity);
      const savedEnergy = saved.nutrients?.energyKcal === null
        ? null
        : Number(saved.nutrients?.energyKcal);
      if (food.nutrients.Energia === null) assert.equal(savedEnergy, null);
      else {
        assert.ok(savedEnergy !== null);
        assert.ok(Math.abs(savedEnergy - food.nutrients.Energia) < 0.000001);
      }

      const expectedMeasures = parsed.measures.filter(
        (measure) =>
          measure.foodSourceCode === food.sourceCode &&
          measure.originalNutritionSource === food.originalSource,
      );
      const persistedMeasures = await prisma.foodHouseholdMeasureReference.findMany({
        where: { importedFrom: EVONUT_IMPORTED_FROM, foodId: saved.id },
      });
      assert.equal(persistedMeasures.length, expectedMeasures.length);
      for (const measure of persistedMeasures) {
        assert.equal(measure.matchStatus, "CONFIRMED");
        assert.equal(measure.linkMethod, "EVONUT_SOURCE_AND_CODE");
        assert.equal(measure.foodSource, food.originalSource);
        assert.ok(measure.quantityValue && Number(measure.quantityValue) > 0);
      }
    }
  });

  it("não converte g em ml e preserva o valor real da célula", async () => {
    for (const unit of ["g", "ml"] as const) {
      const measure = parsed.measures.find((candidate) => candidate.measureUnit === unit);
      assert.ok(measure);
      const saved = await prisma.foodHouseholdMeasureReference.findFirst({
        where: {
          importedFrom: EVONUT_IMPORTED_FROM,
          sourceFoodCode: measure.foodSourceCode,
          foodSource: measure.originalNutritionSource,
          measureCode: evonutMeasureCode(measure.measureName),
        },
      });
      assert.ok(saved);
      assert.equal(saved.quantityUnit, unit);
      assert.equal(Number(saved.quantityValue), measure.measureValue);
    }
  });

  it("mantém receitas fora da carga e suas medidas sem vínculo", async () => {
    const recipeFoodCount = await prisma.food.count({
      where: {
        importedFrom: EVONUT_IMPORTED_FROM,
        source: { kind: "EVONUT", name: "Receitas", version: EVONUT_SOURCE_VERSION },
      },
    });
    const unlinked = await prisma.foodHouseholdMeasureReference.findMany({
      where: { importedFrom: EVONUT_IMPORTED_FROM, matchStatus: "UNLINKED" },
    });
    assert.equal(recipeFoodCount, 0);
    assert.equal(unlinked.length, 30);
    assert.ok(unlinked.every((measure) => measure.foodId === null));
  });

  it("não sobrescreve os 597 alimentos TACO existentes", async () => {
    const originalTacoFoods = await prisma.food.count({
      where: { source: { kind: "TACO" }, importedFrom: null },
    });
    const evonutFoods = await prisma.food.count({ where: { importedFrom: EVONUT_IMPORTED_FROM } });
    assert.equal(originalTacoFoods, 597);
    assert.equal(evonutFoods, 7_068);
  });

  it("não aceita medidas vazias, zero, negativas ou com unidade diferente", async () => {
    const invalidPersisted = await prisma.foodHouseholdMeasureReference.count({
      where: {
        importedFrom: EVONUT_IMPORTED_FROM,
        OR: [
          { quantityValue: null },
          { quantityValue: { lte: 0 } },
          { quantityUnit: { notIn: ["g", "ml"] } },
        ],
      },
    });
    assert.equal(invalidPersisted, 0);
  });

  it("usa chaves determinísticas distintas por fonte e código", () => {
    assert.notEqual(evonutFoodKey("TACO", "1"), evonutFoodKey("TBCA", "1"));
    assert.equal(evonutMeasureCode("Colher de sopa"), "COLHER_DE_SOPA");
  });
});
