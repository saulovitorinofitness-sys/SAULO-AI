import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateMacronutrient, validateMacroDistribution } from "@/lib/nutrition";

import {
  CLINICAL_PROTOCOL_OPTIONS,
  ENERGY_GOAL_OPTIONS,
  NUTRITION_METHOD_OPTIONS,
  NUTRITION_MODIFICATION_OPTIONS,
  defaultAdjustmentForEnergyGoal,
  energyGoalFromLegacyValues,
  fastingProtocolDurations,
  specificConfigurationIssues,
  timeAfterHours,
} from "./prescription";
import { parseNutritionStrategyDraft } from "./strategy-validation";

test("carrega todas as opções profissionais com códigos estáveis e descrições", () => {
  assert.equal(NUTRITION_METHOD_OPTIONS.length, 16);
  assert.equal(NUTRITION_MODIFICATION_OPTIONS.length, 18);
  assert.equal(CLINICAL_PROTOCOL_OPTIONS.length, 17);
  assert.equal(ENERGY_GOAL_OPTIONS.length, 8);
  for (const option of [...NUTRITION_METHOD_OPTIONS, ...NUTRITION_MODIFICATION_OPTIONS, ...CLINICAL_PROTOCOL_OPTIONS]) {
    assert.ok(option[0]);
    assert.ok(option[1]);
    assert.ok(option[2]);
  }
});

test("combina método, modificações e protocolo sem aplicar parâmetros automaticamente", () => {
  const parsed = parseNutritionStrategyDraft({
    method: "MEDITERRANEAN",
    modifications: ["HIGH_PROTEIN", "LOW_SODIUM"],
    clinicalProtocols: ["HYPERTENSION", "DYSLIPIDEMIA"],
    specificConfigurations: {},
    protein: { mode: "GRAMS_PER_KG" },
    carbohydrates: { mode: "PERCENTAGE" },
    fats: { mode: "GRAMS" },
    calculatedMacros: {},
    mealDistribution: [],
    supplementation: [],
    clinicalObservations: "",
  });

  assert.ok(parsed);
  assert.deepEqual(parsed.modifications, ["HIGH_PROTEIN", "LOW_SODIUM"]);
  assert.deepEqual(parsed.clinicalProtocols, ["HYPERTENSION", "DYSLIPIDEMIA"]);
  assert.equal(parsed.specificConfigurations?.renal, undefined);
});

test("valida somente configurações condicionais selecionadas", () => {
  assert.deepEqual(specificConfigurationIssues({ method: "STANDARD", modifications: [], configurations: {} }), []);
  assert.deepEqual(
    specificConfigurationIssues({ method: "KETOGENIC", modifications: ["LOW_FODMAP"], clinicalProtocol: "OTHER", configurations: {} }),
    [
      "Limite de carboidratos e confirmação de acompanhamento da dieta cetogênica",
      "Fase da estratégia Low FODMAP",
      "Descrição do protocolo clínico",
    ],
  );
  assert.deepEqual(
    specificConfigurationIssues({
      method: "KETOGENIC",
      modifications: ["LOW_FODMAP"],
      clinicalProtocol: "OTHER",
      configurations: {
        ketogenic: { dailyCarbohydrateLimitGrams: 35, monitoringAcknowledged: true },
        lowFodmap: { phase: "REINTRODUCTION" },
        otherProtocolDescription: "Protocolo individualizado.",
      },
    }),
    [],
  );
});

test("calcula protocolos de jejum e exige total de 24 horas sem exigir todos os dias", () => {
  assert.deepEqual(fastingProtocolDurations("16_8"), { eatingWindowHours: 8, fastingWindowHours: 16 });
  assert.equal(timeAfterHours("12:30", 8), "20:30");
  assert.equal(timeAfterHours("20:00", 6), "02:00");
  assert.deepEqual(specificConfigurationIssues({
    method: "TIME_RESTRICTED_EATING",
    modifications: [],
    configurations: { fasting: { protocol: "16_8", eatingWindowHours: 8, fastingWindowHours: 16, startTime: "12:30", weekdays: ["MON"] } },
  }), []);
  assert.deepEqual(specificConfigurationIssues({
    method: "TIME_RESTRICTED_EATING",
    modifications: [],
    configurations: { fasting: { protocol: "CUSTOM", eatingWindowHours: 9, fastingWindowHours: 14, startTime: "08:00", weekdays: ["TUE"] } },
  }), ["Janela alimentar e jejum devem totalizar 24 horas"]);
});

