import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PreviousClinicalReferenceCard } from "../../components/clinical-anamnesis/previous-clinical-reference";
import {
  buildNutritionClinicalFlow,
  isVisibleNutritionClinicalFlowStep,
} from "../nutrition-clinical-flow";
import {
  emptyDetailedReturnAdherence,
  emptyNutritionReturnAnamnesisData,
  emptyReturnRecall24Hours,
  type NutritionReturnAnamnesisData,
  type PreviousClinicalReference,
} from "./contracts";
import {
  flowForAttendanceAnamnesis,
  isNutritionReturnAttendance,
  returnAnamnesisEntryStatus,
} from "./policy";
import { buildPreviousClinicalReference } from "./previous-reference";
import { calculateReturnRecall } from "./recall-calculation";
import {
  hasUnconfirmedPreviousPlanFoods,
  parseNutritionReturnAnamnesisData,
  pruneEmptyOptionalReturnBlocks,
} from "./validation";

test("exige confirmação dos itens prescritos apenas para concluir o retorno", () => {
  const data = recallFixture();
  const withReference: NutritionReturnAnamnesisData = {
    ...data,
    recall24h: data.recall24h
      ? {
          ...data.recall24h,
          meals: data.recall24h.meals.map((meal) => ({
            ...meal,
            foods: meal.foods.map((food) => ({
              ...food,
              previousPlanComparison: {
                sourcePlanEntryId: "40000000-0000-4000-8000-000000000004",
                sourceFoodId: "food-prescribed",
                status: "",
              },
            })),
          })),
        }
      : undefined,
  };

  assert.equal(hasUnconfirmedPreviousPlanFoods(withReference), true);
  const confirmed = {
    ...withReference,
    recall24h: withReference.recall24h
      ? {
          ...withReference.recall24h,
          meals: withReference.recall24h.meals.map((meal) => ({
            ...meal,
            foods: meal.foods.map((food) => ({
              ...food,
              previousPlanComparison: food.previousPlanComparison
                ? { ...food.previousPlanComparison, status: "AS_PRESCRIBED" as const }
                : undefined,
            })),
          })),
        }
      : undefined,
  };
  assert.equal(hasUnconfirmedPreviousPlanFoods(confirmed), false);
});

test("recordatório legado ou de teste não é confirmado implicitamente como representativo", () => {
  const data = recallFixture();
  const legacyLike = {
    ...data,
    recall24h: data.recall24h
      ? { ...data.recall24h, representativeConfirmed: undefined }
      : undefined,
  };
  const parsed = parseNutritionReturnAnamnesisData(legacyLike);
  assert.equal(parsed?.recall24h?.representativeConfirmed, false);

  const explicitlyConfirmed = parseNutritionReturnAnamnesisData({
    ...data,
    recall24h: data.recall24h
      ? { ...data.recall24h, representativeConfirmed: true }
      : undefined,
  });
  assert.equal(explicitlyConfirmed?.recall24h?.representativeConfirmed, true);
});

const patientId = "10000000-0000-4000-8000-000000000001";
const attendanceId = "20000000-0000-4000-8000-000000000002";

function recallFixture(): NutritionReturnAnamnesisData {
  return {
    ...emptyNutritionReturnAnamnesisData(),
    recall24h: {
      ...emptyReturnRecall24Hours(),
      dayType: "HABITUAL",
      referenceDate: "2026-10-07",
      meals: [
        {
          id: "meal-one",
          time: "08:00",
          name: "Primeira refeição",
          observations: "",
          foods: [
            {
              id: "food-one",
              source: "LOCAL_DATABASE",
              catalogFoodId: "30000000-0000-4000-8000-000000000003",
              catalogSource: "Base local",
              name: "Alimento local A",
              quantity: 100,
              unit: "g",
              gramsPerUnit: 1,
              preparation: "",
              brand: "",
              observations: "",
              compositionStatus: "AVAILABLE",
              nutrientsPer100g: {
                energyKcal: 100,
                proteinGrams: 10,
                carbohydratesGrams: 20,
                fatsGrams: 5,
                fiberGrams: 2,
                sodiumMg: 100,
              },
            },
            {
              id: "manual-food",
              source: "MANUAL",
              name: "Alimento não catalogado",
              quantity: 1,
              unit: "porção relatada",
              preparation: "",
              brand: "",
              observations: "",
              compositionStatus: "MANUAL",
            },
          ],
        },
        {
          id: "meal-two",
          time: "12:30",
          name: "Segunda refeição",
          observations: "",
          foods: [
            {
              id: "food-two",
              source: "LOCAL_DATABASE",
              catalogFoodId: "40000000-0000-4000-8000-000000000004",
              catalogSource: "Base local",
              name: "Alimento local B",
              quantity: 2,
              unit: "medida caseira",
              householdMeasureId:
                "50000000-0000-4000-8000-000000000005",
              gramsPerUnit: 25,
              preparation: "",
              brand: "",
              observations: "",
              compositionStatus: "AVAILABLE",
              nutrientsPer100g: {
                energyKcal: 200,
                proteinGrams: 20,
                carbohydratesGrams: 10,
                fatsGrams: 10,
                fiberGrams: 2,
                sodiumMg: 100,
              },
            },
          ],
        },
      ],
    },
  };
}

