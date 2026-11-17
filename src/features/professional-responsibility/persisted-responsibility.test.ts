import assert from "node:assert/strict";
import test from "node:test";

import { persistedProfessionalReference } from "./persisted-responsibility";

const saulo = { id: "saulo", fullName: "Saulo Xavier Vitorino" };
const maria = { id: "maria", fullName: "Maria de Lourdes Gomes" };

test("cada módulo mantém o executor da própria versão", () => {
  const postural = persistedProfessionalReference(maria, saulo);
  const performance = persistedProfessionalReference(saulo, maria);
  const nutrition = persistedProfessionalReference(saulo, maria);

  assert.equal(postural.fullName, "Maria de Lourdes Gomes");
  assert.equal(performance.fullName, "Saulo Xavier Vitorino");
  assert.equal(nutrition.fullName, "Saulo Xavier Vitorino");
});

test("usuário visualizador não participa da resolução de autoria", () => {
  const viewer = maria;
  const stored = persistedProfessionalReference(saulo, maria);

  assert.equal(viewer.fullName, "Maria de Lourdes Gomes");
  assert.equal(stored.fullName, "Saulo Xavier Vitorino");
});

test("registro legado usa updatedBy somente quando não há versão", () => {
  assert.deepEqual(persistedProfessionalReference(undefined, maria), maria);
});