test("impede classificações semanais contraditórias e exige metas da ciclagem", () => {
  assert.deepEqual(specificConfigurationIssues({
    method: "CARB_CYCLING",
    modifications: [],
    configurations: { carbohydrateCycling: {
      lowDays: ["MON"], moderateDays: ["MON"], highDays: ["SAT"], linkedToTraining: true,
      lowTarget: { mode: "GRAMS_PER_KG", value: 2 },
      moderateTarget: { mode: "GRAMS", value: 240 },
      highTarget: { mode: "GRAMS_PER_KG", value: 5 },
    } },
  }), ["Cada dia deve ter somente um tipo de ciclagem de carboidratos"]);
});

test("valida período, classificação e detalhes orientados da periodização esportiva", () => {
  const configuration = {
    phase: "PREPARATION", objective: "PERFORMANCE", sport: "Corrida",
    startDate: "2026-10-01", endDate: "2026-10-31",
    trainingDays: ["MON"] as const, restDays: ["TUE"] as const, competitionDays: ["SUN"] as const,
    days: [
      { weekday: "MON" as const, type: "TRAINING" as const, trainingType: "Intervalado", time: "07:00", durationMinutes: 60, intensity: "HIGH" as const },
      { weekday: "TUE" as const, type: "REST" as const },
      { weekday: "SUN" as const, type: "COMPETITION" as const, time: "06:00" },
    ],
  };
  assert.deepEqual(specificConfigurationIssues({ method: "SPORTS_PERIODIZATION", modifications: [], configurations: { sportsPeriodization: configuration } }), []);
  assert.deepEqual(specificConfigurationIssues({ method: "SPORTS_PERIODIZATION", modifications: [], configurations: { sportsPeriodization: { ...configuration, endDate: "2026-09-30" } } }), ["Data final da fase deve ser igual ou posterior à data inicial"]);
});

test("recarrega as novas configurações sem perder os campos legados", () => {
  const parsed = parseNutritionStrategyDraft({
    method: "CARB_CYCLING",
    specificConfigurations: {
      fasting: { protocol: "14_10", eatingWindowHours: 10, fastingWindowHours: 14, startTime: "08:00", weekdays: ["MON"] },
      carbohydrateCycling: {
        lowDays: ["MON"], moderateDays: ["TUE"], highDays: ["WED"], linkedToTraining: true,
        lowTarget: { mode: "GRAMS_PER_KG", value: 2 }, moderateTarget: { mode: "GRAMS", value: 220 }, highTarget: { mode: "GRAMS_PER_KG", value: 5 },
      },
      sportsPeriodization: {
        phase: "COMPETITION", objective: "GLYCOGEN_REPLENISHMENT", sport: "Triatlo", startDate: "2026-10-01", endDate: "2026-10-10",
        trainingDays: ["MON"], restDays: [], competitionDays: ["SUN"],
        days: [{ weekday: "MON", type: "TRAINING", trainingType: "Ciclismo", time: "06:00", durationMinutes: 90, intensity: "MODERATE" }],
        nutritionTargets: { TRAINING: { energyKcal: 2800, carbohydrates: { mode: "GRAMS_PER_KG", value: 6 } } },
      },
    },
    protein: { mode: "GRAMS_PER_KG" }, carbohydrates: { mode: "PERCENTAGE" }, fats: { mode: "GRAMS" },
    calculatedMacros: {}, mealDistribution: [], supplementation: [], clinicalObservations: "",
  });
  assert.equal(parsed?.specificConfigurations?.fasting?.protocol, "14_10");
  assert.equal(parsed?.specificConfigurations?.carbohydrateCycling?.moderateTarget?.value, 220);
  assert.equal(parsed?.specificConfigurations?.sportsPeriodization?.days?.[0]?.trainingType, "Ciclismo");
  assert.equal(parsed?.specificConfigurations?.sportsPeriodization?.nutritionTargets?.TRAINING?.energyKcal, 2800);
});

