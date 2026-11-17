import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { Prisma, type PaymentMethodType } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { BUILT_IN_IDS } from "@/modules/permissions";
import { assertCpfAvailableForPerson, CpfOwnershipError } from "@/features/identity/cpf-ownership";

import type {
  ServiceReceiptCandidate,
  ServiceReceiptPaymentMethod,
  ServiceReceiptProviderKey,
} from "./contracts";
import { isValidCpf, onlyDigits } from "./issuer-configuration";
import { issuerConfigurationService } from "./issuer-configuration-service";
import {
  professionalServiceReceiptService,
  ProfessionalServiceReceiptServiceError,
} from "./service";

export type RegularizationIssueCode =
  | "CUSTOMER_CPF_REQUIRED_OR_INVALID"
  | "RECEIPT_SERIES_REQUIRED"
  | "ISSUER_CONFIGURATION_INCOMPLETE"
  | "PAYMENT_NOT_AVAILABLE"
  | "RECEIVING_CANCELLED";

export interface RegularizationIssue {
  readonly code: RegularizationIssueCode;
  readonly message: string;
  readonly correction: string;
}

export interface RegularizationOverview {
  readonly charge: {
    readonly id: string;
    readonly status: string;
    readonly amountDue: string;
    readonly receivedAmount: string;
    readonly createdAt: string;
    readonly financialEntryId: string | null;
  };
  readonly customer: {
    readonly patientId: string;
    readonly masterRecordId: string;
    readonly fullName: string;
    readonly clinicalCode: string;
    readonly cpfConfigured: boolean;
  };
  readonly provider: {
    readonly key: ServiceReceiptProviderKey;
    readonly name: string;
    readonly series: string | null;
  };
  readonly payment: {
    readonly id: string;
    readonly receivedAmount: string;
    readonly recordedAt: string;
    readonly method: PaymentMethodType;
    readonly financialSettlementId: string;
  } | null;
  readonly services: readonly {
    readonly id: string;
    readonly description: string;
    readonly serviceDate: string;
    readonly grossAmount: string;
  }[];
  readonly cancellation: {
    readonly auditEventId: string | null;
    readonly reason: string | null;
    readonly occurredAt: string | null;
    readonly actor: { readonly id: string; readonly fullName: string } | null;
  } | null;
  readonly receiptId: string | null;
  readonly issues: readonly RegularizationIssue[];
  readonly eligible: boolean;
  readonly managementAction: "DELETE_DRAFT" | "CANCEL_PAYMENT" | null;
}

type Context = Awaited<ReturnType<typeof loadContext>>;

const paymentMethodMap: Record<PaymentMethodType, ServiceReceiptPaymentMethod | null> = {
  CASH: "CASH",
  PIX: "PIX",
  DEBIT_CARD: "CARD",
  CREDIT_CARD: "CARD",
  BANK_TRANSFER: "BANK_TRANSFER",
  BANK_DEPOSIT: "BANK_TRANSFER",
  BOLETO: null,
  OTHER: null,
};

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function providerKey(provider: { type: string; userId: string | null }): ServiceReceiptProviderKey {
  if (provider.type === "LEGAL_ENTITY") return "ACADEMIA_SAULO_FITNESS";
  return provider.userId === BUILT_IN_IDS.users.sauloXavierVitorino
    ? "SAULO_XAVIER_VITORINO"
    : "MARIA_DE_LOURDES_GOMES";
}

function providerName(key: ServiceReceiptProviderKey): string {
  if (key === "ACADEMIA_SAULO_FITNESS") return "Academia Saulo Fitness";
  if (key === "SAULO_XAVIER_VITORINO") return "Saulo Xavier Vitorino";
  return "Maria de Lourdes Gomes";
}

async function loadContext(chargeId: string) {
  return prisma.professionalServiceCharge.findUnique({
    where: { id: chargeId },
    include: {
      legalProvider: { select: { id: true, type: true, userId: true } },
      financialEntry: { select: { id: true } },
      masterRecord: {
        select: {
          id: true,
          patient: { select: { id: true, fullName: true, clinicalCode: true, cpf: true } },
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          commercialUnit: { select: { code: true, commercialName: true } },
          executors: {
            include: {
              professionalRegistration: { select: { council: true, status: true } },
            },
          },
        },
      },
      payments: {
        orderBy: { recordedAt: "asc" },
        include: {
          allocations: true,
          financialSettlement: { include: { paymentMethod: { select: { type: true } } } },
          receipts: { where: { status: { not: "DRAFT" } }, select: { id: true } },
          refunds: { select: { amount: true } },
        },
      },
    },
  });
}

