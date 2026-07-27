import assert from "node:assert/strict";
import test from "node:test";

import { posturalSegmentsByView } from "./postural-segments";

test("mantém os segmentos aprovados em cada vista", () => {
  assert.equal(posturalSegmentsByView.ANTERIOR.length, 20);
  assert.equal(posturalSegmentsByView.POSTERIOR.length, 15);
  assert.equal(posturalSegmentsByView.RIGHT_LATERAL.length, 11);
  assert.equal(posturalSegmentsByView.LEFT_LATERAL.length, 11);
  assert.deepEqual(
    posturalSegmentsByView.LEFT_LATERAL,
    posturalSegmentsByView.RIGHT_LATERAL,
  );
});

test("todos os cartões oferecem estrutura clínica uniforme", () => {
  for (const definitions of Object.values(
    posturalSegmentsByView,
  )) {
    for (const definition of definitions) {
      assert.ok(definition.name);
      assert.ok(definition.objective);
      assert.ok(definition.options.length >= 3);
      assert.ok(definition.definition);
      assert.ok(definition.howToObserve);
      assert.ok(definition.biomechanicalAssociations);
      assert.deepEqual(definition.investigationSuggestions, [
        "Mobilidade",
        "Histórico de dor",
        "Avaliação funcional",
        "Outro",
      ]);
    }
  }
});

test("textos auxiliares evitam linguagem conclusiva", () => {
  const content = JSON.stringify(posturalSegmentsByView);

  for (const forbiddenTerm of [
    "diagnóstico",
    "confirma",
    "possui",
    "caracteriza",
  ]) {
    assert.equal(
      content.toLocaleLowerCase("pt-BR").includes(forbiddenTerm),
      false,
    );
  }
});