test("mistura percentual, g/kg e g/dia e valida a soma energética", () => {
  const vet = 2000;
  const weight = 80;
  const protein = calculateMacronutrient("protein", "GRAMS_PER_KG", 1.5, vet, weight)!;
  const carbohydrates = calculateMacronutrient("carbohydrates", "PERCENTAGE", 46, vet, weight)!;
  const fats = calculateMacronutrient("fats", "GRAMS", 66.6666666667, vet, weight)!;
  const validation = validateMacroDistribution(vet, [protein, carbohydrates, fats]);

  assert.equal(protein.grams, 120);
  assert.equal(carbohydrates.kcal, 920);
  assert.ok(Math.abs(fats.kcal - 600) < 0.001);
  assert.equal(validation?.status, "ADEQUATE");
  assert.ok(Math.abs((validation?.calculatedCalories ?? 0) - vet) < 0.1);
});

test("mantém compatibilidade com códigos antigos e recarrega o novo contrato", () => {
  assert.equal(energyGoalFromLegacyValues(-20, undefined), "DEFICIT_MODERATE");
  assert.equal(energyGoalFromLegacyValues(undefined, 2100), "MANUAL_VET");
  assert.equal(defaultAdjustmentForEnergyGoal("SURPLUS_LIGHT"), 5);

  const legacy = parseNutritionStrategyDraft({
    method: "LOW_CARB",
    calorieAdjustmentPercentage: -20,
    protein: { mode: "PERCENTAGE" },
    carbohydrates: { mode: "PERCENTAGE" },
    fats: { mode: "PERCENTAGE" },
    calculatedMacros: {},
    mealDistribution: [],
    supplementation: [],
    clinicalObservations: "",
  });
  assert.equal(legacy?.method, "LOW_CARB");

  const legacyClinicalProtocol = parseNutritionStrategyDraft({
    method: "LOW_CARB",
    clinicalProtocol: "SPORTS_NUTRITION",
    protein: { mode: "PERCENTAGE" },
    carbohydrates: { mode: "PERCENTAGE" },
    fats: { mode: "PERCENTAGE" },
    calculatedMacros: {},
    mealDistribution: [],
    supplementation: [],
    clinicalObservations: "",
  });
  assert.deepEqual(legacyClinicalProtocol?.clinicalProtocols, ["SPORTS_NUTRITION"]);

  const serialized = JSON.stringify({
    ...legacy,
    method: "SPORTS_PERIODIZATION",
    modifications: ["HIGH_ENERGY_DENSITY"],
    clinicalProtocols: ["SPORTS_NUTRITION", "CARDIOVASCULAR_DISEASE"],
    energyGoal: "SURPLUS_CUSTOM",
    specificConfigurations: {
      sportsPeriodization: {
        phase: "Competição",
        objective: "Disponibilidade energética",
        trainingDays: ["MON"],
        restDays: ["SUN"],
        competitionDays: ["SAT"],
      },
    },
  });
  const reloaded = parseNutritionStrategyDraft(JSON.parse(serialized));
  assert.equal(reloaded?.method, "SPORTS_PERIODIZATION");
  assert.deepEqual(reloaded?.modifications, ["HIGH_ENERGY_DENSITY"]);
  assert.deepEqual(reloaded?.clinicalProtocols, ["SPORTS_NUTRITION", "CARDIOVASCULAR_DISEASE"]);
  assert.equal(reloaded?.specificConfigurations?.sportsPeriodization?.phase, "Competição");
});

