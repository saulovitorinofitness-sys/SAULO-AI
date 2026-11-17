import assert from "node:assert/strict";
import test from "node:test";

import { salaryDocumentPreviewFixture } from "./salary-document-preview-fixtures";

test("fornece os três estados de validação sem repositório ou persistência", () => {
  const demonstrative = salaryDocumentPreviewFixture("demonstrativo");
  const legacy = salaryDocumentPreviewFixture("legado");
  const confirmed = salaryDocumentPreviewFixture("recibo-confirmado");

  assert.equal(demonstrative.documentKind, "DEMONSTRATIVE");
  assert.equal(demonstrative.documentState, "DEMONSTRATIVE_AVAILABLE");
  assert.equal(legacy.documentKind, "LEGACY_DEMONSTRATIVE");
  assert.equal(legacy.documentState, "LEGACY_UNCONFIRMED");
  assert.equal(confirmed.documentKind, "SALARY_RECEIPT");
  assert.equal(confirmed.documentState, "CASH_AWAITING_SIGNATURE");
  if (confirmed.documentKind === "SALARY_RECEIPT") {
    assert.equal(confirmed.payment.method, "CASH");
    assert.equal(confirmed.payment.proofUrl, null);
  }
});
