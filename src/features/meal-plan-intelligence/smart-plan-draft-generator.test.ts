import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

import {
  normalizeFoodSearchText,
  type ProfessionalFood,
} from "@/features/food-database";
import { foodRepository } from "@/features/food-database/repository";
import {
  calculateFoodNutrientsForGrams,
  normalizeFoodNutrients,
} from "@/features/meal-plan/nutrition-calculations";
import { prisma } from "@/lib/database/prisma";

import {
  nutritionalDecisionEngine,
  type EligibleFood,
} from "./nutritional-decision-engine";
import {
  patientContextLocation,
  type PatientContext,
} from "./patient-context-service";
import {
  mealFunctionsFor,
  regionalFoodRankingBonus,
  resolveRegionalFoodContext,
  smartPlanDraftGenerator,
  type SmartPlanDraft,
} from "./smart-plan-draft-generator";
import { classifyFoodSemantics } from "./food-semantic-profile";

let masterFoods: readonly ProfessionalFood[] = [];

before(async () => {
  const first = await foodRepository.search({ source: "TACO", status: "ACTIVE", page: 1, pageSize: 50 });
  const pages = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      foodRepository.search({ source: "TACO", status: "ACTIVE", page: index + 2, pageSize: 50 }),
    ),
  );
  masterFoods = [first, ...pages].flatMap((page) => page.items);
  assert.ok(masterFoods.length >= 597);
});

after(async () => {
  await prisma.$disconnect();
});

interface ContextScenario {
  readonly mealCount?: number;
  readonly namedMeals?: boolean;
  readonly informedTimes?: boolean;
  readonly caloriesKcal?: number;
  readonly proteinGrams?: number;
  readonly carbohydratesGrams?: number;
  readonly fatsGrams?: number;
  readonly allergies?: readonly string[];
  readonly intolerances?: readonly string[];
  readonly restrictions?: readonly string[];
  readonly refusedFoods?: readonly string[];
  readonly preferredFoods?: readonly string[];
  readonly habitualFoods?: readonly string[];
  readonly habitualIntakeBasis?: PatientContext["clinical"]["habitualIntakeBasis"];
  readonly financialAccessibility?: string;
  readonly attendanceId?: string;
  readonly foods?: readonly ProfessionalFood[];
  readonly objective?: string;
  readonly ageYears?: number;
  readonly pathologies?: readonly string[];
  readonly dailyRoutine?: readonly string[];
  readonly exercise?: PatientContext["clinical"]["exercise"];
  readonly mealNames?: readonly string[];
  readonly mealPercentages?: readonly number[];
  readonly location?: PatientContext["patient"]["location"];
  readonly relevantObservations?: readonly string[];
  readonly strategyObservations?: string;
}

function context(scenario: ContextScenario = {}): PatientContext {
  const mealCount = scenario.mealCount ?? 4;
  const foods = scenario.foods ?? masterFoods;
  return {
    patient: {
      patientId: "patient-smart-draft",
      masterRecordId: "master-record-smart-draft",
      attendanceId: scenario.attendanceId ?? "attendance-smart-draft",
      sex: "FEMALE",
      ageYears: scenario.ageYears ?? 35,
      weightKg: 65,
      heightCm: 165,
      bmi: 23.9,
      objective: scenario.objective ?? "Manutenção da saúde",
      secondaryObjectives: [],
      location: scenario.location,
      source: "MASTER_RECORD",
    },
    clinical: {
      pathologies: scenario.pathologies ?? [],
      availableExams: [],
      allergyStatus: scenario.allergies?.length ? "CONFIRMED" : "DENIED",
      allergies: scenario.allergies ?? [],
      intolerances: scenario.intolerances ?? [],
      restrictions: scenario.restrictions ?? [],
      refusedFoods: scenario.refusedFoods ?? [],
      preferredFoods: scenario.preferredFoods ?? ["Banana", "Arroz", "Feij\u00e3o"],
      habitualFoods: scenario.habitualFoods ?? ["Banana", "Arroz", "Feij\u00e3o", "Frango"],
      habitualIntakeBasis: scenario.habitualIntakeBasis,
      dailyRoutine: scenario.dailyRoutine ?? ["Rotina alimentar registrada"],
      financialAccessibility:
        scenario.financialAccessibility ?? "Priorizar alimentos acess\u00edveis e de baixo custo",
      mealSchedules: [],
      exercise: scenario.exercise ?? {},
      relevantObservations: scenario.relevantObservations ?? [],
      unavailableStructuredFields: [],
      source: "MASTER_RECORD",
    },
    nutritionStrategy: {
      sourceStrategyId: "strategy-smart-draft",
      objective: scenario.objective ?? "Manuten\u00e7\u00e3o da sa\u00fade",
      protocol: "MIFFLIN_ST_JEOR",
      totalEnergyExpenditureKcal: 2_000,
      caloriesKcal: scenario.caloriesKcal ?? 2_000,
      protein: { grams: scenario.proteinGrams ?? 100, percentage: 20 },
      carbohydrates: { grams: scenario.carbohydratesGrams ?? 250, percentage: 50 },
      fats: { grams: scenario.fatsGrams ?? 66.7, percentage: 30 },
      dailyDistribution: Array.from({ length: mealCount }, (_, index) => ({
        mealNumber: index + 1,
        name:
          scenario.mealNames?.[index] ??
          (scenario.namedMeals === false ? "" : `Refeição clínica ${index + 1}`),
        time: scenario.informedTimes === false ? "" : `${String(7 + index * 3).padStart(2, "0")}:00`,
        vetPercentage: scenario.mealPercentages?.[index] ?? 100 / mealCount,
        plannedCaloriesKcal:
          (scenario.caloriesKcal ?? 2_000) *
          ((scenario.mealPercentages?.[index] ?? 100 / mealCount) / 100),
      })),
      supplementation: [],
      observations: scenario.strategyObservations ?? "",
      source: "NUTRITION_STRATEGY",
    },
    foodCatalog: {
      source: "MASTER_FOOD_DATABASE",
      activeFoodCount: foods.length,
      availableSources: ["TACO"],
      foods,
    },
  };
}

