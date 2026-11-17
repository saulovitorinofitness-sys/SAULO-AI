import assert from "node:assert/strict";
import test from "node:test";

import type { FrontendAccessSnapshot } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

import type { IssuerConfigurationView } from "./issuer-configuration";
import { createIssuerConfigurationHttpHandlers } from "./issuer-configuration-http";

const address = { postalCode: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" };
const configuration: IssuerConfigurationView = {
  academy: { section: "ACADEMY", personType: "Pessoa jurídica", legalName: "", tradeName: "", cnpj: { configured: false, masked: null }, address, active: true, status: "INCOMPLETE" },
  clinic: { section: "CLINIC", commercialName: "", internalCode: "CLINICA_SV", academyLinked: false, active: false, status: "INACTIVE" },
  saulo: { section: "SAULO", userId: BUILT_IN_IDS.users.sauloXavierVitorino, userLinked: true, fullName: "Saulo Xavier Vitorino", cpf: { configured: false, masked: null }, address, active: true, registrations: [], status: "INCOMPLETE" },
  maria: { section: "MARIA", userId: BUILT_IN_IDS.users.mariaDeLourdesGomes, userLinked: true, fullName: "Maria de Lourdes Gomes", cpf: { configured: false, masked: null }, address, active: true, registrations: [], status: "INCOMPLETE" },
};

function access(userId: string): FrontendAccessSnapshot {
  return { user: { id: userId, fullName: "Usuário", status: "ACTIVE", roleName: "SYSTEM_OWNER" }, grantsAllModules: userId === BUILT_IN_IDS.users.sauloXavierVitorino, allowsNutritionModules: userId === BUILT_IN_IDS.users.sauloXavierVitorino, overrides: [] };
}

function handlers(userId: string) {
  const sections: string[] = [];
  const service = {
    async getConfiguration() { return configuration; },
    async saveConfiguration(input: { section: string }) { sections.push(input.section); return configuration; },
    async enrichCandidate<T>(candidate: T) { return candidate; },
    async assertIssuerReady() {},
  };
  return { sections, handlers: createIssuerConfigurationHttpHandlers({ resolveAccess: async () => access(userId), service: service as never }) };
}

test("endpoint rejeita ausencia de sessao e acesso de Maria", async () => {
  const unauthenticated = createIssuerConfigurationHttpHandlers({ resolveAccess: async () => { throw new Error("session"); } });
  assert.equal((await unauthenticated.get(new Request("http://localhost"))).status, 401);
  const maria = handlers(BUILT_IN_IDS.users.mariaDeLourdesGomes).handlers;
  assert.equal((await maria.get(new Request("http://localhost"))).status, 403);
  assert.equal((await maria.put(new Request("http://localhost", { method: "PUT", body: "{}" }))).status, 403);
});

test("Saulo consulta e salva cada secao por endpoint autenticado", async () => {
  const context = handlers(BUILT_IN_IDS.users.sauloXavierVitorino);
  const getResponse = await context.handlers.get(new Request("http://localhost"));
  assert.equal(getResponse.status, 200);
  const payloads = [
    { section: "ACADEMY", legalName: "", tradeName: "", address, active: true },
    { section: "CLINIC", commercialName: "", internalCode: "CLINICA_SV", active: true },
    { section: "SAULO", fullName: "Saulo Xavier Vitorino", address, active: true },
    { section: "MARIA", fullName: "Maria de Lourdes Gomes", address, active: true },
  ];
  for (const payload of payloads) {
    const response = await context.handlers.put(new Request("http://localhost", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
    assert.equal(response.status, 200);
  }
  assert.deepEqual(context.sections, ["ACADEMY", "CLINIC", "SAULO", "MARIA"]);
});

test("resposta administrativa nao expoe campos privados", async () => {
  const response = await handlers(BUILT_IN_IDS.users.sauloXavierVitorino).handlers.get(new Request("http://localhost"));
  const body = await response.text();
  assert.doesNotMatch(body, /taxIdEncrypted|registrationEncrypted|registrationHash|proof/u);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
});
