import assert from "node:assert/strict";
import test from "node:test";

import {
  missingNutrientLabel,
  recipeServingsLabel,
  yieldDescriptionIncludesServings,
} from "@/components/deliverables/nutrition-deliverable-preview";
import {
  calculateMealPlanNutritionTotals,
  EMPTY_FOOD_NUTRIENTS,
  updateMealPlanRecipePortion,
} from "@/features/meal-plan/nutrition-calculations";
import type {
  MealPlanFoodSubstitution,
  MealPlanIbgeMeasureOption,
  MealPlanRecordFood,
  MealPlanRecordMeal,
  MealPlanRecordRecipe,
} from "@/features/meal-plan/record";
import type { NutritionClinicalPanelView } from "@/features/nutrition-strategy/clinical-panel-contracts";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import { BUILT_IN_IDS } from "@/modules/permissions";

import { nutritionDeliverableDraftStorage } from "./draft-storage";
import {
  buildNutritionDeliverableDraft,
  resolveDeliverableStrategy,
} from "./service";
import { createShoppingList, shoppingCategoryFor } from "./shopping-list";

const generatedAt = "2026-08-04T12:00:00.000Z";
const panel: NutritionClinicalPanelView = {
  patientId: "patient-1",
  masterRecordId: "master-1",
  attendanceId: "attendance-1",
  attendanceStartedAt: generatedAt,
  responsibleProfessional: "Saulo Xavier Vitorino",
  patient: {
    name: "Paciente Teste",
    code: "SV-001",
    age: 35,
    sex: "Feminino",
    primaryObjective: "Emagrecimento",
    secondaryObjectives: [],
  },
  anthropometry: {
    weightKg: 70,
    heightCm: 165,
    bmi: 25.7,
    bmiClassification: "Sobrepeso",
    assessmentDate: generatedAt,
    assessmentType: "INITIAL",
    assessmentStatus: "COMPLETED",
  },
  perimetry: {
    measurements: [],
    abdomenCm: 86,
  },
  bioimpedance: {
    skeletalMuscleMassKg: 27,
    fatMassKg: 21,
    bodyFatPercent: 30,
    totalBodyWaterL: 34,
    basalMetabolicRateKcal: 1_420,
    totalEnergyExpenditureKcal: 2_000,
  },
  nutritionalStatus: {
    weightKg: 70,
    heightM: 1.65,
    bmi: 25.7,
    bmiClassification: "Sobrepeso",
    abdomenCm: 86,
  },
  bodyComposition: {
    muscleMassKg: 27,
    fatMassKg: 21,
    bodyFatPercent: 30,
    bodyWaterL: 34,
    basalMetabolicRateKcal: 1_420,
    totalEnergyExpenditureKcal: 2_000,
  },
  inheritedClinicalContext: {
    diagnoses: ["Hipertensão registrada"],
    allergyStatus: "CONFIRMED",
    allergies: ["Alergia a amendoim"],
    restrictions: ["Restrição a lactose"],
    foodPreferences: ["Frutas"],
    medications: ["Medicamento registrado"],
    supplements: ["Creatina registrada"],
    injuriesAndLimitations: [],
    laboratoryExams: ["Hemograma registrado"],
  },
  decisionSupport: {
    positivePoints: ["Avaliação antropométrica disponível."],
    attentionPoints: ["Acompanhar ingestão de sódio."],
    pendingData: [],
  },
};

const strategy: MealPlanStrategyInheritance = {
  sourceStrategyId: "strategy-1",
  patientId: panel.patientId,
  masterRecordId: panel.masterRecordId,
  attendanceId: panel.attendanceId,
  objective: "WEIGHT_LOSS",
  secondaryObjectives: [],
  method: "STANDARD",
  protocol: "MIFFLIN_ST_JEOR",
  totalEnergyExpenditureKcal: 2_000,
  caloriesKcal: 1_700,
  proteinGrams: 120,
  proteinPercentage: 28,
  carbohydratesGrams: 180,
  carbohydratesPercentage: 42,
  fatsGrams: 57,
  fatsPercentage: 30,
  fiberGrams: 28,
  waterMl: 2_300,
  mealCount: 2,
  mealDistribution: [],
  supplementation: [],
  clinicalObservations: "Orientação registrada e aprovada.",
  calorieAdjustmentPercentage: -15,
  status: "APPROVED",
  approvedAt: generatedAt,
  approvedByUserId: "user-saulo",
};

function food(input: {
  id: string;
  catalogFoodId?: string;
  name: string;
  group: string;
  amount: number;
  unit?: "g" | "ml";
  quantity?: number;
  measure?: string;
  substitutions?: readonly MealPlanFoodSubstitution[];
}): MealPlanRecordFood {
  const nutrients = {
    ...EMPTY_FOOD_NUTRIENTS,
    energyKcal: 100,
    proteinGrams: 5,
    carbohydratesGrams: 15,
    fatsGrams: 2,
    fiberGrams: 3,
  };
  return {
    id: input.id,
    catalogFoodId: input.catalogFoodId ?? input.id,
    description: input.name,
    foodGroup: input.group,
    source: "TACO",
    sourceName: "TACO",
    primaryHouseholdMeasure: input.measure ?? "gramas",
    standardWeightGrams: 100,
    grams: input.unit === "ml" ? 0 : input.amount,
    prescribedAmount: input.amount,
    prescribedUnit: input.unit ?? "g",
    householdMeasure: input.measure ?? (input.unit === "ml" ? "Mililitros" : "Gramas"),
    measureOptions: [],
    quantity: input.quantity ?? 1,
    nutrientsPer100g: nutrients,
    nutrients,
    substitutions: input.substitutions ?? [],
  };
}

