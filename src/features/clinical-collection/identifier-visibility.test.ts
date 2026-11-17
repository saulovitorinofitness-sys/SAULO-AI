import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("resumo exibe código SV e não renderiza UUID do Prontuário Mestre", async () => {
  const source = await readFile(
    "src/components/clinical-collection/collection-summary.tsx",
    "utf8",
  );
  assert.match(source, /Código clínico/);
  assert.match(source, /collection\.patientCode/);
  assert.doesNotMatch(source, /value=\{collection\.masterRecordId\}/);
});

test("painéis não exibem masterRecordId ao usuário", async () => {
  const sources = await Promise.all([
    readFile("src/components/nutrition-prescription/nutrition-patient-panel.tsx", "utf8"),
    readFile("src/components/clinical-engine/clinical-engine-workspace.tsx", "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, />\{(?:patient|view)\.masterRecordId\}/);
  }
});