function generate(
  patientContext: PatientContext,
  eligibleFoods: readonly EligibleFood[] = nutritionalDecisionEngine.evaluate(patientContext),
) {
  let sequence = 0;
  return smartPlanDraftGenerator.generate({
    patientContext,
    eligibleFoods,
    options: {
      now: () => new Date("2026-08-03T12:00:00.000Z"),
      createId: () => `temporary-meal-${++sequence}`,
    },
  });
}

function successfulDraft(
  patientContext: PatientContext,
  eligibleFoods?: readonly EligibleFood[],
): SmartPlanDraft {
  const result = generate(patientContext, eligibleFoods);
  assert.equal(
    result.success,
    true,
    result.success
      ? undefined
      : result.pending.map((item) => `${item.message} (${item.reason})`).join("; "),
  );
  if (!result.success) throw new Error("Prévia esperada não foi gerada.");
  return result.smartPlanDraft;
}

function usedFoodIds(draft: SmartPlanDraft) {
  return new Set(draft.meals.flatMap((meal) => meal.items.map((item) => item.foodId)));
}

test("1. paciente sem restrições gera prévia estruturada não aprovada", () => {
  const draft = successfulDraft(context());
  assert.equal(draft.generationStatus, "PREVIEW_NOT_APPROVED");
  assert.equal(draft.approvalLabel, "Prévia não aprovada.");
  assert.ok(draft.meals.every((meal) => meal.items.length > 0));
  const items = draft.meals.flatMap((meal) => meal.items);
  assert.ok(items.every((item) => item.prescribedAmount > 0 && item.unit === "g"));
  assert.ok(new Set(items.map((item) => item.group)).size >= 3);
  assert.ok(
    new Set(
      draft.meals.map((meal) => meal.items.map((item) => item.foodId).sort().join("|")),
    ).size > 1,
  );
  assert.ok(items.every((item) => item.name !== "Café, pó, torrado"));
});

test("1b. cada refeição cumpre estrutura culinária e porções sem otimização absurda", () => {
  const draft = successfulDraft(context({ mealCount: 6, namedMeals: false }));
  for (const meal of draft.meals) {
    const profiles = meal.items.map((item) => {
      const food = masterFoods.find((candidate) => candidate.id === item.foodId);
      assert.ok(food);
      const semantic = classifyFoodSemantics(food);
      assert.equal(semantic.automaticEligible, true);
      assert.ok(item.prescribedAmount >= semantic.minimumGrams);
      assert.ok(item.prescribedAmount <= semantic.maximumGrams);
      assert.equal(item.prescribedAmount % semantic.stepGrams, 0);
      return semantic;
    });
    for (const requiredFunction of mealFunctionsFor(meal.name, meal.time)) {
      assert.ok(
        profiles.some((profile) => profile.functions.includes(requiredFunction)),
        `${meal.name} sem ${requiredFunction}`,
      );
    }
    assert.ok(meal.internalJustification.includes("hipótese clínica"));
  }
  const normalizedNames = normalizeFoodSearchText(
    draft.meals.flatMap((meal) => meal.items.map((item) => item.name)).join(" "),
  );
  assert.doesNotMatch(normalizedNames, /damasco seco|ameixa seca|parmesao|queijo ralado|jilo cru/);
});

test("1c. paciente novo sem recordatório gera proposta e informa dados opcionais ausentes", () => {
  const result = generate(context({
    preferredFoods: [],
    habitualFoods: [],
    dailyRoutine: [],
    financialAccessibility: "",
  }));
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(
    result.smartPlanDraft.optionalDataNotProvided.map((item) => item.field),
    ["foodPreferences", "habitualIntake", "dailyRoutine", "financialAccessibility"],
  );
  assert.ok(result.smartPlanDraft.warnings.includes("Proposta inicial gerada sem recordatório alimentar."));
  const regionalNames = normalizeFoodSearchText(
    result.smartPlanDraft.meals.flatMap((meal) => meal.items.map((item) => item.name)).join(" "),
  );
  assert.match(regionalNames, /cuscuz/);
  assert.match(regionalNames, /arroz/);
  assert.match(regionalNames, /feijao/);
});

test("1c.1 atendimento online sem recordatório usa construção inicial segura", () => {
  const draft = successfulDraft(context({
    attendanceId: "attendance-online-without-recall",
    habitualFoods: [],
    habitualIntakeBasis: "NOT_INFORMED",
  }));
  assert.equal(draft.attendanceId, "attendance-online-without-recall");
  assert.ok(draft.warnings.includes("Proposta inicial gerada sem recordatório alimentar."));
  assert.ok(draft.meals.every((meal) => meal.items.length >= 2));
});

test("1c.2 recordatório confirmado é identificado e usado como referência", () => {
  const draft = successfulDraft(context({
    habitualFoods: ["Banana", "Arroz", "Feijão", "Frango"],
    habitualIntakeBasis: "CONFIRMED_REPRESENTATIVE",
  }));
  assert.ok(draft.warnings.includes("Proposta baseada em recordatório alimentar confirmado como representativo pelo nutricionista."));
  assert.equal(draft.inputSummary.habitualIntakeBasis, "CONFIRMED_REPRESENTATIVE");
  assert.ok(draft.meals.flatMap((meal) => meal.items).some((item) =>
    item.selectionReason.includes("Alimento presente no recordatório."),
  ));
});

test("1c.3 recordatório incompleto ou de teste permanece fora da base clínica", () => {
  const draft = successfulDraft(context({
    habitualFoods: ["Alimento de teste"],
    habitualIntakeBasis: "UNCONFIRMED_OR_TEST",
  }));
  assert.ok(draft.warnings.includes("Proposta inicial gerada sem recordatório alimentar."));
  assert.ok(draft.optionalDataNotProvided.some((item) =>
    item.field === "habitualIntake" && item.message.includes("não confirmado"),
  ));
  assert.equal(draft.meals.flatMap((meal) => meal.items).some((item) =>
    item.selectionReason.includes("Alimento presente no recordatório."),
  ), false);
});

