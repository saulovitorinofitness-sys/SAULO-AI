import assert from "node:assert/strict";
import test from "node:test";

import { BUILT_IN_IDS } from "@/modules/permissions";

import type { ServiceReceiptCandidate } from "./contracts";
import type {
  IssueReceiptPersistenceInput,
  LegalProviderReference,
  PersistedCharge,
  PersistedPayment,
  PersistedReceipt,
  ProfessionalServiceReceiptRepository,
  RecordPaymentPersistenceInput,
  RefundReceiptPersistenceInput,
  RegisterChargePersistenceInput,
} from "./repository";
import {
  createProfessionalServiceReceiptService,
  ProfessionalServiceReceiptServiceError,
} from "./service";

const SHA = "a".repeat(64);
const SAULO_ID = BUILT_IN_IDS.users.sauloXavierVitorino;
const PROVIDER: LegalProviderReference = {
  id: "00000000-0000-4000-8000-000000000301",
  key: "SAULO_XAVIER_VITORINO",
};

function charge(overrides: Partial<PersistedCharge> = {}): PersistedCharge {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    provider: PROVIDER,
    masterRecordId: "00000000-0000-4000-8000-000000000402",
    status: "OPEN",
    subtotal: "100.00",
    discount: "0.00",
    surcharge: "0.00",
    amountDue: "100.00",
    previouslyReceivedAmount: "0.00",
    items: [{
      id: "00000000-0000-4000-8000-000000000403",
      serviceReferenceId: "service-test-reference",
      kind: "PERSONAL_TRAINING",
      grossAmount: "100.00",
    }],
    authorization: {
      legalProviderKey: "SAULO_XAVIER_VITORINO",
      serviceKinds: ["PERSONAL_TRAINING"],
      executorUserIds: [SAULO_ID],
      activeProfessionalCouncils: ["CREF"],
    },
    ...overrides,
  };
}

function receipt(overrides: Partial<PersistedReceipt> = {}): PersistedReceipt {
  return {
    id: "00000000-0000-4000-8000-000000000501",
    paymentId: "00000000-0000-4000-8000-000000000502",
    provider: PROVIDER,
    status: "ISSUED",
    series: "SV",
    sequence: 1,
    idempotencyKey: "receipt-key",
    requestSha256: SHA,
    replayed: false,
    ...overrides,
  };
}

function candidate(): ServiceReceiptCandidate {
  return {
    legalProvider: {
      key: "SAULO_XAVIER_VITORINO",
      providerType: "INDIVIDUAL",
      taxIdType: "CPF",
      fullName: "Saulo Xavier Vitorino",
      cpf: "52998224725",
      address: { formattedAddress: "Endereco exclusivo de teste" },
      crn: "CRN TESTE",
      cref: "CREF TESTE",
    },
    customerMasterRecordId: "00000000-0000-4000-8000-000000000402",
    items: [{
      serviceReferenceId: "service-test-reference",
      kind: "PERSONAL_TRAINING",
      soldByProviderKey: "SAULO_XAVIER_VITORINO",
      legalProviderKey: "SAULO_XAVIER_VITORINO",
      executors: [{
        userId: SAULO_ID,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Atividade exclusiva de teste",
      }],
      grossAmount: "100.00",
    }],
    totals: { subtotal: "100.00", discount: "0.00", surcharge: "0.00", amountDue: "100.00" },
    payment: {
      method: "PIX",
      receivedByProviderKey: "SAULO_XAVIER_VITORINO",
      receivedAmount: "40.00",
      previouslyReceivedAmount: "0.00",
      allocations: [{ serviceReferenceId: "service-test-reference", amount: "40.00" }],
    },
    numbering: { series: "SV", sequence: 1 },
    signature: {
      mode: "ELECTRONIC",
      signingProviderKey: "SAULO_XAVIER_VITORINO",
      electronicSignatureReference: "signature-test-reference",
      includeManualSignatureSpace: true,
    },
    privacy: { customerCpfOnDocument: "MASKED" },
    operatorUserId: SAULO_ID,
  };
}

