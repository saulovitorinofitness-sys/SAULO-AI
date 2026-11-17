import type {
  AcademyLegalProfile,
  ClinicCommercialIdentity,
  MariaLegalProfile,
  SauloLegalProfile,
  ServiceReceiptCandidate,
  ServiceReceiptCustomerIdentity,
  ServiceReceiptLegalProvider,
  ServiceReceiptProviderKey,
} from "./contracts";
import {
  areExecutorsAllowedForService,
  calculateServiceReceiptPaymentState,
  canPerformServiceReceiptAction,
  isCommercialUnitAllowed,
  isProviderAllowedForService,
  serviceReceiptMoneyToCents,
} from "./domain-rules";

export type ServiceReceiptValidationCode =
  | "LEGAL_PROFILE_INCOMPLETE"
  | "LEGAL_TAX_IDENTIFIER_INVALID"
  | "CLINIC_IDENTITY_INCOMPLETE"
  | "CUSTOMER_MASTER_RECORD_MISMATCH"
  | "CUSTOMER_CPF_REQUIRED_OR_INVALID"
  | "EMPTY_SERVICE_ITEMS"
  | "MIXED_LEGAL_PROVIDERS"
  | "SALE_PROVIDER_MISMATCH"
  | "PAYMENT_RECEIVER_MISMATCH"
  | "PROVIDER_SERVICE_NOT_ALLOWED"
  | "COMMERCIAL_UNIT_NOT_ALLOWED"
  | "EXECUTOR_NOT_ALLOWED"
  | "DUPLICATE_SERVICE_REFERENCE"
  | "INVALID_ITEM_AMOUNT"
  | "SUBTOTAL_MISMATCH"
  | "INVALID_PAYMENT"
  | "UNKNOWN_ALLOCATION"
  | "DUPLICATE_ALLOCATION"
  | "TRANSACTION_REFERENCE_TOO_LONG"
  | "INVALID_NUMBERING"
  | "NUMBERING_PROVIDER_MISMATCH"
  | "RECEIPT_NUMBER_ALREADY_USED"
  | "INVALID_SIGNATURE"
  | "SIGNATURE_PROVIDER_MISMATCH"
  | "OPERATOR_NOT_AUTHORIZED";

export interface ServiceReceiptValidationIssue {
  readonly code: ServiceReceiptValidationCode;
  readonly message: string;
}

export interface ServiceReceiptValidationContext {
  readonly customerIdentity: ServiceReceiptCustomerIdentity | null;
  readonly numbering: {
    readonly seriesProviderKey: ServiceReceiptProviderKey;
    readonly sequencePreviouslyUsed: boolean;
  };
}

function digits(value?: string): string {
  return value?.replace(/\D/gu, "") ?? "";
}

function present(value?: string): boolean {
  return Boolean(value?.trim());
}

