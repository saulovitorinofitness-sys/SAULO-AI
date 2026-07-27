import assert from "node:assert/strict";
import test from "node:test";

import { resolvePatientObjectives } from "./patient-objectives";

test("prioriza o objetivo clínico e carrega objetivos secundários", () => {
  assert.deepEqual(
    resolvePatientObjectives({
      clinicalObjectives: [
        { type: "PRIMARY", title: "Performance esportiva" },
        { type: "SECONDARY", title: "Melhorar recuperação" },
      ],
      strategyEntries: [{ payload: { objective: "WEIGHT_LOSS" } }],
    }),
    {
      primaryObjective: "Performance esportiva",
      secondaryObjectives: ["Melhorar recuperação"],
    },
  );
});

test("reutiliza o objetivo persistido pela estratégia quando necessário", () => {
  assert.deepEqual(
    resolvePatientObjectives({
      clinicalObjectives: [],
      strategyEntries: [{ payload: { objective: "WEIGHT_LOSS" } }],
    }),
    {
      primaryObjective: "Emagrecimento",
      secondaryObjectives: [],
    },
  );
});

test("não inventa objetivo quando nenhuma fonte possui registro", () => {
  assert.deepEqual(
    resolvePatientObjectives({
      clinicalObjectives: [],
      strategyEntries: [],
    }),
    {
      primaryObjective: undefined,
      secondaryObjectives: [],
    },
  );
});
