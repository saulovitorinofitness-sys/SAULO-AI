import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";

import { foodRepository } from "@/features/food-database/repository";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import { prisma } from "@/lib/database/prisma";

import {
  assemblePatientContext,
  optionalPatientContextFields,
  type PatientContextSourceSnapshot,
} from "./patient-context-service";

after(async () => {
  await prisma.$disconnect();
});

const strategy: MealPlanStrategyInheritance = {
  sourceStrategyId: "a3eec247-7fcb-4bde-bad4-f4f180641fcc",
  patientId: "d914f474-013d-4a92-b764-25006f7c24e8",
  masterRecordId: "7d83fe02-8229-43af-8b67-4df1fde8c2a9",
  attendanceId: "52935d43-5756-440f-b9ac-e87c77ef9c72",
  objective: "WEIGHT_LOSS",
  secondaryObjectives: ["HEALTH"],
  method: "STANDARD",
  protocol: "MIFFLIN_ST_JEOR",
  totalEnergyExpenditureKcal: 2_250,
  caloriesKcal: 1_800,
  proteinGrams: 150,
  proteinPercentage: 33.3,
  carbohydratesGrams: 195,
  carbohydratesPercentage: 43.3,
  fatsGrams: 60,
  fatsPercentage: 30,
  fiberGrams: 30,
  waterMl: 2_800,
  mealCount: 2,
  mealDistribution: [
    { mealNumber: 1, name: "Café da manhã", time: "07:00", vetPercentage: 40, plannedCaloriesKcal: 720 },
    { mealNumber: 2, name: "Jantar", time: "19:00", vetPercentage: 60, plannedCaloriesKcal: 1_080 },
  ],
  supplementation: [
    { id: "c26326cb-a96c-424c-a01b-bbafb89c76e1", name: "Suplemento registrado", objective: "Objetivo registrado", schedule: "Após o treino", observations: "Revisar tolerância" },
  ],
  clinicalObservations: "Observação aprovada na Estratégia Nutricional.",
  calorieAdjustmentPercentage: -20,
  status: "APPROVED",
  approvedAt: "2026-08-03T10:00:00.000Z",
  approvedByUserId: "1b3620c9-c43d-4f26-a39c-a98e9131b8ae",
};

const completeSource: PatientContextSourceSnapshot = {
  patientId: strategy.patientId,
  masterRecordId: strategy.masterRecordId,
  attendanceId: strategy.attendanceId,
  sex: "FEMALE",
  ageYears: 37,
  weightKg: 68,
  heightCm: 161,
  bmi: 26.2,
  objective: "Emagrecimento",
  secondaryObjectives: ["Saúde"],
  pathologies: ["Hipertensão"],
  availableExams: ["Hemograma disponível"],
  allergyStatus: "CONFIRMED",
  allergies: ["Alergia alimentar registrada"],
  restrictions: ["Restrição registrada"],
  preferredFoods: ["Arroz"],
  dailyRoutine: ["Refeições por dia: 4", "Sono: 8 horas"],
  exercise: { frequency: "3 vezes por semana", duration: "60 minutos", modality: "Musculação" },
  clinicalObservations: ["Observação clínica registrada"],
  strategy,
};

async function realMasterFood() {
  const result = await foodRepository.search({
    source: "TACO",
    status: "ACTIVE",
    page: 1,
    pageSize: 1,
  });
  assert.equal(result.items.length, 1);
  return result.items[0];
}

function messages(result: ReturnType<typeof assemblePatientContext>) {
  return result.success ? [] : result.pending.map((item) => item.message);
}

test("monta patientContext completo sem gerar refeições", async () => {
  const food = await realMasterFood();
  const result = assemblePatientContext(completeSource, [food]);

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.patientContext.patient.weightKg, 68);
  assert.equal(result.patientContext.patient.objective, "Emagrecimento");
  assert.deepEqual(result.patientContext.clinical.allergies, ["Alergia alimentar registrada"]);
  assert.deepEqual(result.patientContext.clinical.availableExams, ["Hemograma disponível"]);
  assert.deepEqual(result.patientContext.clinical.mealSchedules, [
    { mealNumber: 1, name: "Café da manhã", time: "07:00" },
    { mealNumber: 2, name: "Jantar", time: "19:00" },
  ]);
  assert.equal(result.patientContext.nutritionStrategy.caloriesKcal, 1_800);
  assert.equal(result.patientContext.foodCatalog.foods[0].id, food.id);
  assert.equal("meals" in result.patientContext, false);
  assert.deepEqual(
    result.patientContext.clinical.unavailableStructuredFields.map((item) => item.field),
    ["intolerances", "refusedFoods"],
  );
});

