import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeFiles = {
  login: new URL("../../app/api/auth/login/route.ts", import.meta.url),
  session: new URL("../../app/api/auth/session/route.ts", import.meta.url),
  logout: new URL("../../app/api/auth/logout/route.ts", import.meta.url),
} as const;

test("mantem os Route Handlers de autenticacao nos caminhos reconhecidos pelo App Router", async () => {
  const [loginRoute, sessionRoute, logoutRoute] = await Promise.all([
    readFile(routeFiles.login, "utf8"),
    readFile(routeFiles.session, "utf8"),
    readFile(routeFiles.logout, "utf8"),
  ]);

  assert.match(loginRoute, /export async function POST\s*\(/);
  assert.match(sessionRoute, /export async function GET\s*\(/);
  assert.match(logoutRoute, /export async function POST\s*\(/);
});

test("mantem os consumidores apontando para as rotas oficiais de autenticacao", async () => {
  const [loginPage, authenticatedShell, logoutPage] = await Promise.all([
    readFile(new URL("../../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../components/auth/authenticated-shell.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../app/(authenticated)/sair/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(loginPage, /fetch\("\/api\/auth\/login"/);
  assert.match(loginPage, /fetch\("\/api\/auth\/session"/);
  assert.match(authenticatedShell, /fetch\("\/api\/auth\/session"/);
  assert.match(logoutPage, /fetch\("\/api\/auth\/logout"/);
});

test("login verifica a credencial cadastrada sem reaplicar politica de criacao e registra apenas o desfecho seguro", async () => {
  const loginRoute = await readFile(routeFiles.login, "utf8");

  assert.match(loginRoute, /password:\s*z\s*\.string\(\)\s*\.min\(1\)\s*\.max\(128\)/u);
  assert.doesNotMatch(loginRoute, /\.regex\(\/\\p\{Ll\}/u);
  assert.doesNotMatch(loginRoute, /\.regex\(\/\\p\{Lu\}/u);
  assert.match(loginRoute, /IDENTITY_NOT_FOUND/u);
  assert.match(loginRoute, /CREDENTIAL_HASH_INVALID/u);
  assert.match(loginRoute, /PASSWORD_MISMATCH/u);
  assert.match(loginRoute, /TECHNICAL_ERROR/u);
  assert.match(loginRoute, /\[auth\.login\] outcome=\$\{outcome\}/u);
  assert.doesNotMatch(loginRoute, /console\.(?:info|error)\([^\n]*(?:parsedInput|password|credentialHash|providerSubject)/u);
});