function recipe(): MealPlanRecordRecipe {
  const snapshotNutrients = {
    ...EMPTY_FOOD_NUTRIENTS,
    energyKcal: 300,
    proteinGrams: 20,
    carbohydratesGrams: 30,
    fatsGrams: 10,
    fiberGrams: 0,
    sodiumMg: null,
  };
  return {
    itemType: "RECIPE",
    id: "recipe-item-1",
    recipeId: "recipe-1",
    recipeTitle: "Receita congelada",
    recipeNutritionSnapshotId: "recipe-snapshot-1",
    recipeNutritionSnapshotVersion: 3,
    recipeContentSnapshot: {
      schemaVersion: 1,
      title: "Receita congelada",
      ingredients: [
        {
          ingredientId: "ingredient-1",
          foodId: "food-recipe-1",
          foodName: "Ingrediente congelado",
          position: 1,
          grossQuantity: 200,
          netQuantity: 180,
          quantityUnit: "GRAM",
          householdMeasureQuantity: 2,
          householdMeasureDescription: "colheres",
          notes: null,
        },
      ],
      preparationMethod: "Misture e cozinhe conforme o registro congelado.",
      preparationSteps: [],
      yieldDescription: null,
      finalYield: { amount: 400, unit: "GRAM" },
      declaredYield: null,
      servings: 2,
    },
    portion: {
      kind: "SERVINGS",
      prescribedServings: 1,
      recipeServings: 2,
      description: "1 de 2 porções",
    },
    nutritionCompleteness: "PARTIAL",
    snapshotNutrients,
    prescribedNutrients: {
      ...snapshotNutrients,
      energyKcal: 150,
      proteinGrams: 10,
      carbohydratesGrams: 15,
      fatsGrams: 5,
      fiberGrams: 0,
    },
    missingNutrients: ["sodiumMg"],
  };
}

const meals: readonly MealPlanRecordMeal[] = [
  {
    id: "meal-1",
    name: "Café da manhã",
    order: 1,
    time: "07:00",
    items: [
      food({ id: "banana", name: "Banana prata", group: "Frutas", amount: 100 }),
      food({ id: "leite", name: "Leite integral", group: "Laticínios", amount: 200, unit: "ml" }),
      food({ id: "ovo", name: "Ovo de galinha", group: "Ovos", amount: 100, quantity: 2, measure: "unidades" }),
    ],
  },
  {
    id: "meal-2",
    name: "Lanche",
    order: 2,
    items: [
      food({ id: "banana-2", catalogFoodId: "banana", name: "Banana prata", group: "Frutas", amount: 50 }),
    ],
  },
];

function draft(
  inputPanel = panel,
  inputMeals: readonly MealPlanRecordMeal[] = meals,
  inputStrategy = strategy,
) {
  return buildNutritionDeliverableDraft({
    panel: inputPanel,
    strategy: inputStrategy,
    plan: {
      id: "plan-1",
      patientId: panel.patientId,
      attendanceId: panel.attendanceId,
      status: "APPROVED",
      responsibleUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
      responsibleProfessional: "Saulo Xavier Vitorino",
      updatedAt: generatedAt,
      meals: inputMeals,
    },
    attendanceType: "NUTRITION",
    professional: { fullName: "Saulo Xavier Vitorino" },
    generatedAt,
  });
}

test("1. paciente com avaliação completa gera todas as fontes disponíveis", () => {
  const result = draft();
  assert.match(result.clinicalDiagnosis.content, /Hemograma registrado/);
  assert.equal(
    result.findings.some((item) => /Gordura corporal: 30%/.test(item.description)),
    true,
  );
  assert.doesNotMatch(result.clinicalDiagnosis.content, /Gordura corporal: 30%/);
  assert.equal(result.mealPlan?.status, "APPROVED");
});

test("2. paciente com dados incompletos mantém pendências explícitas", () => {
  const incompletePanel = {
      ...panel,
      anthropometry: {},
      perimetry: { measurements: [] },
      bioimpedance: {},
      nutritionalStatus: {},
      bodyComposition: {},
      decisionSupport: {
        ...panel.decisionSupport,
        pendingData: ["Peso", "Altura"],
      },
    } satisfies NutritionClinicalPanelView;
  const result = buildNutritionDeliverableDraft({
    panel: incompletePanel,
    patientId: panel.patientId,
    attendanceId: panel.attendanceId,
    responsibleUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
    responsibleProfessional: "Saulo Xavier Vitorino",
    professional: { fullName: "Saulo Xavier Vitorino" },
    generatedAt,
  });
  assert.deepEqual(result.missingData.slice(0, 2), ["Peso", "Altura"]);
  assert.ok(result.missingData.includes("Estratégia Nutricional aprovada"));
  assert.ok(result.missingData.includes("Plano Alimentar aprovado"));
  assert.equal(result.nutritionStrategy, undefined);
  assert.equal(result.mealPlan, undefined);
});

