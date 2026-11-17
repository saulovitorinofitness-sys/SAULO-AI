import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import type { FrontendAccessSnapshot } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

import type { ServiceReceiptCandidate } from "./contracts";
import { createProfessionalReceiptHttpHandlers } from "./http";
import { ProfessionalServiceReceiptServiceError } from "./service";

const SAULO_ID = BUILT_IN_IDS.users.sauloXavierVitorino;
const MARIA_ID = BUILT_IN_IDS.users.mariaDeLourdesGomes;
const CHARGE_ID = "00000000-0000-4000-8000-000000000401";
const ITEM_ID = "00000000-0000-4000-8000-000000000403";
const PAYMENT_ID = "00000000-0000-4000-8000-000000000502";
const RECEIPT_ID = "00000000-0000-4000-8000-000000000501";
const SETTLEMENT_ID = "00000000-0000-4000-8000-000000000601";
const MASTER_RECORD_ID = "00000000-0000-4000-8000-000000000402";
const originalProtectionKey = process.env.PAYROLL_DATA_ENCRYPTION_KEY;

before(() => {
  process.env.PAYROLL_DATA_ENCRYPTION_KEY = "exclusive-test-protection-key-with-32-characters";
});

after(() => {
  if (originalProtectionKey === undefined) delete process.env.PAYROLL_DATA_ENCRYPTION_KEY;
  else process.env.PAYROLL_DATA_ENCRYPTION_KEY = originalProtectionKey;
});

function accessFor(userId: string): FrontendAccessSnapshot {
  return {
    user: {
      id: userId,
      fullName: userId === SAULO_ID ? "Saulo Xavier Vitorino" : "Maria de Lourdes Gomes",
      status: "ACTIVE",
      roleName: userId === SAULO_ID ? "SYSTEM_OWNER" : "SHARED_PROFESSIONAL",
    },
    grantsAllModules: userId === SAULO_ID,
    allowsNutritionModules: userId === SAULO_ID,
    overrides: [],
  };
}

function physicalCandidate(provider: "SAULO_XAVIER_VITORINO" | "MARIA_DE_LOURDES_GOMES" = "SAULO_XAVIER_VITORINO"): ServiceReceiptCandidate {
  const userId = provider === "SAULO_XAVIER_VITORINO" ? SAULO_ID : MARIA_ID;
  return {
    legalProvider: {
      key: provider,
      providerType: "INDIVIDUAL",
      taxIdType: "CPF",
      fullName: provider === "SAULO_XAVIER_VITORINO" ? "Saulo Xavier Vitorino" : "Maria de Lourdes Gomes",
      cpf: "52998224725",
      cref: "CREF TESTE",
      address: { formattedAddress: "Endereco exclusivo de teste" },
    },
    customerMasterRecordId: MASTER_RECORD_ID,
    items: [{
      serviceReferenceId: "service-test-reference",
      kind: "PERSONAL_TRAINING",
      soldByProviderKey: provider,
      legalProviderKey: provider,
      executors: [{
        userId,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Atividade exclusiva de teste",
      }],
      grossAmount: "100.00",
    }],
    totals: { subtotal: "100.00", discount: "0.00", surcharge: "0.00", amountDue: "100.00" },
    payment: {
      method: "PIX",
      receivedByProviderKey: provider,
      receivedAmount: "40.00",
      previouslyReceivedAmount: "0.00",
      allocations: [{ serviceReferenceId: "service-test-reference", amount: "40.00" }],
    },
    numbering: { series: provider === "SAULO_XAVIER_VITORINO" ? "SV" : "MLG", sequence: 1 },
    signature: {
      mode: "ELECTRONIC",
      signingProviderKey: provider,
      electronicSignatureReference: "signature-test-reference",
      includeManualSignatureSpace: true,
    },
    privacy: { customerCpfOnDocument: "MASKED" },
    operatorUserId: userId,
  };
}

