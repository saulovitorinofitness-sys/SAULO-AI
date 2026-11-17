import assert from "node:assert/strict";
import test from "node:test";
import {
  isTechnicalClinicalText,
  safeClinicalText,
  safeClinicalTexts,
} from "./clinical-text-safety";

for (const value of [
    "[HOMOLOGACAO V1.0] persistência validada",
    "HOMOLOGAÇÃO: validação técnica",
    "TESTE registro automatizado",
    "MOCK: paciente fictício",
    "DEMONSTRAÇÃO conteúdo técnico",
    "DEBUG dados internos",
  ]) {
  test(`remove conteúdo explicitamente técnico: ${value}`, () => {
    assert.equal(isTechnicalClinicalText(value), true);
    assert.equal(safeClinicalText(value), undefined);
  });
}

test("preserva observações clínicas reais", () => {
    const clinical = "Paciente realizará teste respiratório conforme solicitação.";
    assert.equal(safeClinicalText(clinical), clinical);
    assert.deepEqual(safeClinicalTexts(["DEBUG interno", clinical]), [clinical]);
  });
