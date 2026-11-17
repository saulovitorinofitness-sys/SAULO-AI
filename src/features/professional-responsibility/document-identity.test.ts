import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

async function identityFor(userId: string) {
  const source = await readFile(new URL("./document-identity.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} as {
    physicalDocumentProfessionalIdentity: (id: string, fallback: string) => Promise<{
      userId: string;
      fullName: string;
      title?: string;
      registrations: string[];
    }>;
  } };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    require(id: string) {
      if (id === "@/config/institution") {
        return { institutionalProfessionalFor: (id: string) => id === "author-saulo"
          ? { fullName: "Saulo", qualifications: ["Nutricionista", "Profissional de Educação Física"], registrations: ["CRN 1", "CREF 2"] }
          : undefined };
      }
      if (id === "./service") {
        return { professionalResponsibilityService: { getProfessional: async (id: string) => id === "author-maria"
          ? { fullName: "Maria de Lourdes", professionalTitle: "Nutricionista", professionalRegistration: "CRN 3" }
          : { fullName: "Saulo", professionalTitle: "Profissional de Educação Física", professionalRegistration: "CREF 2" } } };
      }
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return testModule.exports.physicalDocumentProfessionalIdentity(userId, "Outro profissional");
}

test("usa as credenciais da profissional que consta no registro", async () => {
  const identity = await identityFor("author-maria");
  assert.equal(identity.userId, "author-maria");
  assert.equal(identity.fullName, "Maria de Lourdes");
  assert.equal(identity.title, "Nutricionista");
  assert.deepEqual(Array.from(identity.registrations), ["CRN 3"]);
});

test("mantém os dados do autor Saulo sem atribuir a ele o perfil de outra pessoa", async () => {
  const identity = await identityFor("author-saulo");
  assert.equal(identity.userId, "author-saulo");
  assert.equal(identity.fullName, "Saulo");
  assert.equal(identity.title, "Profissional de Educação Física");
  assert.deepEqual(Array.from(identity.registrations), ["CREF 2", "CRN 1"]);
});