function request(method: string, payload?: unknown) {
  return new Request("http://localhost/api/financial/professional-service-receipts", {
    method,
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

function chargePayload(providerKey: "SAULO_XAVIER_VITORINO" | "MARIA_DE_LOURDES_GOMES", actorUserId: string) {
  return {
    providerKey,
    masterRecordId: MASTER_RECORD_ID,
    totals: { subtotal: "100.00", discount: "0.00", surcharge: "0.00", amountDue: "100.00" },
    items: [{
      serviceReferenceId: "service-test-reference",
      kind: "PERSONAL_TRAINING",
      soldByProviderKey: providerKey,
      legalProviderKey: providerKey,
      executors: [{
        userId: actorUserId,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "Atividade exclusiva de teste",
      }],
      grossAmount: "100.00",
      description: "Servico exclusivo de teste",
      serviceDate: "2026-09-22",
    }],
  };
}

function serviceDouble() {
  const seen: { actorUserIds: string[]; issuanceCiphertext?: Uint8Array } = { actorUserIds: [] };
  const charge = {
    id: CHARGE_ID,
    provider: { id: "00000000-0000-4000-8000-000000000301", key: "SAULO_XAVIER_VITORINO" as const },
    masterRecordId: MASTER_RECORD_ID,
    status: "PARTIALLY_PAID" as const,
    subtotal: "100.00",
    discount: "0.00",
    surcharge: "0.00",
    amountDue: "100.00",
    previouslyReceivedAmount: "40.00",
    items: [{ id: ITEM_ID, serviceReferenceId: "service-test-reference", kind: "PERSONAL_TRAINING" as const, grossAmount: "100.00" }],
    authorization: {
      legalProviderKey: "SAULO_XAVIER_VITORINO" as const,
      serviceKinds: ["PERSONAL_TRAINING" as const],
      executorUserIds: [SAULO_ID],
      activeProfessionalCouncils: ["CREF" as const],
    },
  };
  const service = {
    async listReceipts(input: { actorUserId: string; query?: string; page?: number }) {
      seen.actorUserIds.push(input.actorUserId);
      return {
        items: [{
          id: CHARGE_ID, receiptId: RECEIPT_ID, customerName: "Cliente real", customerCode: "SV000001",
          providerKey: "SAULO_XAVIER_VITORINO" as const, status: "PARTIALLY_PAID" as const,
          amount: "100.00", receivedAmount: "40.00", createdAt: new Date("2026-09-22T12:00:00.000Z"),
          series: "SV", sequence: 1,
          paymentCount: 1, managementAction: null,
        }],
        page: input.page ?? 1, pageSize: 20, total: 1, totalPages: 1,
        indicators: { receivedAmount: "40.00", pending: 0, partial: 1, cancelled: 0, refunded: 0 },
      };
    },
    async registerCharge(input: {
      actorUserId: string;
      providerKey: string;
      items: readonly { kind: string; executors: readonly { userId: string }[] }[];
    }) {
      seen.actorUserIds.push(input.actorUserId);
      const mariaParticipates = input.providerKey === "MARIA_DE_LOURDES_GOMES"
        || input.items.some((item) => item.executors.some((executor) => executor.userId === MARIA_ID));
      const hasNutrition = input.items.some((item) => item.kind.startsWith("NUTRITION"));
      if (input.actorUserId === MARIA_ID && (!mariaParticipates || hasNutrition)) {
        throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Usuario sem permissao para registrar a operacao.");
      }
      return { ...charge, provider: { ...charge.provider, key: input.providerKey } };
    },
    async getCharge(_chargeId: string, actorUserId: string) {
      seen.actorUserIds.push(actorUserId);
      return charge;
    },
    async recordPayment(input: { actorUserId: string; idempotencyKey: string; receivedAmount: string }) {
      seen.actorUserIds.push(input.actorUserId);
      return {
        id: PAYMENT_ID,
        chargeId: CHARGE_ID,
        provider: charge.provider,
        receivedAmount: input.receivedAmount,
        idempotencyKey: input.idempotencyKey,
        requestSha256: "a".repeat(64),
        replayed: input.idempotencyKey === "payment-replay",
      };
    },
    assessIssuanceCandidate(candidate: ServiceReceiptCandidate, _context: unknown, actorUserId: string) {
      seen.actorUserIds.push(actorUserId);
      if (candidate.items.some((item) => item.kind.startsWith("NUTRITION")) && actorUserId === MARIA_ID) {
        return { eligible: false, issues: [
          { code: "OPERATOR_NOT_AUTHORIZED", message: "Operador sem permissao para Nutrição." },
          { code: "PROVIDER_NOT_ALLOWED", message: "Prestador incompativel." },
        ] };
      }
      return { eligible: true, issues: [] };
    },
    async prepareIssuanceCandidate(candidate: ServiceReceiptCandidate) {
      return candidate;
    },
    async issueReceipt(input: { candidate: ServiceReceiptCandidate; idempotencyKey: string; snapshotPayloadCiphertext: Uint8Array }) {
      seen.actorUserIds.push(input.candidate.operatorUserId);
      seen.issuanceCiphertext = input.snapshotPayloadCiphertext;
      return {
        id: RECEIPT_ID,
        paymentId: PAYMENT_ID,
        provider: charge.provider,
        status: "ISSUED" as const,
        series: "SV",
        sequence: 1,
        idempotencyKey: input.idempotencyKey,
        requestSha256: "a".repeat(64),
        replayed: input.idempotencyKey === "receipt-replay",
      };
    },
    async getReceiptDetails(_receiptId: string, actorUserId: string) {
      seen.actorUserIds.push(actorUserId);
      return {
        receipt: {
          id: RECEIPT_ID, paymentId: PAYMENT_ID, provider: charge.provider, status: "ISSUED" as const,
          series: "SV", sequence: 1, idempotencyKey: "receipt-key", requestSha256: "a".repeat(64), replayed: false,
        },
        charge,
        receivedAmount: "40.00",
        remainingBalance: "60.00",
        partialPayment: true,
        snapshot: { schemaVersion: 1, encryptionVersion: 1, payloadSha256: "b".repeat(64), createdAt: new Date("2026-09-22T12:00:00.000Z") },
        events: [{ type: "ISSUED" as const, fromStatus: "DRAFT" as const, toStatus: "ISSUED" as const, reason: null, occurredAt: new Date("2026-09-22T12:00:00.000Z") }],
      };
    },
    async cancelReceipt(receiptId: string, actorUserId: string) {
      seen.actorUserIds.push(actorUserId);
      if (actorUserId !== SAULO_ID) throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Cancelamento exclusivo.");
      return { id: receiptId, status: "CANCELLED" as const };
    },
    async deleteDraftCharge(chargeId: string, actorUserId: string) {
      seen.actorUserIds.push(actorUserId);
      if (actorUserId !== SAULO_ID) throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Exclusao exclusiva.");
      return { id: chargeId, status: "DELETED" as const, replayed: false };
    },
    async cancelPaidCharge(input: { chargeId: string; actorUserId: string; idempotencyKey: string }) {
      seen.actorUserIds.push(input.actorUserId);
      if (input.actorUserId !== SAULO_ID) throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Cancelamento exclusivo.");
      return { id: input.chargeId, status: "CANCELLED" as const, replayed: input.idempotencyKey === "cancel-replay" };
    },
    async refundReceipt(input: { receiptId: string; actorUserId: string; idempotencyKey: string }) {
      seen.actorUserIds.push(input.actorUserId);
      if (input.actorUserId !== SAULO_ID) throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Estorno exclusivo.");
      return { id: input.receiptId, status: "REFUNDED" as const, replayed: input.idempotencyKey === "refund-replay" };
    },
    async getPrivateProof(_receiptId: string, actorUserId: string) {
      seen.actorUserIds.push(actorUserId);
      if (actorUserId !== SAULO_ID) throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Comprovante privado.");
      return {
        receiptId: RECEIPT_ID,
        charge,
        mimeType: "application/pdf" as const,
        byteLength: 5,
        sha256: "c".repeat(64),
        bytes: Uint8Array.from([37, 80, 68, 70, 45]),
      };
    },
  };
  return { seen, service };
}

function handlersFor(userId: string, double = serviceDouble()) {
  return {
    ...double,
    handlers: createProfessionalReceiptHttpHandlers({
      resolveAccess: async () => accessFor(userId),
      service: double.service as unknown as NonNullable<Parameters<typeof createProfessionalReceiptHttpHandlers>[0]["service"]>,
    }),
  };
}

const validationContext = {
  customerIdentity: { masterRecordId: MASTER_RECORD_ID, cpf: "529.982.247-25" },
  numbering: { seriesProviderKey: "SAULO_XAVIER_VITORINO", sequencePreviouslyUsed: false },
};

test("todas as operacoes rejeitam ausencia de sessao antes de acessar o servico", async () => {
  const double = serviceDouble();
  const handlers = createProfessionalReceiptHttpHandlers({
    resolveAccess: async () => { throw new Error("no session"); },
    service: double.service as unknown as NonNullable<Parameters<typeof createProfessionalReceiptHttpHandlers>[0]["service"]>,
  });
  const responses = await Promise.all([
    handlers.listReceipts(request("GET")),
    handlers.createCharge(request("POST", {})),
    handlers.getCharge(request("GET"), CHARGE_ID),
    handlers.deleteDraftCharge(request("DELETE", {}), CHARGE_ID),
    handlers.cancelPaidCharge(request("POST", {}), CHARGE_ID),
    handlers.recordPayment(request("POST", {}), CHARGE_ID),
    handlers.assessCandidate(request("POST", {}), CHARGE_ID),
    handlers.issueReceipt(request("POST", {})),
    handlers.getReceipt(request("GET"), RECEIPT_ID),
    handlers.cancelReceipt(request("POST", {}), RECEIPT_ID),
    handlers.refundReceipt(request("POST", {}), RECEIPT_ID),
    handlers.getPrivateProof(request("GET"), RECEIPT_ID),
  ]);
  assert.deepEqual(responses.map((response) => response.status), Array(12).fill(401));
  assert.deepEqual(double.seen.actorUserIds, []);
});

test("GET lista recibos paginados com indicadores sem dados privados", async () => {
  const { handlers, seen } = handlersFor(SAULO_ID);
  const response = await handlers.listReceipts(new Request(
    "http://localhost/api/financial/professional-service-receipts/receipts?query=Cliente&page=1&pageSize=20&status=PARTIALLY_PAID",
  ));
  assert.equal(response.status, 200);
  const text = await response.text();
  const payload = JSON.parse(text);
  assert.equal(payload.items[0].customerName, "Cliente real");
  assert.equal(payload.items[0].createdAt, "2026-09-22T12:00:00.000Z");
  assert.equal(payload.indicators.partial, 1);
  assert.equal(payload.totalPages, 1);
  assert.doesNotMatch(text, /cpf|proof|comprovante|bytes|storageKey/iu);
  assert.equal(seen.actorUserIds.at(-1), SAULO_ID);
});

test("Saulo cria cobranca e Maria cria apenas Educacao Fisica como prestadora ou executora", async () => {
  const saulo = handlersFor(SAULO_ID);
  const created = await saulo.handlers.createCharge(request("POST", chargePayload("SAULO_XAVIER_VITORINO", SAULO_ID)));
  assert.equal(created.status, 201);
  const queried = await saulo.handlers.getCharge(request("GET"), CHARGE_ID);
  const queriedBody = await queried.json();
  assert.equal(queried.status, 200);
  assert.equal(queriedBody.charge.remainingBalance, "60.00");
  assert.equal(queriedBody.charge.items[0].id, ITEM_ID);

  const maria = handlersFor(MARIA_ID);
  assert.equal((await maria.handlers.createCharge(request("POST", chargePayload("MARIA_DE_LOURDES_GOMES", MARIA_ID)))).status, 201);
  assert.equal((await maria.handlers.createCharge(request("POST", chargePayload("SAULO_XAVIER_VITORINO", MARIA_ID)))).status, 201);
  const nutrition = chargePayload("MARIA_DE_LOURDES_GOMES", MARIA_ID);
  nutrition.items[0].kind = "NUTRITION_CONSULTATION";
  const forbidden = await maria.handlers.createCharge(request("POST", nutrition));
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).code, "NOT_AUTHORIZED");
});

test("pagamento parcial usa ator da sessao e distingue repeticao idempotente", async () => {
  const { handlers, seen } = handlersFor(SAULO_ID);
  const base = {
    providerKey: "SAULO_XAVIER_VITORINO",
    financialSettlementId: SETTLEMENT_ID,
    method: "PIX",
    receivedAmount: "40.00",
    allocations: [{ chargeItemId: ITEM_ID, amount: "40.00" }],
  };
  const created = await handlers.recordPayment(request("POST", { ...base, idempotencyKey: "payment-new" }), CHARGE_ID);
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { payment: { id: PAYMENT_ID, chargeId: CHARGE_ID, receivedAmount: "40.00", replayed: false } });
  const replay = await handlers.recordPayment(request("POST", { ...base, idempotencyKey: "payment-replay" }), CHARGE_ID);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).payment.replayed, true);
  assert.ok(seen.actorUserIds.every((id) => id === SAULO_ID));
});

