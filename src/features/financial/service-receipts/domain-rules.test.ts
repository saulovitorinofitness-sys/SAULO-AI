import assert from "node:assert/strict";
import test from "node:test";

import { BUILT_IN_IDS } from "@/modules/permissions";

import type { ServiceReceiptItemCandidate } from "./contracts";
import {
  areExecutorsAllowedForService,
  calculateServiceReceiptPaymentState,
  canPerformServiceReceiptAction,
  customerCpfForCommonScreen,
  customerCpfForDocument,
  groupServiceItemsByLegalProvider,
  isProviderAllowedForService,
  isValidReceiptStatusTransition,
  serviceReceiptDeclaredAmount,
} from "./domain-rules";
import { SERVICE_RECEIPT_HISTORY_POLICY } from "./lifecycle";

function item(
  overrides: Partial<ServiceReceiptItemCandidate> = {},
): ServiceReceiptItemCandidate {
  return {
    serviceReferenceId: "test-service-reference",
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
    ...overrides,
  };
}

test("o prestador legal é explícito e não é deduzido somente pelo serviço", () => {
  assert.equal(
    isProviderAllowedForService("ACADEMIA_SAULO_FITNESS", "PERSONAL_TRAINING"),
    true,
  );
  assert.equal(
    isProviderAllowedForService("SAULO_XAVIER_VITORINO", "PERSONAL_TRAINING"),
    true,
  );
  assert.equal(
    isProviderAllowedForService("SAULO_XAVIER_VITORINO", "NUTRITION_CONSULTATION"),
    false,
  );
  assert.equal(
    isProviderAllowedForService("MARIA_DE_LOURDES_GOMES", "POSTURAL_ASSESSMENT"),
    true,
  );
  assert.equal(
    isProviderAllowedForService("MARIA_DE_LOURDES_GOMES", "RUNNING_PLAN"),
    true,
  );
  assert.equal(
    isProviderAllowedForService("MARIA_DE_LOURDES_GOMES", "PERSONAL_TRAINING"),
    true,
  );
  assert.equal(
    isProviderAllowedForService("MARIA_DE_LOURDES_GOMES", "CYCLING_PLAN"),
    true,
  );
  assert.equal(
    isProviderAllowedForService("MARIA_DE_LOURDES_GOMES", "PHYSICAL_FOLLOW_UP"),
    true,
  );
});

test("pacote é agrupado em um recibo por prestador legal", () => {
  const grouped = groupServiceItemsByLegalProvider([
    item(),
    item({
      serviceReferenceId: "second-test-service-reference",
      kind: "RUNNING_PLAN",
    }),
    item({
      serviceReferenceId: "third-test-service-reference",
      kind: "POSTURAL_ASSESSMENT",
      legalProviderKey: "MARIA_DE_LOURDES_GOMES",
      executors: [{
        userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Atividade exclusiva de teste",
      }],
    }),
  ]);

  assert.equal(grouped.size, 2);
  assert.equal(grouped.get("SAULO_XAVIER_VITORINO")?.length, 2);
  assert.equal(grouped.get("MARIA_DE_LOURDES_GOMES")?.length, 1);
});

test("nutrição exige somente Saulo com CRN e Educação Física aceita atuação conjunta", () => {
  assert.equal(areExecutorsAllowedForService(item({
    kind: "NUTRITION_CONSULTATION",
    legalProviderKey: "ACADEMIA_SAULO_FITNESS",
    executors: [{
      userId: BUILT_IN_IDS.users.sauloXavierVitorino,
      professionalRegistration: "CRN",
      professionalRegistrationStatus: "ACTIVE",
      performedActivity: "Consulta nutricional exclusiva de teste",
    }],
  })), true);
  assert.equal(areExecutorsAllowedForService(item({
    kind: "NUTRITION_CONSULTATION",
    legalProviderKey: "ACADEMIA_SAULO_FITNESS",
    executors: [
      {
        userId: BUILT_IN_IDS.users.sauloXavierVitorino,
        professionalRegistration: "CRN",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Consulta nutricional exclusiva de teste",
      },
      {
        userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Atividade não permitida em Nutrição",
      },
    ],
  })), false);
  assert.equal(areExecutorsAllowedForService(item({
    kind: "RUNNING_PLAN",
    legalProviderKey: "ACADEMIA_SAULO_FITNESS",
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
  })), true);
});

test("Saulo pode manter CRN e CREF ativos para responsabilidades distintas", () => {
  assert.equal(areExecutorsAllowedForService(item({
    kind: "NUTRITION_PLAN",
    legalProviderKey: "ACADEMIA_SAULO_FITNESS",
    executors: [{
      userId: BUILT_IN_IDS.users.sauloXavierVitorino,
      professionalRegistration: "CRN",
      professionalRegistrationStatus: "ACTIVE",
      performedActivity: "Plano nutricional exclusivo de teste",
    }],
  })), true);
  assert.equal(areExecutorsAllowedForService(item({
    kind: "RUNNING_PLAN",
    executors: [{
      userId: BUILT_IN_IDS.users.sauloXavierVitorino,
      professionalRegistration: "CREF",
      professionalRegistrationStatus: "ACTIVE",
      performedActivity: "Plano de corrida exclusivo de teste",
    }],
  })), true);
});