test("1d. camada semântica rejeita fruta seca, parmesão ralado e jiló cru", () => {
  const base = masterFoods[0];
  assert.ok(base);
  const prohibited: readonly ProfessionalFood[] = [
    { ...base, id: "semantic-dried-fruit", officialName: "Damasco seco", foodGroup: "Frutas" },
    { ...base, id: "semantic-grated-cheese", officialName: "Queijo parmesão ralado", foodGroup: "Leite e derivados" },
    { ...base, id: "semantic-raw-jilo", officialName: "Jiló cru", foodGroup: "Verduras e hortaliças" },
    { ...base, id: "semantic-commercial-yogurt", officialName: "Iogurte Natural Marca 2x120g", foodGroup: "Leite e derivados" },
    { ...base, id: "semantic-peel", officialName: "Abóbora (casca)", foodGroup: "Verduras e hortaliças" },
    { ...base, id: "semantic-quail-egg", officialName: "Ovo de codorna cozido", foodGroup: "Ovos" },
  ];
  for (const food of prohibited) {
    const semantic = classifyFoodSemantics(food);
    assert.equal(semantic.automaticEligible, false, food.officialName);
    assert.equal(semantic.maximumGrams, 0, food.officialName);
    assert.ok(semantic.rejectionReason, food.officialName);
  }
});

test("2. intolerância à lactose impede uso de alimentos restritos", () => {
  const patient = context({ intolerances: ["Intolerância à lactose"] });
  const eligibility = nutritionalDecisionEngine.evaluate(patient);
  const result = generate(patient, eligibility);
  if (!result.success) {
    assert.equal(result.pending[0].field, "semanticFoodCatalog");
    return;
  }
  const restrictedIds = new Set(eligibility.filter((food) => food.status !== "APROVADO").map((food) => food.foodId));
  assert.ok([...usedFoodIds(result.smartPlanDraft)].every((id) => !restrictedIds.has(id)));
});

test("3. alergia ao ovo impede uso de alimentos bloqueados", () => {
  const patient = context({ allergies: ["Alergia ao ovo"] });
  const eligibility = nutritionalDecisionEngine.evaluate(patient);
  const draft = successfulDraft(patient, eligibility);
  const eggIds = new Set(eligibility.filter((food) => food.reason.includes("Alergia ao ovo")).map((food) => food.foodId));
  assert.ok([...usedFoodIds(draft)].every((id) => !eggIds.has(id)));
});

test("4. padrão vegetariano não utiliza carnes ou pescados bloqueados", () => {
  const patient = context({ restrictions: ["Vegetariana"] });
  const eligibility = nutritionalDecisionEngine.evaluate(patient);
  const result = generate(patient, eligibility);
  if (!result.success) {
    assert.equal(result.pending[0].field, "semanticFoodCatalog");
    return;
  }
  const blockedIds = new Set(eligibility.filter((food) => food.status === "BLOQUEADO").map((food) => food.foodId));
  assert.ok([...usedFoodIds(result.smartPlanDraft)].every((id) => !blockedIds.has(id)));
});

test("5. alimento recusado não aparece na prévia", () => {
  const refused = masterFoods.find((food) => food.officialName === "Arroz, integral, cozido");
  assert.ok(refused);
  const patient = context({ refusedFoods: [refused.officialName] });
  const draft = successfulDraft(patient);
  assert.equal(usedFoodIds(draft).has(refused.id), false);
});

test("6. estratégia com seis refeições gera exatamente seis refeições", () => {
  const draft = successfulDraft(context({ mealCount: 6, namedMeals: false }));
  assert.equal(draft.meals.length, 6);
  assert.deepEqual(draft.meals.map((meal) => meal.name), ["Desjejum", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"]);
});

test("6b. seis refeições sem distribuição profissional usam 20/10/30/10/25/5", () => {
  const draft = successfulDraft(context({
    mealCount: 6,
    namedMeals: false,
    caloriesKcal: 1_836,
    proteinGrams: 114.7,
    carbohydratesGrams: 206.5,
    fatsGrams: 61.2,
  }));

  assert.deepEqual(
    draft.meals.map((meal) => meal.targetPercentage),
    [20, 10, 30, 10, 25, 5],
  );
  assert.deepEqual(
    draft.meals.map((meal) => Number(meal.targetEnergyKcal?.toFixed(1))),
    [367.2, 183.6, 550.8, 183.6, 459, 91.8],
  );
  const mealDeviations = draft.meals.map((meal) => ({
    name: meal.name,
    actual: meal.totals.energyKcal,
    target: meal.targetEnergyKcal ?? 0,
    deviation: Math.abs(meal.totals.energyKcal - (meal.targetEnergyKcal ?? 0)) /
      (meal.targetEnergyKcal ?? 1),
  }));
  assert.ok(
    mealDeviations.every((meal) => meal.deviation <= 0.15),
    JSON.stringify(mealDeviations),
  );
  assert.ok(
    Object.values(draft.targetComparison).every(
      (comparison) => comparison.withinTolerance,
    ),
    JSON.stringify(draft.targetComparison),
  );
});

test("6c. distribuição profissional substitui o padrão funcional", () => {
  const percentages = [22, 8, 32, 8, 25, 5];
  const draft = successfulDraft(context({
    mealCount: 6,
    namedMeals: false,
    mealPercentages: percentages,
  }));

  assert.deepEqual(draft.meals.map((meal) => meal.targetPercentage), percentages);
});

test("6d. percentuais somam cem e metas energéticas preservam o VET", () => {
  const draft = successfulDraft(context({
    mealCount: 6,
    namedMeals: false,
    caloriesKcal: 1_836,
  }));

  assert.equal(
    draft.meals.reduce((sum, meal) => sum + (meal.targetPercentage ?? 0), 0),
    100,
  );
  assert.equal(
    Number(draft.meals.reduce(
      (sum, meal) => sum + (meal.targetEnergyKcal ?? 0),
      0,
    ).toFixed(1)),
    1_836,
  );
});

test("6e. evita repetição excessiva de combinações e ovos no mesmo dia", () => {
  const draft = successfulDraft(context({ mealCount: 6, namedMeals: false }));
  const fruitAndDairyMeals = draft.meals.filter((meal) => {
    const functions = meal.items.flatMap((item) => {
      const food = masterFoods.find((candidate) => candidate.id === item.foodId);
      return food ? classifyFoodSemantics(food).functions : [];
    });
    return functions.includes("FRUIT") && functions.includes("DAIRY");
  });
  const eggMeals = draft.meals.filter((meal) =>
    meal.items.some((item) => /ovo|omelete/i.test(item.name)),
  );

  assert.ok(fruitAndDairyMeals.length <= 1);
  assert.ok(eggMeals.length <= 1);
});

test("7. estratégia com quatro refeições gera exatamente quatro refeições", () => {
  const draft = successfulDraft(context({ mealCount: 4, namedMeals: false }));
  assert.equal(draft.meals.length, 4);
  assert.deepEqual(draft.meals.map((meal) => meal.name), ["Desjejum", "Almoço", "Lanche da tarde", "Jantar"]);
});

test("8. horários informados são preservados", () => {
  const draft = successfulDraft(context({ informedTimes: true }));
  assert.deepEqual(draft.meals.map((meal) => meal.time), ["07:00", "10:00", "13:00", "16:00"]);
});

test("9. horários ausentes bloqueiam a construção inicial", () => {
  const result = generate(context({ informedTimes: false }));
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.pending.every((item) => item.field.startsWith("mealTime:")));
  assert.ok(result.pending[0].message.startsWith("Informe ou herde o horário"));
});

test("10. estratégia ausente interrompe a geração", () => {
  const patient = { ...context(), nutritionStrategy: undefined } as unknown as PatientContext;
  const result = generate(patient, []);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.pending[0].message, "Estratégia Nutricional aprovada não encontrada.");
});