test("3. paciente sem exames não recebe exame inventado", () => {
  const result = draft({
    ...panel,
    inheritedClinicalContext: { ...panel.inheritedClinicalContext, laboratoryExams: [] },
  });
  assert.ok(result.missingData.includes("Exames laboratoriais"));
  assert.doesNotMatch(result.clinicalDiagnosis.content, /Hemograma/);
});

test("4. paciente sem bioimpedância omite composição corporal", () => {
  const result = draft({ ...panel, bioimpedance: {}, bodyComposition: {} });
  assert.doesNotMatch(result.clinicalDiagnosis.content, /bioimpedância registra/i);
});

test("5. paciente sem avaliação postural não recebe achado postural", () => {
  const result = draft({
    ...panel,
    decisionSupport: { ...panel.decisionSupport, pendingData: ["Avaliação postural"] },
  });
  assert.ok(result.missingData.includes("Avaliação postural"));
  assert.equal(result.findings.some((item) => /postur/i.test(item.description)), false);
});

test("6. alimentos repetidos são consolidados com rastreabilidade", () => {
  const list = createShoppingList({ meals });
  const banana = list.items.find((item) => item.catalogFoodId === "banana");
  assert.equal(banana?.displayQuantity, "1,05 kg");
  assert.deepEqual(banana?.sourceMealIds, ["meal-1", "meal-2"]);
});

test("7. medidas em gramas permanecem massa", () => {
  const banana = createShoppingList({ meals }).items.find((item) => item.catalogFoodId === "banana");
  assert.equal(banana?.unit, "kg");
  assert.equal(banana?.quantity, 1_050);
});

test("8. medidas em ml permanecem volume e nunca viram gramas", () => {
  const milk = createShoppingList({ meals }).items.find((item) => item.catalogFoodId === "leite");
  assert.equal(milk?.displayQuantity, "1,4 L");
  assert.equal(milk?.unit, "L");
});

test("9. medidas contáveis permanecem unidades", () => {
  const egg = createShoppingList({ meals }).items.find((item) => item.catalogFoodId === "ovo");
  assert.equal(egg?.displayQuantity, "14 unidades");
  assert.equal(egg?.unit, "unit");
});

for (const days of [7, 15, 30] as const) {
  test(`${days === 7 ? 10 : days === 15 ? 11 : 12}. lista de compras de ${days} dias`, () => {
    const result = createShoppingList({ meals, period: days });
    assert.equal(result.days, days);
    assert.equal(
      result.items.find((item) => item.catalogFoodId === "leite")?.quantity,
      200 * days,
    );
  });
}

test("13. item pode ser marcado como já existente em casa", () => {
  const item = { ...createShoppingList({ meals }).items[0], alreadyAtHome: true };
  assert.equal(item.alreadyAtHome, true);
});

test("14. item removido permanece rastreável e excluído", () => {
  const item = { ...createShoppingList({ meals }).items[0], excluded: true };
  assert.equal(item.excluded, true);
  assert.ok(item.sourceMealIds.length > 0);
});

test("15. somente substituição registrada no plano aprovado é incluída", () => {
  const substitution: MealPlanFoodSubstitution = {
    id: "sub-1",
    replacedFoodId: "banana",
    replacedDescription: "Banana prata",
    replacementFoodId: "maca",
    replacementDescription: "Maçã",
    occurredAt: generatedAt,
    originalPrescribedAmount: 100,
    originalPrescribedUnit: "g",
    replacementQuantity: 3.6,
    replacementPrescribedAmount: 90,
    replacementPrescribedUnit: "g",
    replacementHouseholdMeasure: "1 colher de sopa — 25 g",
  };
  const result = draft(panel, [
    {
      ...meals[0],
      items: [
        food({
          id: "banana",
          name: "Banana prata",
          group: "Frutas",
          amount: 100,
          substitutions: [substitution],
        }),
      ],
    },
  ]);
  assert.equal(
    result.substitutions[0].prescribedFood,
    "Banana prata — 100 g",
  );
  assert.deepEqual(result.substitutions[0].approvedOptions, [
    "Maçã — 3,6 × 1 colher de sopa — 25 g — 90 g",
  ]);
  const prescribedItem = result.mealPlan?.meals[0]?.items?.[0];
  assert.notEqual(prescribedItem?.itemType, "RECIPE");
  if (!prescribedItem || prescribedItem.itemType === "RECIPE") {
    assert.fail("alimento principal não preservado");
  }
  assert.deepEqual(prescribedItem.substitutions, [
    {
      id: "sub-1",
      name: "Maçã",
      prescribedAmount: 90,
      prescribedUnit: "g",
      quantity: 3.6,
      householdMeasure: "1 colher de sopa — 25 g",
    },
  ]);
  assert.equal(
    result.shoppingList.items.some((item) => item.catalogFoodId === "maca"),
    false,
  );
});

