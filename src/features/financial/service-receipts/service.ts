import { randomUUID } from "node:crypto";

import { BUILT_IN_IDS } from "@/modules/permissions";

import type {
  ServiceReceiptCandidate,
  ServiceReceiptItemCandidate,
  ServiceReceiptPaymentMethod,
  ServiceReceiptProofCandidate,
  ServiceReceiptProviderKey,
  ServiceReceiptTotalsCandidate,
} from "./contracts";
import {
  areExecutorsAllowedForService,
  calculateServiceReceiptPaymentState,
  canPerformServiceReceiptAction,
  canReadServiceReceiptProof,
  isCommercialUnitAllowed,
  isProviderAllowedForService,
  serviceReceiptMoneyToCents,
} from "./domain-rules";
import {
  validateServiceReceiptCancellation,
  validateServiceReceiptRefund,
} from "./lifecycle";
import { validatePaymentAllocations } from "./persistence-rules";
import { validateServiceReceiptProof } from "./proof-file";
import {
  professionalServiceReceiptRepository,
  type PersistedCharge,
  type ProfessionalReceiptListStatus,
  type ProfessionalServiceReceiptRepository,
} from "./repository";
import {
  validateServiceReceiptCandidate,
  type ServiceReceiptValidationContext,
} from "./validation";
import {
  issuerConfigurationService,
  type createIssuerConfigurationService,
} from "./issuer-configuration-service";

export type ProfessionalServiceReceiptServiceErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "NOT_AUTHORIZED"
  | "VALIDATION_FAILED";

export class ProfessionalServiceReceiptServiceError extends Error {
  constructor(
    readonly code: ProfessionalServiceReceiptServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProfessionalServiceReceiptServiceError";
  }
}

export interface RegisterProfessionalServiceChargeInput {
  readonly providerKey: ServiceReceiptProviderKey;
  readonly masterRecordId: string;
  readonly financialEntryId?: string | null;
  readonly totals: ServiceReceiptTotalsCandidate;
  readonly items: readonly (ServiceReceiptItemCandidate & {
    readonly description: string;
    readonly serviceDate: string;
    readonly masterRecordEntryId?: string | null;
  })[];
  readonly actorUserId: string;
}

export interface RecordProfessionalServicePaymentInput {
  readonly chargeId: string;
  readonly providerKey: ServiceReceiptProviderKey;
  readonly financialSettlementId?: string;
  readonly method: ServiceReceiptPaymentMethod;
  readonly receivedAmount: string;
  readonly transactionReference?: string;
  readonly allocations: readonly { readonly chargeItemId: string; readonly amount: string }[];
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly actorUserId: string;
  readonly proof?: ServiceReceiptProofCandidate;
}

export interface IssueProfessionalServiceReceiptInput {
  readonly candidate: ServiceReceiptCandidate;
  readonly validationContext: ServiceReceiptValidationContext;
  readonly paymentId: string;
  readonly customerCpfHash: string;
  readonly customerCpfEncrypted: string;
  readonly snapshotPayloadSha256: string;
  readonly snapshotPayloadCiphertext: Uint8Array;
  readonly snapshotSchemaVersion: number;
  readonly snapshotEncryptionVersion: number;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly replacesReceiptId?: string | null;
  readonly issuedAt?: Date;
}

export interface RefundProfessionalServiceReceiptInput {
  readonly receiptId: string;
  readonly originalPaymentId: string;
  readonly financialSettlementId: string;
  readonly amount: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly actorUserId: string;
}

export interface CancelPaidProfessionalServiceChargeInput {
  readonly chargeId: string;
  readonly actorUserId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
}

export interface ListProfessionalServiceReceiptsInput {
  readonly query?: string;
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly providerKey?: ServiceReceiptProviderKey;
  readonly status?: ProfessionalReceiptListStatus;
  readonly page?: number;
  readonly pageSize?: number;
  readonly actorUserId: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", `${field} e obrigatorio.`);
  return normalized;
}

function requestMetadata(idempotencyKey: string, requestSha256: string) {
  const key = required(idempotencyKey, "Chave de idempotencia");
  if (key.length > 120 || !SHA256_PATTERN.test(requestSha256)) {
    throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Metadados de idempotencia invalidos.");
  }
  return { key, requestSha256 };
}

