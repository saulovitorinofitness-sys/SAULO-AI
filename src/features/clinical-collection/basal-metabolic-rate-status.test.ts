import assert from "node:assert/strict";
import test from "node:test";

import { basalMetabolicRateMissingReason } from "./basal-metabolic-rate-status";

test("TMB real registrada não recebe pendência", () => {
  assert.equal(
    basalMetabolicRateMissingReason({ recordedValue: 1420 }),
    undefined,
  );
});

test("TMB informa exatamente o dado faltante", () => {
  assert.equal(
    basalMetabolicRateMissingReason({}),
    "Não calculada: data de nascimento não informada.",
  );
  assert.equal(
    basalMetabolicRateMissingReason({
      ageYears: 35,
      sex: "FEMALE",
      weightKg: 65,
      heightCm: 165,
    }),
    "Não calculada: protocolo de TMB não definido.",
  );
});
