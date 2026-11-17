import assert from "node:assert/strict";
import test from "node:test";

import { employmentTypeLabel, salaryLineDescription } from "./salary-document-presentation";

test("traduz códigos salariais conhecidos sem alterar o valor interno", () => {
  const line = { code: "SALARY", description: "SALARY", type: "EARNING" as const };
  assert.equal(salaryLineDescription(line), "Salário base");
  assert.equal(line.code, "SALARY");
});

test("preserva uma descrição profissional aprovada", () => {
  assert.equal(salaryLineDescription({ code: "INSS", description: "Contribuição previdenciária", type: "DEDUCTION" }), "Contribuição previdenciária");
});

test("usa denominação portuguesa segura quando não existe descrição válida", () => {
  assert.equal(salaryLineDescription({ code: "CUSTOM_INTERNAL", description: "CUSTOM_INTERNAL", type: "BENEFIT" }), "Benefício");
  assert.equal(salaryLineDescription({ code: "X1", description: "UNKNOWN_EARNING_ENUM", type: "EARNING" }), "Provento salarial");
  assert.equal(salaryLineDescription({ code: "X", description: "", type: "ADJUSTMENT_DEBIT" }), "Ajuste de débito");
  assert.equal(employmentTypeLabel("UNSUPPORTED_INTERNAL_VALUE"), "Vínculo empregatício");
});