test("11. macro obrigatório ausente interrompe a geração", () => {
  const patient = context({ proteinGrams: 0 });
  const result = generate(patient);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.pending.some((item) => item.message === "Meta de proteínas não encontrada na Estratégia Nutricional."));
});

test("12. poucos alimentos elegíveis bloqueiam a geração sem inventar uma refeição", () => {
  const patient = context();
  const approved = nutritionalDecisionEngine.evaluate(patient).filter((food) => food.status === "APROVADO").slice(0, 2);
  const result = generate(patient, approved);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.pending[0].field, "semanticFoodCatalog");
});

test("13. nenhum alimento elegível interrompe a geração", () => {
  const patient = context();
  const blocked = nutritionalDecisionEngine.evaluate(patient).map((food) => ({ ...food, status: "BLOQUEADO" as const }));
  const result = generate(patient, blocked);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.pending[0].message, "Nenhum alimento aprovado disponível para gerar a prévia.");
});

test("14. nutrientes são calculados proporcionalmente ao peso prescrito", () => {
  const patient = context();
  const draft = successfulDraft(patient);
  const item = draft.meals.flatMap((meal) => meal.items)[0];
  const food = masterFoods.find((candidate) => candidate.id === item.foodId);
  assert.ok(food?.nutrients);
  const expected = calculateFoodNutrientsForGrams(normalizeFoodNutrients(food.nutrients), item.prescribedAmount);
  assert.equal(item.energyKcal, expected.energyKcal);
  assert.equal(item.proteinGrams, expected.proteinGrams);
  assert.equal(item.carbohydratesGrams, expected.carbohydratesGrams);
  assert.equal(item.fatsGrams, expected.fatsGrams);
});

test("14b. cada alimento apresenta medida caseira acompanhada do peso em gramas", () => {
  const draft = successfulDraft(context({ mealCount: 6, namedMeals: false }));

  for (const item of draft.meals.flatMap((meal) => meal.items)) {
    assert.match(item.householdMeasure, /\d/);
    assert.match(
      `${item.householdMeasure} · ${item.prescribedAmount} ${item.unit}`,
      /(unidade|colher|concha|fatia|xícara|copo|porção|pote|filé|pedaço|escumadeira).*\d+.*g/i,
    );
  }
});

test("15. comparação diária referencia todas as metas da Estratégia", () => {
  const draft = successfulDraft(context());
  assert.equal(draft.targetComparison.energyKcal.target, 2_000);
  assert.equal(draft.targetComparison.proteinGrams.target, 100);
  assert.equal(draft.targetComparison.carbohydratesGrams.target, 250);
  assert.equal(draft.targetComparison.fatsGrams.target, 66.7);
});

test("15b. ajusta simultaneamente VET, proteínas, carboidratos e lipídios do caso real", () => {
  const draft = successfulDraft(context({
    caloriesKcal: 1_836,
    proteinGrams: 114.7,
    carbohydratesGrams: 206.5,
    fatsGrams: 61.2,
  }));

  assert.equal(
    draft.requiresProfessionalAdjustment,
    false,
    JSON.stringify({ totals: draft.dailyTotals, comparison: draft.targetComparison, meals: draft.meals }),
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(draft.targetComparison).map(([metric, comparison]) => [
        metric,
        comparison.withinTolerance,
      ]),
    ),
    {
      energyKcal: true,
      proteinGrams: true,
      carbohydratesGrams: true,
      fatsGrams: true,
    },
  );
});

test("15c. carboidratos acima de cinco por cento mantêm a prévia pendente", () => {
  const draft = successfulDraft(context({
    caloriesKcal: 5_000,
    proteinGrams: 250,
    carbohydratesGrams: 200,
    fatsGrams: 140,
  }));

  assert.equal(draft.targetComparison.carbohydratesGrams.withinTolerance, false);
  assert.equal(draft.requiresProfessionalAdjustment, true);
  assert.equal(draft.generationStatus, "PREVIEW_NOT_APPROVED");
  assert.ok(draft.warnings.some((warning) => warning.includes("carboidratos")));
});

test("16. catálogo amplo prioriza porções humanas antes da tolerância matemática", () => {
  const draft = successfulDraft(context());
  assert.ok(
    draft.meals.flatMap((meal) => meal.items).every(
      (item) => Number.isInteger(item.prescribedAmount / 5),
    ),
    JSON.stringify(draft.meals),
  );
});

test("17. plano fora da tolerância retorna alerta profissional", () => {
  const patient = context({ caloriesKcal: 5_000, proteinGrams: 250, carbohydratesGrams: 700, fatsGrams: 140 });
  const draft = successfulDraft(patient);
  assert.equal(draft.requiresProfessionalAdjustment, true);
  assert.ok(draft.warnings.some((warning) =>
    warning.includes("A prévia permanece pendente de revisão"),
  ));
});

test("18. nenhum alimento bloqueado ou restrito é incluído", () => {
  const patient = context({ allergies: ["Alergia ao ovo"], refusedFoods: ["Arroz integral cozido"] });
  const eligibility = nutritionalDecisionEngine.evaluate(patient);
  const draft = successfulDraft(patient, eligibility);
  const nonApproved = new Set(eligibility.filter((food) => food.status !== "APROVADO").map((food) => food.foodId));
  assert.ok([...usedFoodIds(draft)].every((id) => !nonApproved.has(id)));
});

