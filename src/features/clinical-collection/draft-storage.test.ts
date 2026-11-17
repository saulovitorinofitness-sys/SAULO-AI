import assert from "node:assert/strict";
import test from "node:test";

import { shouldCreateClinicalStepVersion } from "./contracts";
import {
  clinicalStepDraftStorageKey,
  parseClinicalStepDraft,
  serializeClinicalStepDraft,
} from "./draft-storage";

test("isola e recupera o rascunho pela etapa clínica", () => {
  const raw = serializeClinicalStepDraft("ANTHROPOMETRY", {
    weightKg: 72.4,
    heightCm: 174,
    bmi: 23.9,
    notes: "Rascunho local",
  });
  const parsed = parseClinicalStepDraft(raw, "ANTHROPOMETRY");

  assert.equal(parsed?.step, "ANTHROPOMETRY");
  assert.equal(
    (parsed?.data as { weightKg?: number }).weightKg,
    72.4,
  );
  assert.equal(parseClinicalStepDraft(raw, "PERIMETRY"), null);
  assert.match(
    clinicalStepDraftStorageKey("patient/1", "attendance/1", "ANTHROPOMETRY"),
    /patient%2F1:attendance%2F1:ANTHROPOMETRY$/,
  );
});

test("rejeita rascunho local inválido ou incompatível", () => {
  assert.equal(parseClinicalStepDraft("{", "ANTHROPOMETRY"), null);
  assert.equal(
    parseClinicalStepDraft(
      JSON.stringify({
        schemaVersion: 1,
        step: "ANTHROPOMETRY",
        savedAt: new Date().toISOString(),
        data: { weightKg: "72" },
      }),
      "ANTHROPOMETRY",
    ),
    null,
  );
});

test("autosave não cria versão histórica completa", () => {
  assert.equal(shouldCreateClinicalStepVersion("AUTOSAVE"), false);
  assert.equal(shouldCreateClinicalStepVersion("MANUAL"), true);
  assert.equal(shouldCreateClinicalStepVersion(), true);
});
