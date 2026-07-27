import assert from "node:assert/strict";
import test from "node:test";

import type { ProfessionalFood } from "@/features/food-database";

import { canonicalizeMealPlanDraftFoods } from "./food-snapshot";
import { EMPTY_FOOD_NUTRIENTS } from "./nutrition-calculations";
import type { MealPlanRecordDraft } from "./record";

const food: ProfessionalFood = {
  id: "4ff48dc8-9532-44d5-a599-c327be55434a",
  officialName: "Arroz integral cozido",
  normalizedName: "arroz integral cozido",
  description: "Arroz integral preparado sem óleo.",
  category: "Cereais e tubérculos",
  categoryId: "dc2e261d-9604-452c-a45f-bf53bc9b2d7d",
  foodGroup: "Cereais",
  source: {
    id: "d4b1e37b-e51d-4cd3-8864-e0c70d34728d",
    kind: "TBCA",
    name: "TBCA",
    version: "7.2",
    origin: "OFFICIAL",
    editable: false,
  },
  sourceCode: "BRC0001",
  referenceServingGrams: 100,
  status: "ACTIVE",
  nutrients: {
    ...EMPTY_FOOD_NUTRIENTS,
    energyKcal: 124,
    proteinGrams: 2.6,
    carbohydratesGrams: 25.8,
    fatsGrams: 1,
    fiberGrams: 2.7,
    sodiumMg: 1,
    ironMg: 0.3,
  },
  householdMeasures: [
    {
      id: "dd107457-5cb5-4f88-9ebf-25bd54a7051a",
      name: "colher de servir",
      normalizedName: "colher de servir",
      quantity: 1,
      grams: 45,
      source: "TBCA",
      isDefault: true,
      active: true,
    },
  ],
  synonyms: ["arroz marrom"],
  createdAt: "2026-07-27T10:00:00.000Z",
  updatedAt: "2026-07-27T10:00:00.000Z",
};

const draft: MealPlanRecordDraft = {
  strategyEntryId: "8bd60bc7-5f36-4b2b-9782-813884fc9f19",
  status: "DRAFT",
  aiDecision: "IDLE",
  meals: [
    {
      id: "0dde6733-90c2-4dc7-acac-a79f5155030f",
      name: "Almoço",
      order: 1,
      items: [
        {
          id: "3e8ab848-c09c-4d33-b2f7-6fccda22bcdc",
          catalogFoodId: food.id,
          description: "Nome adulterado",
          foodGroup: "Grupo adulterado",
          source: "CLINIC_SV",
          sourceName: "Fonte adulterada",
          primaryHouseholdMeasure: "porção",
          standardWeightGrams: 999,
          grams: 90,
          householdMeasure: "colher de servir",
          measureOptions: [],
          quantity: 2,
          nutrientsPer100g: EMPTY_FOOD_NUTRIENTS,
          nutrients: EMPTY_FOOD_NUTRIENTS,
          substitutions: [],
        },
      ],
    },
  ],
};

test("reconstrói o snapshot a partir do catálogo e mantém a prescrição", () => {
  const result = canonicalizeMealPlanDraftFoods(draft, [food]);
  const item = result?.meals[0]?.items[0];

  assert.equal(item?.description, food.officialName);
  assert.equal(item?.source, "TBCA");
  assert.equal(item?.sourceVersion, "7.2");
  assert.equal(item?.quantity, 2);
  assert.equal(item?.grams, 90);
  assert.equal(item?.nutrients.energyKcal, 111.6);
  assert.equal(item?.nutrients.sodiumMg, 0.9);
});

test("rejeita alimento ausente no catálogo definitivo", () => {
  assert.equal(canonicalizeMealPlanDraftFoods(draft, []), null);
});