test("19. gerador não possui persistência nem integração com interface", async () => {
  const source = (await readFile("src/features/meal-plan-intelligence/smart-plan-draft-generator.ts", "utf8")).toLowerCase();
  assert.equal(source.includes("repository"), false);
  assert.equal(source.includes("prisma"), false);
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("openai"), false);
});

test("20. geração repetida não altera o Banco Mestre", async () => {
  const patient = context();
  const eligibility = nutritionalDecisionEngine.evaluate(patient);
  const sampledFood = masterFoods[0];
  const beforeRecord = await foodRepository.findById(sampledFood.id);
  const first = generate(patient, eligibility);
  const second = generate(patient, eligibility);
  const afterRecord = await foodRepository.findById(sampledFood.id);
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.deepEqual(afterRecord, beforeRecord);
});

test("cada refeicao registra justificativa interna para revisao profissional", () => {
  const draft = successfulDraft(context({
    dailyRoutine: ["Rotina registrada"],
    preferredFoods: ["Banana"],
  }));
  assert.ok(draft.meals.every((meal) => meal.internalJustification.length > 40));
  assert.ok(draft.meals.every((meal) =>
    normalizeFoodSearchText(meal.internalJustification).includes("hipotese clinica"),
  ));
});

test("regeneracao parcial constroi somente a refeicao solicitada", () => {
  const patient = context({ mealCount: 3, mealNames: ["Desjejum", "Almo\u00e7o", "Jantar"] });
  const eligibility = nutritionalDecisionEngine.evaluate(patient);
  const current = successfulDraft(patient, eligibility).meals[1];
  const result = smartPlanDraftGenerator.regenerateMeal({
    patientContext: patient,
    eligibleFoods: eligibility,
    mealIndex: 1,
    targetTotals: current.totals,
    previouslyUsedFoodIds: current.items.map((item) => item.foodId),
    options: { createId: () => "regenerated-lunch" },
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.smartPlanMeal.id, "regenerated-lunch");
  assert.equal(result.smartPlanMeal.name, "Almo\u00e7o");
  assert.ok(result.smartPlanMeal.items.length > 0);
  assert.ok(result.smartPlanMeal.internalJustification.includes("nutricionista"));
  assert.equal(result.smartPlanMeal.items.every((item) =>
    eligibility.some((eligible) => eligible.foodId === item.foodId && eligible.status === "APROVADO")), true);
});

test("regeneracao parcial rejeita indice fora da Estrategia", () => {
  const patient = context({ mealCount: 3 });
  const result = smartPlanDraftGenerator.regenerateMeal({
    patientContext: patient,
    eligibleFoods: nutritionalDecisionEngine.evaluate(patient),
    mealIndex: 8,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.pending[0].field, "mealIndex");
});

const clinicalCoherenceScenarios = [
  { label: "emagrecimento", objective: "Emagrecimento" },
  { label: "hipertrofia", objective: "Hipertrofia" },
  { label: "diabetes", pathologies: ["Diabetes mellitus"] },
  { label: "hipertensão", pathologies: ["Hipertensão arterial"] },
  { label: "endometriose", pathologies: ["Endometriose"] },
  { label: "SOP", pathologies: ["Síndrome dos ovários policísticos (SOP)"] },
  { label: "idoso", ageYears: 68 },
  {
    label: "atleta",
    objective: "Performance",
    exercise: { frequency: "6 vezes por semana", modality: "Triatlo" },
  },
] as const;

test("21. cenários clínicos priorizam composição coerente antes dos macros", () => {
  for (const scenario of clinicalCoherenceScenarios) {
    const patient = context({
      ...scenario,
      mealCount: 3,
      mealNames: ["Desjejum", "Almoço", "Jantar"],
      dailyRoutine: ["Rotina registrada no Prontuário Mestre"],
    });
    const draft = successfulDraft(patient);
    for (const meal of draft.meals.filter((item) =>
      ["Almoço", "Jantar"].includes(item.name),
    )) {
      assert.ok(
        new Set(meal.items.map((item) => item.group)).size >= 3,
        `${scenario.label}/${meal.name}: ${meal.items.map((item) => item.name).join(" + ")}`,
      );
      assert.ok(
        meal.items.some((item) => item.proteinGrams >= 5),
        `${scenario.label}/${meal.name} sem contribuição proteica relevante`,
      );
    }
  }
});

test("22. combinações improváveis recebem baixa prioridade sem proibição rígida", () => {
  const patient = context({
    mealCount: 3,
    mealNames: ["Desjejum", "Almoço", "Jantar"],
  });
  const draft = successfulDraft(patient);
  const lunchNames = normalizeFoodSearchText(
    draft.meals[1].items.map((item) => item.name).join(" "),
  );
  assert.equal(lunchNames.includes("bolo") && lunchNames.includes("parmesao"), false);
  assert.equal(
    draft.meals.slice(1).some(
      (meal) =>
        meal.items.length === 1 &&
        normalizeFoodSearchText(meal.items[0].name).includes("queijo"),
    ),
    false,
  );
  assert.ok(
    draft.meals.flatMap((meal) => meal.items).every(
      (item) => item.selectionReason !== "Sem restrições aplicáveis.",
    ),
  );
});

test("regressão clínica 1. lanche próximo de 180 kcal não aceita 70 kcal sem alerta", () => {
  const draft = successfulDraft(context({
    mealCount: 6,
    namedMeals: false,
    caloriesKcal: 1_836,
    proteinGrams: 114.7,
    carbohydratesGrams: 206.5,
    fatsGrams: 61.2,
  }));
  const snack = draft.meals.find((meal) => meal.name === "Lanche da tarde");
  assert.ok(snack?.targetEnergyKcal);
  assert.ok(Math.abs(snack.targetEnergyKcal - 183.6) < 0.1);

  const withinPreferredRange = snack.totals.energyKcal >= snack.targetEnergyKcal * 0.9;
  const safelyFlagged = draft.requiresProfessionalAdjustment &&
    draft.warnings.some((warning) =>
      warning.includes("Não foi possível completar esta refeição com segurança"),
    );
  assert.ok(
    withinPreferredRange || safelyFlagged,
    `Lanche de ${snack.totals.energyKcal} kcal foi liberado sem alerta para meta de ${snack.targetEnergyKcal} kcal.`,
  );
  assert.equal(
    snack.totals.energyKcal <= 70.5 && !safelyFlagged,
    false,
  );
});

test("regressão clínica 2. refeição estruturalmente incompleta é sinalizada", () => {
  const patient = context({ mealCount: 3, mealNames: ["Desjejum", "Almoço", "Jantar"] });
  const eligibility = nutritionalDecisionEngine.evaluate(patient).filter((eligible) => {
    const food = masterFoods.find((candidate) => candidate.id === eligible.foodId);
    if (!food || eligible.status !== "APROVADO") return false;
    const functions = classifyFoodSemantics(food).functions;
    return functions.includes("FRUIT") || functions.includes("DAIRY");
  });
  const result = generate(patient, eligibility);

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.pending[0].field, "semanticFoodCatalog");
  assert.match(result.pending[0].reason, /não foram encontrados alimentos seguros/i);
});

test("regressão clínica 3. total diário não é o único critério e desvio individual gera alerta próprio", () => {
  const draft = successfulDraft(context({
    mealCount: 6,
    namedMeals: false,
    mealPercentages: [20, 10, 30, 10, 29, 1],
    caloriesKcal: 1_836,
    proteinGrams: 114.7,
    carbohydratesGrams: 206.5,
    fatsGrams: 61.2,
  }));
  const mealsOutsidePreferredRange = draft.meals.filter((meal) => {
    const target = meal.targetEnergyKcal ?? 0;
    return target > 0 && Math.abs(meal.totals.energyKcal - target) / target > 0.1;
  });

  assert.ok(mealsOutsidePreferredRange.length > 0);
  assert.equal(draft.requiresProfessionalAdjustment, true);
  assert.ok(draft.warnings.some((warning) =>
    warning.includes("Não foi possível completar esta refeição com segurança") &&
    mealsOutsidePreferredRange.some((meal) => warning.includes(meal.name)),
  ));
});

test("regressão clínica 4. geração controla concentração excessiva de gordura", () => {
  const draft = successfulDraft(context({ mealCount: 6, namedMeals: false }));
  const selected = draft.meals.flatMap((meal) => meal.items.map((item) => ({ meal, item })));

  for (const { meal, item } of selected) {
    const food = masterFoods.find((candidate) => candidate.id === item.foodId);
    assert.ok(food?.nutrients);
    const fatPer100 = food.nutrients.fatsGrams ?? 0;
    const energyPer100 = food.nutrients.energyKcal ?? 0;
    const concentrated = fatPer100 >= 15 && energyPer100 > 0 &&
      (fatPer100 * 9) / energyPer100 >= 0.45;
    assert.equal(concentrated, false, `${meal.name}: ${item.name}`);
    assert.doesNotMatch(
      normalizeFoodSearchText(item.name),
      /costela|com gordura|frit|maionese|charque/,
    );
  }
});

test("regressão clínica 5. proteína é distribuída entre as refeições", () => {
  const proteinTarget = 114.7;
  const draft = successfulDraft(context({
    mealCount: 6,
    namedMeals: false,
    caloriesKcal: 1_836,
    proteinGrams: proteinTarget,
    carbohydratesGrams: 206.5,
    fatsGrams: 61.2,
  }));

  for (const meal of draft.meals) {
    const proportionalTarget = proteinTarget * ((meal.targetPercentage ?? 0) / 100);
    const minimumRatio = meal.name === "Almoço" || meal.name === "Jantar"
      ? 0.6
      : meal.name === "Desjejum"
        ? 0.5
        : 0.45;
    assert.ok(
      meal.totals.proteinGrams >= proportionalTarget * minimumRatio,
      `${meal.name}: ${meal.totals.proteinGrams} g para referência proporcional de ${proportionalTarget} g.`,
    );
  }
});

test("regressão clínica 6. somente alimentos reais e ativos do catálogo são usados", () => {
  const patient = context({ mealCount: 6, namedMeals: false });
  const draft = successfulDraft(patient);
  const catalogById = new Map(patient.foodCatalog.foods.map((food) => [food.id, food]));

  for (const item of draft.meals.flatMap((meal) => meal.items)) {
    const source = catalogById.get(item.foodId);
    assert.ok(source, `Alimento ${item.foodId} não pertence ao catálogo carregado.`);
    assert.equal(source.status, "ACTIVE");
    assert.notEqual(source.source.origin, "DEMONSTRATIVE");
    assert.equal(source.officialName, item.name);
  }
});

test("regressão clínica 7. geração e regeneração não mutam edição manual existente", () => {
  const patient = context({ mealCount: 3, mealNames: ["Desjejum", "Almoço", "Jantar"] });
  const eligibility = nutritionalDecisionEngine.evaluate(patient);
  const original = successfulDraft(patient, eligibility);
  const firstMeal = original.meals[0];
  const manuallyEditedMeal = {
    ...firstMeal,
    items: firstMeal.items.map((item, index) => index === 0
      ? { ...item, prescribedAmount: 137, householdMeasure: "Edição manual do nutricionista" }
      : item),
  };
  const before = structuredClone(manuallyEditedMeal);

  generate(patient, eligibility);
  smartPlanDraftGenerator.regenerateMeal({
    patientContext: patient,
    eligibleFoods: eligibility,
    mealIndex: 1,
    previouslyUsedFoodIds: manuallyEditedMeal.items.map((item) => item.foodId),
  });

  assert.deepEqual(manuallyEditedMeal, before);
  assert.equal(manuallyEditedMeal.items[0].prescribedAmount, 137);
  assert.equal(manuallyEditedMeal.items[0].householdMeasure, "Edição manual do nutricionista");
});

test("regressão clínica 8. geração funciona sem recordatório e ignora recordatório incompleto", () => {
  const absent = successfulDraft(context({
    habitualFoods: [],
    habitualIntakeBasis: "NOT_INFORMED",
  }));
  const incomplete = successfulDraft(context({
    habitualFoods: ["Alimento incompleto de teste"],
    habitualIntakeBasis: "UNCONFIRMED_OR_TEST",
  }));

  assert.ok(absent.warnings.includes("Proposta inicial gerada sem recordatório alimentar."));
  assert.ok(incomplete.warnings.includes("Proposta inicial gerada sem recordatório alimentar."));
  assert.equal(incomplete.meals.flatMap((meal) => meal.items).some((item) =>
    item.selectionReason.includes("Alimento presente no recordatório."),
  ), false);
});

test("regressão clínica 9. preferências aversões alergias e restrições são respeitadas", () => {
  const preferredPatient = context({
    preferredFoods: ["Banana"],
    refusedFoods: ["Manga"],
    mealCount: 6,
    namedMeals: false,
  });
  const preferredDraft = successfulDraft(preferredPatient);
  const preferredNames = normalizeFoodSearchText(
    preferredDraft.meals.flatMap((meal) => meal.items.map((item) => item.name)).join(" "),
  );
  assert.match(preferredNames, /banana/);
  assert.doesNotMatch(preferredNames, /manga/);

  for (const scenario of [
    context({ allergies: ["Alergia ao ovo"] }),
    context({ restrictions: ["Vegetariana"] }),
  ]) {
    const eligibility = nutritionalDecisionEngine.evaluate(scenario);
    const result = generate(scenario, eligibility);
    if (!result.success) {
      assert.equal(result.pending[0].field, "semanticFoodCatalog");
      continue;
    }
    const blocked = new Set(
      eligibility.filter((food) => food.status !== "APROVADO").map((food) => food.foodId),
    );
    assert.ok([...usedFoodIds(result.smartPlanDraft)].every((foodId) => !blocked.has(foodId)));
  }
});

test("regressão clínica 10. ausência de equivalência não inventa medida caseira", () => {
  const draft = successfulDraft(context({ mealCount: 6, namedMeals: false }));
  const withoutValidatedMeasure = draft.meals.flatMap((meal) => meal.items).filter((item) => {
    const food = masterFoods.find((candidate) => candidate.id === item.foodId);
    return food && !food.householdMeasures.some((measure) =>
      measure.active && measure.grams > 0 && measure.quantity > 0,
    );
  });

  assert.ok(withoutValidatedMeasure.length > 0, "O cenário não contém alimento sem equivalência cadastrada.");
  for (const item of withoutValidatedMeasure) {
    assert.equal(
      item.householdMeasure,
      `Porção de ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(item.prescribedAmount)} g (medida caseira validada não disponível)`,
    );
  }
});

test("regressão regional 1. localização real de Juazeiro do Norte reconhece Ceará Nordeste e Cariri", () => {
  const location = patientContextLocation("Juazeiro do Norte", "CE");

  assert.ok(location);
  assert.deepEqual(location.recognizedRegions, ["Ceará", "Nordeste", "Cariri"]);
  assert.deepEqual(resolveRegionalFoodContext(context({ location })), {
    hasLocation: true,
    northeast: true,
    ceara: true,
    cariri: true,
    textualSupport: false,
  });
});

test("regressão regional 2. cidade e estado reais influenciam o ranqueamento regional", () => {
  const base = masterFoods[0];
  assert.ok(base);
  const cuscuz = { ...base, id: "regional-ranking-cuscuz", officialName: "Cuscuz de milho cozido" };
  const cariri = patientContextLocation("Juazeiro do Norte", "CE");
  const foraDoNordeste = patientContextLocation("Juazeiro do Norte", "SP");
  assert.ok(cariri);
  assert.ok(foraDoNordeste);

  assert.equal(regionalFoodRankingBonus(context({ location: cariri }), cuscuz), 35);
  assert.equal(regionalFoodRankingBonus(context({ location: foraDoNordeste }), cuscuz), 0);
  assert.equal(resolveRegionalFoodContext(context({ location: cariri })).cariri, true);
  assert.equal(resolveRegionalFoodContext(context({ location: foraDoNordeste })).cariri, false);
});

test("regressão regional 3. preferência individual confirmada supera preferência regional genérica", () => {
  const location = patientContextLocation("Juazeiro do Norte", "CE");
  assert.ok(location);
  const draft = successfulDraft(context({
    location,
    mealCount: 3,
    mealNames: ["Desjejum", "Almoço", "Jantar"],
    preferredFoods: ["Pão, trigo, francês"],
    habitualFoods: [],
    habitualIntakeBasis: "NOT_INFORMED",
  }));
  const breakfastNames = normalizeFoodSearchText(
    draft.meals[0].items.map((item) => item.name).join(" "),
  );

  assert.match(breakfastNames, /pao/);
  assert.ok(draft.meals[0].items.some((item) =>
    normalizeFoodSearchText(item.name).includes("pao") &&
    item.selectionReason.includes("Preferência registrada."),
  ));
});

test("regressão regional 4. alimento regional rejeitado incompatível ou em aversão não é escolhido", () => {
  const location = patientContextLocation("Juazeiro do Norte", "CE");
  assert.ok(location);
  const refusalPatient = context({ location, refusedFoods: ["Cuscuz"] });
  const refusalEligibility = nutritionalDecisionEngine.evaluate(refusalPatient);
  const refusedRegionalIds = new Set(
    refusalEligibility
      .filter((food) => normalizeFoodSearchText(food.name).includes("cuscuz"))
      .map((food) => food.foodId),
  );
  assert.ok(refusedRegionalIds.size > 0);
  assert.ok(refusalEligibility
    .filter((food) => refusedRegionalIds.has(food.foodId))
    .every((food) => food.status === "BLOQUEADO"));
  const refusalResult = generate(refusalPatient, refusalEligibility);
  if (refusalResult.success) {
    assert.ok([...usedFoodIds(refusalResult.smartPlanDraft)]
      .every((foodId) => !refusedRegionalIds.has(foodId)));
  } else {
    assert.equal(refusalResult.pending[0].field, "semanticFoodCatalog");
  }

  const lunchDraft = successfulDraft(context({
    location,
    mealCount: 1,
    mealNames: ["Almoço"],
    mealPercentages: [100],
    preferredFoods: ["Cuscuz"],
  }));
  assert.doesNotMatch(
    normalizeFoodSearchText(lunchDraft.meals[0].items.map((item) => item.name).join(" ")),
    /cuscuz/,
  );
});

test("regressão regional 5. ausência de cidade ou estado não cria localização ou região falsa", () => {
  assert.equal(patientContextLocation(undefined, "CE"), undefined);
  assert.equal(patientContextLocation("Juazeiro do Norte", undefined), undefined);
  assert.equal(patientContextLocation("", "CE"), undefined);
  assert.deepEqual(resolveRegionalFoodContext(context()), {
    hasLocation: false,
    northeast: false,
    ceara: false,
    cariri: false,
    textualSupport: false,
  });
});

test("regressão regional 6. observações textuais apenas complementam a localização estruturada", () => {
  const base = masterFoods[0];
  assert.ok(base);
  const cuscuz = { ...base, id: "text-support-cuscuz", officialName: "Cuscuz de milho cozido" };
  const location = patientContextLocation("Juazeiro do Norte", "CE");
  assert.ok(location);
  const textOnly = context({
    relevantObservations: ["Paciente relata rotina alimentar do Cariri cearense."],
    strategyObservations: "Priorizar padrão do Nordeste.",
  });
  const structuredOnly = context({ location });
  const structuredAndText = context({
    location,
    relevantObservations: ["Rotina alimentar do Cariri."],
  });

  assert.equal(resolveRegionalFoodContext(textOnly).northeast, false);
  assert.equal(regionalFoodRankingBonus(textOnly, cuscuz), 0);
  assert.equal(regionalFoodRankingBonus(structuredOnly, cuscuz), 35);
  assert.equal(regionalFoodRankingBonus(structuredAndText, cuscuz), 40);
});

test("regressão regional 7. cuscuz paulista não recebe prioridade regional do Ceará", () => {
  const base = masterFoods[0];
  const location = patientContextLocation("Juazeiro do Norte", "CE");
  assert.ok(base);
  assert.ok(location);
  const paulista = { ...base, id: "cuscuz-paulista", officialName: "Cuscuz paulista" };
  const nordestino = { ...base, id: "cuscuz-milho", officialName: "Cuscuz de milho cozido" };
  const patient = context({ location });

  assert.equal(regionalFoodRankingBonus(patient, paulista), 0);
  assert.equal(regionalFoodRankingBonus(patient, nordestino), 35);
});

test("regressão regional 8. alimentos raros não são priorizados apenas pela composição", () => {
  const location = patientContextLocation("Juazeiro do Norte", "CE");
  assert.ok(location);
  const draft = successfulDraft(context({
    location,
    preferredFoods: [],
    habitualFoods: [],
    habitualIntakeBasis: "NOT_INFORMED",
  }));
  const selectedNames = normalizeFoodSearchText(
    draft.meals.flatMap((meal) => meal.items.map((item) => item.name)).join(" "),
  );

  assert.doesNotMatch(selectedNames, /alcachofra|leite de cabra|leite, cabra/);
});

test("regressão regional 9. proteína in natura permanece à frente de steak ultraprocessado", () => {
  const naturalProtein = masterFoods.find((food) => {
    const name = normalizeFoodSearchText(food.officialName);
    return name.includes("miolo de alcatra") &&
      name.includes("sem gordura") &&
      name.includes("grelhad");
  });
  assert.ok(naturalProtein);
  const steak = {
    ...naturalProtein,
    id: "synthetic-steak-regression",
    officialName: "Steak de carne",
    normalizedName: "steak de carne",
  };
  const patient = context({
    mealCount: 1,
    mealNames: ["Almoço"],
    mealPercentages: [100],
    preferredFoods: [naturalProtein.officialName, steak.officialName],
    foods: [...masterFoods, steak],
  });
  const competingProteins = new Set([naturalProtein.id, steak.id]);
  const eligibility = nutritionalDecisionEngine.evaluate(patient).map((eligible) => {
    const food = patient.foodCatalog.foods.find((candidate) => candidate.id === eligible.foodId);
    assert.ok(food);
    const functions = classifyFoodSemantics(food).functions;
    return functions.includes("PROTEIN") &&
      !functions.includes("LEGUME") &&
      !competingProteins.has(food.id)
      ? { ...eligible, status: "BLOQUEADO" as const }
      : eligible;
  });
  const draft = successfulDraft(patient, eligibility);
  const selectedNames = normalizeFoodSearchText(
    draft.meals.flatMap((meal) => meal.items.map((item) => item.name)).join(" "),
  );

  assert.match(selectedNames, /alcatra/);
  assert.doesNotMatch(selectedNames, /steak/);
});

test("regressão regional 10. coerência clínica energia por refeição e gordura continuam protegidas", () => {
  const location = patientContextLocation("Juazeiro do Norte", "CE");
  assert.ok(location);
  const draft = successfulDraft(context({
    location,
    mealCount: 6,
    namedMeals: false,
    caloriesKcal: 1_836,
    proteinGrams: 114.7,
    carbohydratesGrams: 206.5,
    fatsGrams: 61.2,
  }));

  for (const meal of draft.meals) {
    const target = meal.targetEnergyKcal ?? 0;
    assert.ok(
      target > 0 && Math.abs(meal.totals.energyKcal - target) / target <= 0.15,
      `${meal.name}: ${meal.totals.energyKcal} kcal para meta de ${target} kcal.`,
    );
    for (const item of meal.items) {
      const food = masterFoods.find((candidate) => candidate.id === item.foodId);
      assert.ok(food?.nutrients);
      const fats = food.nutrients.fatsGrams ?? 0;
      const energy = food.nutrients.energyKcal ?? 0;
      assert.equal(fats >= 15 && energy > 0 && (fats * 9) / energy >= 0.45, false);
    }
  }
  for (const meal of draft.meals.filter((item) => ["Almoço", "Jantar"].includes(item.name))) {
    assert.ok(new Set(meal.items.map((item) => item.group)).size >= 3);
    assert.ok(meal.items.some((item) => item.proteinGrams >= 5));
  }
});

test("23. geração reutiliza o catálogo carregado e mantém resposta rápida", () => {
  const durations: number[] = [];
  for (const scenario of clinicalCoherenceScenarios) {
    const patient = context({
      ...scenario,
      mealCount: 3,
      mealNames: ["Desjejum", "Almoço", "Jantar"],
    });
    const eligible = nutritionalDecisionEngine.evaluate(patient);
    const startedAt = performance.now();
    const result = generate(patient, eligible);
    durations.push(performance.now() - startedAt);
    assert.equal(result.success, true);
  }
  const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  assert.ok(average < 300, `Tempo médio observado: ${average.toFixed(2)} ms`);
});
