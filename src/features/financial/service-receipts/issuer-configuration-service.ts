import { BUILT_IN_IDS } from "@/modules/permissions";

import type { ServiceReceiptCandidate, ServiceReceiptProviderKey } from "./contracts";
import {
  isValidCnpj,
  isValidCpf,
  isValidPostalCode,
  isValidRegistration,
  isValidState,
  type IssuerAddress,
  type RegistrationDraft,
  type SaveIssuerConfigurationInput,
} from "./issuer-configuration";
import {
  issuerConfigurationRepository,
  type IssuerConfigurationRepository,
} from "./issuer-configuration-repository";

export class IssuerConfigurationServiceError extends Error {
  constructor(readonly code: "NOT_AUTHORIZED" | "INVALID_INPUT" | "ISSUER_INCOMPLETE", message: string) {
    super(message);
    this.name = "IssuerConfigurationServiceError";
  }
}

function assertSaulo(actorUserId: string) {
  if (actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) {
    throw new IssuerConfigurationServiceError("NOT_AUTHORIZED", "Somente Saulo pode acessar a configuracao dos emissores.");
  }
}

function assertLength(value: string, maximum: number, field: string) {
  if (value.trim().length > maximum) {
    throw new IssuerConfigurationServiceError("INVALID_INPUT", `${field} excede o limite permitido.`);
  }
}

function validateAddress(address: IssuerAddress) {
  assertLength(address.street, 180, "Logradouro");
  assertLength(address.number, 30, "Numero");
  assertLength(address.complement, 120, "Complemento");
  assertLength(address.neighborhood, 120, "Bairro");
  assertLength(address.city, 120, "Cidade");
  if (address.postalCode.trim() && !isValidPostalCode(address.postalCode)) {
    throw new IssuerConfigurationServiceError("INVALID_INPUT", "CEP invalido.");
  }
  if (address.state.trim() && !isValidState(address.state)) {
    throw new IssuerConfigurationServiceError("INVALID_INPUT", "UF invalida.");
  }
}

function registrationHasData(registration: RegistrationDraft | undefined) {
  return Boolean(registration?.number?.trim() || registration?.category?.trim() || registration?.state?.trim());
}

function validateRegistration(registration: RegistrationDraft | undefined, council: "CRN" | "CREF") {
  if (registrationHasData(registration) && (!registration || !isValidRegistration(registration))) {
    throw new IssuerConfigurationServiceError("INVALID_INPUT", `${council} invalido.`);
  }
}

function validateInput(input: SaveIssuerConfigurationInput) {
  if (input.section === "ACADEMY") {
    assertLength(input.legalName, 180, "Razao social");
    assertLength(input.tradeName, 180, "Nome fantasia");
    if (input.cnpj && !isValidCnpj(input.cnpj)) {
      throw new IssuerConfigurationServiceError("INVALID_INPUT", "CNPJ invalido.");
    }
    validateAddress(input.address);
    return;
  }
  if (input.section === "CLINIC") {
    assertLength(input.commercialName, 180, "Nome comercial");
    if (input.internalCode !== "CLINICA_SV") {
      throw new IssuerConfigurationServiceError("INVALID_INPUT", "Codigo interno da Clinica SV invalido.");
    }
    return;
  }
  assertLength(input.fullName, 180, "Nome completo");
  if (input.cpf && !isValidCpf(input.cpf)) {
    throw new IssuerConfigurationServiceError("INVALID_INPUT", "CPF invalido.");
  }
  validateAddress(input.address);
  if (input.section === "SAULO") validateRegistration(input.crn, "CRN");
  validateRegistration(input.cref, "CREF");
}

export function createIssuerConfigurationService(repository: IssuerConfigurationRepository = issuerConfigurationRepository) {
  return {
    async getConfiguration(actorUserId: string) {
      assertSaulo(actorUserId);
      return repository.getConfiguration();
    },

    async saveConfiguration(input: SaveIssuerConfigurationInput, actorUserId: string) {
      assertSaulo(actorUserId);
      validateInput(input);
      return repository.saveConfiguration(input);
    },

    async enrichCandidate(candidate: ServiceReceiptCandidate): Promise<ServiceReceiptCandidate> {
      const profile = await repository.getIssuanceProfile(candidate.legalProvider.key);
      if (profile.status !== "COMPLETE" || !profile.legalProvider) {
        throw new IssuerConfigurationServiceError(
          "ISSUER_INCOMPLETE",
          "Complete e ative a configuracao do emissor antes de emitir o recibo.",
        );
      }
      const usesClinic = candidate.items.some((item) => item.kind.startsWith("NUTRITION_"));
      if (usesClinic) {
        const configuration = await repository.getConfiguration();
        if (configuration.clinic.status !== "COMPLETE") {
          throw new IssuerConfigurationServiceError(
            "ISSUER_INCOMPLETE",
            "Complete e ative a configuracao da Clinica SV antes de emitir o recibo.",
          );
        }
      }
      return { ...candidate, legalProvider: profile.legalProvider } as ServiceReceiptCandidate;
    },

    async assertIssuerReady(providerKey: ServiceReceiptProviderKey) {
      const profile = await repository.getIssuanceProfile(providerKey);
      if (profile.status !== "COMPLETE") {
        throw new IssuerConfigurationServiceError(
          "ISSUER_INCOMPLETE",
          "Complete e ative a configuracao do emissor antes de emitir o recibo.",
        );
      }
    },
  };
}

export const issuerConfigurationService = createIssuerConfigurationService();
