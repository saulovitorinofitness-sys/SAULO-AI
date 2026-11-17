import assert from "node:assert/strict";
import test from "node:test";

import { emptyAnamnesisData } from "./mock-data";
import { sanitizeClinicalAnamnesisData } from "./clinical-data-safety";

test("impede texto técnico em campos clínicos sem apagar observação real", () => {
  const result = sanitizeClinicalAnamnesisData({
    ...emptyAnamnesisData,
    chiefComplaint: "MOCK paciente fictício",
    generalNotes: "Paciente relata melhora do sono.",
    allergies: ["DEBUG alérgeno interno"],
  });
  assert.equal(result.chiefComplaint, "");
  assert.equal(result.generalNotes, "Paciente relata melhora do sono.");
  assert.deepEqual(result.allergies, []);
});