test("pagamento aceita liquidacao canonica ainda nao vinculada", async () => {
  const { handlers } = handlersFor(SAULO_ID);
  const response = await handlers.recordPayment(request("POST", {
    providerKey: "SAULO_XAVIER_VITORINO",
    method: "PIX",
    receivedAmount: "40.00",
    allocations: [{ chargeItemId: ITEM_ID, amount: "40.00" }],
    idempotencyKey: "payment-with-canonical-settlement",
  }), CHARGE_ID);
  assert.equal(response.status, 201);
});

test("consulta de candidato lista todas as pendencias de Nutrição para Maria", async () => {
  const { handlers } = handlersFor(MARIA_ID);
  const candidate = physicalCandidate("MARIA_DE_LOURDES_GOMES");
  const nutritionCandidate = {
    ...candidate,
    items: candidate.items.map((item) => ({ ...item, kind: "NUTRITION_CONSULTATION" as const })),
  };
  const response = await handlers.assessCandidate(request("POST", {
    candidate: nutritionCandidate,
    validationContext: {
      ...validationContext,
      numbering: { ...validationContext.numbering, seriesProviderKey: "MARIA_DE_LOURDES_GOMES" },
    },
  }), CHARGE_ID);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.candidate.eligible, false);
  assert.deepEqual(payload.candidate.issues.map((issue: { code: string }) => issue.code), ["OPERATOR_NOT_AUTHORIZED", "PROVIDER_NOT_ALLOWED"]);
});