function fakeRepository() {
  const calls: {
    charge?: RegisterChargePersistenceInput;
    payment?: RecordPaymentPersistenceInput;
    issuance?: IssueReceiptPersistenceInput;
    cancellation?: { receiptId: string; actorUserId: string; reason: string };
    refund?: RefundReceiptPersistenceInput;
    deletedDraftId?: string;
    cancelledCharge?: { chargeId: string; actorUserId: string; reason: string; idempotencyKey: string };
  } = {};
  let currentCharge: PersistedCharge | null = charge();
  let currentReceipt: PersistedReceipt | null = receipt();
  let replayedPayment: PersistedPayment | null = null;
  let replayedReceipt: PersistedReceipt | null = null;
  const repository: ProfessionalServiceReceiptRepository = {
    async listReceipts(filters) {
      return {
        items: [], page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 0,
        indicators: { receivedAmount: "0.00", pending: 0, partial: 0, cancelled: 0, refunded: 0 },
      };
    },
    async resolveProvider(key) {
      return { ...PROVIDER, key };
    },
    async registerCharge(input) {
      calls.charge = input;
      return charge({
        provider: input.provider,
        masterRecordId: input.masterRecordId,
        subtotal: input.subtotal,
        discount: input.discount,
        surcharge: input.surcharge,
        amountDue: input.amountDue,
        items: input.items.map((item) => ({
          id: item.id,
          serviceReferenceId: item.serviceReferenceId,
          kind: item.kind,
          grossAmount: item.grossAmount,
        })),
      });
    },
    async findCharge() {
      return currentCharge;
    },
    async findPaymentByIdempotencyKey() {
      return replayedPayment;
    },
    async recordPayment(input) {
      calls.payment = input;
      return {
        id: input.id,
        chargeId: input.charge.id,
        provider: input.charge.provider,
        receivedAmount: input.receivedAmount,
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        replayed: false,
      } satisfies PersistedPayment;
    },
    async issueReceipt(input) {
      calls.issuance = input;
      return receipt({
        id: input.id,
        paymentId: input.paymentId,
        provider: input.provider,
        series: input.seriesCode,
        sequence: input.expectedSequence,
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
    },
    async findReceipt() {
      return currentReceipt;
    },
    async findReceiptDetails() {
      return null;
    },
    async findReceiptByIdempotencyKey() {
      return replayedReceipt;
    },
    async findPrivateProof() {
      return null;
    },
    async cancelReceipt(receiptId, actorUserId, reason) {
      calls.cancellation = { receiptId, actorUserId, reason };
      currentReceipt = receipt({ status: "CANCELLED" });
      return currentReceipt;
    },
    async refundReceipt(input) {
      calls.refund = input;
      currentReceipt = receipt({ status: "REFUNDED", replayed: false });
      return currentReceipt;
    },
    async deleteDraftCharge(chargeId) {
      calls.deletedDraftId = chargeId;
      return { id: chargeId, status: "DELETED", replayed: false };
    },
    async cancelPaidCharge(input) {
      calls.cancelledCharge = input;
      return { id: input.chargeId, status: "CANCELLED", replayed: false };
    },
  };
  return {
    calls,
    repository,
    setCharge(value: PersistedCharge | null) { currentCharge = value; },
    setReceipt(value: PersistedReceipt | null) { currentReceipt = value; },
    setPaymentReplay(value: PersistedPayment | null) { replayedPayment = value; },
    setReceiptReplay(value: PersistedReceipt | null) { replayedReceipt = value; },
  };
}

test("somente Saulo exclui rascunho sem criar outra operacao", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  const result = await service.deleteDraftCharge(charge().id, SAULO_ID);
  assert.equal(result.status, "DELETED");
  assert.equal(fake.calls.deletedDraftId, charge().id);
  await assert.rejects(
    service.deleteDraftCharge(charge().id, BUILT_IN_IDS.users.mariaDeLourdesGomes),
    (error: unknown) => error instanceof ProfessionalServiceReceiptServiceError && error.code === "NOT_AUTHORIZED",
  );
});

test("cancelamento de recebimento exige Saulo, motivo e idempotencia", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  await assert.rejects(service.cancelPaidCharge({
    chargeId: charge().id, actorUserId: SAULO_ID, reason: " ", idempotencyKey: "cancel-key", requestSha256: SHA,
  }));
  await assert.rejects(service.cancelPaidCharge({
    chargeId: charge().id, actorUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
    reason: "Teste", idempotencyKey: "cancel-key", requestSha256: SHA,
  }));
  const result = await service.cancelPaidCharge({
    chargeId: charge().id, actorUserId: SAULO_ID, reason: " Correção de teste ",
    idempotencyKey: "cancel-key", requestSha256: SHA,
  });
  assert.equal(result.status, "CANCELLED");
  assert.equal(fake.calls.cancelledCharge?.reason, "Correção de teste");
  assert.equal(fake.calls.cancelledCharge?.idempotencyKey, "cancel-key");
});

test("registra cobranca com itens, prestador e executor validados", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  const result = await service.registerCharge({
    providerKey: "SAULO_XAVIER_VITORINO",
    masterRecordId: "00000000-0000-4000-8000-000000000402",
    totals: { subtotal: "100.00", discount: "0.00", surcharge: "0.00", amountDue: "100.00" },
    items: [{
      ...candidate().items[0],
      description: "Personal exclusivo de teste",
      serviceDate: "2026-09-22",
    }],
    actorUserId: SAULO_ID,
  });
  assert.equal(result.items[0].serviceReferenceId, "service-test-reference");
  assert.equal(fake.calls.charge?.items[0].executors[0].council, "CREF");
});