test("consulta inicial preserva Cadastro e retorno começa em Anamnese 1 de 10", () => {
  const flow = buildNutritionClinicalFlow(
    { patientId, attendanceId },
    {},
  );
  const initialFlow = flowForAttendanceAnamnesis(flow, {
    clinicalType: "FIRST_CONSULTATION",
    consultationType: "INITIAL",
  });
  const returnFlow = flowForAttendanceAnamnesis(flow, {
    clinicalType: "RETURN",
    consultationType: "FOLLOW_UP",
  });
  const visibleReturnFlow = returnFlow.filter(
    isVisibleNutritionClinicalFlowStep,
  );

  assert.equal(initialFlow[0]?.id, "PATIENT_REGISTRATION");
  assert.equal(returnFlow[0]?.id, "ANAMNESIS");
  assert.equal(visibleReturnFlow.length, 10);
  assert.equal(visibleReturnFlow.indexOf(returnFlow[0]!), 0);
  assert.equal(
    isNutritionReturnAttendance({
      clinicalType: null,
      consultationType: "FOLLOW_UP",
    }),
    true,
  );
});

test("R24h valida várias refeições e vários alimentos antes de salvar", () => {
  const fixture = recallFixture();
  const parsed = parseNutritionReturnAnamnesisData(fixture);
  assert.ok(parsed);
  assert.equal(parsed.recall24h?.meals.length, 2);
  assert.equal(parsed.recall24h?.meals[0]?.foods.length, 2);
  assert.equal(parsed.recall24h?.meals[1]?.foods.length, 1);
});

test("cálculo usa somente composição existente e mantém item manual fora dos totais", () => {
  const recall = recallFixture().recall24h;
  assert.ok(recall);
  const result = calculateReturnRecall(recall);
  assert.deepEqual(result.totals, {
    energyKcal: 200,
    proteinGrams: 20,
    carbohydratesGrams: 25,
    fatsGrams: 10,
    fiberGrams: 3,
    sodiumMg: 150,
  });
  assert.equal(result.calculatedFoods.length, 2);
  assert.equal(result.meals.length, 2);
  assert.deepEqual(result.sourcesUsed, ["Base local"]);
  assert.deepEqual(result.foodsWithoutComposition, [
    "Alimento não catalogado",
  ]);
  assert.equal(result.partial, true);
});

test("alimento sem composição não recebe valor nutricional inventado", () => {
  const fixture = recallFixture();
  const recall = fixture.recall24h;
  assert.ok(recall);
  const sourceFood = recall.meals[0]!.foods[0]!;
  if (sourceFood.source !== "LOCAL_DATABASE") {
    throw new Error("Fixture local inválida.");
  }
  const unavailable = {
    ...sourceFood,
    compositionStatus: "UNAVAILABLE" as const,
    nutrientsPer100g: {
      energyKcal: null,
      proteinGrams: null,
      carbohydratesGrams: null,
      fatsGrams: null,
      fiberGrams: null,
      sodiumMg: null,
    },
  };
  const result = calculateReturnRecall({
    ...recall,
    meals: [
      {
        ...recall.meals[0]!,
        foods: [unavailable],
      },
    ],
  });
  assert.equal(result.totals, undefined);
  assert.equal(result.calculatedFoods.length, 0);
  assert.deepEqual(result.foodsWithoutComposition, ["Alimento local A"]);
});

