import assert from "node:assert/strict";
import test from "node:test";

import { BUILT_IN_IDS } from "@/modules/permissions";

import type {
  ServiceReceiptCandidate,
} from "./contracts";
import {
  type ServiceReceiptValidationContext,
  validateServiceReceiptCandidate,
} from "./validation";

function testOnlyCpf(base: string): string {
  const digits = [...base].map(Number);
  for (const length of [9, 10]) {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    digits.push(remainder === 10 ? 0 : remainder);
  }
  return digits.join("");
}

function validCandidate(): ServiceReceiptCandidate {
  return {
    legalProvider: {
      key: "SAULO_XAVIER_VITORINO",
      providerType: "INDIVIDUAL",
      taxIdType: "CPF",
      fullName: "Saulo Xavier Vitorino",
      cpf: testOnlyCpf("123456789"),
      address: { formattedAddress: "ENDERECO_EXCLUSIVO_DE_TESTE_NAO_PERSISTIDO" },
      crn: "REGISTRO_CRN_EXCLUSIVO_DE_TESTE",
      cref: "REGISTRO_CREF_EXCLUSIVO_DE_TESTE",
    },
    customerMasterRecordId: "master-record-test-reference",
    items: [{
      serviceReferenceId: "service-test-reference",
      kind: "PERSONAL_TRAINING",
      soldByProviderKey: "SAULO_XAVIER_VITORINO",
      legalProviderKey: "SAULO_XAVIER_VITORINO",
      executors: [{
        userId: BUILT_IN_IDS.users.sauloXavierVitorino,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Atividade exclusiva de teste",
      }],
      grossAmount: "100.00",
    }],
    totals: {
      subtotal: "100.00",
      discount: "0.00",
      surcharge: "0.00",
      amountDue: "100.00",
    },
    payment: {
      method: "PIX",
      receivedByProviderKey: "SAULO_XAVIER_VITORINO",
      receivedAmount: "40.00",
      previouslyReceivedAmount: "0.00",
      transactionReference: "TEST_ONLY_REFERENCE",
      allocations: [{
        serviceReferenceId: "service-test-reference",
        amount: "40.00",
      }],
    },
    numbering: { series: "TEST_ONLY_SERIES", sequence: 1 },
    signature: {
      mode: "ELECTRONIC",
      signingProviderKey: "SAULO_XAVIER_VITORINO",
      electronicSignatureReference: "test-only-signature-reference",
      includeManualSignatureSpace: true,
    },
    privacy: { customerCpfOnDocument: "MASKED" },
    operatorUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
  };
}

function validContext(): ServiceReceiptValidationContext {
  return {
    customerIdentity: {
      masterRecordId: "master-record-test-reference",
      cpf: testOnlyCpf("987654321"),
    },
    numbering: {
      seriesProviderKey: "SAULO_XAVIER_VITORINO",
      sequencePreviouslyUsed: false,
    },
  };
}

function codes(
  candidate: ServiceReceiptCandidate,
  context: ServiceReceiptValidationContext = validContext(),
) {
  return validateServiceReceiptCandidate(candidate, context).map((issue) => issue.code);
}

test("candidato completo e coerente fica apto para a futura camada de emissão", () => {
  assert.deepEqual(validateServiceReceiptCandidate(validCandidate(), validContext()), []);
});

test("dados legais ausentes bloqueiam sem preencher valores automaticamente", () => {
  const candidate: ServiceReceiptCandidate = {
    ...validCandidate(),
    legalProvider: {
      key: "SAULO_XAVIER_VITORINO",
      providerType: "INDIVIDUAL",
    },
  };

  assert.ok(codes(candidate).includes("LEGAL_PROFILE_INCOMPLETE"));
});

test("cliente deve vir do mesmo MasterRecord e possuir CPF válido", () => {
  const candidate = validCandidate();

  assert.ok(codes(candidate, {
    ...validContext(),
    customerIdentity: {
      masterRecordId: "different-master-record-test-reference",
      cpf: testOnlyCpf("987654321"),
    },
  }).includes("CUSTOMER_MASTER_RECORD_MISMATCH"));

  assert.ok(codes(candidate, {
    ...validContext(),
    customerIdentity: {
      masterRecordId: candidate.customerMasterRecordId,
    },
  }).includes("CUSTOMER_CPF_REQUIRED_OR_INVALID"));
});

