import assert from "node:assert/strict";
import test from "node:test";

import type { ClinicalAnamnesisData } from "./contracts";
import {
  assertClinicalAnamnesisData,
  ClinicalAnamnesisValidationError,
  validateClinicalAnamnesisData,
} from "./validation";

function emptyData(): ClinicalAnamnesisData {
  return {
    chiefComplaint: "",
    currentIllness: {
      onset: "",
      duration: "",
      evolution: "",
      previousTreatments: "",
      currentSituation: "",
    },
    primaryObjective: "",
    secondaryObjectives: [],
    clinicalHistory: [],
    clinicalHistoryNotes: "",
    familyHistory: [],
    surgeries: [],
    injuries: [],
    medications: [],
    supplements: [],
    allergyStatus: "NOT_INFORMED",
    allergies: [],
    sleep: { hours: "", quality: "", awakenings: "" },
    stressLevel: 0,
    physicalActivity: { frequency: "", duration: "", modality: "" },
    habits: { alcohol: "", smoking: "", others: "" },
    nutrition: {
      mealsPerDay: "",
      water: "",
      restrictions: "",
      preferences: "",
    },
    generalNotes: "",
  };
}

test("aceita criação com campos clínicos não informados", () => {
  const data = emptyData();
  const result = validateClinicalAnamnesisData(data);

  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data, data);
});

test("aceita edição preenchida sem transformar os valores", () => {
  const data: ClinicalAnamnesisData = {
    ...emptyData(),
    chiefComplaint: "Dor lombar ao final do dia",
    primaryObjective: "HEALTH",
    secondaryObjectives: ["CONDITIONING"],
    clinicalHistory: ["HYPERTENSION"],
    clinicalHistoryNotes: "Condição registrada pelo profissional",
    surgeries: [
      {
        id: "surgery-1",
        procedure: "Procedimento registrado",
        date: "2025-02-10",
        notes: "Sem observações adicionais",
      },
    ],
    stressLevel: 6,
  };
  const result = validateClinicalAnamnesisData(data);

  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data, data);
});

test("rejeita objeto interno incompleto", () => {
  const data = { ...emptyData(), sleep: { hours: "8" } };
  const result = validateClinicalAnamnesisData(data);

  assert.equal(result.success, false);
});

test("modela explicitamente alergia negada e confirmada", () => {
  assert.equal(
    validateClinicalAnamnesisData({
      ...emptyData(),
      allergyStatus: "DENIED",
      allergies: [],
    }).success,
    true,
  );
  assert.equal(
    validateClinicalAnamnesisData({
      ...emptyData(),
      allergyStatus: "CONFIRMED",
      allergies: ["Amendoim"],
    }).success,
    true,
  );
  assert.equal(
    validateClinicalAnamnesisData({
      ...emptyData(),
      allergyStatus: "CONFIRMED",
      allergies: [],
    }).success,
    false,
  );
});

test("rejeita opção clínica que não pertence ao catálogo", () => {
  const data = { ...emptyData(), primaryObjective: "UNKNOWN" };
  const result = validateClinicalAnamnesisData(data);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.message, /objetivo principal válido/i);
  }
});

test("rejeita nível de estresse fora da faixa da interface", () => {
  const result = validateClinicalAnamnesisData({
    ...emptyData(),
    stressLevel: 11,
  });

  assert.deepEqual(result, {
    success: false,
    message: "O nível de estresse deve estar entre 0 e 10.",
  });
});

test("a proteção usada pela persistência rejeita payload direto inválido", () => {
  assert.throws(
    () => assertClinicalAnamnesisData({ ...emptyData(), allergies: [null] }),
    ClinicalAnamnesisValidationError,
  );
});
