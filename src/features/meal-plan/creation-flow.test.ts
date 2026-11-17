import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseStoredMealPlanPayload } from "./record";

process.env.DATABASE_URL ??=
  "postgresql://test:test@127.0.0.1:5432/saulo_ai_test";

async function repositoryHelpers() {
  return import("./repository");
}

const identity = {
  patientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  attendanceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  strategyEntryId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};

test("estratégia concluída gera refeições que o Plano consegue abrir", async () => {
  const { initialMeals } = await repositoryHelpers();
  const meals = initialMeals([
    {
      mealNumber: 1,
      name: "",
      time: "",
      vetPercentage: 100,
      plannedCaloriesKcal: 1_836,
    },
  ]);
  const parsed = parseStoredMealPlanPayload({
    schemaVersion: 6,
    strategyEntryId: identity.strategyEntryId,
    strategyApprovedAt: "2026-10-12T12:00:00.000Z",
    status: "DRAFT",
    aiDecision: "IDLE",
    meals,
    supplements: [],
    totals: {
      energyKcal: 0,
      proteinGrams: 0,
      carbohydratesGrams: 0,
      fatsGrams: 0,
      fiberGrams: 0,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.meals[0].name, "Refeição 1");
  assert.equal(parsed.meals[0].time, undefined);
  assert.equal(parsed.strategyEntryId, identity.strategyEntryId);
});

test("reabre plano criado pelo bug sem inventar horário clínico", () => {
  const parsed = parseStoredMealPlanPayload({
    schemaVersion: 6,
    strategyEntryId: identity.strategyEntryId,
    strategyApprovedAt: "2026-10-12T12:00:00.000Z",
    status: "DRAFT",
    aiDecision: "IDLE",
    meals: [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        name: "",
        order: 1,
        time: "",
        vetPercentage: 100,
        plannedEnergyKcal: 1_836,
        items: [],
      },
    ],
    supplements: [],
    totals: {
      energyKcal: 0,
      proteinGrams: 0,
      carbohydratesGrams: 0,
      fatsGrams: 0,
      fiberGrams: 0,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.meals[0].name, "Refeição 1");
  assert.equal(parsed.meals[0].time, undefined);
});

test("segunda abertura reutiliza o mesmo Plano e não cria duplicado", async () => {
  const { findOrCreateMealPlanForAttendance } = await repositoryHelpers();
  let stored: { id: string; strategyEntryId: string } | null = null;
  let createCount = 0;
  const findCalls: Array<readonly [string, string]> = [];
  const open = () =>
    findOrCreateMealPlanForAttendance({
      patientId: identity.patientId,
      attendanceId: identity.attendanceId,
      expectedStrategyEntryId: identity.strategyEntryId,
      find: async (patientId, attendanceId) => {
        findCalls.push([patientId, attendanceId]);
        return stored;
      },
      create: async () => {
        createCount += 1;
        stored = { id: "plan-1", strategyEntryId: identity.strategyEntryId };
      },
    });

  const first = await open();
  const second = await open();

  assert.equal(first.id, "plan-1");
  assert.equal(second.id, first.id);
  assert.equal(createCount, 1);
  assert.ok(
    findCalls.every(
      ([patientId, attendanceId]) =>
        patientId === identity.patientId &&
        attendanceId === identity.attendanceId,
    ),
  );
});

test("retry após falha transitória reutiliza o Plano que já foi criado", async () => {
  const { findOrCreateMealPlanForAttendance } = await repositoryHelpers();
  const stored = { id: "plan-1", strategyEntryId: identity.strategyEntryId };
  let created = false;
  let failReadAfterCreate = true;
  let createCount = 0;
  const open = () =>
    findOrCreateMealPlanForAttendance({
      patientId: identity.patientId,
      attendanceId: identity.attendanceId,
      expectedStrategyEntryId: identity.strategyEntryId,
      find: async () => {
        if (!created) return null;
        if (failReadAfterCreate) {
          failReadAfterCreate = false;
          throw new Error("TRANSIENT_READ_FAILURE");
        }
        return stored;
      },
      create: async () => {
        createCount += 1;
        created = true;
      },
    });

  await assert.rejects(open(), /TRANSIENT_READ_FAILURE/);
  assert.equal((await open()).id, stored.id);
  assert.equal(createCount, 1);
});

test("cria e busca no mesmo MasterRecord, atendimento e profissional; retry atualiza a rota", async () => {
  const [repository, errorBoundary] = await Promise.all([
    readFile(new URL("./repository.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../app/(authenticated)/error.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(repository, /masterRecordId: attendance\.masterRecordId/);
  assert.match(repository, /attendanceId: attendance\.id/);
  assert.match(repository, /authorUserId: professional\.id/);
  assert.match(repository, /updatedByUserId: professional\.id/);
  assert.match(repository, /pg_advisory_xact_lock\(hashtext\(\$\{input\.attendanceId\}\)\)/);
  assert.match(repository, /if \(existing\) return/);
  assert.match(errorBoundary, /reset\(\);[\s\S]*router\.refresh\(\)/);
  assert.match(errorBoundary, /onClick=\{retry\}/);
});

test("salvamento repetido do mesmo rascunho é idempotente", async () => {
  const { hasSameMealPlanDraftContent, initialMeals } = await repositoryHelpers();
  const meals = initialMeals([
    {
      mealNumber: 1,
      name: "Almoço",
      time: "12:00",
      vetPercentage: 100,
      plannedCaloriesKcal: 1_836,
    },
  ]);
  const current = parseStoredMealPlanPayload({
    schemaVersion: 6,
    strategyEntryId: identity.strategyEntryId,
    strategyApprovedAt: "2026-10-12T12:00:00.000Z",
    status: "DRAFT",
    aiDecision: "SUGGESTION_GENERATED",
    smartGenerationVersion: 2,
    meals,
    supplements: [],
    totals: {
      energyKcal: 0,
      proteinGrams: 0,
      carbohydratesGrams: 0,
      fatsGrams: 0,
      fiberGrams: 0,
    },
  });
  assert.ok(current);

  const draft = {
    strategyEntryId: current.strategyEntryId,
    status: current.status,
    aiDecision: current.aiDecision,
    smartGenerationVersion: current.smartGenerationVersion,
    meals: current.meals,
    supplements: current.supplements,
  };
  assert.equal(hasSameMealPlanDraftContent(current, draft), true);
  assert.equal(
    hasSameMealPlanDraftContent(current, {
      ...draft,
      smartGenerationVersion: 1,
    }),
    false,
  );
  assert.equal(
    hasSameMealPlanDraftContent(current, {
      ...draft,
      meals: draft.meals.map((meal) => ({ ...meal, name: "Jantar" })),
    }),
    false,
  );
});

test("persistência da prévia usa uma transação serializada, uma auditoria em lote e o atendimento exato", async () => {
  const repository = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const save = repository.slice(
    repository.indexOf("async function persistExistingPlan("),
  );

  assert.match(save, /pg_advisory_xact_lock\(hashtext\(\$\{input\.attendanceId\}\)\)/);
  assert.match(save, /attendanceId: input\.attendanceId/);
  assert.match(save, /patientId: input\.patientId/);
  assert.match(save, /hasSameMealPlanDraftContent\(current, input\.draft\)/);
  assert.match(save, /create: prescriptionChanges\.map/);
  assert.doesNotMatch(save, /for \(const change of prescriptionChanges\)/);
});