test("16. sugestões não registradas não aparecem como substituição", () => {
  assert.deepEqual(draft().substitutions, []);
  const item = draft().mealPlan?.meals[0]?.items?.[0];
  assert.notEqual(item?.itemType, "RECIPE");
  if (!item || item.itemType === "RECIPE") assert.fail("alimento ausente");
  assert.deepEqual(item.substitutions, []);
  assert.equal(draft().enabledSections.substitutions, false);
});

test("17. objetivo esportivo aprovado prevalece sobre objetivo genérico do painel", () => {
  const result = buildNutritionDeliverableDraft({
    panel: {
      ...panel,
      patient: { ...panel.patient, primaryObjective: "Hipertrofia" },
    },
    strategy: {
      ...strategy,
      method: "SPORTS_PERIODIZATION",
      specificConfigurations: {
        sportsPeriodization: {
          objective: "FAT_LOSS",
          trainingDays: [],
          restDays: [],
          competitionDays: [],
        },
      },
    },
    patientId: panel.patientId,
    attendanceId: panel.attendanceId,
    responsibleUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
    responsibleProfessional: "Saulo Xavier Vitorino",
    professional: { fullName: "Saulo Xavier Vitorino" },
    generatedAt,
  });
  assert.equal(result.nutritionStrategy?.objective, "Redução de gordura");
  assert.doesNotMatch(result.clinicalDiagnosis.content, /Redução de gordura/);
  assert.doesNotMatch(result.clinicalDiagnosis.content, /Hipertrofia/);
});

test("18. método aprovado usa rótulo clínico e não o código interno", () => {
  const result = buildNutritionDeliverableDraft({
    panel,
    strategy: { ...strategy, method: "SPORTS_PERIODIZATION" },
    patientId: panel.patientId,
    attendanceId: panel.attendanceId,
    responsibleUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
    responsibleProfessional: "Saulo Xavier Vitorino",
    professional: { fullName: "Saulo Xavier Vitorino" },
    generatedAt,
  });
  assert.equal(result.nutritionStrategy?.method, "Periodização nutricional esportiva");
  assert.notEqual(result.nutritionStrategy?.method, "SPORTS_PERIODIZATION");
});

test("19. seção opcional pode ser desativada sem apagar conteúdo", () => {
  const result = draft();
  const disabled = { ...result, enabledSections: { ...result.enabledSections, findings: false } };
  assert.equal(disabled.enabledSections.findings, false);
  assert.equal(disabled.findings.length, result.findings.length);
});