function assertCanRegister(actorUserId: string, providerKey: ServiceReceiptProviderKey, items: readonly ServiceReceiptItemCandidate[]) {
  const context = {
    legalProviderKey: providerKey,
    serviceKinds: items.map((item) => item.kind),
    executorUserIds: items.flatMap((item) => item.executors.map((executor) => executor.userId)),
    activeProfessionalCouncils: items.flatMap((item) => item.executors
      .filter((executor) => executor.userId === actorUserId && executor.professionalRegistrationStatus === "ACTIVE")
      .map((executor) => executor.professionalRegistration)),
  };
  if (!canPerformServiceReceiptAction(actorUserId, "REGISTER", context)) {
    throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Usuario sem permissao para registrar a operacao.");
  }
}

function validateCharge(input: RegisterProfessionalServiceChargeInput) {
  if (!input.items.length) throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Inclua ao menos um servico.");
  let subtotal = BigInt(0);
  const references = new Set<string>();
  for (const item of input.items) {
    required(item.serviceReferenceId, "Referencia do servico");
    required(item.description, "Descricao do servico");
    if (references.has(item.serviceReferenceId)) throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Referencia de servico duplicada.");
    references.add(item.serviceReferenceId);
    if (!DATE_PATTERN.test(item.serviceDate)) throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Data do servico invalida.");
    if (item.legalProviderKey !== input.providerKey || item.soldByProviderKey !== input.providerKey) {
      throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Prestador do servico divergente.");
    }
    if (!isProviderAllowedForService(input.providerKey, item.kind)
      || !isCommercialUnitAllowed(input.providerKey, item.kind, item.commercialUnit?.unit)
      || !areExecutorsAllowedForService(item)) {
      throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Servico, unidade ou executor invalido.");
    }
    subtotal += serviceReceiptMoneyToCents(item.grossAmount);
  }
  const declaredSubtotal = serviceReceiptMoneyToCents(input.totals.subtotal);
  const discount = serviceReceiptMoneyToCents(input.totals.discount);
  const surcharge = serviceReceiptMoneyToCents(input.totals.surcharge);
  const due = serviceReceiptMoneyToCents(input.totals.amountDue);
  if (subtotal !== declaredSubtotal || discount > subtotal || subtotal - discount + surcharge !== due || due <= BigInt(0)) {
    throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Totais da cobranca invalidos.");
  }
  assertCanRegister(input.actorUserId, input.providerKey, input.items);
}

function assertChargeProvider(charge: PersistedCharge, providerKey: ServiceReceiptProviderKey) {
  if (charge.provider.key !== providerKey) {
    throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Cobranca pertence a outro prestador legal.");
  }
}

function idempotentReplay<T extends { readonly requestSha256: string }>(
  record: T | null,
  requestSha256: string,
): T | null {
  if (record && record.requestSha256 !== requestSha256) {
    throw new ProfessionalServiceReceiptServiceError(
      "VALIDATION_FAILED",
      "A chave de idempotencia pertence a outra requisicao.",
    );
  }
  return record;
}