test("informa exatamente a ausência de peso", async () => {
  const result = assemblePatientContext(
    { ...completeSource, weightKg: undefined },
    [await realMasterFood()],
  );
  assert.deepEqual(messages(result), ["Peso não encontrado na Antropometria."]);
});

test("informa exatamente a ausência de objetivo", async () => {
  const result = assemblePatientContext(
    { ...completeSource, objective: undefined },
    [await realMasterFood()],
  );
  assert.deepEqual(messages(result), ["Objetivo não encontrado no Prontuário Mestre."]);
});

test("informa exatamente a ausência de estratégia", async () => {
  const result = assemblePatientContext(
    { ...completeSource, strategy: undefined },
    [await realMasterFood()],
  );
  assert.deepEqual(messages(result), ["Estratégia Nutricional aprovada não encontrada."]);
});

test("não presume ausência de alergias", async () => {
  const result = assemblePatientContext(
    { ...completeSource, allergyStatus: "NOT_INFORMED", allergies: [] },
    [await realMasterFood()],
  );
  assert.deepEqual(messages(result), [
    "Alergias não informadas: confirme a ausência de alergias ou registre os alérgenos na Anamnese.",
  ]);
});

test("alergia negada permite montar o contexto do Plano Inteligente", async () => {
  const result = assemblePatientContext(
    { ...completeSource, allergyStatus: "DENIED", allergies: [] },
    [await realMasterFood()],
  );
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.patientContext.clinical.allergyStatus, "DENIED");
    assert.deepEqual(result.patientContext.clinical.allergies, []);
  }
});

test("preferências, recordatório, rotina e orçamento ausentes não bloqueiam o contexto", async () => {
  const source = {
    ...completeSource,
    preferredFoods: [],
    habitualFoods: [],
    habitualIntakeBasis: "NOT_INFORMED" as const,
    dailyRoutine: [],
    financialAccessibility: undefined,
  };
  const result = assemblePatientContext(source, [await realMasterFood()]);
  assert.equal(result.success, true);
  assert.deepEqual(
    optionalPatientContextFields(source).map((item) => item.field),
    ["foodPreferences", "habitualIntake", "dailyRoutine", "financialAccessibility"],
  );
});

test("informa exatamente refeições sem horário", async () => {
  const result = assemblePatientContext(
    {
      ...completeSource,
      strategy: {
        ...strategy,
        mealDistribution: strategy.mealDistribution.map((meal, index) =>
          index === 0 ? { ...meal, time: "" } : meal,
        ),
      },
    },
    [await realMasterFood()],
  );
  assert.deepEqual(messages(result), [
    "Horários não encontrados na Estratégia Nutricional. Horários ausentes em: Café da manhã.",
  ]);
});

test("serviço não contém geração de dieta, prompt ou integração externa", async () => {
  const source = (
    await readFile(
      "src/features/meal-plan-intelligence/patient-context-service.ts",
      "utf8",
    )
  ).toLocaleLowerCase("pt-BR");
  assert.equal(source.includes("openai"), false);
  assert.equal(source.includes("llm"), false);
  assert.equal(source.includes("prompt"), false);
  assert.equal(source.includes("generateassistedmealplanpreview"), false);
});

test("carrega as paginas do Banco Mestre sem abrir transacoes em paralelo", async () => {
  const source = await readFile(
    "src/features/meal-plan-intelligence/patient-context-service.ts",
    "utf8",
  );
  const pagination = source.slice(
    source.indexOf("async function readAllActiveFoods()"),
    source.indexOf("export const patientContextService"),
  );

  assert.ok(pagination.includes("for (let page = 2; page <= first.totalPages; page += 1)"));
  assert.equal(pagination.includes("Promise.all("), false);
});
