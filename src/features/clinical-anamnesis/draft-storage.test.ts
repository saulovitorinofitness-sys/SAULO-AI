import assert from "node:assert/strict";
import test from "node:test";

import { shouldCreateClinicalAnamnesisHistory } from "./contracts";
import {
  clinicalAnamnesisDraftStorageKey,
  parseClinicalAnamnesisDraft,
  serializeClinicalAnamnesisDraft,
} from "./draft-storage";
import { emptyAnamnesisData } from "./mock-data";

test("recupera rascunho local válido e isolado pelo paciente", () => {
  const data = { ...emptyAnamnesisData, chiefComplaint: "Dor lombar" };
  const parsed = parseClinicalAnamnesisDraft(
    serializeClinicalAnamnesisDraft(data),
  );

  assert.equal(parsed?.data.chiefComplaint, "Dor lombar");
  assert.match(
    clinicalAnamnesisDraftStorageKey("patient/1", "attendance/1"),
    /patient%2F1:attendance%2F1$/,
  );
});

test("rejeita rascunho local corrompido", () => {
  assert.equal(parseClinicalAnamnesisDraft("{"), null);
  assert.equal(
    parseClinicalAnamnesisDraft(
      JSON.stringify({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        data: { chiefComplaint: 10 },
      }),
    ),
    null,
  );
});

test("somente a conclusão explícita cria snapshot histórico", () => {
  assert.equal(shouldCreateClinicalAnamnesisHistory("AUTOSAVE"), false);
  assert.equal(shouldCreateClinicalAnamnesisHistory("DRAFT"), false);
  assert.equal(shouldCreateClinicalAnamnesisHistory("COMPLETE"), true);
});