test("retorno rápido pode ser concluído sem criar blocos opcionais vazios", () => {
  const quickOnly = emptyNutritionReturnAnamnesisData();
  const parsed = parseNutritionReturnAnamnesisData(quickOnly);
  assert.ok(parsed);
  assert.equal(parsed.recall24h, undefined);
  assert.equal(parsed.detailedAdherence, undefined);
  assert.equal(returnAnamnesisEntryStatus("COMPLETE"), "FINALIZED");

  const pruned = pruneEmptyOptionalReturnBlocks({
    ...quickOnly,
    recall24h: emptyReturnRecall24Hours(),
    detailedAdherence: emptyDetailedReturnAdherence(),
  });
  assert.equal(pruned.recall24h, undefined);
  assert.equal(pruned.detailedAdherence, undefined);

  const unresolved = pruneEmptyOptionalReturnBlocks({
    ...quickOnly,
    recall24h: {
      ...emptyReturnRecall24Hours(),
      meals: [
        {
          id: "meal-pending",
          time: "",
          name: "",
          observations: "",
          foods: [
            {
              id: "food-pending",
              source: "UNSELECTED",
              name: "",
              unit: "",
              preparation: "",
              brand: "",
              observations: "",
              compositionStatus: "UNSELECTED",
            },
          ],
        },
      ],
    },
  });
  assert.equal(unresolved.recall24h, undefined);
});

test("payload antigo é mapeado para o retorno rápido sem perder os campos originais", () => {
  const legacy = {
    schemaVersion: 1 as const,
    followUp: {
      evolutionSinceLastVisit: "Evolução registrada",
      perceivedPlanAdherence: "Parcial",
      difficulties: "Organização da rotina",
      intercurrences: "Nova medicação",
      currentSymptoms: "Sintoma preservado",
      medicationSupplementChanges: "Ajuste preservado",
      newExams: "Exame preservado",
      routineChanges: "Rotina preservada",
      currentSleepStress: "Sono preservado",
      currentPhysicalActivity: "Atividade preservada",
      waterIntake: "Água preservada",
      alcoholConsumption: "Álcool preservado",
      perceivedResult: "Resultado preservado",
      professionalObservations: "Observação preservada",
      initialReturnPlan: "Ajustar plano alimentar",
    },
    recall24h: emptyReturnRecall24Hours(),
    previousPlanAdherence: {
      level: "PARTIAL" as const,
      followedMeals: "Café da manhã",
      omittedMeals: "",
      substitutions: "",
      difficultyReasons: "",
      hungerSatietyTolerance: "",
      professionalObservation: "",
    },
  };
  const parsed = parseNutritionReturnAnamnesisData(legacy);
  assert.ok(parsed);
  assert.equal(parsed.quickReturn.adherence, "PARTIAL");
  assert.equal(parsed.quickReturn.mainDifficulty, "ROUTINE_ORGANIZATION");
  assert.equal(parsed.quickReturn.hadIntercurrence, "YES");
  assert.equal(parsed.quickReturn.conduct, "ADJUST_MEAL_PLAN");
  assert.deepEqual(parsed.legacy?.followUp, legacy.followUp);
  assert.deepEqual(
    parsed.legacy?.previousPlanAdherence,
    legacy.previousPlanAdherence,
  );
  assert.equal(parsed.recall24h, undefined);
  assert.equal(parsed.detailedAdherence?.followedMeals, "Café da manhã");
});

test("rascunho e conclusão explícita produzem estados distintos", () => {
  assert.equal(returnAnamnesisEntryStatus("DRAFT"), "DRAFT");
  assert.equal(returnAnamnesisEntryStatus("COMPLETE"), "FINALIZED");
});

test("referência anterior é derivada sem alterar os registros de origem", () => {
  const entries = [
    {
      id: "previous-anamnesis",
      type: "CLINICAL_ANAMNESIS",
      occurredAt: "2026-09-01T12:00:00.000Z",
      payload: {
        chiefComplaint: "Queixa registrada anteriormente",
        primaryObjective: "HEALTH",
        secondaryObjectives: [],
        clinicalHistory: ["HYPERTENSION"],
        clinicalHistoryNotes: "",
        medications: [],
        supplements: [],
        allergies: [],
        nutrition: { restrictions: "" },
      },
    },
  ] as const;
  const before = structuredClone(entries);
  const reference = buildPreviousClinicalReference({
    lastConsultationAt: "2026-09-01T12:00:00.000Z",
    entries,
  });

  assert.equal(reference.complaint, "Queixa registrada anteriormente");
  assert.deepEqual(entries, before);
});

