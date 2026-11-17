import assert from "node:assert/strict";
import test from "node:test";

import { BUILT_IN_IDS } from "@/modules/permissions";

import type { ServiceReceiptCandidate } from "./contracts";
import type { IssuerConfigurationView, SaveIssuerConfigurationInput } from "./issuer-configuration";
import type { IssuerConfigurationRepository } from "./issuer-configuration-repository";
import { createIssuerConfigurationService, IssuerConfigurationServiceError } from "./issuer-configuration-service";

const emptyAddress = { postalCode: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" };

function view(): IssuerConfigurationView {
  return {
    academy: { section: "ACADEMY", personType: "Pessoa jurídica", legalName: "", tradeName: "", cnpj: { configured: true, masked: "**.***.***/****-**" }, address: emptyAddress, active: true, status: "INCOMPLETE" },
    clinic: { section: "CLINIC", commercialName: "", internalCode: "CLINICA_SV", academyLinked: true, active: true, status: "INCOMPLETE" },
    saulo: { section: "SAULO", userId: BUILT_IN_IDS.users.sauloXavierVitorino, userLinked: true, fullName: "Saulo Xavier Vitorino", cpf: { configured: true, masked: "***.***.***-**" }, address: emptyAddress, active: true, registrations: [], status: "INCOMPLETE" },
    maria: { section: "MARIA", userId: BUILT_IN_IDS.users.mariaDeLourdesGomes, userLinked: true, fullName: "Maria de Lourdes Gomes", cpf: { configured: true, masked: "***.***.***-**" }, address: emptyAddress, active: true, registrations: [], status: "INCOMPLETE" },
  };
}

function repositoryDouble() {
  const saves: SaveIssuerConfigurationInput[] = [];
  const repository: IssuerConfigurationRepository = {
    async getConfiguration() { return view(); },
    async saveConfiguration(input) { saves.push(input); return view(); },
    async getIssuanceProfile() { return { status: "INCOMPLETE", legalProvider: null }; },
  };
  return { repository, saves };
}

test("somente Saulo consulta e altera a configuracao", async () => {
  const double = repositoryDouble();
  const service = createIssuerConfigurationService(double.repository);
  await assert.rejects(
    service.getConfiguration(BUILT_IN_IDS.users.mariaDeLourdesGomes),
    (error: unknown) => error instanceof IssuerConfigurationServiceError && error.code === "NOT_AUTHORIZED",
  );
  await service.getConfiguration(BUILT_IN_IDS.users.sauloXavierVitorino);
});

test("salva rascunhos das quatro secoes sem criar documentos automaticamente", async () => {
  const double = repositoryDouble();
  const service = createIssuerConfigurationService(double.repository);
  const actor = BUILT_IN_IDS.users.sauloXavierVitorino;
  await service.saveConfiguration({ section: "ACADEMY", legalName: "", tradeName: "", address: emptyAddress, active: true }, actor);
  await service.saveConfiguration({ section: "CLINIC", commercialName: "", internalCode: "CLINICA_SV", active: true }, actor);
  await service.saveConfiguration({ section: "SAULO", fullName: "Saulo Xavier Vitorino", address: emptyAddress, active: true }, actor);
  await service.saveConfiguration({ section: "MARIA", fullName: "Maria de Lourdes Gomes", address: emptyAddress, active: true }, actor);
  assert.deepEqual(double.saves.map((item) => item.section), ["ACADEMY", "CLINIC", "SAULO", "MARIA"]);
  assert.equal("crn" in double.saves[3]!, false);
});

test("consulta retorna somente mascaras e nunca campos internos de protecao", async () => {
  const service = createIssuerConfigurationService(repositoryDouble().repository);
  const result = await service.getConfiguration(BUILT_IN_IDS.users.sauloXavierVitorino);
  const serialized = JSON.stringify(result);
  assert.match(serialized, /\*\*\.\*\*\*\.\*\*\*\/\*\*\*\*-\*\*/u);
  assert.match(serialized, /\*\*\*\.\*\*\*\.\*\*\*-\*\*/u);
  assert.doesNotMatch(serialized, /taxIdEncrypted|registrationEncrypted|registrationHash/u);
});

test("emissor incompleto bloqueia emissao no servidor", async () => {
  const service = createIssuerConfigurationService(repositoryDouble().repository);
  await assert.rejects(
    service.enrichCandidate({ legalProvider: { key: "ACADEMIA_SAULO_FITNESS", providerType: "LEGAL_ENTITY" } } as ServiceReceiptCandidate),
    (error: unknown) => error instanceof IssuerConfigurationServiceError && error.code === "ISSUER_INCOMPLETE",
  );
});

test("Clinica SV incompleta bloqueia emissao de Nutricao", async () => {
  const double = repositoryDouble();
  const repository: IssuerConfigurationRepository = {
    ...double.repository,
    async getIssuanceProfile() {
      return { status: "COMPLETE", legalProvider: { key: "ACADEMIA_SAULO_FITNESS", providerType: "LEGAL_ENTITY" } };
    },
  };
  const service = createIssuerConfigurationService(repository);
  await assert.rejects(
    service.enrichCandidate({
      legalProvider: { key: "ACADEMIA_SAULO_FITNESS", providerType: "LEGAL_ENTITY" },
      items: [{ kind: "NUTRITION_CONSULTATION" }],
    } as ServiceReceiptCandidate),
    (error: unknown) => error instanceof IssuerConfigurationServiceError && error.code === "ISSUER_INCOMPLETE",
  );
});