test("um recibo não mistura valores de prestadores legais diferentes", () => {
  const base = validCandidate();
  const candidate: ServiceReceiptCandidate = {
    ...base,
    items: [{
      ...base.items[0],
      legalProviderKey: "MARIA_DE_LOURDES_GOMES",
      kind: "POSTURAL_ASSESSMENT",
      executors: [{
        userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Avaliação exclusiva de teste",
      }],
    }],
  };

  assert.ok(codes(candidate).includes("MIXED_LEGAL_PROVIDERS"));
});

test("sequência usada anteriormente é bloqueada e nunca pode ser reutilizada", () => {
  assert.ok(codes(validCandidate(), {
    ...validContext(),
    numbering: {
      seriesProviderKey: "SAULO_XAVIER_VITORINO",
      sequencePreviouslyUsed: true,
    },
  }).includes("RECEIPT_NUMBER_ALREADY_USED"));
});

test("prestador deve coincidir com quem vendeu e recebeu", () => {
  const base = validCandidate();
  const candidate: ServiceReceiptCandidate = {
    ...base,
    items: [{
      ...base.items[0],
      soldByProviderKey: "ACADEMIA_SAULO_FITNESS",
    }],
    payment: {
      ...base.payment,
      receivedByProviderKey: "ACADEMIA_SAULO_FITNESS",
    },
  };

  const result = codes(candidate);
  assert.ok(result.includes("SALE_PROVIDER_MISMATCH"));
  assert.ok(result.includes("PAYMENT_RECEIVER_MISMATCH"));
});

test("operador não se torna prestador ou executor automaticamente", () => {
  const candidate: ServiceReceiptCandidate = {
    ...validCandidate(),
    operatorUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
  };

  assert.ok(codes(candidate).includes("OPERATOR_NOT_AUTHORIZED"));
  assert.equal(candidate.legalProvider.key, "SAULO_XAVIER_VITORINO");
  assert.equal(
    candidate.items[0].executors[0]?.userId,
    BUILT_IN_IDS.users.sauloXavierVitorino,
  );
});

test("Nutrição exige Academia como prestadora, Clínica SV vinculada e Saulo com CRN", () => {
  const base = validCandidate();
  const candidate: ServiceReceiptCandidate = {
    ...base,
    legalProvider: {
      key: "ACADEMIA_SAULO_FITNESS",
      providerType: "LEGAL_ENTITY",
      taxIdType: "CNPJ",
      legalName: "RAZAO_SOCIAL_EXCLUSIVA_DE_TESTE",
      tradeName: "Academia Saulo Fitness",
      cnpj: "11222333000181",
      address: { formattedAddress: "ENDERECO_EXCLUSIVO_DE_TESTE_NAO_PERSISTIDO" },
    },
    items: [{
      ...base.items[0],
      kind: "NUTRITION_CONSULTATION",
      soldByProviderKey: "ACADEMIA_SAULO_FITNESS",
      legalProviderKey: "ACADEMIA_SAULO_FITNESS",
      commercialUnit: {
        unit: "CLINICA_SV",
        commercialName: "Clínica SV",
        legalProviderKey: "ACADEMIA_SAULO_FITNESS",
      },
      executors: [{
        userId: BUILT_IN_IDS.users.sauloXavierVitorino,
        professionalRegistration: "CRN",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Consulta nutricional exclusiva de teste",
      }],
    }],
    payment: {
      ...base.payment,
      receivedByProviderKey: "ACADEMIA_SAULO_FITNESS",
    },
    signature: {
      ...base.signature,
      signingProviderKey: "ACADEMIA_SAULO_FITNESS",
    },
  };

  assert.deepEqual(validateServiceReceiptCandidate(candidate, {
    ...validContext(),
    numbering: {
      seriesProviderKey: "ACADEMIA_SAULO_FITNESS",
      sequencePreviouslyUsed: false,
    },
  }), []);
});