test("rejeita cobranca com totais divergentes antes da persistencia", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  await assert.rejects(service.registerCharge({
    providerKey: "SAULO_XAVIER_VITORINO",
    masterRecordId: "master-test",
    totals: { subtotal: "99.00", discount: "0.00", surcharge: "0.00", amountDue: "99.00" },
    items: [{ ...candidate().items[0], description: "Teste", serviceDate: "2026-09-22" }],
    actorUserId: SAULO_ID,
  }), (error) => error instanceof ProfessionalServiceReceiptServiceError && error.code === "VALIDATION_FAILED");
  assert.equal(fake.calls.charge, undefined);
});

test("registra pagamento parcial, alocacao, idempotencia e comprovante privado", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  await service.recordPayment({
    chargeId: charge().id,
    providerKey: "SAULO_XAVIER_VITORINO",
    financialSettlementId: "00000000-0000-4000-8000-000000000601",
    method: "PIX",
    receivedAmount: "40.00",
    allocations: [{ chargeItemId: charge().items[0].id, amount: "40.00" }],
    idempotencyKey: "payment-test-key",
    requestSha256: SHA,
    actorUserId: SAULO_ID,
    proof: { name: "proof.pdf", mimeType: "application/pdf", bytes: pdf },
  });
  assert.equal(fake.calls.payment?.receivedAmount, "40.00");
  assert.equal(fake.calls.payment?.proof?.storageKey.includes("professional-service-payments/"), true);
  assert.deepEqual(fake.calls.payment?.proof?.bytes, pdf);
});

test("pagamento de prestador individual permite criar a liquidacao canonica na transacao", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  await service.recordPayment({
    chargeId: charge().id,
    providerKey: "SAULO_XAVIER_VITORINO",
    method: "PIX",
    receivedAmount: "100.00",
    allocations: [{ chargeItemId: charge().items[0].id, amount: "100.00" }],
    idempotencyKey: "canonical-payment-test-key",
    requestSha256: SHA,
    actorUserId: SAULO_ID,
  });
  assert.equal(fake.calls.payment?.financialSettlementId, undefined);
  assert.equal(fake.calls.payment?.method, "PIX");
});

test("pagamento rejeita alocacao de item pertencente a outra cobranca", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  await assert.rejects(service.recordPayment({
    chargeId: charge().id,
    providerKey: "SAULO_XAVIER_VITORINO",
    financialSettlementId: "settlement-test",
    method: "PIX",
    receivedAmount: "40.00",
    allocations: [{ chargeItemId: "another-charge-item", amount: "40.00" }],
    idempotencyKey: "payment-test-key",
    requestSha256: SHA,
    actorUserId: SAULO_ID,
  }), /outra cobranca/u);
  assert.equal(fake.calls.payment, undefined);
});

test("retry identico de pagamento retorna o registro sem recalcular saldo", async () => {
  const fake = fakeRepository();
  const replay: PersistedPayment = {
    id: "payment-replayed",
    chargeId: charge().id,
    provider: PROVIDER,
    receivedAmount: "40.00",
    idempotencyKey: "payment-test-key",
    requestSha256: SHA,
    replayed: true,
  };
  fake.setPaymentReplay(replay);
  fake.setCharge(null);
  const service = createProfessionalServiceReceiptService(fake.repository);
  const result = await service.recordPayment({
    chargeId: charge().id,
    providerKey: "SAULO_XAVIER_VITORINO",
    financialSettlementId: "settlement-test",
    method: "PIX",
    receivedAmount: "40.00",
    allocations: [{ chargeItemId: charge().items[0].id, amount: "40.00" }],
    idempotencyKey: "payment-test-key",
    requestSha256: SHA,
    actorUserId: SAULO_ID,
  });
  assert.equal(result, replay);
  assert.equal(fake.calls.payment, undefined);
});