export function createProfessionalServiceReceiptService(
  repository: ProfessionalServiceReceiptRepository = professionalServiceReceiptRepository,
  issuerConfiguration?: ReturnType<typeof createIssuerConfigurationService>,
) {
  return {
    async listReceipts(input: ListProfessionalServiceReceiptsInput) {
      const isSaulo = input.actorUserId === BUILT_IN_IDS.users.sauloXavierVitorino;
      const isMaria = input.actorUserId === BUILT_IN_IDS.users.mariaDeLourdesGomes;
      if (!isSaulo && !isMaria) {
        throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Usuario sem permissao para consultar recibos.");
      }
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 20;
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Paginacao invalida.");
      }
      if ((input.periodStart && !DATE_PATTERN.test(input.periodStart))
        || (input.periodEnd && !DATE_PATTERN.test(input.periodEnd))
        || (input.periodStart && input.periodEnd && input.periodEnd < input.periodStart)) {
        throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Periodo invalido.");
      }
      const query = input.query?.trim();
      const result = await repository.listReceipts({
        query: query || undefined,
        periodStart: input.periodStart ? new Date(`${input.periodStart}T00:00:00.000Z`) : undefined,
        periodEndExclusive: input.periodEnd
          ? new Date(new Date(`${input.periodEnd}T00:00:00.000Z`).getTime() + 86_400_000)
          : undefined,
        providerKey: input.providerKey,
        status: input.status,
        page,
        pageSize,
        visibility: isSaulo ? "ALL" : "MARIA_PHYSICAL_EDUCATION",
      });
      return {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          managementAction: !isSaulo ? null
            : item.receiptId && item.status === "ISSUED" ? "CANCEL_RECEIPT" as const
              : !item.receiptId && item.status === "DRAFT" && item.paymentCount === 0 ? "DELETE_DRAFT" as const
                : !item.receiptId && ["PAID", "PARTIALLY_PAID"].includes(item.status) && item.paymentCount > 0
                  ? "CANCEL_PAYMENT" as const
                  : null,
        })),
      };
    },

    async getCharge(chargeId: string, actorUserId: string) {
      const charge = await repository.findCharge(required(chargeId, "Cobranca"));
      if (!charge) throw new ProfessionalServiceReceiptServiceError("NOT_FOUND", "Cobranca nao encontrada.");
      if (!canPerformServiceReceiptAction(actorUserId, "READ", charge.authorization)) {
        throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Usuario sem permissao para consultar a cobranca.");
      }
      return charge;
    },

    assessIssuanceCandidate(
      candidate: ServiceReceiptCandidate,
      validationContext: ServiceReceiptValidationContext,
      actorUserId: string,
    ) {
      const serverCandidate = { ...candidate, operatorUserId: actorUserId };
      const issues = validateServiceReceiptCandidate(serverCandidate, validationContext);
      return {
        eligible: issues.length === 0,
        issues: issues.map((issue) => ({ code: issue.code, message: issue.message })),
      };
    },

    async prepareIssuanceCandidate(candidate: ServiceReceiptCandidate) {
      return issuerConfiguration ? issuerConfiguration.enrichCandidate(candidate) : candidate;
    },

    async getReceiptDetails(receiptId: string, actorUserId: string) {
      const details = await repository.findReceiptDetails(required(receiptId, "Recibo"));
      if (!details) throw new ProfessionalServiceReceiptServiceError("NOT_FOUND", "Recibo nao encontrado.");
      if (!canPerformServiceReceiptAction(actorUserId, "READ", details.charge.authorization)) {
        throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Usuario sem permissao para consultar o recibo.");
      }
      return details;
    },

    async getPrivateProof(receiptId: string, actorUserId: string) {
      const proof = await repository.findPrivateProof(required(receiptId, "Recibo"));
      if (!proof) throw new ProfessionalServiceReceiptServiceError("NOT_FOUND", "Comprovante nao encontrado.");
      if (!canReadServiceReceiptProof(actorUserId, proof.charge.authorization)) {
        throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Usuario sem permissao para consultar o comprovante.");
      }
      return proof;
    },

    async registerCharge(input: RegisterProfessionalServiceChargeInput) {
      validateCharge(input);
      const provider = await repository.resolveProvider(input.providerKey);
      return repository.registerCharge({
        provider,
        masterRecordId: required(input.masterRecordId, "Cadastro mestre"),
        financialEntryId: input.financialEntryId,
        ...input.totals,
        actorUserId: required(input.actorUserId, "Operador"),
        items: input.items.map((item) => ({
          id: randomUUID(),
          serviceReferenceId: item.serviceReferenceId,
          kind: item.kind,
          description: item.description.trim(),
          serviceDate: new Date(`${item.serviceDate}T00:00:00.000Z`),
          grossAmount: item.grossAmount,
          commercialUnit: item.commercialUnit?.unit,
          masterRecordEntryId: item.masterRecordEntryId,
          executors: item.executors.map((executor) => ({
            userId: executor.userId,
            council: executor.professionalRegistration,
            performedActivity: executor.performedActivity.trim(),
          })),
        })),
      });
    },

    async recordPayment(input: RecordProfessionalServicePaymentInput) {
      const metadata = requestMetadata(input.idempotencyKey, input.requestSha256);
      const replay = idempotentReplay(
        await repository.findPaymentByIdempotencyKey(metadata.key),
        metadata.requestSha256,
      );
      if (replay) return replay;
      const charge = await repository.findCharge(required(input.chargeId, "Cobranca"));
      if (!charge) throw new ProfessionalServiceReceiptServiceError("NOT_FOUND", "Cobranca nao encontrada.");
      assertChargeProvider(charge, input.providerKey);
      if (charge.status === "CANCELLED") {
        throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Cobranca cancelada nao aceita pagamento.");
      }
      if (!canPerformServiceReceiptAction(input.actorUserId, "REGISTER", charge.authorization)) {
        throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Usuario sem permissao para registrar pagamento.");
      }
      const itemIds = new Set(charge.items.map((item) => item.id));
      if (input.allocations.some((allocation) => !itemIds.has(allocation.chargeItemId))) {
        throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Alocacao aponta para item de outra cobranca.");
      }
      validatePaymentAllocations({
        receivedAmount: input.receivedAmount,
        allocations: input.allocations.map((allocation) => allocation.amount),
      });
      calculateServiceReceiptPaymentState(
        {
          subtotal: charge.subtotal,
          discount: charge.discount,
          surcharge: charge.surcharge,
          amountDue: charge.amountDue,
        },
        {
          method: input.method,
          receivedByProviderKey: input.providerKey,
          receivedAmount: input.receivedAmount,
          previouslyReceivedAmount: charge.previouslyReceivedAmount,
          transactionReference: input.transactionReference,
          allocations: input.allocations.map((allocation) => ({
            serviceReferenceId: allocation.chargeItemId,
            amount: allocation.amount,
          })),
        },
      );
      const proof = input.proof ? validateServiceReceiptProof(input.method, input.proof) : undefined;
      const paymentId = randomUUID();
      return repository.recordPayment({
        id: paymentId,
        charge,
        financialSettlementId: input.financialSettlementId,
        method: input.method,
        receivedAmount: input.receivedAmount,
        transactionReference: input.transactionReference?.trim() || null,
        idempotencyKey: metadata.key,
        requestSha256: metadata.requestSha256,
        actorUserId: input.actorUserId,
        allocations: input.allocations,
        proof: proof ? {
          id: randomUUID(),
          storageKey: `professional-service-payments/${paymentId}/${proof.sha256}`,
          ...proof,
        } : undefined,
      });
    },

    async issueReceipt(input: IssueProfessionalServiceReceiptInput) {
      const metadata = requestMetadata(input.idempotencyKey, input.requestSha256);
      const replay = idempotentReplay(
        await repository.findReceiptByIdempotencyKey(metadata.key),
        metadata.requestSha256,
      );
      if (replay) return replay;
      const candidate = issuerConfiguration
        ? await issuerConfiguration.enrichCandidate(input.candidate)
        : input.candidate;
      const issues = validateServiceReceiptCandidate(candidate, input.validationContext);
      if (issues.length) {
        throw new ProfessionalServiceReceiptServiceError(
          "VALIDATION_FAILED",
          issues.map((issue) => issue.code).join(","),
        );
      }
      if (!SHA256_PATTERN.test(input.customerCpfHash) || !input.customerCpfEncrypted.trim()
        || !SHA256_PATTERN.test(input.snapshotPayloadSha256)
        || !input.snapshotPayloadCiphertext.byteLength
        || input.snapshotSchemaVersion < 1 || input.snapshotEncryptionVersion < 1) {
        throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Dados protegidos ou snapshot invalidos.");
      }
      const provider = await repository.resolveProvider(candidate.legalProvider.key);
      const paymentState = calculateServiceReceiptPaymentState(candidate.totals, candidate.payment);
      return repository.issueReceipt({
        id: randomUUID(),
        provider,
        paymentId: required(input.paymentId, "Pagamento"),
        seriesCode: candidate.numbering.series.trim(),
        expectedSequence: candidate.numbering.sequence,
        receivedAmount: candidate.payment.receivedAmount,
        remainingBalance: (paymentState.remainingBalanceInCents / BigInt(100)).toString()
          + `.${(paymentState.remainingBalanceInCents % BigInt(100)).toString().padStart(2, "0")}`,
        partialPayment: paymentState.isPartialPayment,
        customerCpfHash: input.customerCpfHash,
        customerCpfEncrypted: input.customerCpfEncrypted,
        customerCpfVisibility: candidate.privacy.customerCpfOnDocument,
        signatureMode: candidate.signature.mode,
        electronicSignatureReference: candidate.signature.electronicSignatureReference,
        manualSignatureSpace: candidate.signature.includeManualSignatureSpace,
        idempotencyKey: metadata.key,
        requestSha256: metadata.requestSha256,
        snapshotPayloadSha256: input.snapshotPayloadSha256,
        snapshotPayloadCiphertext: Uint8Array.from(input.snapshotPayloadCiphertext),
        snapshotSchemaVersion: input.snapshotSchemaVersion,
        snapshotEncryptionVersion: input.snapshotEncryptionVersion,
        replacesReceiptId: input.replacesReceiptId,
        actorUserId: candidate.operatorUserId,
        issuedAt: input.issuedAt ?? new Date(),
      });
    },

    async cancelReceipt(receiptId: string, actorUserId: string, reason: string) {
      const receipt = await repository.findReceipt(required(receiptId, "Recibo"));
      if (!receipt) throw new ProfessionalServiceReceiptServiceError("NOT_FOUND", "Recibo nao encontrado.");
      if (receipt.status === "CANCELLED") {
        if (actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino || !reason.trim()) {
          throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Somente Saulo pode cancelar recibos.");
        }
        return repository.cancelReceipt(receipt.id, actorUserId, reason.trim());
      }
      validateServiceReceiptCancellation({
        receipt: {
          id: receipt.id,
          legalProviderKey: receipt.provider.key,
          status: receipt.status === "ISSUED" ? "ISSUED" : "CANCELLED",
          series: receipt.series,
          sequence: receipt.sequence,
        },
        actorUserId,
        reason,
      });
      return repository.cancelReceipt(receipt.id, actorUserId, reason.trim());
    },

    async deleteDraftCharge(chargeId: string, actorUserId: string) {
      if (actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) {
        throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Somente Saulo pode excluir rascunhos.");
      }
      return repository.deleteDraftCharge(required(chargeId, "Cobranca"));
    },

    async cancelPaidCharge(input: CancelPaidProfessionalServiceChargeInput) {
      if (input.actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) {
        throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Somente Saulo pode cancelar recebimentos.");
      }
      const reason = input.reason.trim();
      if (!reason || reason.length > 500) {
        throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Informe um motivo de cancelamento com ate 500 caracteres.");
      }
      const metadata = requestMetadata(input.idempotencyKey, input.requestSha256);
      return repository.cancelPaidCharge({
        chargeId: required(input.chargeId, "Cobranca"),
        actorUserId: input.actorUserId,
        reason,
        idempotencyKey: metadata.key,
        requestSha256: metadata.requestSha256,
      });
    },

    async refundReceipt(input: RefundProfessionalServiceReceiptInput) {
      const metadata = requestMetadata(input.idempotencyKey, input.requestSha256);
      const receipt = await repository.findReceipt(required(input.receiptId, "Recibo"));
      if (!receipt) throw new ProfessionalServiceReceiptServiceError("NOT_FOUND", "Recibo nao encontrado.");
      if (receipt.paymentId !== input.originalPaymentId) {
        throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Pagamento original divergente.");
      }
      validateServiceReceiptRefund({
        originalPaymentReferenceId: input.originalPaymentId,
        actorUserId: input.actorUserId,
        amount: input.amount,
        reason: input.reason,
      });
      return repository.refundReceipt({
        id: randomUUID(),
        receipt,
        originalPaymentId: input.originalPaymentId,
        financialSettlementId: required(input.financialSettlementId, "Liquidacao de estorno"),
        amount: input.amount,
        reason: input.reason.trim(),
        idempotencyKey: metadata.key,
        requestSha256: metadata.requestSha256,
        actorUserId: input.actorUserId,
      });
    },
  };
}

export const professionalServiceReceiptService = createProfessionalServiceReceiptService(
  professionalServiceReceiptRepository,
  issuerConfigurationService,
);