test("pacote no mesmo CNPJ pode combinar item da Clínica e item da Academia", () => {
  const base = validCandidate();
  const candidate: ServiceReceiptCandidate = {
    ...base,
    legalProvider: {
      key: "ACADEMIA_SAULO_FITNESS",
      providerType: "LEGAL_ENTITY",
      taxIdType: "CNPJ",
      legalName: "RAZAO_SOCIAL_EXCLUSIVA_DE_TESTE",
      tradeName: "Academia Saulo Fitness",
      cnpj: "11222333000181",
      address: { formattedAddress: "ENDERECO_EXCLUSIVO_DE_TESTE_NAO_PERSISTIDO" },
    },
    items: [
      {
        serviceReferenceId: "nutrition-service-test-reference",
        kind: "NUTRITION_PLAN",
        soldByProviderKey: "ACADEMIA_SAULO_FITNESS",
        legalProviderKey: "ACADEMIA_SAULO_FITNESS",
        commercialUnit: {
          unit: "CLINICA_SV",
          commercialName: "Clínica SV",
          legalProviderKey: "ACADEMIA_SAULO_FITNESS",
        },
        executors: [{
          userId: BUILT_IN_IDS.users.sauloXavierVitorino,
          professionalRegistration: "CRN",
          professionalRegistrationStatus: "ACTIVE",
          performedActivity: "Plano nutricional exclusivo de teste",
        }],
        grossAmount: "60.00",
      },
      {
        serviceReferenceId: "academy-service-test-reference",
        kind: "ACADEMY_MEMBERSHIP",
        soldByProviderKey: "ACADEMIA_SAULO_FITNESS",
        legalProviderKey: "ACADEMIA_SAULO_FITNESS",
        commercialUnit: {
          unit: "ACADEMIA_SAULO_FITNESS",
          commercialName: "Academia Saulo Fitness",
          legalProviderKey: "ACADEMIA_SAULO_FITNESS",
        },
        executors: [],
        grossAmount: "40.00",
      },
    ],
    payment: {
      ...base.payment,
      receivedByProviderKey: "ACADEMIA_SAULO_FITNESS",
      allocations: [
        { serviceReferenceId: "nutrition-service-test-reference", amount: "20.00" },
        { serviceReferenceId: "academy-service-test-reference", amount: "20.00" },
      ],
    },
    signature: {
      ...base.signature,
      signingProviderKey: "ACADEMIA_SAULO_FITNESS",
    },
  };

  assert.deepEqual(validateServiceReceiptCandidate(candidate, {
    ...validContext(),
    numbering: {
      seriesProviderKey: "ACADEMIA_SAULO_FITNESS",
      sequencePreviouslyUsed: false,
    },
  }), []);
});

test("Maria pode emitir serviço físico em que participa junto com Saulo", () => {
  const base = validCandidate();
  const candidate: ServiceReceiptCandidate = {
    ...base,
    items: [{
      ...base.items[0],
      kind: "RUNNING_PLAN",
      executors: [
        {
          userId: BUILT_IN_IDS.users.sauloXavierVitorino,
          professionalRegistration: "CREF",
          professionalRegistrationStatus: "ACTIVE",
          performedActivity: "Planejamento exclusivo de teste",
        },
        {
          userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
          professionalRegistration: "CREF",
          professionalRegistrationStatus: "ACTIVE",
          performedActivity: "Acompanhamento exclusivo de teste",
        },
      ],
    }],
    operatorUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
  };

  assert.deepEqual(validateServiceReceiptCandidate(candidate, validContext()), []);
});