function activePayment(context: NonNullable<Context>) {
  return context.payments.find((payment) => payment.receipts.length === 0) ?? null;
}

function receivedTotal(context: NonNullable<Context>): Prisma.Decimal {
  return context.payments.reduce(
    (total, payment) => total.plus(payment.receivedAmount).minus(
      payment.refunds.reduce((refunded, refund) => refunded.plus(refund.amount), new Prisma.Decimal(0)),
    ),
    new Prisma.Decimal(0),
  );
}

export function regularizationIssues(input: {
  readonly validCustomerCpf: boolean;
  readonly hasSeries: boolean;
  readonly issuerComplete: boolean;
  readonly hasPayment: boolean;
  readonly chargeCancelled?: boolean;
}): readonly RegularizationIssue[] {
  const issues: RegularizationIssue[] = [];
  if (input.chargeCancelled) return [{
    code: "RECEIVING_CANCELLED",
    message: "Este recebimento foi cancelado.",
    correction: "O histórico foi preservado e nenhuma emissão pode ser realizada.",
  }];
  if (!input.validCustomerCpf) issues.push({
    code: "CUSTOMER_CPF_REQUIRED_OR_INVALID",
    message: "O CPF do cliente está ausente ou inválido.",
    correction: "Atualize o CPF no cadastro canônico do cliente.",
  });
  if (!input.hasSeries) issues.push({
    code: "RECEIPT_SERIES_REQUIRED",
    message: "A emissora ainda não possui série de recibos configurada.",
    correction: "Informe e salve uma série para a emissora, sem reutilizar numeração já emitida.",
  });
  if (!input.issuerComplete) issues.push({
    code: "ISSUER_CONFIGURATION_INCOMPLETE",
    message: "A configuração legal da emissora está incompleta ou inativa.",
    correction: "Complete os dados da emissora na configuração de emissores.",
  });
  if (!input.hasPayment) issues.push({
    code: "PAYMENT_NOT_AVAILABLE",
    message: "Não há pagamento disponível para esta emissão.",
    correction: "Confira o pagamento existente; a regularização não cria outro pagamento.",
  });
  return issues;
}

function protectionKey(): Buffer {
  const secret = process.env.PAYROLL_DATA_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error("PROTECTION_KEY_UNAVAILABLE");
  return createHash("sha256").update(secret).digest();
}

function protectText(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", protectionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function protectSnapshot(value: unknown) {
  const plaintext = JSON.stringify(value);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", protectionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: Uint8Array.from(Buffer.concat([iv, cipher.getAuthTag(), encrypted])),
    sha256: createHash("sha256").update(plaintext).digest("hex"),
  };
}

async function authorizedContext(chargeId: string, actorUserId: string) {
  await professionalServiceReceiptService.getCharge(chargeId, actorUserId);
  const context = await loadContext(chargeId);
  if (!context) throw new ProfessionalServiceReceiptServiceError("NOT_FOUND", "Cobrança não encontrada.");
  return context;
}

async function configuredSeries(context: NonNullable<Context>) {
  return prisma.professionalServiceReceiptSeries.findFirst({
    where: { legalProviderId: context.legalProvider.id },
    orderBy: { createdAt: "asc" },
    select: { code: true, nextSequence: true },
  });
}

