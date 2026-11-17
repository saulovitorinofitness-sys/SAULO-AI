import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  nutritionEnergyMissingData,
  nutritionStrategyDecisionService,
  resolveInitialNutritionObjective,
  resolveNutritionObjective,
} from "./decision-engine";

const patientEnergy = {
  sex: "FEMALE",
  ageYears: 37,
  weightKg: 68,
  heightCm: 161,
  leanMassKg: 47,
  activityFactor: 1.55,
} as const;

test("carrega objetivo existente por chave ou descrição", () => {
  assert.equal(resolveNutritionObjective("WEIGHT_LOSS"), "WEIGHT_LOSS");
  assert.equal(resolveNutritionObjective("Emagrecimento"), "WEIGHT_LOSS");
  assert.equal(resolveNutritionObjective("Manutenção"), "MAINTENANCE");
  assert.equal(resolveNutritionObjective("Saúde"), "HEALTH");
});

test("herda o objetivo clínico e preserva alteração deliberada da Estratégia", () => {
  assert.equal(
    resolveInitialNutritionObjective(undefined, "Hipertrofia"),
    "HYPERTROPHY",
  );
  assert.equal(
    resolveInitialNutritionObjective("MAINTENANCE", "Hipertrofia"),
    "MAINTENANCE",
  );
});

test("informa exatamente os dados ausentes para o cálculo energético", () => {
  assert.deepEqual(
    nutritionEnergyMissingData(undefined, undefined, undefined),
    ["Protocolo energético", "Sexo cadastrado para cálculo energético"],
  );
  assert.deepEqual(
    nutritionEnergyMissingData(
      {
        sex: "MALE",
        ageYears: undefined,
        weightKg: 70,
        heightCm: undefined,
      },
      "MIFFLIN_ST_JEOR",
      undefined,
    ),
    ["Idade", "Altura", "Fator de atividade"],
  );
  assert.deepEqual(
    nutritionEnergyMissingData(
      { sex: "FEMALE", leanMassKg: undefined },
      "CUNNINGHAM",
      1.55,
    ),
    ["Massa livre de gordura"],
  );
  assert.deepEqual(
    nutritionEnergyMissingData(
      {
        sex: "MALE",
        ageYears: 45,
        weightKg: 80,
        heightCm: 180,
        recordedTotalEnergyExpenditureKcal: 2400,
      },
      "HARRIS_BENEDICT",
      undefined,
    ),
    [],
  );
});

test("calcula Harris-Benedict para mulher e GET antes da definição do VET", () => {
  const result = nutritionStrategyDecisionService.calculate({
    energy: {
      sex: "FEMALE",
      ageYears: 34,
      weightKg: 72,
      heightCm: 160,
      activityFactor: 1.55,
    },
    objective: "HYPERTROPHY",
    protocol: "HARRIS_BENEDICT",
  });

  assert.ok(result.basalMetabolicRateKcal);
  assert.ok(Math.abs(result.basalMetabolicRateKcal - 1480.6259) < 0.00001);
  assert.ok(result.totalEnergyExpenditureKcal);
  assert.ok(
    Math.abs(result.totalEnergyExpenditureKcal - 2294.970145) < 0.00001,
  );
  assert.equal(result.finalCaloriesKcal, undefined);
  assert.equal(
    result.calculationDetails.getFormula,
    "GET = TMB × fator de atividade",
  );
  assert.match(
    result.calculationDetails.basalSubstitution,
    /9,5634 × 72/,
  );
});

test("calcula TMB uma única vez com protocolo explicitamente definido", () => {
  const result = nutritionStrategyDecisionService.calculate({
    energy: patientEnergy,
    objective: "MAINTENANCE",
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: 0,
  });

  assert.equal(result.protocol, "MIFFLIN_ST_JEOR");
  assert.equal(result.basalMetabolicRateKcal, 1340.25);
  assert.ok(result.totalEnergyExpenditureKcal);
  assert.ok(
    Math.abs(result.totalEnergyExpenditureKcal - 2077.3875) < 0.00001,
  );
  assert.equal(result.finalCaloriesKcal, result.totalEnergyExpenditureKcal);
});

test("recalcula calorias ao alterar déficit ou superávit", () => {
  const deficit = nutritionStrategyDecisionService.calculate({
    energy: patientEnergy,
    objective: "WEIGHT_LOSS",
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: -20,
  });
  const surplus = nutritionStrategyDecisionService.calculate({
    energy: patientEnergy,
    objective: "HYPERTROPHY",
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: 10,
  });

  assert.ok(deficit.finalCaloriesKcal);
  assert.ok(surplus.finalCaloriesKcal);
  assert.ok(Math.abs(deficit.finalCaloriesKcal - 1661.91) < 0.00001);
  assert.ok(Math.abs(surplus.finalCaloriesKcal - 2285.12625) < 0.00001);
});

test("não sugere calorias sem objetivo ou GET", () => {
  const withoutObjective = nutritionStrategyDecisionService.calculate({
    energy: patientEnergy,
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: 0,
  });
  const withoutGet = nutritionStrategyDecisionService.calculate({
    energy: { ...patientEnergy, activityFactor: undefined },
    objective: "MAINTENANCE",
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: 0,
  });

  assert.equal(withoutObjective.finalCaloriesKcal, undefined);
  assert.equal(withoutGet.totalEnergyExpenditureKcal, undefined);
  assert.equal(withoutGet.finalCaloriesKcal, undefined);
});

test("não inventa protocolo e prioriza TMB real registrada", () => {
  assert.throws(
    () =>
      nutritionStrategyDecisionService.calculate({
        energy: patientEnergy,
        objective: "MAINTENANCE",
        calorieAdjustmentPercentage: 0,
      }),
    /Selecione o protocolo de TMB/,
  );

  const result = nutritionStrategyDecisionService.calculate({
    energy: { ...patientEnergy, recordedBasalMetabolicRateKcal: 1500 },
    objective: "MAINTENANCE",
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: 0,
  });
  assert.equal(result.basalMetabolicRateKcal, 1500);
  assert.equal(result.totalEnergyExpenditureKcal, 2325);
});

test("disponibiliza somente protocolos compatíveis com os dados", () => {
  assert.deepEqual(
    nutritionStrategyDecisionService.availableProtocols(patientEnergy),
    ["HARRIS_BENEDICT", "MIFFLIN_ST_JEOR", "FAO_WHO", "CUNNINGHAM"],
  );
  assert.deepEqual(
    nutritionStrategyDecisionService.availableProtocols({
      ...patientEnergy,
      leanMassKg: undefined,
    }),
    ["HARRIS_BENEDICT", "MIFFLIN_ST_JEOR", "FAO_WHO"],
  );
});

test("Estratégia mostra o Recordatório da Anamnese somente como leitura", async () => {
  const component = await readFile(
    new URL(
      "../../components/nutrition-strategy/nutrition-strategy-decision-engine.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const page = await readFile(
    new URL(
      "../../app/(authenticated)/pacientes/[patientId]/estrategia-nutricional/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(component, /Resumo somente para leitura/);
  assert.match(component, /Recordat&oacute;rio n&atilde;o realizado/);
  assert.match(component, /Revisar na Anamnese/);
  assert.match(component, /finalizeStrategy/);
  assert.match(component, /scrollIntoView/);
  assert.match(component, /Memória de cálculo/);
  assert.match(component, /focusApprovalIssue/);
  assert.match(component, /openEnergyDataOrigin/);
  assert.match(page, /calculateReturnRecall/);
  assert.match(page, /#recordatorio-24h/);
});
