import assert from "node:assert/strict";
import test from "node:test";

import {
  isLegacyServiceReceiptPostEnabled,
  legacyServiceReceiptCutoverFromEnvironment,
} from "./legacy-cutover";

test("POST legado permanece ativo ate o novo fluxo estar pronto", () => {
  assert.equal(isLegacyServiceReceiptPostEnabled({
    professionalServiceReceiptFlowReady: false,
    disableLegacyServiceReceiptPost: true,
  }), true);
  assert.equal(isLegacyServiceReceiptPostEnabled({
    professionalServiceReceiptFlowReady: true,
    disableLegacyServiceReceiptPost: false,
  }), true);
});

test("POST legado desativa somente com as duas confirmacoes explicitas", () => {
  const state = legacyServiceReceiptCutoverFromEnvironment({
    PROFESSIONAL_SERVICE_RECEIPT_FLOW_READY: "true",
    DISABLE_LEGACY_SERVICE_RECEIPT_POST: "true",
  });
  assert.equal(isLegacyServiceReceiptPostEnabled(state), false);
});
