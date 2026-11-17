import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseReturnFoodSafetyInput,
  resolveEffectiveFoodAllergyState,
  type ReturnFoodSafetyUpdate,
} from "./food-safety-update";

const attendanceId = "52935d43-5756-440f-b9ac-e87c77ef9c72";

function update(
  values: Partial<ReturnFoodSafetyUpdate> = {},
): ReturnFoodSafetyUpdate {
  return {
    id: "93a42508-f383-40b0-a9ce-5594b2d30c9d",
    patientId: "d914f474-013d-4a92-b764-25006f7c24e8",
    masterRecordId: "7d83fe02-8229-43af-8b67-4df1fde8c2a9",
    attendanceId,
    status: "DENIED",
    allergens: [],
    confirmedAt: "2026-10-12T12:00:00.000Z",
    responsibleUserId: "1b3620c9-c43d-4f26-a39c-a98e9131b8ae",
    responsibleName: "Profissional responsável",
    revision: 1,
    ...values,
  };
}

test("ausência confirmada compõe o estado efetivo sem presumir alergias", () => {
  const result = resolveEffectiveFoodAllergyState({
    attendanceId,
    baselineStatus: "NOT_INFORMED",
    baselineAllergies: [],
    update: update(),
  });

  assert.deepEqual(result, { status: "DENIED", allergies: [] });
});

test("alérgenos cadastrados compõem o estado efetivo", () => {
  const result = resolveEffectiveFoodAllergyState({
    attendanceId,
    baselineStatus: "NOT_INFORMED",
    baselineAllergies: [],
    update: update({
      status: "CONFIRMED",
      allergens: [
        {
          id: "f55924cc-1746-424e-903f-065aa16359c4",
          name: "Amendoim",
          reaction: "Urticária",
        },
      ],
    }),
  });

  assert.deepEqual(result, {
    status: "CONFIRMED",
    allergies: ["Amendoim"],
  });
});

test("estado vazio continua não informado e não vira ausência de alergias", () => {
  const result = resolveEffectiveFoodAllergyState({
    attendanceId,
    baselineStatus: "NOT_INFORMED",
    baselineAllergies: [],
    update: null,
  });

  assert.deepEqual(result, { status: "NOT_INFORMED", allergies: [] });
  assert.equal(
    parseReturnFoodSafetyInput({
      status: "DENIED",
      allergens: [],
      professionalConfirmation: false,
    }),
    null,
  );
});

test("confirmação com alergias exige ao menos um alérgeno", () => {
  assert.equal(
    parseReturnFoodSafetyInput({
      status: "CONFIRMED",
      allergens: [],
      professionalConfirmation: true,
    }),
    null,
  );
  assert.ok(
    parseReturnFoodSafetyInput({
      status: "CONFIRMED",
      allergens: [
        {
          id: "f55924cc-1746-424e-903f-065aa16359c4",
          name: "Amendoim",
          reaction: "Urticária",
        },
      ],
      professionalConfirmation: true,
    }),
  );
});

test("atualização de outro atendimento nunca altera o estado efetivo", () => {
  const result = resolveEffectiveFoodAllergyState({
    attendanceId,
    baselineStatus: "CONFIRMED",
    baselineAllergies: ["Leite"],
    update: update({
      attendanceId: "a32d52e5-5644-48f5-84a4-06ad930a75e7",
      status: "DENIED",
    }),
  });

  assert.deepEqual(result, {
    status: "CONFIRMED",
    allergies: ["Leite"],
  });
});

test("retorno ao Plano preserva patientId e attendanceId", async () => {
  const source = await readFile(
    "src/components/clinical-anamnesis/return-anamnesis.tsx",
    "utf8",
  );

  assert.ok(source.includes("Atualização de segurança alimentar"));
  assert.ok(source.includes("Paciente nega alergias alimentares"));
  assert.ok(source.includes("Paciente possui alergias alimentares"));
  assert.ok(source.includes("Voltar ao Plano Alimentar"));
  assert.ok(
    source.includes(
      "/pacientes/${encodeURIComponent(view.patientId)}/plano-alimentar?attendanceId=${encodeURIComponent(view.attendanceId)}",
    ),
  );
});

test("persistência é isolada por atendimento, versionada e auditada", async () => {
  const source = await readFile(new URL("./food-safety-update.ts", import.meta.url), "utf8");

  assert.ok(source.includes("id: input.attendanceId"));
  assert.ok(source.includes("patientId: input.patientId"));
  assert.ok(source.includes("recordVersion.create"));
  assert.ok(source.includes("auditEvent.create"));
  assert.ok(source.includes("updatedByUserId: professional.id"));
  assert.ok(source.includes("confirmedAt: now.toISOString()"));
});

test("painel clínico usa a atualização do mesmo atendimento", async () => {
  const source = await readFile(
    "src/features/nutrition-strategy/clinical-panel-repository.ts",
    "utf8",
  );

  assert.ok(
    source.includes(
      "returnFoodSafetyRepository.get(patientId, collection.attendanceId)",
    ),
  );
  assert.ok(source.includes("resolveEffectiveFoodAllergyState"));
});