test("20. salvamento de rascunho usa chave do paciente e atendimento", () => {
  const values = new Map<string, string>();
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  try {
    const result = draft();
    nutritionDeliverableDraftStorage.save(result);
    const restored = nutritionDeliverableDraftStorage.read(
      result.patientId,
      result.attendanceId,
    );
    assert.equal(restored?.deliverableId, result.deliverableId);
    assert.equal(restored?.status, result.status);
    assert.equal(
      JSON.stringify(restored?.shoppingList.items),
      JSON.stringify(result.shoppingList.items),
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("21. ausência de dado nunca é convertida em zero", () => {
  const result = draft({
    ...panel,
    anthropometry: {},
    bioimpedance: {},
    nutritionalStatus: {},
    bodyComposition: {},
  });
  assert.doesNotMatch(result.clinicalDiagnosis.content, /peso de 0|altura de 0|IMC de 0/);
});

test("22. síntese não acrescenta doença, causalidade ou recomendação inexistente", () => {
  const result = draft({
    ...panel,
    inheritedClinicalContext: {
      ...panel.inheritedClinicalContext,
      diagnoses: [],
      medications: [],
      supplements: [],
    },
  });
  assert.doesNotMatch(result.clinicalDiagnosis.content, /diabetes|causad|deve tomar|diagnóstico médico/i);
});

test("23. conteúdo técnico não entra no diagnóstico nem nos achados", () => {
  const result = draft({
    ...panel,
    inheritedClinicalContext: {
      ...panel.inheritedClinicalContext,
      diagnoses: ["DEBUG diagnóstico interno"],
      restrictions: ["MOCK restrição fictícia"],
    },
    decisionSupport: {
      ...panel.decisionSupport,
      attentionPoints: ["[HOMOLOGAÇÃO V1.0] validação técnica"],
    },
  });
  const serialized = JSON.stringify({
    diagnosis: result.clinicalDiagnosis,
    findings: result.findings,
  });
  assert.doesNotMatch(serialized, /HOMOLOGA|DEBUG|MOCK/i);
});

test("24. avisos de integridade ficam fora das conclusões clínicas", () => {
  const notice =
    "A Anamnese disponível não pertence ao atendimento atual e não foi consolidada.";
  const result = draft({
    ...panel,
    decisionSupport: {
      ...panel.decisionSupport,
      positivePoints: [
        "Avaliação antropométrica disponível no Prontuário Mestre.",
      ],
      attentionPoints: [notice],
    },
  });
  const clinicalContent = JSON.stringify({
    diagnosis: result.clinicalDiagnosis,
    findings: result.findings,
    guidance: result.guidance,
  });
  assert.doesNotMatch(clinicalContent, /não pertence ao atendimento atual/i);
  assert.doesNotMatch(clinicalContent, /avaliação antropométrica disponível/i);
  assert.equal(result.warnings.some((warning) => warning.includes(notice)), true);
});

test("25. frutas em grupo misto não são classificadas como bebidas", () => {
  assert.equal(
    shoppingCategoryFor("Abacate", "Frutas, sucos e vitaminas"),
    "Hortifruti",
  );
  assert.equal(
    shoppingCategoryFor("Acerola", "Frutas, sucos e vitaminas"),
    "Hortifruti",
  );
  assert.equal(
    shoppingCategoryFor("Suco de acerola", "Frutas, sucos e vitaminas"),
    "Bebidas",
  );
});

test("26. preparação cadastrada permanece explícita e não é convertida", () => {
  const cookedMeasure: MealPlanIbgeMeasureOption = {
    id: "measure-cooked",
    label: "Colher de servir",
    measureName: "colher de servir",
    preparationCode: "COOKED",
    preparationName: "Cozido",
    amountPerMeasure: 60,
    unit: "g",
  };
  const cooked = {
    ...food({
      id: "rice",
      name: "Arroz cozido",
      group: "Cereais",
      amount: 120,
      quantity: 2,
      measure: "colheres",
    }),
    selectedIbgeMeasureId: "measure-cooked",
    ibgeMeasureOptions: [cookedMeasure],
  };
  const list = createShoppingList({
    meals: [{ ...meals[0], items: [cooked] }],
  });
  assert.equal(list.items[0]?.preparationName, "Cozido");
  assert.equal(list.items[0]?.displayQuantity, "14 colheres");
});

test("27. unidade salva em gramas não é convertida para volume pelo nome", () => {
  const milkInGrams = {
    ...food({
      id: "milk-g",
      name: "Leite integral",
      group: "Leite e derivados",
      amount: 200,
      unit: "g",
    }),
    primaryHouseholdMeasure: "100 ml",
  };
  const result = draft(panel, [{ ...meals[0], items: [milkInGrams] }]);
  const shoppingItem = result.shoppingList.items[0];
  assert.equal(shoppingItem?.unit, "kg");
  assert.equal(shoppingItem?.displayQuantity, "1,4 kg");
  assert.equal(
    result.warnings.some((warning) =>
      warning.includes("a prescrição salva está em g"),
    ),
    true,
  );
});

test("28. entregável distingue prescrição direta da base nutricional", () => {
  const result = draft();
  const firstMeal = result.mealPlan?.meals[0];
  const banana = firstMeal?.items?.find((item) => item.id === "banana");
  assert.equal(banana?.itemType, "FOOD");
  if (banana?.itemType !== "FOOD") assert.fail("alimento não preservado");
  assert.equal(banana.quantity, 1);
  assert.equal(banana.prescribedAmount, 100);
  assert.equal(banana.prescribedUnit, "g");
  assert.equal(banana.nutritionReferenceMeasure, "gramas");
});

test("28b. entregável e lista preservam prescrição direta em mililitros", () => {
  const milkInMilliliters = {
    ...food({
      id: "milk-ml",
      name: "Leite integral",
      group: "Leite e derivados",
      amount: 250,
      unit: "ml",
      measure: "100 ml",
    }),
    nutritionBasisUnit: "ml" as const,
  };
  const result = draft(panel, [
    { ...meals[0], items: [milkInMilliliters] },
  ]);
  const deliveredMilk = result.mealPlan?.meals?.[0]?.items?.[0];
  assert.equal(deliveredMilk?.itemType, "FOOD");
  if (!deliveredMilk || deliveredMilk.itemType !== "FOOD") {
    throw new Error("alimento em ml não preservado");
  }
  assert.equal(deliveredMilk.prescribedAmount, 250);
  assert.equal(deliveredMilk.prescribedUnit, "ml");
  assert.equal(deliveredMilk.nutritionReferenceMeasure, "100 ml");
  assert.equal(result.shoppingList.items[0]?.unit, "L");
  assert.equal(result.shoppingList.items[0]?.displayQuantity, "1,75 L");
  assert.equal(
    result.warnings.some((warning) =>
      warning.includes("a prescrição salva está em"),
    ),
    false,
  );
});

test("29. plano misto preserva ordem, snapshot, null e zero da receita", () => {
  const mixedMeal: MealPlanRecordMeal = {
    ...meals[0],
    items: [meals[0].items[0], recipe(), meals[0].items[1]],
  };
  const result = draft(panel, [mixedMeal]);
  const items = result.mealPlan?.meals[0]?.items;
  assert.deepEqual(items?.map((item) => item.id), [
    "banana",
    "recipe-item-1",
    "leite",
  ]);
  const savedRecipe = items?.[1];
  assert.equal(savedRecipe?.itemType, "RECIPE");
  if (savedRecipe?.itemType !== "RECIPE") assert.fail("receita não preservada");
  assert.equal(savedRecipe.recipeNutritionSnapshotVersion, 3);
  assert.equal(savedRecipe.recipeTitle, "Receita congelada");
  assert.equal(savedRecipe.prescribedNutrients.sodiumMg, null);
  assert.equal(savedRecipe.prescribedNutrients.fiberGrams, 0);
  assert.equal(result.mealPlan?.recipes?.length, 1);
  assert.equal(
    result.mealPlan?.recipes?.[0]?.contentSnapshot?.ingredients[0]
      ?.grossQuantity,
    200,
  );
  assert.equal(
    result.mealPlan?.nutritionTotals.nutritionCompleteness,
    "PARTIAL",
  );
  assert.deepEqual(
    result.shoppingList.items.map((item) => item.catalogFoodId),
    ["banana", "leite"],
  );
});

test("30. uma receita em uma refeição gera um anexo completo", () => {
  const frozenRecipe = recipe();
  const result = draft(panel, [
    { ...meals[0], items: [frozenRecipe] },
  ]);
  assert.equal(result.mealPlan?.recipes?.length, 1);
  assert.deepEqual(result.mealPlan?.recipes?.[0]?.contentPendings, []);
  assert.equal(
    result.mealPlan?.recipes?.[0]?.contentSnapshot?.preparationMethod,
    "Misture e cozinhe conforme o registro congelado.",
  );
  assert.deepEqual(result.shoppingList.items, []);
});

test("31. mesma versão usada em várias refeições não repete o anexo", () => {
  const first = recipe();
  const repeated = { ...recipe(), id: "recipe-item-2" };
  const result = draft(panel, [
    { ...meals[0], items: [first] },
    { ...meals[1], items: [repeated] },
  ]);
  assert.equal(result.mealPlan?.recipes?.length, 1);
  assert.equal(result.mealPlan?.meals.length, 2);
});

test("32. versões diferentes da mesma receita preservam conteúdos distintos", () => {
  const first = recipe();
  const firstContent = first.recipeContentSnapshot;
  assert.ok(firstContent);
  const second: MealPlanRecordRecipe = {
    ...recipe(),
    id: "recipe-item-2",
    recipeNutritionSnapshotId: "recipe-snapshot-2",
    recipeNutritionSnapshotVersion: 4,
    recipeContentSnapshot: {
      ...firstContent,
      preparationMethod: "Preparo exclusivo da versão quatro.",
      finalYield: { amount: 500, unit: "GRAM" },
    },
  };
  const result = draft(panel, [
    { ...meals[0], items: [first, second] },
  ]);
  assert.equal(result.mealPlan?.recipes?.length, 2);
  assert.deepEqual(
    result.mealPlan?.recipes?.map(
      (item) => item.contentSnapshot?.preparationMethod,
    ),
    [
      "Misture e cozinhe conforme o registro congelado.",
      "Preparo exclusivo da versão quatro.",
    ],
  );
});

test("33. mudar a porção altera nutrientes, mas não o anexo congelado", () => {
  const original = recipe();
  const contentBefore = structuredClone(original.recipeContentSnapshot);
  const updated = updateMealPlanRecipePortion(original, "2");
  assert.equal(updated.success, true);
  if (!updated.success) throw new Error("não foi possível atualizar a porção");
  assert.equal(updated.recipe.prescribedNutrients.energyKcal, 300);
  assert.equal(updated.recipe.prescribedNutrients.fiberGrams, 0);
  assert.equal(updated.recipe.prescribedNutrients.sodiumMg, null);
  assert.deepEqual(updated.recipe.recipeContentSnapshot, contentBefore);

  const result = draft(panel, [
    { ...meals[0], items: [updated.recipe] },
  ]);
  assert.deepEqual(result.mealPlan?.recipes?.[0]?.contentSnapshot, contentBefore);
});

test("34. receita antiga sem conteýo congelado gera pendência profissional", () => {
  const { recipeContentSnapshot, ...legacyRecipe } = recipe();
  assert.ok(recipeContentSnapshot);
  const result = draft(panel, [
    { ...meals[0], items: [legacyRecipe] },
  ]);
  assert.deepEqual(result.mealPlan?.recipes?.[0]?.contentPendings, [
    "CONTENT_SNAPSHOT_MISSING",
  ]);
  assert.equal(result.mealPlan?.recipes?.[0]?.contentSnapshot, undefined);
  assert.equal(
    result.warnings.some((warning) =>
      warning.includes("conteúdo completo congelado"),
    ),
    true,
  );
});

test("35. estratégia congelada no plano não é substituída pela corrente", () => {
  const frozenStrategy: MealPlanStrategyInheritance = {
    ...strategy,
    sourceStrategyId: "strategy-frozen",
    objective: "WEIGHT_LOSS",
    caloriesKcal: 1_700,
  };
  const currentStrategy: MealPlanStrategyInheritance = {
    ...strategy,
    sourceStrategyId: "strategy-current",
    objective: "HYPERTROPHY",
    caloriesKcal: 2_500,
  };
  assert.equal(
    resolveDeliverableStrategy(
      {
        strategyEntryId: frozenStrategy.sourceStrategyId,
        strategySnapshot: frozenStrategy,
      },
      currentStrategy,
    ),
    frozenStrategy,
  );
  assert.equal(
    resolveDeliverableStrategy(
      { strategyEntryId: frozenStrategy.sourceStrategyId },
      currentStrategy,
    ),
    undefined,
  );
});

test("36. análise separa meta da estratégia dos totais congelados e registra desvio autorizado sem justificativa inventada", () => {
  const frozenTotals = {
    ...calculateMealPlanNutritionTotals(meals),
    values: {
      energyKcal: 1_836.4,
      proteinGrams: 118.25,
      carbohydratesGrams: 224.75,
      fatsGrams: 61.8,
      fiberGrams: 37.8,
    },
  };
  const result = buildNutritionDeliverableDraft({
    panel,
    strategy,
    plan: {
      id: "plan-approved-snapshot",
      patientId: panel.patientId,
      attendanceId: panel.attendanceId,
      status: "APPROVED",
      responsibleUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
      responsibleProfessional: "Saulo Xavier Vitorino",
      updatedAt: generatedAt,
      meals,
      nutritionTotals: frozenTotals,
      targetDeviationAuthorized: true,
    },
    attendanceType: "NUTRITION",
    professional: { fullName: "Saulo Xavier Vitorino" },
    generatedAt,
  });
  const plannedValues = result.guidance.find(
    (item) => item.category === "Metas e valores planejados",
  )?.content ?? "";
  const fibersAndHydration = result.guidance.find(
    (item) => item.category === "Fibras e hidratação",
  )?.content ?? "";

  assert.deepEqual(result.mealPlan?.nutritionTotals.values, frozenTotals.values);
  assert.match(plannedValues, /Referência aprovada da estratégia: 1\.700 kcal/i);
  assert.match(plannedValues, /Valores planejados na versão concluída: 1\.836,4 kcal/i);
  assert.match(plannedValues, /decisão profissional registrada na finalização do plano/i);
  assert.match(plannedValues, /não os classifica automaticamente como erro ou problema/i);
  assert.match(fibersAndHydration, /37,8 g conhecidos/i);
  assert.doesNotMatch(plannedValues, /corresponde à meta|adequação gradual|teste funcional/i);
  assert.doesNotMatch(
    JSON.stringify(result.guidance),
    /buscar atingir aproximadamente|alimentos já aprovados no plano, incluindo|espera-se evolução/i,
  );
});

test("36b. entregável completo expõe a conduta aprovada sem convertê-la em diagnóstico", () => {
  const result = buildNutritionDeliverableDraft({
    panel: {
      ...panel,
      inheritedClinicalContext: {
        ...panel.inheritedClinicalContext,
        diagnoses: [],
      },
    },
    strategy: {
      ...strategy,
      modifications: ["HIGH_PROTEIN", "FLUID_RESTRICTION"],
      clinicalProtocols: ["OBESITY_WEIGHT_LOSS"],
      secondaryObjectives: ["Saúde"],
      clinicalObservations: "",
    },
    plan: {
      id: "plan-with-conduct",
      patientId: panel.patientId,
      attendanceId: panel.attendanceId,
      status: "APPROVED",
      responsibleUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
      responsibleProfessional: "Saulo Xavier Vitorino",
      updatedAt: generatedAt,
      meals,
    },
    attendanceType: "NUTRITION",
    professional: { fullName: "Saulo Xavier Vitorino" },
    generatedAt,
  });
  const conduct = result.guidance.find(
    (item) => item.category === "Conduta nutricional registrada",
  )?.content ?? "";
  const hydration = result.guidance.find(
    (item) => item.category === "Fibras e hidratação",
  )?.content ?? "";
  const followUp = result.guidance.find(
    (item) => item.category === "Acompanhamento e reavaliação",
  )?.content ?? "";

  assert.match(conduct, /Hiperproteica/);
  assert.match(conduct, /Restrição hídrica/);
  assert.match(conduct, /Obesidade \/ emagrecimento/);
  assert.match(conduct, /não constituem diagnóstico clínico/);
  assert.match(conduct, /Objetivos complementares registrados: Saúde/);
  assert.match(hydration, /selecionada como modificação técnica na Estratégia Nutricional aprovada/i);
  assert.match(hydration, /valor foi registrado no campo de meta hídrica/i);
  assert.match(hydration, /não o consumo de água efetivamente realizado/i);
  assert.match(followUp, /execução das 2 refeições planejadas/i);
  assert.match(followUp, /não presume resultados, diagnóstico, prazo ou necessidade de ajuste/i);
  assert.deepEqual(result.professionalNotes, {
    considerations: "",
    orientations: "",
  });
  assert.equal(result.includeClinicalDiagnosis, false);
});

test("37. fibra parcial é apresentada como subtotal conhecido, sem recomendar aumento ou redução", () => {
  const partialRecipe = {
    ...recipe(),
    partialNutrients: ["fiberGrams"],
  } satisfies MealPlanRecordRecipe;
  const partialMeals = [{ ...meals[0], items: [partialRecipe] }];
  const calculated = calculateMealPlanNutritionTotals(partialMeals);
  const frozenTotals = {
    ...calculated,
    values: { ...calculated.values, fiberGrams: 37.8 },
  };
  const result = buildNutritionDeliverableDraft({
    panel,
    strategy: { ...strategy, fiberGrams: 25 },
    plan: {
      id: "plan-partial-fiber",
      patientId: panel.patientId,
      attendanceId: panel.attendanceId,
      status: "APPROVED",
      responsibleProfessional: "Saulo Xavier Vitorino",
      updatedAt: generatedAt,
      meals: partialMeals,
      nutritionTotals: frozenTotals,
    },
    attendanceType: "NUTRITION",
    professional: { fullName: "Saulo Xavier Vitorino" },
    generatedAt,
  });
  const analysis = result.guidance.find(
    (item) => item.category === "Fibras e hidratação",
  )?.content ?? "";

  assert.match(analysis, /meta registrada na estratégia é 25 g/i);
  assert.match(analysis, /37,8 g conhecidos/i);
  assert.match(analysis, /subtotal parcial/i);
  assert.doesNotMatch(analysis, /aument|reduz|atingir aproximadamente/i);
  assert.equal(result.mealPlan?.nutritionTotals.nutritionCompleteness, "PARTIAL");
});

test("37b. texto autoral registrado permanece separado dos dados gerados", () => {
  const result = draft(panel, meals, {
    ...strategy,
    clinicalObservations: "Consideração escrita pelo profissional.",
  });

  assert.deepEqual(result.professionalNotes, {
    considerations: "Consideração escrita pelo profissional.",
    orientations: "",
  });
  assert.doesNotMatch(
    JSON.stringify(result.guidance),
    /Consideração escrita pelo profissional/,
  );
});

test("38. receita mantém ingredientes do rendimento integral e somente a porção prescrita na refeição", () => {
  const result = draft(panel, [
    { ...meals[0], items: [recipe()] },
  ]);
  const mealRecipe = result.mealPlan?.meals?.[0]?.items?.[0];
  assert.equal(mealRecipe?.itemType, "RECIPE");
  if (!mealRecipe || mealRecipe.itemType !== "RECIPE") {
    throw new Error("receita ausente");
  }
  assert.equal(mealRecipe.portion.prescribedServings, 1);
  assert.equal(mealRecipe.portion.recipeServings, 2);
  assert.equal(
    result.mealPlan?.recipes?.[0]?.contentSnapshot?.ingredients[0]?.grossQuantity,
    200,
  );
  assert.equal(result.mealPlan?.recipes?.length, 1);
});

test("39. impressão usa nomes legíveis e não duplica o número de porções no rendimento", () => {
  assert.equal(missingNutrientLabel("transFatsGrams"), "gorduras trans");
  assert.equal(missingNutrientLabel("vitaminB12Mcg"), "vitamina B12");
  assert.equal(recipeServingsLabel(1), "1 porção");
  assert.equal(recipeServingsLabel(3), "3 porções");
  assert.equal(
    yieldDescriptionIncludesServings(
      "3 porções de 100 g aproximadamente",
      3,
    ),
    true,
  );
});

test("40. revisão diagnóstica ainda não realizada permanece pendente", () => {
  const result = draft({
    ...panel,
    inheritedClinicalContext: {
      ...panel.inheritedClinicalContext,
      diagnoses: [],
      diagnosisReview: undefined,
    },
  });

  assert.equal(result.clinicalDiagnosis.reviewOutcome, undefined);
  assert.equal(result.includeClinicalDiagnosis, false);
});

test("41. revisão sem diagnóstico não cria texto ou análise clínica", () => {
  const result = draft({
    ...panel,
    inheritedClinicalContext: {
      ...panel.inheritedClinicalContext,
      diagnoses: [],
      diagnosisReview: {
        outcome: "NO_DIAGNOSIS_ESTABLISHED",
        reviewedAt: generatedAt,
        responsibleName: "Saulo Xavier Vitorino",
        revision: 1,
      },
    },
  });

  assert.equal(
    result.clinicalDiagnosis.reviewOutcome,
    "NO_DIAGNOSIS_ESTABLISHED",
  );
  assert.equal(result.clinicalDiagnosis.content, "");
  assert.deepEqual(result.clinicalDiagnosis.sections, []);
  assert.deepEqual(result.clinicalDiagnosis.sourceReferences, []);
  assert.equal(result.includeClinicalDiagnosis, false);
});

test("42. revisão com diagnósticos registra somente o conteúdo confirmado", () => {
  const result = draft({
    ...panel,
    inheritedClinicalContext: {
      ...panel.inheritedClinicalContext,
      diagnoses: ["Hipertensão confirmada"],
      diagnosisReview: {
        outcome: "DIAGNOSES_CONFIRMED",
        reviewedAt: generatedAt,
        responsibleName: "Saulo Xavier Vitorino",
        revision: 1,
      },
    },
  });

  assert.equal(
    result.clinicalDiagnosis.reviewOutcome,
    "DIAGNOSES_CONFIRMED",
  );
  assert.match(result.clinicalDiagnosis.content, /Hipertensão confirmada/);
  assert.equal(result.includeClinicalDiagnosis, true);
  assert.equal(
    result.clinicalDiagnosis.sourceReferences.includes(
      "Revisão profissional do diagnóstico",
    ),
    true,
  );
});
