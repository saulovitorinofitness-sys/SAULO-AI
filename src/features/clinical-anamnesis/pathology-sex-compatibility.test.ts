import assert from "node:assert/strict";
import test from "node:test";

import {
  PathologySexCompatibilityError,
  assertNewPathologiesCompatible,
  filterPathologyOptionsBySex,
  getPathologySexCompatibility,
  incompatiblePathologies,
} from "./pathology-sex-compatibility";

test("paciente masculino não consegue registrar endometriose", () => {
  const result = getPathologySexCompatibility("Endometriose", "MALE");

  assert.equal(result.status, "INCOMPATIBLE");
  assert.throws(
    () =>
      assertNewPathologiesCompatible({
        currentConditions: ["Endometriose"],
        patientSex: "MALE",
      }),
    PathologySexCompatibilityError,
  );
});

test("paciente masculino continua conseguindo registrar hipertensão", () => {
  assert.equal(
    getPathologySexCompatibility("Hipertensão", "MALE").status,
    "COMPATIBLE",
  );
  assert.doesNotThrow(() =>
    assertNewPathologiesCompatible({
      currentConditions: ["Hipertensão"],
      patientSex: "MALE",
    }),
  );
});

test("paciente feminino não consegue registrar condição prostática", () => {
  const result = getPathologySexCompatibility("Câncer de próstata", "FEMALE");

  assert.equal(result.status, "INCOMPATIBLE");
  assert.throws(
    () =>
      assertNewPathologiesCompatible({
        currentConditions: ["Câncer de próstata"],
        patientSex: "FEMALE",
      }),
    PathologySexCompatibilityError,
  );
});

test("paciente feminino continua conseguindo registrar diabetes", () => {
  assert.equal(
    getPathologySexCompatibility("Diabetes", "FEMALE").status,
    "COMPATIBLE",
  );
});

test("sexo não informado gera orientação sem bloqueio definitivo", () => {
  const result = getPathologySexCompatibility(
    "Síndrome dos ovários policísticos",
    "NOT_INFORMED",
  );

  assert.equal(result.status, "SEX_REQUIRED");
  assert.match(result.message ?? "", /registre o sexo do paciente/i);
  assert.doesNotThrow(() =>
    assertNewPathologiesCompatible({
      currentConditions: ["Síndrome dos ovários policísticos"],
      patientSex: "NOT_INFORMED",
    }),
  );
});

test("payload direto incompatível é rejeitado pela guarda da persistência", () => {
  assert.throws(
    () =>
      assertNewPathologiesCompatible({
        currentConditions: ["Diabetes", "Adenomiose"],
        previousConditions: ["Diabetes"],
        patientSex: "MALE",
      }),
    (error: unknown) =>
      error instanceof PathologySexCompatibilityError &&
      /adenomiose/i.test(error.message),
  );
});

test("diagnóstico antigo incompatível é preservado para revisão", () => {
  assert.doesNotThrow(() =>
    assertNewPathologiesCompatible({
      currentConditions: ["Endometriose", "Hipertensão"],
      previousConditions: ["Endometriose"],
      patientSex: "MALE",
    }),
  );
  assert.deepEqual(
    incompatiblePathologies(["Endometriose"], "MALE").map(
      ({ condition }) => condition,
    ),
    ["Endometriose"],
  );
});

test("filtro visual remove apenas condições incompatíveis", () => {
  const options = [
    ["ENDOMETRIOSIS", "Endometriose"],
    ["HYPERTENSION", "Hipertensão"],
    ["PROSTATE_CANCER", "Câncer de próstata"],
    ["DIABETES", "Diabetes"],
  ] as const;

  assert.deepEqual(
    filterPathologyOptionsBySex(options, "MALE").map(([value]) => value),
    ["HYPERTENSION", "PROSTATE_CANCER", "DIABETES"],
  );
  assert.deepEqual(
    filterPathologyOptionsBySex(options, "FEMALE").map(([value]) => value),
    ["ENDOMETRIOSIS", "HYPERTENSION", "DIABETES"],
  );
});