test("camada de regras é pura e os testes não alteram pacientes ou banco", async () => {
  const source = await readFile(new URL("./prescription.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /prisma|fetch\(|patientId|masterRecord/i);
});

test("seleção do método não altera porções nem gera plano automaticamente", async () => {
  const source = await readFile(
    new URL("../meal-plan/assisted-preview-mock.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /strategy\.method|methodFactor/);
  assert.match(source, /nunca altera ou gera[\s\S]*automaticamente porções/);
});

test("interface usa seções expansíveis e campos condicionais", async () => {
  const source = await readFile(
    new URL("../../components/nutrition-strategy/nutrition-strategy-decision-engine.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Modificações nutricionais/);
  assert.match(source, /exclusiveModificationGroups/);
  assert.match(source, /changeModification\(code, event\.target\.checked\)/);
  assert.match(source, /alternativas mutuamente exclusivas/);
  assert.match(source, /Protocolo clínico/);
  assert.match(source, /Configurações avançadas necessárias/);
  assert.match(source, /method === "TIME_RESTRICTED_EATING"/);
  assert.match(source, /method === "CARB_CYCLING"/);
  assert.match(source, /method === "SPORTS_PERIODIZATION"/);
  assert.match(source, /grid items-start gap-3 md:grid-cols-2/);
  assert.match(source, /Nutriente<\/span><span>Modo<\/span><span>Meta/);
  assert.match(source, /Gramas calculadas<\/span><span>kcal calculadas/);
  assert.match(source, /Distribuição completa: 100%/);
  assert.match(source, /Total calórico calculado:/);
  assert.match(source, /Energia informada:/);
  assert.match(source, /Estas são as metas gerais da estratégia/);
  assert.match(source, /Horários e alimentos serão organizados no Plano Alimentar/);
  assert.match(source, /dentro da janela alimentar definida/);
  assert.match(source, /Restrição hídrica selecionada/);
  assert.match(source, /Meta hídrica deve ser definida individualmente/);
  assert.match(source, /Meta hídrica individual \(ml\) — opcional/);
  assert.match(source, /required=\{!hasFluidRestriction\}/);
  assert.match(source, /waterMl \|\| hasFluidRestriction/);
  assert.match(source, /method === "KETOGENIC"/);
  assert.match(source, /modifications\.includes\("LOW_FODMAP"\)/);
  assert.match(source, /clinicalProtocols\.includes\("RENAL_DISEASE"\)/);
  assert.match(source, /clinicalProtocols\.includes\("OTHER"\)/);
  assert.match(source, /createPortal\(/);
  assert.match(source, /maxHeight: Math\.min\(280/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /aria-multiselectable="true"/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
});

test("finalização conclui o fluxo e redireciona o mesmo atendimento ao Plano Alimentar", async () => {
  const [component, route, repository] = await Promise.all([
    readFile(new URL("../../components/nutrition-strategy/nutrition-strategy-decision-engine.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/patients/[patientId]/attendances/[attendanceId]/nutrition-strategy/route.ts", import.meta.url), "utf8"),
    readFile(new URL("./strategy-repository.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /send\("POST", \{ action: "APPROVE", strategy: draft \}\)/);
  assert.match(component, /result\.record\.status === "APPROVED"[\s\S]*router\.push\([\s\S]*nutritionClinicalFlowHref\("MEAL_PLAN", \{[\s\S]*patientId: view\.patientId,[\s\S]*attendanceId: view\.attendanceId/);
  assert.match(route, /nutritionStrategyDraftValidationIssues/);
  assert.match(route, /Pendências: \$\{approvalIssues\.join\("; "\)\}/);
  assert.match(repository, /const status = input\.approve \? "FINALIZED" : "DRAFT"/);
  assert.match(repository, /key: "NUTRITION_STRATEGY"[\s\S]*status: "COMPLETED"/);
  assert.match(repository, /key: "MEAL_PLAN"[\s\S]*status: "IN_PROGRESS"/);
});