test("emite recibo com saldo parcial, snapshot e reserva de numero", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  const result = await service.issueReceipt({
    candidate: candidate(),
    validationContext: {
      customerIdentity: { masterRecordId: candidate().customerMasterRecordId, cpf: "52998224725" },
      numbering: { seriesProviderKey: "SAULO_XAVIER_VITORINO", sequencePreviouslyUsed: false },
    },
    paymentId: receipt().paymentId,
    customerCpfHash: SHA,
    customerCpfEncrypted: "encrypted-cpf-test",
    snapshotPayloadSha256: "b".repeat(64),
    snapshotPayloadCiphertext: Uint8Array.from([1, 2, 3]),
    snapshotSchemaVersion: 1,
    snapshotEncryptionVersion: 1,
    idempotencyKey: "receipt-test-key",
    requestSha256: SHA,
  });
  assert.equal(result.status, "ISSUED");
  assert.equal(fake.calls.issuance?.remainingBalance, "60.00");
  assert.equal(fake.calls.issuance?.partialPayment, true);
  assert.equal(fake.calls.issuance?.expectedSequence, 1);
});

test("emissao invalida nao chega ao repositorio", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  const invalid = { ...candidate(), items: [] };
  await assert.rejects(service.issueReceipt({
    candidate: invalid,
    validationContext: {
      customerIdentity: { masterRecordId: invalid.customerMasterRecordId, cpf: "52998224725" },
      numbering: { seriesProviderKey: "SAULO_XAVIER_VITORINO", sequencePreviouslyUsed: false },
    },
    paymentId: receipt().paymentId,
    customerCpfHash: SHA,
    customerCpfEncrypted: "encrypted",
    snapshotPayloadSha256: SHA,
    snapshotPayloadCiphertext: Uint8Array.from([1]),
    snapshotSchemaVersion: 1,
    snapshotEncryptionVersion: 1,
    idempotencyKey: "receipt-test-key",
    requestSha256: SHA,
  }), (error) => error instanceof ProfessionalServiceReceiptServiceError && error.code === "VALIDATION_FAILED");
  assert.equal(fake.calls.issuance, undefined);
});

test("retry identico de emissao retorna recibo mesmo apos a sequencia ser usada", async () => {
  const fake = fakeRepository();
  const replay = receipt({ replayed: true, idempotencyKey: "receipt-test-key", requestSha256: SHA });
  fake.setReceiptReplay(replay);
  const service = createProfessionalServiceReceiptService(fake.repository);
  const result = await service.issueReceipt({
    candidate: candidate(),
    validationContext: {
      customerIdentity: null,
      numbering: { seriesProviderKey: "SAULO_XAVIER_VITORINO", sequencePreviouslyUsed: true },
    },
    paymentId: receipt().paymentId,
    customerCpfHash: "invalid-after-replay",
    customerCpfEncrypted: "",
    snapshotPayloadSha256: "invalid-after-replay",
    snapshotPayloadCiphertext: new Uint8Array(),
    snapshotSchemaVersion: 0,
    snapshotEncryptionVersion: 0,
    idempotencyKey: "receipt-test-key",
    requestSha256: SHA,
  });
  assert.equal(result, replay);
  assert.equal(fake.calls.issuance, undefined);
});

test("cancelamento usa somente Saulo, exige motivo e preserva referencia", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  const result = await service.cancelReceipt(receipt().id, SAULO_ID, "Cancelamento exclusivo de teste");
  assert.equal(result.status, "CANCELLED");
  assert.deepEqual(fake.calls.cancellation, {
    receiptId: receipt().id,
    actorUserId: SAULO_ID,
    reason: "Cancelamento exclusivo de teste",
  });
  fake.setReceipt(receipt());
  await assert.rejects(
    service.cancelReceipt(receipt().id, BUILT_IN_IDS.users.mariaDeLourdesGomes, "Teste"),
    /CANCELLATION_NOT_ALLOWED/u,
  );
});

test("estorno integral permanece separado e vinculado ao pagamento original", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  const result = await service.refundReceipt({
    receiptId: receipt().id,
    originalPaymentId: receipt().paymentId,
    financialSettlementId: "00000000-0000-4000-8000-000000000701",
    amount: "40.00",
    reason: "Estorno exclusivo de teste",
    idempotencyKey: "refund-test-key",
    requestSha256: SHA,
    actorUserId: SAULO_ID,
  });
  assert.equal(result.status, "REFUNDED");
  assert.equal(fake.calls.refund?.originalPaymentId, receipt().paymentId);
  assert.equal(fake.calls.refund?.idempotencyKey, "refund-test-key");
});

test("estorno rejeita pagamento diferente do recibo", async () => {
  const fake = fakeRepository();
  const service = createProfessionalServiceReceiptService(fake.repository);
  await assert.rejects(service.refundReceipt({
    receiptId: receipt().id,
    originalPaymentId: "another-payment",
    financialSettlementId: "refund-settlement",
    amount: "40.00",
    reason: "Teste",
    idempotencyKey: "refund-test-key",
    requestSha256: SHA,
    actorUserId: SAULO_ID,
  }), /Pagamento original divergente/u);
  assert.equal(fake.calls.refund, undefined);
});
