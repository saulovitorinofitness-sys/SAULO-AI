import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

test("ação mensal atualiza lista e recarrega o detalhe aberto", () => {
  const monthlyAction = source.slice(source.indexOf("async function runMonthlyAction"), source.indexOf("function openPaymentReceipt"));
  assert.match(monthlyAction, /await fetchStatements\(businessUnitId, true\);\s*if \(details\) await loadStatementDetails\(businessUnitId, details\.id\);/u);
});
