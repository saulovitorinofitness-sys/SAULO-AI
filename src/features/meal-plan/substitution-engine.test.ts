import assert from "node:assert/strict";
import test from "node:test";

import type { ProfessionalFood } from "@/features/food-database";

import { EMPTY_FOOD_NUTRIENTS } from "./nutrition-calculations";
import { rankNutritionalEquivalents } from "./substitution-engine";

function food(
  id: string,
  name: string,
  nutrients: {
    energyKcal: number;
    carbohydratesGrams: number;
    proteinGrams: number;
    fatsGrams: number;
    fiberGrams: number;
  },
): ProfessionalFood {
  return {
    id,
    officialName: name,
    normalizedName: name.toLocaleLowerCase("pt-BR"),
    category: "Cereais e tubérculos",
    categoryId: "e96ab2b6-fac9-4874-9907-cc4e2cc110be",
    foodGroup: "Fontes de carboidratos",
    source: {
      id: "62c1673b-af48-439a-82bb-6ad8b99ddf7d",
      kind: "TBCA",
      name: "TBCA",
      origin: "OFFICIAL",
      editable: false,
    },
    referenceServingGrams: 100,
    status: "ACTIVE",
    nutrients: { ...EMPTY_FOOD_NUTRIENTS, ...nutrients },
    householdMeasures: [],
    synonyms: [],
    createdAt: "2026-07-27T10:00:00.000Z",
    updatedAt: "2026-07-27T10:00:00.000Z",
  };
}

const rice = food(
  "f4d8b866-b7fe-4f8c-934c-e500d6f34052",
  "Arroz branco cozido",
  {
    energyKcal: 130,
    carbohydratesGrams: 28,
    proteinGrams: 2.7,
    fatsGrams: 0.3,
    fiberGrams: 0.4,
  },
);
const sweetPotato = food(
  "5e2b87c2-af63-42b0-bc97-153ee4e98dbd",
  "Batata-doce cozida",
  {
    energyKcal: 86,
    carbohydratesGrams: 20.1,
    proteinGrams: 1.6,
    fatsGrams: 0.1,
    fiberGrams: 3,
  },
);
const chicken = {
  ...food(
    "01530693-608a-45ef-b382-1d22a1ac311f",
    "Frango grelhado",
    {
      energyKcal: 165,
      carbohydratesGrams: 0,
      proteinGrams: 31,
      fatsGrams: 3.6,
      fiberGrams: 0,
    },
  ),
  category: "Carnes",
  categoryId: "93e3a0f2-d0aa-49e4-b759-e9d38495d50c",
  foodGroup: "Proteínas animais",
};

test("sugere gramagem para preservar a energia da porção atual", () => {
  const [equivalent] = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 100,
    candidates: [sweetPotato],
  });

  assert.equal(equivalent?.suggestedGrams, 151.2);
  assert.ok(Math.abs((equivalent?.nutrition.energyKcal ?? 0) - 130) < 0.1);
  assert.equal(equivalent?.adjustmentBasis, "ENERGY");
});

test("restringe candidatos ao mesmo grupo ou categoria alimentar", () => {
  const equivalents = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 100,
    candidates: [chicken, sweetPotato],
  });

  assert.deepEqual(
    equivalents.map((item) => item.food.id),
    [sweetPotato.id],
  );
});

test("não aceita candidato sem composição comparável", () => {
  const incomplete = {
    ...sweetPotato,
    id: "c6f4484a-95be-4abf-a9e6-9e5b57d76671",
    nutrients: {
      ...sweetPotato.nutrients!,
      fiberGrams: null,
    },
  };

  assert.deepEqual(
    rankNutritionalEquivalents({
      currentFood: rice,
      currentGrams: 100,
      candidates: [incomplete],
    }),
    [],
  );
});
