import assert from "node:assert/strict";
import test from "node:test";

import {
  exerciseLibraryDraftSchema,
  normalizeExerciseName,
} from "./exercise-library-contracts";

test("normaliza nome para unicidade por profissional", () => {
  assert.equal(normalizeExerciseName("  Elevação   Pélvica  "), "elevacao pelvica");
});

test("aceita o cadastro mínimo usado pela integração existente", () => {
  const draft = exerciseLibraryDraftSchema.parse({ name: "Agachamento" });

  assert.equal(draft.category, "OTHER");
  assert.equal(draft.active, true);
  assert.equal(draft.professionalNotes, "");
});

test("rejeita categoria fora do escopo aprovado", () => {
  const result = exerciseLibraryDraftSchema.safeParse({
    name: "Sessão teste",
    category: "SWIMMING",
  });

  assert.equal(result.success, false);
});