test("histórico anterior é renderizado somente como leitura e explicita ausências", () => {
  const emptyReference: PreviousClinicalReference = {
    objectives: [],
    diagnosesAndConditions: [],
    medicationsAndSupplements: [],
    allergiesAndRestrictions: [],
    clinicalObservations: [],
    mealPlan: { meals: [], prescriptionMeals: [] },
    energy: {},
    bodyAssessment: { measurements: [] },
  };
  const html = renderToStaticMarkup(
    createElement(PreviousClinicalReferenceCard, {
      reference: emptyReference,
    }),
  );
  assert.match(html, /somente leitura/i);
  assert.match(html, /Não informado/);
  assert.match(html, /<details/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.doesNotMatch(html, /<(input|textarea|select)\b/i);
});

test("divulgação progressiva mantém retorno rápido aberto e opcionais fechados", async () => {
  const component = await readFile(
    new URL(
      "../../components/clinical-anamnesis/return-anamnesis.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(component, /title="Retorno rápido"/);
  assert.match(
    component,
    /useState\(false\)[\s\S]*showRecall|showRecall[\s\S]*useState\(false\)/,
  );
  assert.match(
    component,
    /useState\(false\)[\s\S]*showDetailedAdherence|showDetailedAdherence[\s\S]*useState\(false\)/,
  );
  assert.match(component, /Usar plano anterior como referência/);
  assert.match(component, /Preencher recordatório manualmente/);
  assert.match(component, /Nenhum plano alimentar anterior concluído/);
  assert.match(component, /Fazer análise detalhada/);
  assert.match(component, /active=\{Boolean\(recall\)\}/);
  assert.match(component, /active=\{Boolean\(detailed\)\}/);
  assert.match(component, /Remover recordatório deste retorno/);
  assert.match(component, /Limpar recordatório deste atendimento/);
  assert.match(component, /clearCurrentAttendanceRecall/);
  assert.match(component, /recall24h: emptyReturnRecall24Hours\(\)/);
  assert.match(component, /id="recordatorio-24h"/);
});

test("integração separa a tela de retorno e preserva a implementação inicial", async () => {
  const page = await readFile(
    new URL(
      "../../app/(authenticated)/pacientes/[patientId]/anamnese/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const repository = await readFile(
    new URL("./repository.ts", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL(
      "../../app/api/patients/[patientId]/attendances/[attendanceId]/return-anamnesis/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const component = await readFile(
    new URL(
      "../../components/clinical-anamnesis/return-anamnesis.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /nutritionReturnAnamnesisRepository\.getView/);
  assert.match(page, /<ReturnAnamnesisLazy/);
  assert.match(page, /clinicalAnamnesisObjectivesRepository\.getView/);
  assert.match(page, /<ClinicalAnamnesisLazy/);

  assert.match(repository, /foodRepository\.findManyByIds/);
  assert.match(repository, /food\.nutrients\.energyKcal/);
  assert.match(repository, /findLatestCompletedMealPlanReference/);
  assert.match(repository, /recordVersion\.findMany/);
  assert.match(repository, /attendanceId:\s*\{ not: currentAttendanceId \}/);
  assert.match(repository, /status:\s*"FINALIZED" as const/);
  const saveImplementation = repository.slice(
    repository.indexOf("async save(input"),
  );
  assert.match(
    saveImplementation,
    /attendanceId:\s*attendance\.id/,
  );
  assert.doesNotMatch(saveImplementation, /CLINICAL_ANAMNESIS/);
  assert.doesNotMatch(saveImplementation, /attendance\.update/);

  assert.match(route, /saveMode:\s*"DRAFT"/);
  assert.match(route, /body\?\.action !== "COMPLETE"/);
  assert.match(route, /saveMode:\s*"COMPLETE"/);
  assert.match(component, /window\.confirm/);
  assert.match(component, /Salvar rascunho/);
  assert.match(component, /Concluir anamnese do retorno/);
});