function validCpf(value?: string): boolean {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    const sum = Array.from(cpf.slice(0, length)).reduce(
      (total, character, index) => total + Number(character) * (length + 1 - index),
      0,
    );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function validCnpj(value?: string): boolean {
  const cnpj = digits(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const check = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce(
      (total, weight, index) => total + Number(cnpj[index]) * weight,
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}

function hasAddress(provider: ServiceReceiptLegalProvider): boolean {
  return present(provider.address?.formattedAddress);
}

function academyProfileComplete(provider: AcademyLegalProfile): boolean {
  return provider.taxIdType === "CNPJ"
    && present(provider.legalName)
    && present(provider.tradeName)
    && hasAddress(provider);
}

function sauloProfileComplete(provider: SauloLegalProfile): boolean {
  return provider.taxIdType === "CPF"
    && present(provider.fullName)
    && present(provider.address?.formattedAddress)
    && present(provider.crn)
    && present(provider.cref);
}

function mariaProfileComplete(provider: MariaLegalProfile): boolean {
  return provider.taxIdType === "CPF"
    && present(provider.fullName)
    && present(provider.address?.formattedAddress)
    && present(provider.cref);
}

function legalProfileComplete(provider: ServiceReceiptLegalProvider): boolean {
  if (provider.key === "ACADEMIA_SAULO_FITNESS") {
    return academyProfileComplete(provider) && present(provider.cnpj);
  }
  if (provider.key === "SAULO_XAVIER_VITORINO") {
    return sauloProfileComplete(provider) && present(provider.cpf);
  }
  return mariaProfileComplete(provider) && present(provider.cpf);
}

function legalTaxIdentifierValid(provider: ServiceReceiptLegalProvider): boolean {
  return provider.key === "ACADEMIA_SAULO_FITNESS"
    ? validCnpj(provider.cnpj)
    : validCpf(provider.cpf);
}

function clinicIdentityComplete(
  identity?: ClinicCommercialIdentity,
): boolean {
  return identity?.unit === "CLINICA_SV"
    && present(identity.commercialName)
    && identity.legalProviderKey === "ACADEMIA_SAULO_FITNESS";
}

function pushIssue(
  issues: ServiceReceiptValidationIssue[],
  code: ServiceReceiptValidationCode,
  message: string,
) {
  issues.push({ code, message });
}

export function validateServiceReceiptCandidate(
  candidate: ServiceReceiptCandidate,
  context: ServiceReceiptValidationContext,
): readonly ServiceReceiptValidationIssue[] {
  const issues: ServiceReceiptValidationIssue[] = [];

  if (!legalProfileComplete(candidate.legalProvider)) {
    pushIssue(
      issues,
      "LEGAL_PROFILE_INCOMPLETE",
      "Complete todos os dados obrigatórios do prestador legal antes da emissão.",
    );
  } else if (!legalTaxIdentifierValid(candidate.legalProvider)) {
    pushIssue(
      issues,
      "LEGAL_TAX_IDENTIFIER_INVALID",
      "O CPF ou CNPJ do prestador legal é inválido.",
    );
  }

  if (
    context.customerIdentity?.masterRecordId !== candidate.customerMasterRecordId
  ) {
    pushIssue(
      issues,
      "CUSTOMER_MASTER_RECORD_MISMATCH",
      "O cliente deve ser obtido do mesmo cadastro mestre informado no recibo.",
    );
  } else if (!validCpf(context.customerIdentity.cpf)) {
    pushIssue(
      issues,
      "CUSTOMER_CPF_REQUIRED_OR_INVALID",
      "O CPF do cliente é obrigatório e deve ser válido para a emissão formal.",
    );
  }

  if (candidate.items.length === 0) {
    pushIssue(issues, "EMPTY_SERVICE_ITEMS", "Inclua ao menos um serviço no recibo.");
  }

  const serviceReferences = new Set<string>();
  let itemSubtotal = BigInt(0);
  for (const item of candidate.items) {
    if (serviceReferences.has(item.serviceReferenceId)) {
      pushIssue(
        issues,
        "DUPLICATE_SERVICE_REFERENCE",
        "Cada serviço pode aparecer somente uma vez no recibo.",
      );
    }
    serviceReferences.add(item.serviceReferenceId);

    if (item.legalProviderKey !== candidate.legalProvider.key) {
      pushIssue(
        issues,
        "MIXED_LEGAL_PROVIDERS",
        "Serviços de prestadores legais diferentes exigem recibos separados.",
      );
    }
    if (item.soldByProviderKey !== candidate.legalProvider.key) {
      pushIssue(
        issues,
        "SALE_PROVIDER_MISMATCH",
        "O prestador legal deve ser quem vendeu o serviço registrado.",
      );
    }
    if (!isProviderAllowedForService(item.legalProviderKey, item.kind)) {
      pushIssue(
        issues,
        "PROVIDER_SERVICE_NOT_ALLOWED",
        "O prestador informado não pode emitir este serviço diretamente.",
      );
    }
    if (!isCommercialUnitAllowed(
      item.legalProviderKey,
      item.kind,
      item.commercialUnit?.unit,
    )) {
      pushIssue(
        issues,
        "COMMERCIAL_UNIT_NOT_ALLOWED",
        "A unidade comercial informada não corresponde ao serviço.",
      );
    }
    if (item.kind.startsWith("NUTRITION_") && !clinicIdentityComplete(item.commercialUnit)) {
      pushIssue(
        issues,
        "CLINIC_IDENTITY_INCOMPLETE",
        "A Clínica SV deve estar identificada e vinculada ao CNPJ da Academia.",
      );
    }
    if (!areExecutorsAllowedForService(item)) {
      pushIssue(
        issues,
        "EXECUTOR_NOT_ALLOWED",
        "Os executores, registros e atividades realizadas devem corresponder ao serviço.",
      );
    }

    try {
      const amount = serviceReceiptMoneyToCents(item.grossAmount);
      if (amount === BigInt(0)) throw new Error("ZERO_ITEM_AMOUNT");
      itemSubtotal += amount;
    } catch {
      pushIssue(
        issues,
        "INVALID_ITEM_AMOUNT",
        "O valor bruto de cada serviço deve ser positivo e ter duas casas decimais.",
      );
    }
  }

  try {
    if (itemSubtotal !== serviceReceiptMoneyToCents(candidate.totals.subtotal)) {
      pushIssue(
        issues,
        "SUBTOTAL_MISMATCH",
        "O subtotal deve corresponder à soma dos serviços.",
      );
    }
  } catch {
    pushIssue(
      issues,
      "SUBTOTAL_MISMATCH",
      "O subtotal deve ter duas casas decimais.",
    );
  }

  if (candidate.payment.receivedByProviderKey !== candidate.legalProvider.key) {
    pushIssue(
      issues,
      "PAYMENT_RECEIVER_MISMATCH",
      "O prestador legal deve ser quem recebeu o pagamento registrado.",
    );
  }

  const allocationReferences = new Set<string>();
  for (const allocation of candidate.payment.allocations) {
    if (!serviceReferences.has(allocation.serviceReferenceId)) {
      pushIssue(
        issues,
        "UNKNOWN_ALLOCATION",
        "Todo valor distribuído deve apontar para um serviço do recibo.",
      );
    }
    if (allocationReferences.has(allocation.serviceReferenceId)) {
      pushIssue(
        issues,
        "DUPLICATE_ALLOCATION",
        "Cada serviço deve possuir uma única parcela do pagamento.",
      );
    }
    allocationReferences.add(allocation.serviceReferenceId);
  }

  try {
    calculateServiceReceiptPaymentState(candidate.totals, candidate.payment);
  } catch {
    pushIssue(
      issues,
      "INVALID_PAYMENT",
      "Valores, saldo e distribuição do pagamento devem fechar exatamente.",
    );
  }

  if ((candidate.payment.transactionReference?.trim().length ?? 0) > 120) {
    pushIssue(
      issues,
      "TRANSACTION_REFERENCE_TOO_LONG",
      "A referência da transação deve ser curta.",
    );
  }

  if (!candidate.numbering.series.trim() || candidate.numbering.sequence < 1) {
    pushIssue(
      issues,
      "INVALID_NUMBERING",
      "A série é obrigatória e a sequência deve ser positiva.",
    );
  }
  if (context.numbering.seriesProviderKey !== candidate.legalProvider.key) {
    pushIssue(
      issues,
      "NUMBERING_PROVIDER_MISMATCH",
      "A série deve pertencer ao prestador legal do recibo.",
    );
  }
  if (context.numbering.sequencePreviouslyUsed) {
    pushIssue(
      issues,
      "RECEIPT_NUMBER_ALREADY_USED",
      "Uma numeração já utilizada nunca pode ser reutilizada.",
    );
  }

  if (
    !candidate.signature.includeManualSignatureSpace
    || (
      candidate.signature.mode === "ELECTRONIC"
      && !present(candidate.signature.electronicSignatureReference)
    )
  ) {
    pushIssue(
      issues,
      "INVALID_SIGNATURE",
      "O recibo deve reservar assinatura manual e identificar a assinatura eletrônica quando usada.",
    );
  }
  if (candidate.signature.signingProviderKey !== candidate.legalProvider.key) {
    pushIssue(
      issues,
      "SIGNATURE_PROVIDER_MISMATCH",
      "A assinatura deve pertencer ao prestador legal emissor.",
    );
  }

  if (!canPerformServiceReceiptAction(candidate.operatorUserId, "ISSUE", {
    legalProviderKey: candidate.legalProvider.key,
    serviceKinds: candidate.items.map((item) => item.kind),
    executorUserIds: candidate.items.flatMap((item) =>
      item.executors.map((executor) => executor.userId),
    ),
    activeProfessionalCouncils: candidate.items.flatMap((item) =>
      item.executors
        .filter((executor) =>
          executor.userId === candidate.operatorUserId
          && executor.professionalRegistrationStatus === "ACTIVE",
        )
        .map((executor) => executor.professionalRegistration),
    ),
  })) {
    pushIssue(
      issues,
      "OPERATOR_NOT_AUTHORIZED",
      "O operador não possui permissão para emitir este recibo.",
    );
  }

  return issues;
}