test("emissao protege dados sensiveis e responde idempotencia sem CPF ou snapshot cifrado", async () => {
  const { handlers, seen } = handlersFor(SAULO_ID);
  const payload = {
    candidate: physicalCandidate(),
    validationContext,
    paymentId: PAYMENT_ID,
    idempotencyKey: "receipt-replay",
  };
  const response = await handlers.issueReceipt(request("POST", payload));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.equal(JSON.parse(text).receipt.replayed, true);
  assert.doesNotMatch(text, /529|cpf|ciphertext/iu);
  assert.ok(seen.issuanceCiphertext);
  assert.doesNotMatch(Buffer.from(seen.issuanceCiphertext).toString("utf8"), /52998224725/u);
});

test("consulta recibo expõe saldo, snapshot seguro e historico sem dados privados", async () => {
  const { handlers } = handlersFor(SAULO_ID);
  const response = await handlers.getReceipt(request("GET"), RECEIPT_ID);
  assert.equal(response.status, 200);
  const text = await response.text();
  const payload = JSON.parse(text);
  assert.equal(payload.receipt.remainingBalance, "60.00");
  assert.equal(payload.receipt.partialPayment, true);
  assert.equal(payload.receipt.snapshot.schemaVersion, 1);
  assert.equal(payload.receipt.events[0].type, "ISSUED");
  assert.doesNotMatch(text, /cpf|ciphertext|proof|bytes/iu);
});

