import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loginPathFor, safeReturnTo } from "./authentication-navigation";

test("preserva rota interna pretendida no redirecionamento ao login", () => {
  assert.equal(loginPathFor("/gestao/folha-pagamento?competencia=2026-09"), "/?returnTo=%2Fgestao%2Ffolha-pagamento%3Fcompetencia%3D2026-09");
  assert.equal(safeReturnTo("/gestao/folha-pagamento?competencia=2026-09"), "/gestao/folha-pagamento?competencia=2026-09");
});

test("proteção de navegação usa o cookie real e encaminha a rota ao layout", async () => {
  const proxy = await readFile(new URL("../../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /request\.cookies\.get\(SESSION_COOKIE_NAME\)/);
  assert.match(proxy, /x-saulo-ai-return-to/);
  assert.match(proxy, /NextResponse\.redirect/);
});

test("impede retorno aberto para domínio externo ou caminho ambíguo", () => {
  assert.equal(safeReturnTo("https://evil.example/path"), null);
  assert.equal(safeReturnTo("//evil.example/path"), null);
  assert.equal(safeReturnTo("/\\evil.example"), null);
  assert.equal(loginPathFor("https://evil.example/path"), "/");
});

test("layout e API tratam ausência de sessão por redirecionamento ou 401, nunca como 500", async () => {
  const layout = await readFile(new URL("../../app/(authenticated)/layout.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/auth/session/route.ts", import.meta.url), "utf8");
  const payrollRoute = await readFile(new URL("../../app/api/gestao/folha-pagamento/route.ts", import.meta.url), "utf8");
  assert.match(layout, /isSessionAuthenticationError\(error\)/);
  assert.match(layout, /redirect\(loginPathFor/);
  assert.match(route, /isSessionAuthenticationError\(error\)/);
  assert.match(route, /status: 401/);
  assert.match(payrollRoute, /financialAuthenticationResponse\(error\)/);
  assert.match(payrollRoute, /SESSION_UNAVAILABLE/);
});