test("Maria com CREF pode receber sem vínculo obrigatório de Employee", () => {
  const base = validCandidate();
  const candidate: ServiceReceiptCandidate = {
    ...base,
    legalProvider: {
      key: "MARIA_DE_LOURDES_GOMES",
      providerType: "INDIVIDUAL",
      taxIdType: "CPF",
      fullName: "Maria de Lourdes Gomes",
      cpf: testOnlyCpf("234567890"),
      address: { formattedAddress: "ENDERECO_EXCLUSIVO_DE_TESTE_NAO_PERSISTIDO" },
      cref: "REGISTRO_CREF_EXCLUSIVO_DE_TESTE",
    },
    items: [{
      ...base.items[0],
      kind: "PERSONAL_TRAINING",
      soldByProviderKey: "MARIA_DE_LOURDES_GOMES",
      legalProviderKey: "MARIA_DE_LOURDES_GOMES",
      executors: [{
        userId: BUILT_IN_IDS.users.sauloXavierVitorino,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Execução exclusiva de teste",
      }],
    }],
    payment: {
      ...base.payment,
      receivedByProviderKey: "MARIA_DE_LOURDES_GOMES",
    },
    signature: {
      ...base.signature,
      signingProviderKey: "MARIA_DE_LOURDES_GOMES",
    },
    operatorUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
  };

  assert.deepEqual(validateServiceReceiptCandidate(candidate, {
    ...validContext(),
    numbering: {
      seriesProviderKey: "MARIA_DE_LOURDES_GOMES",
      sequencePreviouslyUsed: false,
    },
  }), []);
  assert.equal("employeeId" in candidate.legalProvider, false);
});

test("unidade comercial incompatível com prestador pessoa física é rejeitada", () => {
  const base = validCandidate();
  const candidate: ServiceReceiptCandidate = {
    ...base,
    items: [{
      ...base.items[0],
      commercialUnit: {
        unit: "CLINICA_SV",
        commercialName: "Clínica SV",
        legalProviderKey: "ACADEMIA_SAULO_FITNESS",
      },
    }],
  };

  assert.ok(codes(candidate).includes("COMMERCIAL_UNIT_NOT_ALLOWED"));
});

test("Maria não pode participar como executora de Nutrição", () => {
  const base = validCandidate();
  const nutritionItem = {
    ...base.items[0],
    kind: "NUTRITION_STRATEGY" as const,
    soldByProviderKey: "ACADEMIA_SAULO_FITNESS" as const,
    legalProviderKey: "ACADEMIA_SAULO_FITNESS" as const,
    commercialUnit: {
      unit: "CLINICA_SV" as const,
      commercialName: "Clínica SV",
      legalProviderKey: "ACADEMIA_SAULO_FITNESS" as const,
    },
    executors: [
      {
        userId: BUILT_IN_IDS.users.sauloXavierVitorino,
        professionalRegistration: "CRN" as const,
        professionalRegistrationStatus: "ACTIVE" as const,
        performedActivity: "Estratégia nutricional exclusiva de teste",
      },
      {
        userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
        professionalRegistration: "CREF" as const,
        professionalRegistrationStatus: "ACTIVE" as const,
        performedActivity: "Participação não permitida em Nutrição",
      },
    ],
  };
  const candidate: ServiceReceiptCandidate = {
    ...base,
    legalProvider: {
      key: "ACADEMIA_SAULO_FITNESS",
      providerType: "LEGAL_ENTITY",
      taxIdType: "CNPJ",
      legalName: "RAZAO_SOCIAL_EXCLUSIVA_DE_TESTE",
      tradeName: "Academia Saulo Fitness",
      cnpj: "11222333000181",
      address: { formattedAddress: "ENDERECO_EXCLUSIVO_DE_TESTE_NAO_PERSISTIDO" },
    },
    items: [nutritionItem],
    payment: {
      ...base.payment,
      receivedByProviderKey: "ACADEMIA_SAULO_FITNESS",
    },
    signature: {
      ...base.signature,
      signingProviderKey: "ACADEMIA_SAULO_FITNESS",
    },
  };

  assert.ok(codes(candidate, {
    ...validContext(),
    numbering: {
      seriesProviderKey: "ACADEMIA_SAULO_FITNESS",
      sequencePreviouslyUsed: false,
    },
  }).includes("EXECUTOR_NOT_ALLOWED"));
});