test("prestador pessoa física e executor permanecem papéis independentes", () => {
  assert.equal(areExecutorsAllowedForService(item({
    legalProviderKey: "SAULO_XAVIER_VITORINO",
    executors: [{
      userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
      professionalRegistration: "CREF",
      professionalRegistrationStatus: "ACTIVE",
      performedActivity: "Execução exclusiva de teste",
    }],
  })), true);
});

test("pagamento parcial declara só o recebido e calcula o saldo", () => {
  const result = calculateServiceReceiptPaymentState(
    {
      subtotal: "120.00",
      discount: "10.00",
      surcharge: "5.00",
      amountDue: "115.00",
    },
    {
      method: "PIX",
      receivedByProviderKey: "SAULO_XAVIER_VITORINO",
      receivedAmount: "40.00",
      previouslyReceivedAmount: "25.00",
      allocations: [{ serviceReferenceId: "test-service-reference", amount: "40.00" }],
    },
  );

  assert.equal(result.receivedInThisPaymentInCents, BigInt(4_000));
  assert.equal(result.remainingBalanceInCents, BigInt(5_000));
  assert.equal(result.isPartialPayment, true);
});

test("rateio deve fechar o valor recebido e pagamentos não podem superar o total", () => {
  const totals = {
    subtotal: "100.00",
    discount: "0.00",
    surcharge: "0.00",
    amountDue: "100.00",
  } as const;

  assert.throws(() => calculateServiceReceiptPaymentState(totals, {
    method: "CARD",
    receivedByProviderKey: "SAULO_XAVIER_VITORINO",
    receivedAmount: "50.00",
    previouslyReceivedAmount: "0.00",
    allocations: [{ serviceReferenceId: "test-service-reference", amount: "40.00" }],
  }), /PAYMENT_ALLOCATION_MISMATCH/);

  assert.throws(() => calculateServiceReceiptPaymentState(totals, {
    method: "CARD",
    receivedByProviderKey: "SAULO_XAVIER_VITORINO",
    receivedAmount: "20.00",
    previouslyReceivedAmount: "90.00",
    allocations: [{ serviceReferenceId: "test-service-reference", amount: "20.00" }],
  }), /PAYMENT_EXCEEDS_AMOUNT_DUE/);
});

test("declaração usa somente o recebido e CPF comum permanece mascarado", () => {
  const payment = {
    method: "CASH",
    receivedByProviderKey: "SAULO_XAVIER_VITORINO",
    receivedAmount: "35.00",
    previouslyReceivedAmount: "0.00",
    allocations: [{ serviceReferenceId: "test-service-reference", amount: "35.00" }],
  } as const;

  assert.equal(serviceReceiptDeclaredAmount(payment), "35.00");
  assert.equal(customerCpfForCommonScreen("12345678901"), "***.***.***-01");
  assert.equal(customerCpfForDocument("12345678901", "MASKED"), "***.***.***-01");
  assert.equal(customerCpfForDocument("12345678901", "FULL"), "123.456.789-01");
});

test("Saulo tem todas as ações e Maria não cancela, estorna ou emite Nutrição", () => {
  const mariaPhysicalContext = {
    legalProviderKey: "MARIA_DE_LOURDES_GOMES",
    serviceKinds: ["POSTURAL_ASSESSMENT"],
    executorUserIds: [BUILT_IN_IDS.users.mariaDeLourdesGomes],
    activeProfessionalCouncils: ["CREF"],
  } as const;
  const nutritionContext = {
    legalProviderKey: "ACADEMIA_SAULO_FITNESS",
    serviceKinds: ["NUTRITION_CONSULTATION"],
    executorUserIds: [BUILT_IN_IDS.users.sauloXavierVitorino],
    activeProfessionalCouncils: ["CRN"],
  } as const;

  assert.equal(canPerformServiceReceiptAction(
    BUILT_IN_IDS.users.sauloXavierVitorino,
    "REFUND",
    nutritionContext,
  ), true);
  assert.equal(canPerformServiceReceiptAction(
    BUILT_IN_IDS.users.mariaDeLourdesGomes,
    "ISSUE",
    mariaPhysicalContext,
  ), true);
  assert.equal(canPerformServiceReceiptAction(
    BUILT_IN_IDS.users.mariaDeLourdesGomes,
    "CANCEL",
    mariaPhysicalContext,
  ), false);
  assert.equal(canPerformServiceReceiptAction(
    BUILT_IN_IDS.users.mariaDeLourdesGomes,
    "ISSUE",
    nutritionContext,
  ), false);
});

test("permissao profissional exige registro estruturado ativo", () => {
  assert.equal(areExecutorsAllowedForService(item({
    executors: [{
      userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
      professionalRegistration: "CREF",
      professionalRegistrationStatus: "INACTIVE",
      performedActivity: "Atividade exclusiva de teste",
    }],
  })), false);
});

test("recibo emitido é imutável e só transita para cancelado", () => {
  assert.equal(SERVICE_RECEIPT_HISTORY_POLICY.issuedReceiptCanBeEdited, false);
  assert.equal(SERVICE_RECEIPT_HISTORY_POLICY.historyCanBeDeleted, false);
  assert.equal(SERVICE_RECEIPT_HISTORY_POLICY.receiptNumberCanBeReused, false);
  assert.equal(isValidReceiptStatusTransition("ISSUED", "CANCELLED"), true);
  assert.equal(isValidReceiptStatusTransition("CANCELLED", "ISSUED"), false);
});
