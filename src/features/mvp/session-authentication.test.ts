import assert from "node:assert/strict";
import test from "node:test";

import {
  requireActiveSession,
  requireSessionToken,
  SessionAuthenticationError,
  SESSION_COOKIE_NAME,
} from "./session-authentication";

const now = new Date("2026-09-25T12:00:00.000Z");
const valid = {
  expiresAt: new Date("2026-09-25T13:00:00.000Z"),
  revokedAt: null,
  user: { status: "ACTIVE", deletedAt: null },
};

test("usa exatamente o cookie emitido pelo login e rejeita sessão ausente", () => {
  assert.equal(SESSION_COOKIE_NAME, "saulo-ai-session");
  assert.throws(() => requireSessionToken(undefined), (error) => error instanceof SessionAuthenticationError && error.reason === "MISSING");
});

test("rejeita sessão expirada sem convertê-la em sessão válida", () => {
  assert.throws(() => requireActiveSession({ ...valid, expiresAt: now }, now), (error) => error instanceof SessionAuthenticationError && error.reason === "EXPIRED");
});

test("rejeita sessão inexistente, revogada, inativa ou de usuário excluído", () => {
  for (const session of [null, { ...valid, revokedAt: now }, { ...valid, user: { status: "INACTIVE", deletedAt: null } }, { ...valid, user: { status: "ACTIVE", deletedAt: now } }]) {
    assert.throws(() => requireActiveSession(session, now), (error) => error instanceof SessionAuthenticationError && error.reason === "INVALID");
  }
});

test("sessão válida continua liberada sem alteração", () => {
  assert.equal(requireSessionToken("  token-real  "), "token-real");
  assert.equal(requireActiveSession(valid, now), valid);
});