test("cancelamento e estorno sao exclusivos de Saulo", async () => {
  const maria = handlersFor(MARIA_ID);
  assert.equal((await maria.handlers.cancelReceipt(request("POST", { reason: "Solicitacao de teste" }), RECEIPT_ID)).status, 403);
  assert.equal((await maria.handlers.refundReceipt(request("POST", {
    originalPaymentId: PAYMENT_ID,
    financialSettlementId: SETTLEMENT_ID,
    amount: "10.00",
    reason: "Estorno de teste",
    idempotencyKey: "refund-new",
  }), RECEIPT_ID)).status, 403);

  const saulo = handlersFor(SAULO_ID);
  assert.equal((await saulo.handlers.cancelReceipt(request("POST", { reason: "Solicitacao de teste" }), RECEIPT_ID)).status, 200);
  assert.equal((await saulo.handlers.refundReceipt(request("POST", {
    originalPaymentId: PAYMENT_ID,
    financialSettlementId: SETTLEMENT_ID,
    amount: "10.00",
    reason: "Estorno de teste",
    idempotencyKey: "refund-new",
  }), RECEIPT_ID)).status, 201);
});

test("acoes sobre rascunho e recebimento exigem confirmacao e Saulo", async () => {
  const maria = handlersFor(MARIA_ID);
  assert.equal((await maria.handlers.deleteDraftCharge(request("DELETE", { confirmation: "EXCLUIR_RASCUNHO" }), CHARGE_ID)).status, 403);
  assert.equal((await maria.handlers.cancelPaidCharge(request("POST", {
    reason: "Correcao de teste", idempotencyKey: "cancel-new",
  }), CHARGE_ID)).status, 403);

  const saulo = handlersFor(SAULO_ID);
  assert.equal((await saulo.handlers.deleteDraftCharge(request("DELETE", {}), CHARGE_ID)).status, 400);
  assert.equal((await saulo.handlers.deleteDraftCharge(request("DELETE", { confirmation: "EXCLUIR_RASCUNHO" }), CHARGE_ID)).status, 200);
  const cancelled = await saulo.handlers.cancelPaidCharge(request("POST", {
    reason: "Correcao de teste", idempotencyKey: "cancel-replay",
  }), CHARGE_ID);
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).replayed, true);
});

test("comprovante privado nega Maria e entrega binario protegido apenas a Saulo", async () => {
  const maria = handlersFor(MARIA_ID);
  const denied = await maria.handlers.getPrivateProof(request("GET"), RECEIPT_ID);
  assert.equal(denied.status, 403);
  assert.doesNotMatch(await denied.text(), /PDF|sha256|storage|bytes/iu);

  const saulo = handlersFor(SAULO_ID);
  const allowed = await saulo.handlers.getPrivateProof(request("GET"), RECEIPT_ID);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("content-type"), "application/pdf");
  assert.equal(allowed.headers.get("cache-control"), "private, no-store");
  assert.equal(allowed.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await allowed.arrayBuffer()), Uint8Array.from([37, 80, 68, 70, 45]));
});
