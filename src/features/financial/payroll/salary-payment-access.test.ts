import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BUILT_IN_IDS } from "@/modules/permissions";

import { salaryProofOwnershipMatches, salaryProofUserDecision } from "./salary-payment-access";

test("acesso sem sessao e negado e apenas Saulo pode ler o comprovante", () => {
  assert.equal(salaryProofUserDecision(null), "UNAUTHENTICATED");
  assert.equal(salaryProofUserDecision(randomUUID()), "FORBIDDEN");
  assert.equal(salaryProofUserDecision(BUILT_IN_IDS.users.sauloXavierVitorino), "ALLOW");
});

test("comprovante de outra unidade, demonstrativo, vinculo ou funcionario e negado", () => {
  const receiptId = randomUUID();
  const unitId = randomUUID();
  const statementId = randomUUID();
  const employeeId = randomUUID();
  const own = {
    receiptId, evidenceReceiptId: receiptId,
    receiptUnitId: unitId, evidenceUnitId: unitId, statementUnitId: unitId, employmentUnitId: unitId,
    statementId, evidenceStatementId: statementId,
    employeeId, evidenceEmployeeId: employeeId,
  };
  assert.equal(salaryProofOwnershipMatches(own), true);
  for (const field of ["evidenceReceiptId", "evidenceUnitId", "statementUnitId", "employmentUnitId", "evidenceStatementId", "evidenceEmployeeId"] as const) {
    assert.equal(salaryProofOwnershipMatches({ ...own, [field]: randomUUID() }), false, field);
  }
});