export const professionalReceiptRegularizationService = {
  async overview(chargeId: string, actorUserId: string): Promise<RegularizationOverview> {
    const context = await authorizedContext(chargeId, actorUserId);
    const key = providerKey(context.legalProvider);
    const [series, issuerConfiguration, cancellationAudit] = await Promise.all([
      configuredSeries(context),
      issuerConfigurationService.getConfiguration(BUILT_IN_IDS.users.sauloXavierVitorino),
      context.status === "CANCELLED" ? prisma.auditEvent.findFirst({
        where: { entityType: "ProfessionalServiceChargeCancellation", entityId: context.id },
        orderBy: { occurredAt: "desc" },
        select: {
          id: true,
          reason: true,
          occurredAt: true,
          changedBy: { select: { id: true, fullName: true } },
        },
      }) : Promise.resolve(null),
    ]);
    const issuer = key === "ACADEMIA_SAULO_FITNESS"
      ? issuerConfiguration.academy
      : key === "SAULO_XAVIER_VITORINO" ? issuerConfiguration.saulo : issuerConfiguration.maria;
    const payment = activePayment(context);
    const existingReceipt = context.payments.flatMap((item) => item.receipts)[0]?.id ?? null;
    const issues = existingReceipt ? [] : regularizationIssues({
      validCustomerCpf: isValidCpf(context.masterRecord.patient.cpf ?? ""),
      hasSeries: Boolean(series),
      issuerComplete: issuer.status === "COMPLETE",
      hasPayment: Boolean(payment),
      chargeCancelled: context.status === "CANCELLED",
    });
    return {
      charge: {
        id: context.id,
        status: context.status,
        amountDue: money(context.amountDue),
        receivedAmount: money(receivedTotal(context)),
        createdAt: context.createdAt.toISOString(),
        financialEntryId: context.financialEntry?.id ?? null,
      },
      customer: {
        patientId: context.masterRecord.patient.id,
        masterRecordId: context.masterRecord.id,
        fullName: context.masterRecord.patient.fullName,
        clinicalCode: context.masterRecord.patient.clinicalCode,
        cpfConfigured: isValidCpf(context.masterRecord.patient.cpf ?? ""),
      },
      provider: { key, name: providerName(key), series: series?.code ?? null },
      payment: payment ? {
        id: payment.id,
        receivedAmount: money(payment.receivedAmount),
        recordedAt: payment.recordedAt.toISOString(),
        method: payment.financialSettlement.paymentMethod.type,
        financialSettlementId: payment.financialSettlement.id,
      } : null,
      services: context.items.map((item) => ({
        id: item.id,
        description: item.description,
        serviceDate: item.serviceDate.toISOString(),
        grossAmount: money(item.grossAmount),
      })),
      cancellation: context.status === "CANCELLED" ? {
        auditEventId: cancellationAudit?.id ?? null,
        reason: cancellationAudit?.reason ?? null,
        occurredAt: cancellationAudit?.occurredAt.toISOString() ?? null,
        actor: cancellationAudit?.changedBy ?? null,
      } : null,
      receiptId: existingReceipt,
      issues,
      eligible: !existingReceipt && issues.length === 0,
      managementAction: actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino ? null
        : context.status === "OPEN" && context.payments.length === 0 ? "DELETE_DRAFT"
          : !existingReceipt && ["PAID", "PARTIALLY_PAID"].includes(context.status) && context.payments.length > 0
            ? "CANCEL_PAYMENT"
            : null,
    };
  },

  async updateCustomerCpf(chargeId: string, cpf: string, actorUserId: string) {
    if (actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) {
      throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Somente Saulo pode alterar o cadastro canônico do cliente.");
    }
    const context = await authorizedContext(chargeId, actorUserId);
    if (context.status === "CANCELLED") {
      throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Recebimento cancelado nao pode emitir recibo.");
    }
    const normalized = onlyDigits(cpf);
    if (!isValidCpf(normalized)) {
      throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Informe um CPF válido; nenhum valor foi salvo.");
    }
    try {
      await prisma.$transaction(async (transaction) => {
        await assertCpfAvailableForPerson(
          normalized,
          { patientId: context.masterRecord.patient.id },
          transaction,
        );
        await transaction.patient.update({
          where: { id: context.masterRecord.patient.id },
          data: { cpf: normalized, updatedByUserId: actorUserId },
        });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof CpfOwnershipError) {
        throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", error.message);
      }
      throw error;
    }
    return this.overview(chargeId, actorUserId);
  },

  async configureSeries(chargeId: string, series: string, actorUserId: string) {
    if (actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) {
      throw new ProfessionalServiceReceiptServiceError("NOT_AUTHORIZED", "Somente Saulo pode configurar a série da emissora.");
    }
    const context = await authorizedContext(chargeId, actorUserId);
    const code = series.trim().toUpperCase();
    if (!/^[A-Z0-9._/-]{1,40}$/u.test(code)) {
      throw new ProfessionalServiceReceiptServiceError("INVALID_INPUT", "Informe uma série de até 40 caracteres usando letras, números, ponto, barra, hífen ou sublinhado.");
    }
    const existing = await configuredSeries(context);
    if (existing && existing.code !== code) {
      throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "A emissora já possui uma série. A regularização não substitui uma série existente.");
    }
    await prisma.professionalServiceReceiptSeries.upsert({
      where: { legalProviderId_code: { legalProviderId: context.legalProvider.id, code } },
      create: { legalProviderId: context.legalProvider.id, code },
      update: {},
    });
    return this.overview(chargeId, actorUserId);
  },

  async retryIssuance(chargeId: string, actorUserId: string) {
    const context = await authorizedContext(chargeId, actorUserId);
    const overview = await this.overview(chargeId, actorUserId);
    if (overview.receiptId) return { receiptId: overview.receiptId, replayed: true };
    if (!overview.eligible) {
      throw new ProfessionalServiceReceiptServiceError(
        "VALIDATION_FAILED",
        overview.issues.map((issue) => issue.message).join(" "),
      );
    }
    const payment = activePayment(context);
    const series = await configuredSeries(context);
    if (!payment || !series) throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "A regularização ainda possui pendências.");
    const method = paymentMethodMap[payment.financialSettlement.paymentMethod.type];
    if (!method) throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "A forma do pagamento existente não é compatível com recibos profissionais.");
    const key = providerKey(context.legalProvider);
    const priorAmount = context.payments
      .filter((item) => item.recordedAt < payment.recordedAt)
      .reduce((total, item) => total.plus(item.receivedAmount), new Prisma.Decimal(0));
    const allocationByItem = new Map(payment.allocations.map((allocation) => [allocation.chargeItemId, money(allocation.amount)]));
    const candidate: ServiceReceiptCandidate = {
      legalProvider: key === "ACADEMIA_SAULO_FITNESS"
        ? { key, providerType: "LEGAL_ENTITY" }
        : { key, providerType: "INDIVIDUAL", fullName: providerName(key) },
      customerMasterRecordId: context.masterRecord.id,
      items: context.items.map((item) => ({
        serviceReferenceId: item.id,
        kind: item.kind,
        soldByProviderKey: key,
        legalProviderKey: key,
        ...(item.commercialUnit ? {
          commercialUnit: {
            unit: item.commercialUnit.code as "CLINICA_SV" | "ACADEMIA_SAULO_FITNESS",
            commercialName: item.commercialUnit.commercialName,
            ...(item.commercialUnit.code === "CLINICA_SV" ? { legalProviderKey: "ACADEMIA_SAULO_FITNESS" as const } : {}),
          },
        } : {}),
        executors: item.executors.map((executor) => ({
          userId: executor.professionalUserId,
          professionalRegistration: executor.professionalRegistration.council,
          professionalRegistrationStatus: executor.professionalRegistration.status,
          performedActivity: executor.performedActivity,
        })),
        grossAmount: money(item.grossAmount),
      })),
      totals: {
        subtotal: money(context.subtotal),
        discount: money(context.discount),
        surcharge: money(context.surcharge),
        amountDue: money(context.amountDue),
      },
      payment: {
        method,
        receivedByProviderKey: key,
        receivedAmount: money(payment.receivedAmount),
        previouslyReceivedAmount: priorAmount.toFixed(2),
        transactionReference: payment.transactionReference ?? undefined,
        allocations: context.items.flatMap((item) => {
          const amount = allocationByItem.get(item.id);
          return amount ? [{ serviceReferenceId: item.id, amount }] : [];
        }),
      },
      numbering: { series: series.code, sequence: series.nextSequence },
      signature: { mode: "MANUAL", signingProviderKey: key, includeManualSignatureSpace: true },
      privacy: { customerCpfOnDocument: "MASKED" },
      operatorUserId: actorUserId,
    };
    const enrichedCandidate = await professionalServiceReceiptService.prepareIssuanceCandidate(candidate);
    const cpf = onlyDigits(context.masterRecord.patient.cpf ?? "");
    const validationContext = {
      customerIdentity: { masterRecordId: context.masterRecord.id, cpf },
      numbering: { seriesProviderKey: key, sequencePreviouslyUsed: false },
    };
    const snapshot = protectSnapshot(enrichedCandidate);
    const stableRequest = { candidate: enrichedCandidate, validationContext, paymentId: payment.id };
    const receipt = await professionalServiceReceiptService.issueReceipt({
      candidate: enrichedCandidate,
      validationContext,
      paymentId: payment.id,
      customerCpfHash: createHash("sha256").update(cpf).digest("hex"),
      customerCpfEncrypted: protectText(cpf),
      snapshotPayloadSha256: snapshot.sha256,
      snapshotPayloadCiphertext: snapshot.ciphertext,
      snapshotSchemaVersion: 1,
      snapshotEncryptionVersion: 1,
      idempotencyKey: `regularize-receipt-${payment.id}`,
      requestSha256: createHash("sha256").update(JSON.stringify(stableRequest)).digest("hex"),
    });
    return { receiptId: receipt.id, replayed: receipt.replayed };
  },
};
