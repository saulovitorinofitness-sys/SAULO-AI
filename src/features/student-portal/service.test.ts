import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { StudentPortalContext } from "./contracts";
import {
  createStudentInvitationToken,
  studentInvitationTokenHash,
} from "./credentials";
import {
  assertStudentResourceOwnership,
  StudentPortalAccessError,
} from "./security";

const alunoA: StudentPortalContext = {
  userId: "usuario-aluno-a",
  patientId: "paciente-ficticio-a",
  masterRecordId: "prontuario-ficticio-a",
  patientName: "Aluno FictÃ­cio A",
  patientCode: "FICT-A",
};

const alunoB: StudentPortalContext = {
  userId: "usuario-aluno-b",
  patientId: "paciente-ficticio-b",
  masterRecordId: "prontuario-ficticio-b",
  patientName: "Aluno FictÃ­cio B",
  patientCode: "FICT-B",
};

test("vÃ­nculo da sessÃ£o aceita apenas o prontuÃ¡rio do prÃ³prio aluno", () => {
  assert.doesNotThrow(() =>
    assertStudentResourceOwnership(alunoA, alunoA.masterRecordId),
  );
  assert.doesNotThrow(() =>
    assertStudentResourceOwnership(alunoB, alunoB.masterRecordId),
  );

  assert.throws(
    () => assertStudentResourceOwnership(alunoA, alunoB.masterRecordId),
    (error) =>
      error instanceof StudentPortalAccessError && error.reason === "NOT_FOUND",
  );
  assert.throws(
    () => assertStudentResourceOwnership(alunoB, alunoA.masterRecordId),
    (error) =>
      error instanceof StudentPortalAccessError && error.reason === "NOT_FOUND",
  );
});

test("convites usam segredo aleatÃ³rio e somente o hash persistÃ­vel", () => {
  const tokenA = createStudentInvitationToken();
  const tokenB = createStudentInvitationToken();

  assert.notEqual(tokenA, tokenB);
  assert.notEqual(studentInvitationTokenHash(tokenA), tokenA);
  assert.equal(
    studentInvitationTokenHash(tokenA),
    studentInvitationTokenHash(tokenA),
  );
});

test("consultas do portal derivam o prontuÃ¡rio da sessÃ£o e ocultam rascunhos", async () => {
  const source = await readFile(new URL("./service.ts", import.meta.url), "utf8");

  assert.match(source, /async getDashboard\(\)/);
  assert.match(source, /requireStudentPortalContext\(\)/);
  assert.match(source, /masterRecordId: context\.masterRecordId/);
  assert.match(source, /status: "FINALIZED"/);
  assert.doesNotMatch(source, /async getDashboard\([^)]*patientId/);
});

test("recibo alterado na URL continua limitado ao prontuÃ¡rio da sessÃ£o", async () => {
  const source = await readFile(new URL("./service.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /payment: \{ charge: \{ masterRecordId: context\.masterRecordId \} \}/,
  );
  assert.match(source, /if \(!receipt\) throw new StudentPortalAccessError\("NOT_FOUND"\)/);
});

test("rotas da equipe desviam somente o perfil de aluno e preservam a equipe", async () => {
  const layout = await readFile(
    new URL("../../app/(authenticated)/layout.tsx", import.meta.url),
    "utf8",
  );
  const login = await readFile(
    new URL("../../app/api/auth/login/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(layout, /profileType === "STUDENT"/);
  assert.match(layout, /redirect\("\/portal"\)/);
  assert.match(
    login,
    /identity\.user\.profile\?\.type === "STUDENT" \? "\/portal" : "\/dashboard"/,
  );
});
